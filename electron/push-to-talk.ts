import { uIOhook, UiohookKey } from "uiohook-napi";
import type { BrowserWindow } from "electron";

const PTT_KEY = UiohookKey.AltRight;

let isKeyDown = false;

export function registerPushToTalk(
  getAppWindow: () => BrowserWindow | null,
): void {
  uIOhook.on("keydown", (e) => {
    if (e.keycode !== PTT_KEY || isKeyDown) return;
    isKeyDown = true;
    getAppWindow()?.webContents.send("push-to-talk-down");
  });

  uIOhook.on("keyup", (e) => {
    if (e.keycode !== PTT_KEY) return;
    isKeyDown = false;
    getAppWindow()?.webContents.send("push-to-talk-up");
  });

  uIOhook.start();
}

export function stopPushToTalk(): void {
  uIOhook.stop();
}
