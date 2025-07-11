import { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Mic, Sparkles, Cog } from "lucide-react";
import "./agy-overlay.css";
import "./markdown.css";

type Phase = "idle" | "recording" | "thinking" | "executing" | "responding";

export function AgyOverlay() {
  const [phase, setPhaseState] = useState<Phase>("idle");
  const [content, setContent] = useState("");
  const [contentSource, setContentSource] = useState<Phase>("idle");
  const [transcriptConfirmed, setTranscriptConfirmed] = useState(false);
  const [glowActive, setGlowActive] = useState(false);
  const [overlayActive, setOverlayActive] = useState(false);

  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseRef = useRef<Phase>("idle");

  const setPhase = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);

    if (fadeTimerRef.current) {
      clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    if (p === "idle") {
      fadeTimerRef.current = setTimeout(() => {
        setOverlayActive(false);
        setGlowActive(false);
        hideTimerRef.current = setTimeout(() => {
          window.electron.hideOverlay();
        }, 1200);
      }, 3000);
    } else {
      setOverlayActive(true);
    }
  }, []);

  useEffect(() => {
    const cleanups: (() => void)[] = [];

    cleanups.push(
      window.electron.onRecordingGlow((active) => {
        if (fallbackTimerRef.current) {
          clearTimeout(fallbackTimerRef.current);
          fallbackTimerRef.current = null;
        }
        if (active) {
          setGlowActive(true);
          setContent("");
          setTranscriptConfirmed(false);
          setContentSource("recording");
          setPhase("recording");
        } else {
          fallbackTimerRef.current = setTimeout(() => {
            if (phaseRef.current === "recording") setPhase("idle");
          }, 5000);
        }
      }),
    );

    cleanups.push(
      window.electron.onTranscriptionDelta((text) => {
        if (phaseRef.current === "recording") setContent((prev) => prev + text);
      }),
    );

    cleanups.push(
      window.electron.onTranscriptionConfirmed((text) => {
        console.log("[overlay] transcription-confirmed:", text);
        setContent(text);
        setTranscriptConfirmed(true);
      }),
    );

    cleanups.push(
      window.electron.onTranscriptionConfirmedError(() => {
        console.log("[overlay] transcription-confirmed-error (fallback)");
        setTranscriptConfirmed(true);
      }),
    );

    cleanups.push(
      window.electron.onGlowPhase((p) => {
        if (fallbackTimerRef.current) {
          clearTimeout(fallbackTimerRef.current);
          fallbackTimerRef.current = null;
        }
        if (p === "thinking") setContent("");
        if (p !== "idle") setGlowActive(true);
        setPhase(p as Phase);
      }),
    );

    cleanups.push(
      window.electron.onToolExecuting((data) => {
        const formatted = data.name
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());
        setContent(formatted + "...");
        setContentSource("executing");
        setPhase("executing");
      }),
    );

    cleanups.push(
      window.electron.onChatChunk((chunk) => {
        const current = phaseRef.current;
        if (current === "thinking" || current === "executing") {
          setContent(chunk);
          setContentSource("responding");
          setPhase("responding");
        } else {
          setContent((prev) => prev + chunk);
        }
      }),
    );

    return () => cleanups.forEach((fn) => fn());
  }, [setPhase]);

  return (
    <>
      <div
        className={`glow ${glowActive ? "active" : ""} ${glowActive ? phase : ""}`}
      >
        <div className="wave fade-mask wave-2" />
        <div className="wave fade-mask wave-1" />
        <div className="wave border-mask highlight" />
      </div>

      <div
        className={`fixed bottom-[10%] left-1/2 -translate-x-1/2 max-w-[520px] min-w-20 px-5 py-2.5 bg-background/80 backdrop-blur-xl rounded-2xl border border-border shadow-[0_8px_32px_rgba(0,0,0,0.5)] text-foreground text-sm leading-relaxed pointer-events-none z-10 transition-all duration-500 ${
          overlayActive
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-2.5"
        }`}
      >
        {phase === "thinking" ? (
          <div className="flex gap-2 justify-center items-center py-1">
            <span className="dot" />
            <span className="dot" />
            <span className="dot" />
          </div>
        ) : phase === "executing" && content ? (
          <div className="flex items-center gap-2.5">
            <Cog
              className="phase-icon text-blue-400 shrink-0 animate-spin"
              size={16}
              style={{ animationDuration: "2s" }}
            />
            <p className="wrap-break-word whitespace-pre-wrap text-blue-300/80">
              {content}
            </p>
          </div>
        ) : content ? (
          <div className="flex items-start gap-2.5 text-left">
            {contentSource === "responding" ? (
              <Sparkles
                className="phase-icon text-violet-400 shrink-0 mt-0.5"
                size={16}
              />
            ) : (
              <Mic
                className="phase-icon text-emerald-400 shrink-0 mt-0.5"
                size={16}
              />
            )}
            {contentSource === "responding" ? (
              <div className="markdown-content min-w-0">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {content}
                </ReactMarkdown>
              </div>
            ) : (
              <p
                className={`wrap-break-word whitespace-pre-wrap transition-colors duration-300 ${
                  contentSource === "recording" && !transcriptConfirmed
                    ? "text-muted-foreground"
                    : "text-foreground"
                }`}
              >
                {content}
              </p>
            )}
          </div>
        ) : null}
      </div>
    </>
  );
}
