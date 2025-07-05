import "dotenv/config";
import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createMainWindow, createGlowWindow } from "./window/index.js";
import { registerTranscriptionHandlers } from "./ipc/transcription.js";
import { registerChatHandlers } from "./ipc/chat.js";
import { registerPushToTalk, stopPushToTalk } from "./push-to-talk.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;
let glowWindow: BrowserWindow | null = null;

const getMainWindow = () => mainWindow;

registerTranscriptionHandlers(getMainWindow);
registerChatHandlers(getMainWindow);
registerPushToTalk(getMainWindow);

ipcMain.handle("set-recording-glow", (_event, active: boolean) => {
  glowWindow?.webContents.send("recording-glow", active);
});

app.whenReady().then(() => {
  mainWindow = createMainWindow(__dirname);
  glowWindow = createGlowWindow(__dirname);

  glowWindow.on("closed", () => {
    glowWindow = null;
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow(__dirname);
      glowWindow = createGlowWindow(__dirname);
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    mainWindow = null;
  }
});

app.on("will-quit", () => {
  stopPushToTalk();
});

process.on("message", (msg) => {
  if (msg === "electron-vite&type=hot-reload") {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.reload();
    }
  }
});
