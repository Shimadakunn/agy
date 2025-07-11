import { ipcMain, nativeTheme } from "electron";
import {
  getSettings,
  updateAudioSettings,
  updateHotkeySettings,
  updateAppearanceSettings,
} from "../settings.js";
import type { AppSettings } from "../settings.js";
import {
  setPushToTalkKey,
  startHotkeyCapture,
  cancelHotkeyCapture,
} from "../push-to-talk.js";
import { getKeyName } from "../key-names.js";

export function registerSettingsHandlers(): void {
  ipcMain.handle("get-settings", () => getSettings());

  ipcMain.handle("set-audio-settings", (_event, audio: AppSettings["audio"]) =>
    updateAudioSettings(audio),
  );

  ipcMain.handle(
    "set-hotkey-settings",
    (_event, hotkey: AppSettings["hotkey"]) => {
      setPushToTalkKey(hotkey.keycode);
      return updateHotkeySettings(hotkey);
    },
  );

  ipcMain.handle("start-hotkey-capture", (event) => {
    startHotkeyCapture((keycode) => {
      const keyName = getKeyName(keycode);
      event.sender.send("hotkey-captured", { keycode, keyName });
    });
  });

  ipcMain.handle("cancel-hotkey-capture", () => {
    cancelHotkeyCapture();
  });

  ipcMain.handle(
    "set-appearance-settings",
    (_event, appearance: AppSettings["appearance"]) => {
      nativeTheme.themeSource = appearance.theme;
      return updateAppearanceSettings(appearance);
    },
  );
}
