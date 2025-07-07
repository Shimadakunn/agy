import { BrowserWindow, screen } from "electron";
import path from "node:path";

export function createAgyWindow(dirname: string): BrowserWindow {
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

  if (process.env.VITE_DEV_SERVER_URL)
    win.loadURL(`${process.env.VITE_DEV_SERVER_URL}/agy.html`);
  else win.loadFile(path.join(dirname, "../dist/agy.html"));

  win.once("ready-to-show", () => win.showInactive());

  return win;
}
