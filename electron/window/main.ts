import { BrowserWindow } from "electron";
import path from "node:path";

export function createMainWindow(dirname: string): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(dirname, "preload.mjs"),
    },
  });

  if (process.env.VITE_DEV_SERVER_URL)
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  else win.loadFile(path.join(dirname, "../dist/index.html"));

  return win;
}
