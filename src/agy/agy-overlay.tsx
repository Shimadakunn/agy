import { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Mic, Sparkles, Cog } from "lucide-react";
import "./agy-overlay.css";
import "./markdown.css";

type Phase = "idle" | "recording" | "thinking" | "executing" | "responding";

type Message = {
  id: number;
  type: "user" | "tool" | "assistant";
  content: string;
};

export function AgyOverlay() {
  const [phase, setPhaseState] = useState<Phase>("idle");
  const [messages, setMessages] = useState<Message[]>([]);
  const [confirmedText, setConfirmedText] = useState("");
  const [pendingText, setPendingText] = useState("");
  const [glowActive, setGlowActive] = useState(false);
  const [overlayActive, setOverlayActive] = useState(false);

  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseRef = useRef<Phase>("idle");
  const confirmedTextRef = useRef("");
  const pendingTextRef = useRef("");
  const nextIdRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when content changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, confirmedText, pendingText, phase]);

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
          setMessages([]);
          confirmedTextRef.current = "";
          pendingTextRef.current = "";
          setConfirmedText("");
          setPendingText("");
          nextIdRef.current = 0;
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
        if (phaseRef.current === "recording") {
          pendingTextRef.current += text;
          setPendingText(pendingTextRef.current);
        }
      }),
    );

    cleanups.push(
      window.electron.onTranscriptionConfirmed((text) => {
        console.log("[overlay] confirmed:", text);
        confirmedTextRef.current = text;
        pendingTextRef.current = "";
        setConfirmedText(text);
        setPendingText("");
      }),
    );

    cleanups.push(
      window.electron.onTranscriptionConfirmedError(() => {
        // Final batch failed — promote pending to confirmed as fallback
        confirmedTextRef.current += pendingTextRef.current;
        pendingTextRef.current = "";
        setConfirmedText(confirmedTextRef.current);
        setPendingText("");
      }),
    );

    cleanups.push(
      window.electron.onGlowPhase((p) => {
        if (fallbackTimerRef.current) {
          clearTimeout(fallbackTimerRef.current);
          fallbackTimerRef.current = null;
        }
        if (p === "thinking") {
          // Finalize user message from transcription before clearing
          const userText = (
            confirmedTextRef.current + pendingTextRef.current
          ).trim();
          confirmedTextRef.current = "";
          pendingTextRef.current = "";
          setConfirmedText("");
          setPendingText("");
          if (userText) {
            const id = nextIdRef.current++;
            setMessages((msgs) => [
              ...msgs,
              { id, type: "user", content: userText },
            ]);
          }
        }
        if (p !== "idle") setGlowActive(true);
        setPhase(p as Phase);
      }),
    );

    cleanups.push(
      window.electron.onToolExecuting((data) => {
        const formatted = data.name
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());
        setMessages((msgs) => [
          ...msgs,
          { id: nextIdRef.current++, type: "tool", content: formatted + "..." },
        ]);
        setPhase("executing");
      }),
    );

    cleanups.push(
      window.electron.onChatChunk((chunk) => {
        const current = phaseRef.current;
        if (current === "thinking" || current === "executing") {
          // First chunk — new assistant message
          setMessages((msgs) => [
            ...msgs,
            { id: nextIdRef.current++, type: "assistant", content: chunk },
          ]);
          setPhase("responding");
        } else {
          // Append to last assistant message
          setMessages((msgs) => {
            const last = msgs[msgs.length - 1];
            if (last && last.type === "assistant") {
              return [
                ...msgs.slice(0, -1),
                { ...last, content: last.content + chunk },
              ];
            }
            return [
              ...msgs,
              { id: nextIdRef.current++, type: "assistant", content: chunk },
            ];
          });
        }
      }),
    );

    return () => cleanups.forEach((fn) => fn());
  }, [setPhase]);

  const showRecording = phase === "recording" && (confirmedText || pendingText);
  const hasContent = messages.length > 0 || showRecording || phase === "thinking";

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
          overlayActive && hasContent
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-2.5"
        }`}
      >
        <div
          ref={scrollRef}
          className="message-scroll max-h-[300px] overflow-y-auto pointer-events-auto flex flex-col gap-2.5"
        >
          {messages.map((msg) => (
            <div key={msg.id}>
              {msg.type === "user" && (
                <div className="flex items-start gap-2.5 text-left">
                  <Mic
                    className="phase-icon text-emerald-400 shrink-0 mt-0.5"
                    size={16}
                  />
                  <p className="wrap-break-word whitespace-pre-wrap text-foreground">
                    {msg.content}
                  </p>
                </div>
              )}
              {msg.type === "tool" && (
                <div className="flex items-center gap-2.5">
                  <Cog
                    className="phase-icon text-blue-400 shrink-0"
                    size={16}
                  />
                  <p className="wrap-break-word whitespace-pre-wrap text-blue-300/80">
                    {msg.content}
                  </p>
                </div>
              )}
              {msg.type === "assistant" && (
                <div className="flex items-start gap-2.5 text-left">
                  <Sparkles
                    className="phase-icon text-violet-400 shrink-0 mt-0.5"
                    size={16}
                  />
                  <div className="markdown-content min-w-0">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Live transcription during recording */}
          {showRecording && (
            <div className="flex items-start gap-2.5 text-left">
              <Mic
                className="phase-icon text-emerald-400 shrink-0 mt-0.5"
                size={16}
              />
              <p className="wrap-break-word whitespace-pre-wrap">
                {confirmedText && (
                  <span className="text-foreground">{confirmedText}</span>
                )}
                {pendingText && (
                  <span className="text-muted-foreground">{pendingText}</span>
                )}
              </p>
            </div>
          )}

          {/* Thinking dots */}
          {phase === "thinking" && (
            <div className="flex gap-2 justify-center items-center py-1">
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
