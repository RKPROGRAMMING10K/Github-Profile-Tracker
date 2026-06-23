import React, { useState, useEffect, useRef, useCallback } from "react";
import { 
  Github, 
  Search, 
  Star, 
  GitFork, 
  Flame, 
  Calendar, 
  BookOpen, 
  MapPin, 
  Link as LinkIcon, 
  Users, 
  Award, 
  Play, 
  Pause, 
  RotateCcw, 
  Cpu, 
  Gamepad2, 
  Sliders, 
  TrendingUp, 
  Volume2, 
  VolumeX,
  Sparkles,
  Info
} from "lucide-react";

// Theme Palette based on "Immersive UI" template
// Base colors: bg-[#010409], secondary text: text-slate-400, borders: border-[#30363d], headers: bg-[#0d1117]


interface UserData {
  login: string;
  name: string;
  avatar_url: string;
  bio: string;
  location: string | null;
  blog: string | null;
  created_at: string;
  followers: number;
  following: number;
  public_repos: number;
  public_gists: number;
  total_stars: number;
  top_languages: { name: string; count: number }[];
  repos: {
    name: string;
    description: string;
    stargazers_count: number;
    forks_count: number;
    language: string | null;
    html_url: string;
  }[];
}

interface ContributionDay {
  date: string;
  level: number;
  count: number;
}

interface StatsData {
  totalContributions: number;
  currentStreak: number;
  longestStreak: number;
  isFallback: boolean;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
  size: number;
}

