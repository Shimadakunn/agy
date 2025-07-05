import { BrowserWindow, screen } from "electron";
import path from "node:path";

const GLOW_HTML = /* html */ `<!DOCTYPE html>
<html>
<head>
<style>
  @property --a1 {
    syntax: "<angle>";
    initial-value: 0deg;
    inherits: false;
  }
  @property --a2 {
    syntax: "<angle>";
    initial-value: 120deg;
    inherits: false;
  }

  * { margin: 0; padding: 0; }

  body {
    background: transparent;
    overflow: hidden;
    width: 100vw;
    height: 100vh;
  }

  .glow {
    position: fixed;
    inset: 0;
    opacity: 0;
    transition: opacity 1s cubic-bezier(0.4, 0, 0.2, 1);
    --radius: 14px;
  }

  .glow.active { opacity: 1; }

  .wave {
    position: absolute;
    inset: 0;
    border-radius: var(--radius);
  }

  .fade-mask {
    mask:
      linear-gradient(to right,  #000, transparent var(--fade)) left  / 50% 100% no-repeat,
      linear-gradient(to left,   #000, transparent var(--fade)) right / 50% 100% no-repeat,
      linear-gradient(to bottom, #000, transparent var(--fade)) top   / 100% 50% no-repeat,
      linear-gradient(to top,    #000, transparent var(--fade)) bottom/ 100% 50% no-repeat;
  }

  .border-mask {
    mask:
      linear-gradient(#000, #000) content-box exclude,
      linear-gradient(#000, #000);
  }

  /* Layer 1 — visible border with inward fade */
  .wave-1 {
    --fade: 60px;
    background: conic-gradient(
      from var(--a1),
      #7c3aed, #6366f1, #3b82f6, #06b6d4,
      #10b981, #8b5cf6, #c084fc, #7c3aed
    );
    animation: spin-1 4s linear infinite, breathe-1 3s ease-in-out infinite;
  }

  /* Layer 2 — wide ambient glow, fades deep into screen */
  .wave-2 {
    --fade: 160px;
    background: conic-gradient(
      from var(--a2),
      #06b6d4, #34d399, #10b981, #3b82f6,
      #8b5cf6, #a78bfa, #06b6d4
    );
    filter: blur(16px);
    opacity: 0.6;
    animation: spin-2 7s linear infinite, breathe-2 5s ease-in-out infinite;
  }

  /* Traveling highlight — bright arc sweeping the border */
  .highlight {
    padding: 8px;
    background: conic-gradient(
      from var(--a1),
      transparent 0%,
      transparent 30%,
      rgba(255, 255, 255, 0.95) 45%,
      #a5b4fc 50%,
      rgba(255, 255, 255, 0.95) 55%,
      transparent 70%,
      transparent 100%
    );
    filter: blur(5px);
    opacity: 0.7;
    animation: spin-1 3s linear infinite, highlight-pulse 3s ease-in-out infinite;
  }

  @keyframes spin-1 { to { --a1: 360deg; } }
  @keyframes spin-2 { to { --a2: -240deg; } }

  @keyframes breathe-1 {
    0%, 100% { opacity: 1; }
    50%      { opacity: 0.7; }
  }

  @keyframes breathe-2 {
    0%, 100% { opacity: 0.6; }
    50%      { opacity: 0.4; }
  }

  @keyframes highlight-pulse {
    0%, 100% { opacity: 0.7; }
    50%      { opacity: 0.3; }
  }
</style>
</head>
<body>
  <div class="glow" id="glow">
    <div class="wave fade-mask wave-2"></div>
    <div class="wave fade-mask wave-1"></div>
    <div class="wave border-mask highlight"></div>
  </div>
  <script>
    window.electron.onRecordingGlow((active) => {
      document.getElementById("glow").classList.toggle("active", active);
    });
  </script>
</body>
</html>`;

export function createGlowWindow(dirname: string): BrowserWindow {
  const { x, y, width, height } = screen.getPrimaryDisplay().bounds;

  const win = new BrowserWindow({
    x,
    y,
    width,
    height,
    transparent: true,
    frame: false,
    hasShadow: false,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    show: false,
    webPreferences: {
      preload: path.join(dirname, "preload.mjs"),
    },
  });

  win.setAlwaysOnTop(true, "screen-saver");
  win.setIgnoreMouseEvents(true);
  win.setVisibleOnAllWorkspaces(true);

  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(GLOW_HTML)}`);

  win.once("ready-to-show", () => win.showInactive());

  return win;
}
