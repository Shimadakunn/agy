import { useState, useEffect } from "react";
import type { Status, ToolAction } from "@/components/transcription/types";
import {
  useAudioRecording,
  useAssistantListeners,
  usePushToTalk,
} from "@/hooks/transcription";
import { useSettings } from "@/hooks/use-settings";
import {
  SettingsLayout,
  AudioSection,
  HotkeySection,
  AppearanceSection,
  PermissionsSection,
} from "@/components/settings";

export function App() {
  const { settings, loaded, updateAudio, updateHotkey, updateAppearance } =
    useSettings();

  const [status, setStatus] = useState<Status>("idle");
  const [, setTranscript] = useState("");
  const [, setAiResponse] = useState("");
  const [, setError] = useState<string | null>(null);
  const [, setToolActions] = useState<ToolAction[]>([]);

  const { startRecording, stopRecording } = useAudioRecording(
    settings.audio.deviceId,
    setStatus,
    setError,
    setTranscript,
  );

  useAssistantListeners(
    setTranscript,
    setAiResponse,
    setToolActions,
    setError,
    setStatus,
  );

  usePushToTalk(status, settings.hotkey.mode, startRecording, stopRecording);

  useEffect(() => {
    const root = document.documentElement;
    const theme = settings.appearance.theme;

    if (theme === "dark") {
      root.classList.add("dark");
      return;
    }

    if (theme === "light") {
      root.classList.remove("dark");
      return;
    }

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => root.classList.toggle("dark", mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [settings.appearance.theme]);

  if (!loaded) return null;

  return (
    <SettingsLayout>
      {{
        audio: (
          <AudioSection
            deviceId={settings.audio.deviceId}
            onDeviceChange={(deviceId) => updateAudio({ deviceId })}
          />
        ),
        hotkey: (
          <HotkeySection
            hotkey={settings.hotkey}
            onHotkeyChange={updateHotkey}
          />
        ),
        appearance: (
          <AppearanceSection
            theme={settings.appearance.theme}
            onThemeChange={(theme) => updateAppearance({ theme })}
          />
        ),
        permissions: <PermissionsSection />,
      }}
    </SettingsLayout>
  );
}

export default App;
