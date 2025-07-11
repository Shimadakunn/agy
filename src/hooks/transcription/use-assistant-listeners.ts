import type { Dispatch, SetStateAction } from "react";
import { useEffect } from "react";
import type { Status, ToolAction } from "@/components/transcription/types";

export function useAssistantListeners(
  setTranscript: Dispatch<SetStateAction<string>>,
  setAiResponse: Dispatch<SetStateAction<string>>,
  setToolActions: Dispatch<SetStateAction<ToolAction[]>>,
  setError: Dispatch<SetStateAction<string | null>>,
  setStatus: Dispatch<SetStateAction<Status>>,
) {
  useEffect(() => {
    let realtimeText = "";

    const removeDelta = window.electron.onTranscriptionDelta((text) => {
      setTranscript((prev) => prev + text);
    });

    const removeDone = window.electron.onTranscriptionDone((text) => {
      realtimeText = text;
      setTranscript(text);

      if (!text.trim()) {
        setError("No speech detected. Try recording again.");
        setStatus("idle");
        return;
      }

      setStatus("confirming");
    });

    const removeConfirmed = window.electron.onTranscriptionConfirmed(
      async (text, isFinal) => {
        setTranscript(text);

        if (!isFinal) return;

        // Brief pause so the user can see the confirmed (white) text
        // before transitioning to the thinking/generating phase
        await new Promise((r) => setTimeout(r, 800));

        setAiResponse("");
        setToolActions([]);
        setStatus("generating");

        try {
          await window.electron.chatWithMistral(text);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Chat failed.");
        } finally {
          setStatus("idle");
        }
      },
    );

    const removeConfirmedError = window.electron.onTranscriptionConfirmedError(
      async () => {
        setAiResponse("");
        setToolActions([]);
        setStatus("generating");

        try {
          await window.electron.chatWithMistral(realtimeText);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Chat failed.");
        } finally {
          setStatus("idle");
        }
      },
    );

    const removeTranscriptionError = window.electron.onTranscriptionError(
      (msg) => {
        setError(msg);
        setStatus("idle");
      },
    );

    const removeChatChunk = window.electron.onChatChunk((chunk) => {
      setAiResponse((prev) => prev + chunk);
    });

    const removeToolExecuting = window.electron.onToolExecuting((data) => {
      setToolActions((prev) => [
        ...prev,
        {
          id: `${data.name}-${Date.now()}`,
          name: data.name,
          args: data.arguments,
          status: "running",
        },
      ]);
    });

    const removeToolResult = window.electron.onToolResult((data) => {
      setToolActions((prev) => {
        const idx = prev.findLastIndex(
          (a) => a.name === data.name && a.status === "running",
        );
        if (idx === -1) return prev;
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          status: data.success ? "done" : "error",
          result: data.result,
        };
        return updated;
      });
    });

    return () => {
      removeDelta();
      removeDone();
      removeConfirmed();
      removeConfirmedError();
      removeTranscriptionError();
      removeChatChunk();
      removeToolExecuting();
      removeToolResult();
    };
  }, [setTranscript, setAiResponse, setToolActions, setError, setStatus]);
}
