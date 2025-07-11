import { useEffect, useRef } from "react";
import type { Status } from "@/components/transcription/types";

export function usePushToTalk(
  status: Status,
  mode: "hold" | "toggle",
  startRecording: () => Promise<void>,
  stopRecording: () => Promise<void>,
) {
  const statusRef = useRef(status);
  statusRef.current = status;

  const modeRef = useRef(mode);
  modeRef.current = mode;

  const startingRef = useRef(false);

  useEffect(() => {
    const unsubDown = window.electron.onPushToTalkDown(async () => {
      if (startingRef.current) return;

      if (modeRef.current === "toggle" && statusRef.current === "recording") {
        await stopRecording();
        return;
      }

      if (statusRef.current !== "idle") return;
      startingRef.current = true;
      try {
        await startRecording();
      } finally {
        startingRef.current = false;
      }
    });

    const unsubUp = window.electron.onPushToTalkUp(async () => {
      if (modeRef.current === "toggle") return;

      if (startingRef.current) {
        const waitForStart = () =>
          new Promise<void>((resolve) => {
            const check = () => {
              if (!startingRef.current) return resolve();
              setTimeout(check, 50);
            };
            check();
          });
        await waitForStart();
      }

      if (statusRef.current === "recording") await stopRecording();
    });

    return () => {
      unsubDown();
      unsubUp();
    };
  }, [startRecording, stopRecording]);
}
