import { useEffect, useRef } from "react";
import type { Status } from "@/components/transcription/types";

export function usePushToTalk(
  status: Status,
  startRecording: () => Promise<void>,
  stopRecording: () => Promise<void>,
) {
  const statusRef = useRef(status);
  statusRef.current = status;

  const startingRef = useRef(false);

  useEffect(() => {
    const unsubDown = window.electron.onPushToTalkDown(async () => {
      if (statusRef.current !== "idle" || startingRef.current) return;
      startingRef.current = true;
      try {
        await startRecording();
      } finally {
        startingRef.current = false;
      }
    });

    const unsubUp = window.electron.onPushToTalkUp(async () => {
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
