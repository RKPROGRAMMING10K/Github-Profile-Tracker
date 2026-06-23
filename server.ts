import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route to fetch github stats
  app.get("/api/github/:username", async (req, res) => {
    const { username } = req.params;

    if (!username || typeof username !== "string" || username.trim() === "") {
      return res.status(400).json({ error: "Invalid username." });
    }

    const cleanUsername = username.trim();

    try {
      // 1. Fetch main profile data from GitHub API
      const userRes = await fetch(`https://api.github.com/users/${cleanUsername}`, {
        headers: {
          "User-Agent": "GitHub-Contribution-Snake-Explorer-App",
        }
      });

      if (userRes.status === 404) {
        return res.status(404).json({ error: "GitHub user not found." });
      }

      if (!userRes.ok) {
        throw new Error(`GitHub API returned status ${userRes.status}`);
      }

      const userData: any = await userRes.json();

      // 2. Fetch repositories for star counts & languages
      // We limit to 100 repositories to stay fast
      const reposRes = await fetch(`https://api.github.com/users/${cleanUsername}/repos?per_page=100&sort=updated`, {
        headers: {
          "User-Agent": "GitHub-Contribution-Snake-Explorer-App",
        }
      });

      let repos: any[] = [];
      if (reposRes.ok) {
        repos = await reposRes.json();
      }

      // Calculate total star count and language frequency
      let totalStars = 0;
      const languages: { [key: string]: number } = {};

      if (Array.isArray(repos)) {
        repos.forEach((repo) => {
          totalStars += repo.stargazers_count || 0;
          if (repo.language) {
            languages[repo.language] = (languages[repo.language] || 0) + 1;
          }
        });
      }

      const topLanguages = Object.entries(languages)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      // 3. Fetch scraped contributions HTML page
      let contributions: any[] = [];
      let totalContributions = 0;
      let isFallback = false;

      try {
        const contribRes = await fetch(`https://github.com/users/${cleanUsername}/contributions`, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          }
        });

        if (contribRes.ok) {
          const htmlContent = await contribRes.text();
          // Match class ContributionCalendar-day data-date="YYYY-MM-DD" data-level="L"
          const regex = /<(?:td|rect)\s+[^>]*?data-date="(\d{4}-\d{2}-\d{2})"[^>]*?data-level="(\d)"/g;
          let match;
          while ((match = regex.exec(htmlContent)) !== null) {
            const date = match[1];
            const level = parseInt(match[2], 10);
            contributions.push({
              date,
              level,
              count: level === 0 ? 0 : level === 1 ? 2 : level === 2 ? 5 : level === 3 ? 10 : 18,
            });
          }

          if (contributions.length === 0) {
            throw new Error("No contribution blocks found in scraping.");
          }

          totalContributions = contributions.reduce((acc, curr) => acc + curr.count, 0);
        } else {
          throw new Error(`Scraper failed with status ${contribRes.status}`);
        }
      } catch (scrapingErr) {
        console.warn(`Scraping failed for ${cleanUsername}, using seed fallback generator:`, scrapingErr);
        contributions = generateFallbackContributions(cleanUsername);
        totalContributions = contributions.reduce((acc, curr) => acc + curr.count, 0);
        isFallback = true;
      }

      // Calculate contribution streaks
      let currentStreak = 0;
      let longestStreak = 0;
      let tempStreak = 0;

      // Sort oldest to newest for streak calculation
      const sortedContribs = [...contributions].sort((a, b) => a.date.localeCompare(b.date));

      sortedContribs.forEach((day) => {
        if (day.level > 0) {
          tempStreak++;
          if (tempStreak > longestStreak) {
            longestStreak = tempStreak;
          }
        } else {
          tempStreak = 0;
        }
      });

      // Calculate current streak
      const reversedContribs = [...sortedContribs].reverse();
      const todayActive = reversedContribs[0] && reversedContribs[0].level > 0;
      const yesterdayActive = reversedContribs[1] && reversedContribs[1].level > 0;

      if (todayActive || yesterdayActive) {
        for (const day of reversedContribs) {
          if (day === reversedContribs[0] && day.level === 0) {
            continue;
          }
          if (day.level > 0) {
            currentStreak++;
          } else {
            break;
          }
        }
      }

      res.json({
        user: {
          login: userData.login,
          name: userData.name || userData.login,
          avatar_url: userData.avatar_url,
          bio: userData.bio || "No bio available.",
          location: userData.location,
          blog: userData.blog,
          created_at: userData.created_at,
          followers: userData.followers,
          following: userData.following,
          public_repos: userData.public_repos,
          public_gists: userData.public_gists,
          total_stars: totalStars,
          top_languages: topLanguages,
          repos: (Array.isArray(repos) ? repos : []).slice(0, 8).map((r: any) => ({
            name: r.name,
            description: r.description || "No description provided.",
            stargazers_count: r.stargazers_count,
            forks_count: r.forks_count,
            language: r.language,
            html_url: r.html_url,
          })),
        },
        contributions: sortedContribs,
        stats: {
          totalContributions,
          currentStreak,
          longestStreak,
          isFallback,
        }
      });

    } catch (apiErr: any) {
      console.error(apiErr);
      res.status(500).json({ error: "Something went wrong fetching GitHub data: " + apiErr.message });
    }
  });

  // Fallback seedable pseudo-random contribution generator
  function generateFallbackContributions(username: string) {
    const contributions = [];
    const today = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(today.getFullYear() - 1);

    let seed = 0;
    for (let i = 0; i < username.length; i++) {
      seed += username.charCodeAt(i);
    }

    const pseudoRandom = () => {
      const x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    };

    // Populate contributions over the last 365 days
    for (const d = new Date(oneYearAgo); d <= today; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split("T")[0];
      const rand = pseudoRandom();

      let level = 0;
      if (rand > 0.65) level = 1;
      if (rand > 0.82) level = 2;
      if (rand > 0.93) level = 3;
      if (rand > 0.97) level = 4;

      contributions.push({
        date: dateStr,
        level,
        count: level === 0 ? 0 : level === 1 ? Math.floor(pseudoRandom() * 3) + 1 : level === 2 ? Math.floor(pseudoRandom() * 3) + 4 : level === 3 ? Math.floor(pseudoRandom() * 3) + 7 : Math.floor(pseudoRandom() * 10) + 10,
      });
    }
    return contributions;
  }

  // Vite dev server vs production static asset serving setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
