import "dotenv/config";
import { app, BrowserWindow, ipcMain, nativeTheme } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAppWindow, createAgyWindow } from "./window/index.js";
import { registerTranscriptionHandlers } from "./ipc/transcription.js";
import { registerChatHandlers } from "./ipc/chat.js";
import { registerSettingsHandlers } from "./ipc/settings.js";
import { registerPermissionsHandlers } from "./ipc/permissions.js";
import {
  registerPushToTalk,
  setPushToTalkKey,
  stopPushToTalk,
} from "./push-to-talk.js";
import { loadSettings } from "./settings.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let appWindow: BrowserWindow | null = null;
let agyWindow: BrowserWindow | null = null;

const getAppWindow = () => appWindow;
const getAgyWindow = () => agyWindow;

registerTranscriptionHandlers(getAppWindow, getAgyWindow);
registerChatHandlers(getAppWindow, getAgyWindow);
registerSettingsHandlers();
registerPermissionsHandlers();
registerPushToTalk(getAppWindow);

ipcMain.handle("set-recording-glow", (_event, active: boolean) => {
  if (active && agyWindow && !agyWindow.isDestroyed() && !agyWindow.isVisible())
    agyWindow.showInactive();
  agyWindow?.webContents.send("recording-glow", active);
});

ipcMain.on("hide-overlay", () => {
  if (agyWindow && !agyWindow.isDestroyed() && agyWindow.isVisible())
    agyWindow.hide();
});

app.whenReady().then(() => {
  const settings = loadSettings();
  nativeTheme.themeSource = settings.appearance.theme;
  setPushToTalkKey(settings.hotkey.keycode);

  appWindow = createAppWindow(__dirname);
  agyWindow = createAgyWindow(__dirname);

  agyWindow.on("closed", () => {
    agyWindow = null;
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      appWindow = createAppWindow(__dirname);
      agyWindow = createAgyWindow(__dirname);
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    appWindow = null;
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
