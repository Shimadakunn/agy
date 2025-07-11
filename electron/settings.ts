import { app } from "electron";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

export type ThemeMode = "system" | "light" | "dark";

export interface AppSettings {
  audio: {
    deviceId: string | null;
  };
  hotkey: {
    keycode: number;
    keyName: string;
    mode: "hold" | "toggle";
  };
  appearance: {
    theme: ThemeMode;
  };
}

export const DEFAULT_SETTINGS: AppSettings = {
  audio: { deviceId: null },
  hotkey: { keycode: 3640, keyName: "Right Alt", mode: "hold" },
  appearance: { theme: "system" },
};

let settings: AppSettings = structuredClone(DEFAULT_SETTINGS);

function getSettingsPath(): string {
  return path.join(app.getPath("userData"), "settings.json");
}

export function loadSettings(): AppSettings {
  try {
    const raw = readFileSync(getSettingsPath(), "utf-8");
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    settings = {
      audio: { ...DEFAULT_SETTINGS.audio, ...parsed.audio },
      hotkey: { ...DEFAULT_SETTINGS.hotkey, ...parsed.hotkey },
      appearance: { ...DEFAULT_SETTINGS.appearance, ...parsed.appearance },
    };
  } catch {
    settings = structuredClone(DEFAULT_SETTINGS);
  }
  return settings;
}

export function getSettings(): AppSettings {
  return settings;
}

function persist(): void {
  const dir = path.dirname(getSettingsPath());
  mkdirSync(dir, { recursive: true });
  writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2));
}

export function updateAudioSettings(audio: AppSettings["audio"]): AppSettings {
  settings = { ...settings, audio };
  persist();
  return settings;
}

export function updateHotkeySettings(
  hotkey: AppSettings["hotkey"],
): AppSettings {
  settings = { ...settings, hotkey };
  persist();
  return settings;
}

export function updateAppearanceSettings(
  appearance: AppSettings["appearance"],
): AppSettings {
  settings = { ...settings, appearance };
  persist();
  return settings;
}
