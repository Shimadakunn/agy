import { uIOhook, UiohookKey } from "uiohook-napi";
import type { BrowserWindow } from "electron";

let pttKeycode: number = UiohookKey.AltRight;
let isKeyDown = false;
let captureCallback: ((keycode: number) => void) | null = null;

export function setPushToTalkKey(keycode: number): void {
  pttKeycode = keycode;
}

export function startHotkeyCapture(callback: (keycode: number) => void): void {
  captureCallback = callback;
}

export function cancelHotkeyCapture(): void {
  captureCallback = null;
}

export function registerPushToTalk(
  getAppWindow: () => BrowserWindow | null,
): void {
  uIOhook.on("keydown", (e) => {
    if (captureCallback) {
      const cb = captureCallback;
      captureCallback = null;
      cb(e.keycode);
      return;
    }

    if (e.keycode !== pttKeycode || isKeyDown) return;
    isKeyDown = true;
    getAppWindow()?.webContents.send("push-to-talk-down");
  });

  uIOhook.on("keyup", (e) => {
    if (e.keycode !== pttKeycode) return;
    isKeyDown = false;
    getAppWindow()?.webContents.send("push-to-talk-up");
  });

  uIOhook.start();
}

export function stopPushToTalk(): void {
  uIOhook.stop();
}
