import { uIOhook, UiohookKey } from "uiohook-napi";
import type { BrowserWindow } from "electron";

const PTT_KEY = UiohookKey.AltRight;

let isKeyDown = false;

export function registerPushToTalk(
  getMainWindow: () => BrowserWindow | null,
): void {
  uIOhook.on("keydown", (e) => {
    if (e.keycode !== PTT_KEY || isKeyDown) return;
    isKeyDown = true;
    getMainWindow()?.webContents.send("push-to-talk-down");
  });

  uIOhook.on("keyup", (e) => {
    if (e.keycode !== PTT_KEY) return;
    isKeyDown = false;
    getMainWindow()?.webContents.send("push-to-talk-up");
  });

  uIOhook.start();
}

export function stopPushToTalk(): void {
  uIOhook.stop();
}
