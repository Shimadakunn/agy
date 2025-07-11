import { BrowserWindow } from "electron";
import path from "node:path";

export function createAppWindow(dirname: string): BrowserWindow {
  const win = new BrowserWindow({
    width: 640,
    height: 460,
    minWidth: 520,
    minHeight: 380,
    title: "Agy",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    trafficLightPosition: { x: 16, y: 18 },
    webPreferences: {
      preload: path.join(dirname, "preload.mjs"),
    },
  });

  if (process.env.VITE_DEV_SERVER_URL)
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  else win.loadFile(path.join(dirname, "../dist/index.html"));

  return win;
}