export default function App() {
  const [username, setUsername] = useState("RKPROGRAMMING10K"); // Default to Evan You (Vue creator) for immediate beauty
  const [searchInput, setSearchInput] = useState("");
  const [userData, setUserData] = useState<UserData | null>(null);
  const [contributions, setContributions] = useState<ContributionDay[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Snake Settings
  const [isManualMode, setIsManualMode] = useState(false); // false = Autopilot (AI hunts dots), true = Manual WASD controls
  const [isPlaying, setIsPlaying] = useState(true);
  const [snakeSpeed, setSnakeSpeed] = useState(100); // ms per step
  const [selectedSkin, setSelectedSkin] = useState("emerald"); // emerald, neon, amber, ruby, cyan
  const [soundEnabled, setSoundEnabled] = useState(false);

  // Snake Internal Engine State Ref (to avoid React re-render lag)
  const [isGameOver, setIsGameOver] = useState(false);
  const [gameScore, setGameScore] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Snake coordinates & movement states with refs
  const snakeRef = useRef<{ x: number; y: number }[]>([
    { x: 10, y: 3 },
    { x: 9, y: 3 },
    { x: 8, y: 3 },
    { x: 7, y: 3 },
    { x: 6, y: 3 },
  ]);
  const directionRef = useRef<{ x: number; y: number }>({ x: 1, y: 0 });
  const foodRef = useRef<{ x: number; y: number } | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const gridWidth = 53; // Columns
  const gridHeight = 7;   // Rows

  // Beep sound generator using Web Audio API
  const playSound = (type: "eat" | "gameover" | "click") => {
    if (!soundEnabled) return;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === "eat") {
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      } else if (type === "gameover") {
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.4);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      } else if (type === "click") {
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      }
    } catch (e) {
      console.warn("Audio Context block", e);
    }
  };

  // Convert contribution days linear array into a grid of columns
  const getContributionGrid = useCallback(() => {
    if (contributions.length === 0) return null;
    
    // Sort oldest first
    const sorted = [...contributions].sort((a, b) => a.date.localeCompare(b.date));
    
    // Build columns of 7 elements (Sunday to Saturday)
    const columns: ContributionDay[][] = [];
    let currentColumn: ContributionDay[] = [];
    
    sorted.forEach((day) => {
      currentColumn.push(day);
      if (currentColumn.length === 7) {
        columns.push(currentColumn);
        currentColumn = [];
      }
    });
    
    if (currentColumn.length > 0) {
      columns.push(currentColumn);
    }
    
    return columns;
  }, [contributions]);

  // Handle data fetching
  const fetchGitHubData = async (targetUser: string) => {
    if (!targetUser.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/github/${encodeURIComponent(targetUser.trim())}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Failed to fetch data (status ${res.status})`);
      }
      const data = await res.json();
      setUserData(data.user);
      setContributions(data.contributions);
      setStats(data.stats);

      // Re-trigger snake to find foods in new data
      resetGame(data.contributions);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  // Trigger search
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setUsername(searchInput.trim());
      fetchGitHubData(searchInput.trim());
    }
  };

  // On first load, perform a default lookup
  useEffect(() => {
    fetchGitHubData(username);
  }, []);

  // Set up Keyboard listener for WASD / Arrow keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isManualMode) return;
      const key = e.key.toLowerCase();
      const currDir = directionRef.current;

      let newDir = null;
      if (key === "arrowup" || key === "w") {
        if (currDir.y === 0) newDir = { x: 0, y: -1 };
      } else if (key === "arrowdown" || key === "s") {
        if (currDir.y === 0) newDir = { x: 0, y: 1 };
      } else if (key === "arrowleft" || key === "a") {
        if (currDir.x === 0) newDir = { x: -1, y: 0 };
      } else if (key === "arrowright" || key === "d") {
        if (currDir.x === 0) newDir = { x: 1, y: 0 };
      }

      if (newDir) {
        e.preventDefault();
        directionRef.current = newDir;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isManualMode]);

  // Find a suitable "active contribution cell" to act as target food
  const findNewFood = (currentContribs: ContributionDay[] = contributions) => {
    if (currentContribs.length === 0) {
      // Pick a random grid position
      foodRef.current = {
        x: Math.floor(Math.random() * gridWidth),
        y: Math.floor(Math.random() * gridHeight),
      };
      return;
    }

    // Attempt to locate an active contribution that is NOT underneath the snake
    const snakeBody = snakeRef.current;
    
    // Sort/filter contributions that are in the 53x7 visible frame
    // We map contributions index to row and column
    const candidates: { x: number; y: number }[] = [];
    
    for (let c = 0; c < 53; c++) {
      for (let r = 0; r < 7; r++) {
        const index = c * 7 + r;
        if (index < currentContribs.length) {
          const item = currentContribs[index];
          if (item && item.level > 0) {
            // Ensure no overlap with snake body
            const isColliding = snakeBody.some(p => p.x === c && p.y === r);
            if (!isColliding) {
              candidates.push({ x: c, y: r });
            }
          }
        }
      }
    }

    if (candidates.length > 0) {
      // Pick random active contribution
      const chosen = candidates[Math.floor(Math.random() * candidates.length)];
      foodRef.current = chosen;
    } else {
      // Fallback: fully random coordinate
      foodRef.current = {
        x: Math.floor(Math.random() * gridWidth),
        y: Math.floor(Math.random() * gridHeight),
      };
    }
  };

  // Spawns particles when a cell is eaten
  const spawnExplosion = (x: number, y: number, color: string) => {
    const numParticles = 16;
    for (let i = 0; i < numParticles; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 3.5;
      particlesRef.current.push({
        id: Math.random(),
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        alpha: 1.0,
        size: 2 + Math.random() * 4,
      });
    }
  };

  // Reset the game loop variables
  const resetGame = (targetContribs: ContributionDay[] = contributions) => {
    snakeRef.current = [
      { x: 12, y: 3 },
      { x: 11, y: 3 },
      { x: 10, y: 3 },
      { x: 9, y: 3 },
      { x: 8, y: 3 },
    ];
    directionRef.current = { x: 1, y: 0 };
    setIsGameOver(false);
    setGameScore(0);
    particlesRef.current = [];
    findNewFood(targetContribs);
  };

  // Main high-performance Game ticks inside custom Canvas
  useEffect(() => {
    let animationFrameId: number;
    let lastTickTime = 0;

    const skinColors: { [key: string]: { head: string; body: string; headGlow: string; outerEye: string } } = {
      emerald: { head: "#ffffff", body: "rgba(52, 211, 153, 0.9)", headGlow: "#10b981", outerEye: "#111827" },
      neon: { head: "#ffffff", body: "rgba(96, 165, 250, 0.9)", headGlow: "#3b82f6", outerEye: "#0f172a" },
      amber: { head: "#ffffff", body: "rgba(251, 191, 36, 0.9)", headGlow: "#f59e0b", outerEye: "#78350f" },
      ruby: { head: "#ffffff", body: "rgba(248, 113, 113, 0.9)", headGlow: "#ef4444", outerEye: "#7f1d1d" },
      cyan: { head: "#ffffff", body: "rgba(34, 211, 238, 0.9)", headGlow: "#06b6d4", outerEye: "#083344" }
    };

    const runEngine = (time: number) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        animationFrameId = requestAnimationFrame(runEngine);
        return;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        animationFrameId = requestAnimationFrame(runEngine);
        return;
      }

      // Automatically adjust aspect ratio based on physical container width
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
      }
      ctx.scale(dpr, dpr);

      const computedWidth = rect.width;
      const computedHeight = rect.height;

      // Draw background
      ctx.fillStyle = "#010409";
      ctx.fillRect(0, 0, computedWidth, computedHeight);

      // Grid dimensions configurations
      const padding = 12;
      const drawWidth = computedWidth - padding * 2;
      const drawHeight = computedHeight - padding * 2;
      
      const cellSize = Math.min(
        (drawWidth - (gridWidth - 1) * 3) / gridWidth,
        (drawHeight - (gridHeight - 1) * 3) / gridHeight
      );

      // Offset to perfectly center grid
      const offsetX = padding + (drawWidth - (gridWidth * cellSize + (gridWidth - 1) * 3)) / 2;
      const offsetY = padding + (drawHeight - (gridHeight * cellSize + (gridHeight - 1) * 3)) / 2;

      // Render contribution cells
      for (let col = 0; col < gridWidth; col++) {
        for (let row = 0; row < gridHeight; row++) {
          const index = col * 7 + row;
          let level = 0;
          if (contributions && contributions[index]) {
            level = contributions[index].level;
          }

          // Choose color based on contribution level
          let color = "#161b22"; // Level 0
          if (level === 1) color = "#0e4429";
          if (level === 2) color = "#006d32";
          if (level === 3) color = "#26a641";
          if (level === 4) color = "#3fb950";

          // Render cell
          const cellX = offsetX + col * (cellSize + 3);
          const cellY = offsetY + row * (cellSize + 3);

          ctx.fillStyle = color;
          ctx.beginPath();
          // Mild rounded corners for premium feel
          ctx.roundRect(cellX, cellY, cellSize, cellSize, 1.5);
          ctx.fill();

          // Highlight target food
          const food = foodRef.current;
          if (food && food.x === col && food.y === row) {
            ctx.save();
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 1.5;
            ctx.shadowBlur = 8;
            ctx.shadowColor = "#3fb950";
            ctx.stroke();
            ctx.restore();
          }
        }
      }

      // Periodic core tick update
      if (isPlaying && !isGameOver && (time - lastTickTime > snakeSpeed)) {
        lastTickTime = time;

        const snake = snakeRef.current;
        const head = { ...snake[0] };
        let dir = directionRef.current;

        // Autonomous AI autopilot mode search logic
        if (!isManualMode) {
          const food = foodRef.current;
          if (food) {
            const diffX = food.x - head.x;
            const diffY = food.y - head.y;

            // Intended AI directions
            let nextDir = { ...dir };

            // Greedy Manhattan path-planning with self-collision checks
            const avoidCrash = (d: { x: number; y: number }) => {
              const testHead = { x: head.x + d.x, y: head.y + d.y };
              // Wrap coordinates safely
              if (testHead.x < 0) testHead.x = gridWidth - 1;
              if (testHead.x >= gridWidth) testHead.x = 0;
              if (testHead.y < 0) testHead.y = gridHeight - 1;
              if (testHead.y >= gridHeight) testHead.y = 0;

              return snake.some((segment, idx) => idx > 0 && segment.x === testHead.x && segment.y === testHead.y);
            };

            const options = [];
            if (diffX !== 0) options.push({ x: Math.sign(diffX), y: 0 });
            if (diffY !== 0) options.push({ x: 0, y: Math.sign(diffY) });

            // Random fallback if perfect alignment fails
            options.push({ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 });

            let bestOption = null;
            for (let opt of options) {
              // Cannot instantly turn back
              if (opt.x === -dir.x && opt.y === -dir.y) continue;
              if (!avoidCrash(opt)) {
                bestOption = opt;
                break;
              }
            }

            if (bestOption) {
              directionRef.current = bestOption;
              dir = bestOption;
            }
          }
        }

        // Apply movement
        head.x += dir.x;
        head.y += dir.y;

        // Warp bounds check (wrapping style is amazing for profile widgets!)
        if (head.x < 0) head.x = gridWidth - 1;
        if (head.x >= gridWidth) head.x = 0;
        if (head.y < 0) head.y = gridHeight - 1;
        if (head.y >= gridHeight) head.y = 0;

        // Collision with self check (only fatal in manual play, or as a score penalty)
        const isSelfCollision = snake.some(segment => segment.x === head.x && segment.y === head.y);
        
        if (isSelfCollision && isManualMode) {
          setIsGameOver(true);
          playSound("gameover");
        } else {
          // Prepend new head
          const newSnake = [head, ...snake];
          snakeRef.current = newSnake;

          // Check if food eaten
          const food = foodRef.current;
          if (food && head.x === food.x && head.y === food.y) {
            setGameScore(prev => prev + 1);
            playSound("eat");
            
            const pixelX = offsetX + food.x * (cellSize + 3) + cellSize / 2;
            const pixelY = offsetY + food.y * (cellSize + 3) + cellSize / 2;
            
            // Spawn gorgeous explosion
            const currentSkinIdx = skinColors[selectedSkin] || skinColors.emerald;
            spawnExplosion(pixelX, pixelY, currentSkinIdx.headGlow);

            // Fetch a brand new juicy contribution coordinate
            findNewFood();
          } else {
            // Cut tail segment to simulate crawling movement
            newSnake.pop();
          }
        }
      }

      // Drawer particles tracker
      const pArr = particlesRef.current;
      for (let i = pArr.length - 1; i >= 0; i--) {
        const p = pArr[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.95; // Drag
        p.vy *= 0.95;
        p.alpha -= 0.03; // Fade out

        if (p.alpha <= 0) {
          pArr.splice(i, 1);
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.alpha;
          ctx.fill();
          ctx.globalAlpha = 1.0;
        }
      }

      // Render the Snake body on top of the elements
      const snake = snakeRef.current;
      const palette = skinColors[selectedSkin] || skinColors.emerald;

      snake.forEach((segment, i) => {
        const segX = offsetX + segment.x * (cellSize + 3);
        const segY = offsetY + segment.y * (cellSize + 3);
        const isHead = i === 0;

        ctx.save();
        if (isHead) {
          ctx.fillStyle = palette.head;
          ctx.shadowBlur = 10;
          ctx.shadowColor = palette.headGlow;

          ctx.beginPath();
          ctx.roundRect(segX, segY, cellSize, cellSize, cellSize / 2.2);
          ctx.fill();

          // Render adorable subtle snake eyes
          const dir = directionRef.current;
          ctx.fillStyle = palette.outerEye;
          const eyeRadius = cellSize * 0.15;
          const center = cellSize / 2;

          let eyeL = { x: 0, y: 0 };
          let eyeR = { x: 0, y: 0 };

          if (dir.x !== 0) { // Horizontal direction
            eyeL = { x: segX + center + dir.x * (cellSize * 0.35), y: segY + center - cellSize * 0.22 };
            eyeR = { x: segX + center + dir.x * (cellSize * 0.35), y: segY + center + cellSize * 0.22 };
          } else { // Vertical direction
            eyeL = { x: segX + center - cellSize * 0.22, y: segY + center + dir.y * (cellSize * 0.35) };
            eyeR = { x: segX + center + cellSize * 0.22, y: segY + center + dir.y * (cellSize * 0.35) };
          }

          ctx.beginPath();
          ctx.arc(eyeL.x, eyeL.y, eyeRadius, 0, Math.PI * 2);
          ctx.fill();

          ctx.beginPath();
          ctx.arc(eyeR.x, eyeR.y, eyeRadius, 0, Math.PI * 2);
          ctx.fill();

        } else {
          // Snake body color gradient fades out towards tail
          const alphaModifier = Math.max(0.3, 1.0 - (i / snake.length));
          ctx.fillStyle = palette.body.replace("0.9", alphaModifier.toFixed(2));
          ctx.beginPath();
          ctx.roundRect(segX + 0.5, segY + 0.5, cellSize - 1, cellSize - 1, cellSize / 3);
          ctx.fill();
        }
        ctx.restore();
      });

      // End cycle loop callback
      animationFrameId = requestAnimationFrame(runEngine);
    };

    animationFrameId = requestAnimationFrame(runEngine);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, isGameOver, snakeSpeed, selectedSkin, isManualMode, contributions, soundEnabled]);

  // Calculate generic profile score grade derived from public counts
  const getGrade = () => {
    if (!userData) return "C";
    const score = (userData.public_repos * 4) + (userData.total_stars * 10) + (userData.followers * 3);
    if (score > 1000) return "S+";
    if (score > 500) return "S";
    if (score > 250) return "A++";
    if (score > 120) return "A+";
    if (score > 60) return "A";
    if (score > 30) return "B+";
    return "B";
  };

  // Human-friendly date converter
  const formatDate = (dateStr: string) => {
    try {
      const options: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" };
      return new Date(dateStr).toLocaleDateString("en-US", options);
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen bg-[#010409] text-slate-300 font-sans flex flex-col justify-between selection:bg-[#238636]/40 select-none">
      
      {/* Real-time Header */}
      <header className="h-16 flex items-center justify-between px-6 lg:px-12 bg-[#0d1117] border-b border-[#30363d] shadow-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white rounded-full flex items-center justify-center overflow-hidden transition-transform hover:rotate-12 duration-300">
            <svg viewBox="0 0 16 16" fill="#000" className="w-7 h-7">
              <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"></path>
            </svg>
          </div>
          <span className="text-md lg:text-lg font-bold text-white tracking-tight flex items-center gap-1.5">
            GitHub <span className="text-emerald-400 font-mono">Snake</span> Tracker
          </span>
        </div>

        {/* Search Engine Form */}
        <form onSubmit={handleSearchSubmit} className="flex items-center w-full max-w-sm md:max-w-md bg-[#010409] border border-[#30363d] rounded-lg px-3 py-1.5 gap-2 group focus-within:border-emerald-500 transition-colors">
          <span className="text-slate-500 font-mono text-sm hidden md:inline">github.com/</span>
          <input 
            type="text" 
            placeholder="Search username... (e.g., torvalds)" 
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="bg-transparent border-none outline-none text-white text-sm w-full font-mono placeholder:text-slate-600"
          />
          <button 
            type="submit" 
            className="bg-[#238636] hover:bg-[#2ea043] text-white px-3.5 py-1 rounded-md text-xs font-semibold transition-all duration-200 shadow-md active:scale-95 flex items-center gap-1 cursor-pointer"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Fetch</span>
          </button>
        </form>
      </header>

      {/* Main Grid View */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8 flex flex-col gap-6">
        
        {loading && (
          <div className="flex-1 flex flex-col items-center justify-center py-24 gap-4 animate-pulse">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin"></div>
              <Cpu className="w-6 h-6 text-emerald-400 absolute inset-0 m-auto animate-bounce" />
            </div>
            <p className="text-emerald-400 font-mono text-sm tracking-widest mt-2 animate-pulse">
              TUNING GITHUB API SENSORS...
            </p>
          </div>
        )}

        {error && (
          <div className="bg-red-950/20 border border-red-900 rounded-xl p-6 text-center shadow-lg my-12 animate-fade-in max-w-2xl mx-auto">
            <h3 className="text-lg font-bold text-red-500 mb-2">Error Connecting to Orbit</h3>
            <p className="text-sm text-red-400/90 mb-6 leading-relaxed">
              {error}
            </p>
            <div className="flex gap-4 justify-center">
              <button 
                onClick={() => { setError(null); fetchGitHubData("yyx990803"); }}
                className="bg-[#30363d] hover:bg-[#8b1c1c]/20 hover:text-red-400 text-slate-300 border border-[#30363d] rounded-lg px-4 py-2 text-sm transition-all font-semibold"
              >
                Reset to Evan You
              </button>
              <button 
                onClick={() => { setError(null); fetchGitHubData(username); }}
                className="bg-red-700 hover:bg-red-600 text-white rounded-lg px-4 py-2 text-sm transition-all font-semibold"
              >
                Retry Request
              </button>
            </div>
          </div>
        )}

        {!loading && !error && userData && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left Profile Panel (cols 12 -> 3) */}
            <aside className="lg:col-span-3 flex flex-col gap-6">
              
              {/* Profile Main Card */}
              <div className="bg-[#0d1117] rounded-xl border border-[#30363d] p-5 shadow-lg flex flex-col items-center relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-emerald-500/10 via-transparent to-transparent pointer-events-none"></div>
                
                {/* Avatar with live streak status border */}
                <div className="w-28 h-28 rounded-full border-4 border-emerald-500/80 p-1 mb-4 relative group-hover:scale-105 transition-transform duration-300">
                  <img 
                    src={userData.avatar_url} 
                    alt={userData.name}
                    className="w-full h-full object-cover rounded-full bg-[#161b22]"
                  />
                  <div className="absolute bottom-1 right-1 w-6 h-6 bg-emerald-500 border-2 border-[#0d1117] rounded-full flex items-center justify-center shadow-lg animate-pulse" title="Contributing Star">
                    <StarsIcon className="w-3.5 h-3.5 text-white" />
                  </div>
                </div>

                <h2 className="text-xl font-bold text-white tracking-tight text-center">{userData.name}</h2>
                <p className="text-emerald-400 font-mono text-xs mb-3">@{userData.login}</p>
                
                <p className="text-slate-400 text-xs text-center leading-relaxed mb-4 italic max-w-sm px-2">
                  "{userData.bio}"
                </p>

                {/* Followers following metrics */}
                <div className="flex gap-4 w-full justify-center text-center text-xs py-2.5 border-t border-b border-[#30363d]/50 my-2">
                  <div className="flex-1">
                    <span className="block text-white font-bold font-mono text-sm">{userData.followers.toLocaleString()}</span>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">Followers</span>
                  </div>
                  <div className="w-px h-8 bg-[#30363d]"></div>
                  <div className="flex-1">
                    <span className="block text-white font-bold font-mono text-sm">{userData.following.toLocaleString()}</span>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">Following</span>
                  </div>
                </div>

                {/* Extra info lines */}
                <div className="w-full font-mono text-xs space-y-2 pt-3 text-slate-400">
                  {userData.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">{userData.location}</span>
                    </div>
                  )}
                  {userData.blog && (
                    <div className="flex items-center gap-2">
                      <LinkIcon className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <a href={userData.blog.startsWith("http") ? userData.blog : `https://${userData.blog}`} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline truncate">
                        {userData.blog}
                      </a>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>Joined {formatDate(userData.created_at)}</span>
                  </div>
                </div>
              </div>

              {/* Languages Percentage Display */}
              <div className="bg-[#0d1117] rounded-xl border border-[#30363d] p-5 shadow-lg flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Language Orbit
                  </h3>
                  <Award className="w-4 h-4 text-emerald-400" />
                </div>
                
                {userData.top_languages.length > 0 ? (
                  <div className="space-y-3.5 pt-2">
                    {userData.top_languages.slice(0, 4).map((lang, index) => {
                      // Mocking percentage values for pleasant rendering based on count sum
                      const totalCount = userData.top_languages.reduce((acc, curr) => acc + curr.count, 0) || 1;
                      const pct = Math.round((lang.count / totalCount) * 100);

                      const colors = ["bg-emerald-400", "bg-cyan-400", "bg-amber-400", "bg-rose-400"];
                      const barColor = colors[index % colors.length];

                      return (
                        <div key={lang.name} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-200 font-medium">{lang.name}</span>
                            <span className="text-slate-400 font-mono">{pct}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-[#161b22] rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${barColor} rounded-full transition-all duration-500`}
                              style={{ width: `${pct}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic py-2 text-center">No active languages detected.</p>
                )}
              </div>
            </aside>

            {/* Right Core Workspace (cols 12 -> 9) */}
            <section className="lg:col-span-9 flex flex-col gap-6">
              
              {/* Top Stats Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-[#0d1117] border border-[#30363d] p-4 rounded-xl flex flex-col gap-1 relative overflow-hidden group hover:border-[#404854] transition-colors shadow">
                  <div className="absolute top-0 right-0 p-2 opacity-5">
                    <Star className="w-12 h-12 text-yellow-400" />
                  </div>
                  <span className="text-[10px] text-slate-500 font-bold tracking-wider uppercase">TOTAL STARS</span>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-2xl font-mono text-yellow-400 font-bold">
                      {userData.total_stars.toLocaleString()}
                    </span>
                    <Star className="w-3.5 h-3.5 text-yellow-400" />
                  </div>
                </div>

                <div className="bg-[#0d1117] border border-[#30363d] p-4 rounded-xl flex flex-col gap-1 relative overflow-hidden group hover:border-[#404854] transition-colors shadow">
                  <span className="text-[10px] text-slate-500 font-bold tracking-wider uppercase">CONTRIBUTIONS</span>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-2xl font-mono text-green-400 font-bold">
                      {stats ? stats.totalContributions.toLocaleString() : "..."}
                    </span>
                    <span className="text-xs text-slate-500">yr</span>
                  </div>
                </div>

                <div className="bg-[#0d1117] border border-[#30363d] p-4 rounded-xl flex flex-col gap-1 relative overflow-hidden group hover:border-[#404854] transition-colors shadow">
                  <div className="absolute top-0 right-0 p-2 opacity-5">
                    <Flame className="w-12 h-12 text-orange-400" />
                  </div>
                  <span className="text-[10px] text-slate-500 font-bold tracking-wider uppercase font-sans">CURRENT STREAK</span>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-2xl font-mono text-orange-400 font-bold">
                      {stats ? stats.currentStreak : "0"}
                    </span>
                    <Flame className="w-3.5 h-3.5 text-orange-400" />
                  </div>
                </div>

                <div className="bg-[#0d1117] border border-[#30363d] p-4 rounded-xl flex flex-col gap-1 relative overflow-hidden group hover:border-[#404854] transition-colors shadow">
                  <span className="text-[10px] text-slate-500 font-bold tracking-wider uppercase">GIT GRADE</span>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-2xl font-mono text-purple-400 font-extrabold">{getGrade()}</span>
                    <span className="text-[10px] text-slate-500 ml-1">Rank</span>
                  </div>
                </div>
              </div>

              {/* Contribution Snake Dynamic Canvas Console Card */}
              <div ref={containerRef} className="bg-[#0d1117] rounded-xl border border-[#30363d] shadow-xl p-5 flex flex-col gap-4 relative overflow-hidden">
                
                {/* Widget Header Controls */}
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3.5 pb-2 border-b border-[#30363d]/50">
                  <div>
                    <h3 className="text-md font-bold text-white flex items-center gap-1.5">
                      <Gamepad2 className="w-5 h-5 text-emerald-400 animate-pulse" />
                      Interactive Contribution Snake
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Watch the autonomous snake eat your real GitHub contributions or switch to Manual keys to control it yourself!
                    </p>
                  </div>
                  
                  {/* Game Status Badges */}
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <div className="bg-[#161b22] px-2.5 py-1 rounded border border-[#30363d] flex items-center gap-1.5">
                      <span className="text-slate-500">Score:</span> 
                      <span className="text-emerald-400 font-bold">{gameScore}</span>
                    </div>

                    <div className={`px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${isManualMode ? "bg-[#38bdf8]/10 text-[#38bdf8] border-[#38bdf8]/20" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"}`}>
                      <span className="w-1.5 h-1.5 bg-current rounded-full"></span>
                      {isManualMode ? "Manual Key Play" : "AI Autopilot"}
                    </div>
                  </div>
                </div>

                {/* Snake Canvas Wrapper */}
                <div className="relative">
                  <div className="overflow-hidden rounded-lg border border-[#161b22] bg-[#010409]">
                    <canvas 
                      ref={canvasRef} 
                      className="w-full h-40 md:h-52 block cursor-crosshair touch-none"
                    />
                  </div>

                  {/* Manual Mode Joystick Overlay for Mobile/Tablet users */}
                  {isManualMode && (
                    <div className="absolute bottom-2 right-2 flex flex-col items-center gap-1 opacity-70 hover:opacity-100 transition-opacity bg-[#0d1117]/80 backdrop-blur-md p-1.5 rounded-lg border border-[#30363d] sm:hidden">
                      <button 
                        onClick={() => { if (directionRef.current.y === 0) directionRef.current = { x: 0, y: -1 }; }}
                        className="w-8 h-8 flex items-center justify-center bg-[#21262d] text-slate-200 active:bg-emerald-500 active:text-white rounded text-xs font-bold"
                      >
                        ▲
                      </button>
                      <div className="flex gap-1">
                        <button 
                          onClick={() => { if (directionRef.current.x === 0) directionRef.current = { x: -1, y: 0 }; }}
                          className="w-8 h-8 flex items-center justify-center bg-[#21262d] text-slate-200 active:bg-emerald-500 active:text-white rounded text-xs font-bold"
                        >
                          ◀
                        </button>
                        <button 
                          onClick={() => { if (directionRef.current.y === 0) directionRef.current = { x: 0, y: 1 }; }}
                          className="w-8 h-8 flex items-center justify-center bg-[#21262d] text-slate-200 active:bg-emerald-500 active:text-white rounded text-xs font-bold"
                        >
                          ▼
                        </button>
                        <button 
                          onClick={() => { if (directionRef.current.x === 0) directionRef.current = { x: 1, y: 0 }; }}
                          className="w-8 h-8 flex items-center justify-center bg-[#21262d] text-slate-200 active:bg-emerald-500 active:text-white rounded text-xs font-bold"
                        >
                          ▶
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Game Over Modal overlay */}
                  {isGameOver && (
                    <div className="absolute inset-0 bg-[#010409]/90 backdrop-blur-sm flex flex-col items-center justify-center gap-3 animate-fade-in p-6 text-center">
                      <h4 className="text-red-500 text-lg font-bold tracking-wider font-mono">CRASH! GAME OVER</h4>
                      <p className="text-xs text-slate-400">Your snake collided with its tail while in manual operation mode.</p>
                      <button 
                        onClick={() => resetGame()} 
                        className="bg-red-900 hover:bg-red-800 text-white font-semibold font-mono text-xs px-4 py-2 rounded-lg border border-red-700 transition"
                      >
                        Restart Session
                      </button>
                    </div>
                  )}
                </div>

                {/* Dashboard Game Settings Slider Controls & Skin Picker */}
                <div className="bg-[#161b22] rounded-lg p-4 border border-[#30363d]/70 flex flex-col md:flex-row flex-wrap justify-between items-center gap-4 text-xs font-mono text-slate-300">
                  
                  {/* Left Controls: Buttons */}
                  <div className="flex flex-wrap gap-2">
                    <button 
                      onClick={() => { playSound("click"); setIsPlaying(!isPlaying); }}
                      className="bg-[#21262d] hover:bg-[#30363d] px-3 py-2 rounded-md border border-[#30363d] flex items-center gap-1.5 cursor-pointer"
                      title={isPlaying ? "Pause Simulation" : "Resume Simulation"}
                    >
                      {isPlaying ? <Pause className="w-3.5 h-3.5 text-amber-500" /> : <Play className="w-3.5 h-3.5 text-emerald-400" />}
                      <span>{isPlaying ? "Pause" : "Play"}</span>
                    </button>

                    <button 
                      onClick={() => { playSound("click"); resetGame(); }}
                      className="bg-[#21262d] hover:bg-[#30363d] px-3 py-2 rounded-md border border-[#30363d] flex items-center gap-1.5 cursor-pointer"
                      title="Reset Snake Position"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Reset</span>
                    </button>

                    <button 
                      onClick={() => { playSound("click"); setIsManualMode(!isManualMode); }}
                      className={`px-3 py-2 rounded-md border flex items-center gap-1.5 cursor-pointer transition-colors ${isManualMode ? "bg-[#38bdf8]/10 border-[#38bdf8]/30 hover:bg-[#38bdf8]/20" : "bg-[#21262d] border-[#30363d] hover:bg-[#30363d]"}`}
                      title="Toggle between autonomous AI crawl or WASD controls"
                    >
                      <Sliders className="w-3.5 h-3.5 text-purple-400" />
                      <span>{isManualMode ? "Play (WASD / Arrows)" : "Auto Pilot (AI)"}</span>
                    </button>
                  </div>

                  {/* Mid Slider speed */}
                  <div className="flex items-center gap-3.5 w-full md:w-auto">
                    <span className="text-slate-500 grow md:grow-0">Speed:</span>
                    <input 
                      type="range" 
                      min="40" 
                      max="220" 
                      step="20"
                      value={260 - snakeSpeed} // Invert slider for user experience
                      onChange={(e) => {
                        const nextSpeed = 260 - parseInt(e.target.value, 10);
                        setSnakeSpeed(nextSpeed);
                      }}
                      className="accent-emerald-500 bg-[#010409] h-1.5 rounded-lg border border-[#30363d] cursor-pointer"
                    />
                  </div>

                  {/* Right Skin & Sound selection */}
                  <div className="flex items-center gap-4 flex-wrap justify-center">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500">Skin:</span>
                      <select 
                        value={selectedSkin} 
                        onChange={(e) => { playSound("click"); setSelectedSkin(e.target.value); }}
                        className="bg-[#21262d] border border-[#30363d] rounded px-2 py-1 text-slate-100 outline-none focus:border-emerald-500"
                      >
                        <option value="emerald">Emerald Glare</option>
                        <option value="neon">Cyberspace Blue</option>
                        <option value="amber">Solar Gold</option>
                        <option value="ruby">Pro-Red</option>
                      </select>
                    </div>

                    {/* Audio Mute button */}
                    <button 
                      onClick={() => {
                        setSoundEnabled(!soundEnabled);
                        if (!soundEnabled) {
                          // Try triggering dummy play so browser allows state
                          try {
                            const dummy = new AudioContext();
                            dummy.close();
                          } catch (_) {}
                        }
                      }}
                      className="bg-[#21262d] hover:bg-[#30363d] p-2 rounded-md border border-[#30363d] cursor-pointer text-slate-400"
                      title={soundEnabled ? "Mute audio beeps" : "Enable sound FX on feed"}
                    >
                      {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5 text-slate-500" />}
                    </button>
                  </div>

                </div>

                {/* Instructions / Key details inside manual play */}
                {isManualMode && (
                  <div className="bg-cyan-950/10 border border-cyan-900/30 rounded-lg p-3 text-xs text-cyan-400/90 flex gap-2.5 items-center font-mono">
                    <Info className="w-4.5 h-4.5 text-cyan-400 shrink-0" />
                    <span>
                      <strong>CONTROL TIPS:</strong> Use <strong>W A S D</strong> or <strong>ARROW KEYS</strong> to navigate around the board. Warp boundaries are enabled! Eat glowing white target cells to build high scores. Be careful not to eat your own body segments!
                    </span>
                  </div>
                )}
              </div>

              {/* Top Repositories section */}
              <div className="bg-[#0b0e14] rounded-xl border border-[#30363d] p-5 shadow-lg flex flex-col gap-4">
                <div className="flex items-center gap-2 pb-1">
                  <BookOpen className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white tracking-wider uppercase">
                    Starred Orbit Projects
                  </h3>
                </div>

                {userData.repos.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {userData.repos.map((repo) => (
                      <a 
                        key={repo.name}
                        href={repo.html_url}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-[#0d1117] border border-[#30363d] rounded-xl p-4 flex flex-col justify-between hover:border-emerald-500/50 hover:bg-[#111620] transition-all duration-200 hover:-translate-y-0.5 group shadow-sm cursor-pointer"
                      >
                        <div>
                          <div className="flex items-center gap-1 text-emerald-400 font-bold group-hover:underline text-sm truncate">
                            <span>{repo.name}</span>
                          </div>
                          <p className="text-slate-400 text-xs mt-1.5 line-clamp-2 leading-relaxed">
                            {repo.description}
                          </p>
                        </div>
                        
                        <div className="flex items-center justify-between text-xs font-mono text-slate-500 mt-4 pt-2 border-t border-[#30363d]/50">
                          <div className="flex items-center gap-3.5">
                            <span className="flex items-center gap-1">
                              <Star className="w-3.5 h-3.5 text-yellow-400" />
                              {repo.stargazers_count}
                            </span>
                            <span className="flex items-center gap-1">
                              <GitFork className="w-3.5 h-3.5 text-slate-400" />
                              {repo.forks_count}
                            </span>
                          </div>

                          {repo.language && (
                            <span className="px-2 py-0.5 bg-[#161b22] rounded text-slate-400 text-[10px] uppercase font-bold">
                              {repo.language}
                            </span>
                          )}
                        </div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic py-4 text-center">No catalogued repositories found.</p>
                )}
              </div>

            </section>

          </div>
        )}

      </main>

      {/* Modern footer with build details */}
      <footer className="bg-[#0d1117] border-t border-[#30363d] py-5 px-6 lg:px-12 flex flex-col md:flex-row gap-4 items-center justify-between text-[11px] font-mono text-slate-500">
        <div className="flex gap-4">
          <span className="hover:text-slate-300">Terms of Orbit</span>
          <span>•</span>
          <span className="hover:text-slate-300">Privacy Firewall</span>
          <span>•</span>
          <span className="hover:text-slate-300">Docs</span>
        </div>
        <div className="text-slate-600 uppercase tracking-widest text-center md:text-right">
          Build: v2.1.0-Emerald • Environment Active
        </div>
      </footer>

    </div>
  );
}

// Sparkle helper icon
function StarsIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275Z" />
    </svg>
  );
}
