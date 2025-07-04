import { useCallback, useEffect, useRef, useState } from "react";
import {
  MicIcon,
  SquareIcon,
  LoaderIcon,
  WrenchIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Status = "idle" | "recording" | "finalizing" | "generating";

type AudioDevice = { label: string; value: string };

type ToolAction = {
  id: string;
  name: string;
  args: Record<string, unknown>;
  status: "running" | "done" | "error";
  result?: string;
};

const TOOL_LABELS: Record<string, string> = {
  open_application: "Opening app",
  quit_application: "Quitting app",
  list_running_applications: "Listing apps",
  get_frontmost_application: "Getting active app",
  open_url: "Opening URL",
  search_files: "Searching files",
  read_file: "Reading file",
  set_volume: "Setting volume",
  take_screenshot: "Taking screenshot",
  type_text: "Typing text",
  press_key: "Pressing key",
  get_clipboard: "Reading clipboard",
  set_clipboard: "Setting clipboard",
  run_applescript: "Running AppleScript",
};

function formatToolLabel(name: string, args: Record<string, unknown>): string {
  const base = TOOL_LABELS[name] ?? name;
  const target = (args.name ?? args.url ?? args.path ?? args.query) as
    | string
    | undefined;
  if (target) return `${base}: ${target}`;
  if (name === "set_volume" && args.level != null)
    return `${base}: ${args.level}%`;
  return base;
}

/** Convert Float32 audio samples [-1, 1] to PCM signed 16-bit little-endian. */
function float32ToPcmS16le(input: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

function useAudioDevices() {
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

export function Transcription() {
  const [status, setStatus] = useState<Status>("idle");
  const [transcript, setTranscript] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [toolActions, setToolActions] = useState<ToolAction[]>([]);

  const devices = useAudioDevices();

  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  useEffect(() => {
    const removeDelta = window.electron.onTranscriptionDelta((text) => {
      setTranscript((prev) => prev + text);
    });

    const removeDone = window.electron.onTranscriptionDone(async (text) => {
      setTranscript(text);

      if (!text.trim()) {
        setError("No speech detected. Try recording again.");
        setStatus("idle");
        return;
      }

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
    });

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
      removeTranscriptionError();
      removeChatChunk();
      removeToolExecuting();
      removeToolResult();
    };
  }, []);

  const cleanupAudio = useCallback(() => {
    processorRef.current?.disconnect();
    processorRef.current = null;

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    setTranscript("");

    const audioConstraints: MediaTrackConstraints = selectedDeviceId
      ? { deviceId: { exact: selectedDeviceId } }
      : {};

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
      });
    } catch {
      setError(
        "Microphone access denied. Please allow microphone permissions.",
      );
      return;
    }

    streamRef.current = stream;

    try {
      await window.electron.startTranscription();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to start transcription",
      );
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      return;
    }

    const audioContext = new AudioContext({ sampleRate: 16000 });
    audioContextRef.current = audioContext;

    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;

    processor.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0);
      window.electron.sendAudioChunk(float32ToPcmS16le(input));
    };

    source.connect(processor);
    const silentGain = audioContext.createGain();
    silentGain.gain.value = 0;
    processor.connect(silentGain);
    silentGain.connect(audioContext.destination);

    setStatus("recording");
    window.electron.setRecordingGlow(true);
  }, [selectedDeviceId, cleanupAudio]);

  const stopRecording = useCallback(async () => {
    cleanupAudio();
    window.electron.setRecordingGlow(false);
    setStatus("finalizing");
    await window.electron.stopTranscription();
  }, [cleanupAudio]);

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Speech to Text</CardTitle>
          <CardDescription>
            Record audio, transcribe it, and get an AI response from Mistral
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {devices.length > 0 && (
            <Select
              items={devices}
              value={selectedDeviceId}
              onValueChange={setSelectedDeviceId}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Default microphone" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {devices.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          )}

          <div className="flex items-center gap-3">
            {status === "recording" ? (
              <Button variant="destructive" size="lg" onClick={stopRecording}>
                <SquareIcon data-icon="inline-start" />
                Stop Recording
              </Button>
            ) : (
              <Button
                size="lg"
                onClick={startRecording}
                disabled={status === "finalizing" || status === "generating"}
              >
                {status === "finalizing" || status === "generating" ? (
                  <LoaderIcon
                    data-icon="inline-start"
                    className="animate-spin"
                  />
                ) : (
                  <MicIcon data-icon="inline-start" />
                )}
                {status === "finalizing"
                  ? "Finalizing..."
                  : status === "generating"
                    ? "Generating..."
                    : "Start Recording"}
              </Button>
            )}

            {status === "recording" && (
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="size-2 animate-pulse rounded-full bg-destructive" />
                Listening...
              </span>
            )}
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          {(transcript || status === "recording") && (
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium text-muted-foreground">
                You said:
              </p>
              <p className="rounded-md bg-muted px-3 py-2 text-sm italic">
                {transcript || (
                  <span className="text-muted-foreground">Listening...</span>
                )}
              </p>
            </div>
          )}

          {toolActions.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                Actions:
              </p>
              <div className="flex flex-col gap-1">
                {toolActions.map((action) => (
                  <div
                    key={action.id}
                    className="flex items-center gap-2 rounded-md bg-muted px-3 py-1.5 text-xs"
                  >
                    {action.status === "running" ? (
                      <LoaderIcon className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
                    ) : action.status === "done" ? (
                      <CheckCircleIcon className="size-3.5 shrink-0 text-green-600" />
                    ) : (
                      <XCircleIcon className="size-3.5 shrink-0 text-destructive" />
                    )}
                    <WrenchIcon className="size-3 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 truncate">
                      {formatToolLabel(action.name, action.args)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(aiResponse || status === "generating") && (
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium text-muted-foreground">
                Mistral:
              </p>
              <div className="min-h-24 whitespace-pre-wrap rounded-md border px-3 py-2 text-sm">
                {aiResponse || (
                  <span className="text-muted-foreground">Thinking...</span>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
