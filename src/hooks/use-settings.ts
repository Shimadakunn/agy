import { useState, useEffect, useCallback } from "react";

const DEFAULT_SETTINGS: AppSettings = {
  audio: { deviceId: null },
  hotkey: { keycode: 3640, keyName: "Right Alt", mode: "hold" },
  appearance: { theme: "system" },
};

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    window.electron.getSettings().then((s) => {
      setSettings(s);
      setLoaded(true);
    });
  }, []);

  const updateAudio = useCallback(async (audio: AppSettings["audio"]) => {
    const updated = await window.electron.setAudioSettings(audio);
    setSettings(updated);
  }, []);

  const updateHotkey = useCallback(async (hotkey: AppSettings["hotkey"]) => {
    const updated = await window.electron.setHotkeySettings(hotkey);
    setSettings(updated);
  }, []);

  const updateAppearance = useCallback(
    async (appearance: AppSettings["appearance"]) => {
      const updated = await window.electron.setAppearanceSettings(appearance);
      setSettings(updated);
    },
    [],
  );

  return { settings, loaded, updateAudio, updateHotkey, updateAppearance };
}
