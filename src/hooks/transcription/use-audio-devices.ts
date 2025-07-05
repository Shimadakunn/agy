import { useEffect, useState } from "react";
import type { AudioDevice } from "@/components/transcription/types";

export function useAudioDevices() {
  const [devices, setDevices] = useState<AudioDevice[]>([]);

  useEffect(() => {
    async function enumerate() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        stream.getTracks().forEach((t) => t.stop());
      } catch {
        return;
      }

      const all = await navigator.mediaDevices.enumerateDevices();
      setDevices(
        all
          .filter((d) => d.kind === "audioinput")
          .map((d, i) => ({
            label: d.label || `Microphone ${i + 1}`,
            value: d.deviceId,
          })),
      );
    }

    enumerate();

    navigator.mediaDevices.addEventListener("devicechange", enumerate);
    return () =>
      navigator.mediaDevices.removeEventListener("devicechange", enumerate);
  }, []);

  return devices;
}
