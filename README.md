
# 🐍 GitHub Profile Stats & Contribution Snake Dashboard

An elegant, immersive dashboard designed to visualize your real GitHub contributions graph through a live, interactive **Snake arcade game**. Watch the snake slither across your contribution grid, consuming commits to grow longer, or take control manually to play on your own timeline stats!

---

## 🚀 Key Features

* **Interactive Canvas Snake Simulator**: High-performance arcade engine rendering directly onto an HTML5 canvas, supporting responsive frame rates, and smooth vector tail scaling.
* **Auto-Pilot Pathfinding (AI)**: An autonomous AI agent calculates real-time paths to seek out and devour your highest commit days first.
* **Manual Joystick Control**: Take direct control of the snake using **W A S D** or **Arrow Keys** to steer around your contribution graph with wrap-around warp boundaries.
* **Contribution Analytics**: Real-time evaluation of your Git metrics, including total repositories, total star counts, current contribution streaks, longest contribution streaks, and language spectrum.
* **Immersive Dark UI Theme**: Premium tech-forward twilight layout pairing Inter typography, neon accents, and responsive bento grid components.
* **Markdown README Generator**: High-speed copyable GitHub Actions workflow yaml and markdown snippets to deploy the live crawling snake onto your GitHub Profile profile.

---

## 🔒 How to Show Private Contributions

By default, GitHub's public API only exposes commits made in public repositories. If you want your private contributions to appear on this stats dashboard and in your snake game, follow these quick steps:

1. Go to your **GitHub Profile page** (e.g. `https://github.com/RKPROGRAMMING10K`).
2. Above your contribution calendar grid, click on the **Contribution settings** dropdown menu on the top-right of the graph.
3. Check the option **Private contributions** (or *"Show private contributions"*).
4. Once enabled, our server-side scraper and the official GitHub API will securely include those anonymous counts into your grid metrics and streak calculations!

---

## 🛠️ Step-by-Step GitHub Profile Embed Setup

To integrate a dynamic, self-updating snake animation directly on your GitHub Profile page (`README.md`), follow this guided workflow:

### Step 1: Create a Profile Repository
Create a repository with the **exact same name** as your GitHub username. For example, if your username is `RKPROGRAMMING10K`, create a repository named `RKPROGRAMMING10K`. It must be setting-configured as **Public** and initialized with a **README.md** file.

### Step 2: Add the GitHub Action Workflow
Inside your new repository, create a directory path `.github/workflows/` and add a newline file named `generate-snake.yml` containing the following configuration:

```yaml
name: Generate Snake contribution graph

on:
  schedule:
    # Runs automatically every 24 hours
    - cron: "0 */24 * * *"
  workflow_dispatch:
  push:
    branches:
      - main

jobs:
  generate:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    
    steps:
      # Generates a snake game from a github user contributions graph
      - name: generate-snake-game
        uses: Platane/snk/svg-only@v3
        with:
          github_user_name: RKPROGRAMMING10K
          outputs: |
            dist/github-contribution-grid-snake.svg
            dist/github-contribution-grid-snake-dark.svg?palette=github-dark
          
      # Push the generated files to a dedicated output branch
      - name: push github-contribution-grid-snake.svg to the output branch
        uses: crazy-max/ghaction-github-pages@v3.1.0
        with:
          target_branch: output
          build_dir: dist
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Step 3: Embed in your Profile README
Open your profile repository's main `README.md` file and add the following Markdown anchor lines where you would like the snake to slither:

```markdown
### 🐍 My Contribution Slither!

[![GitHub Contribution Snake](https://raw.githubusercontent.com/RKPROGRAMMING10K/RKPROGRAMMING10K/output/github-contribution-grid-snake.svg)](https://github.com/RKPROGRAMMING10K)
```

---

## 📦 Project Setup & Local Development

### 1. Installation
Install the required application dependencies:
```bash
npm install
```

### 3. Spin up the Full-Stack Dev Server
Boot up both the Express API backend proxy & standard Vite HMR client simultaneously:
```bash
npm run dev
```
Navigate your browser to `http://localhost:3000` to start exploring.

---

## 🏷️ GitHub Integration Tag Specs

Add these tags to your profile repository configuration to boost visibility:
`github-profile`, `github-readme`, `snake-game`, `contribution-graph`, `interactive-dashboard`, `developer-analytics`, `tailwind-dark`, `html5-canvas`.

---

## 🛡️ License
Distributable under the Apache-2.0 License. See the application code tags for license indicators.
