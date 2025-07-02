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

type Status = "idle" | "recording" | "transcribing" | "generating";

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

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
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
        // Find the last action with this name that is still running
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
      removeChatChunk();
      removeToolExecuting();
      removeToolResult();
    };
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);

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

    const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());

      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const buffer = await blob.arrayBuffer();

      setStatus("transcribing");
      try {
        const text = await window.electron.transcribeAudio(buffer);
        setTranscript(text);

        if (!text.trim()) {
          setError("No speech detected. Try recording again.");
          return;
        }

        setAiResponse("");
        setToolActions([]);
        setStatus("generating");
        await window.electron.chatWithMistral(text);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Transcription failed.");
      } finally {
        setStatus("idle");
      }
    };

    mediaRecorderRef.current = recorder;
    recorder.start();
    setStatus("recording");
  }, [selectedDeviceId]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
  }, []);

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
                disabled={status === "transcribing" || status === "generating"}
              >
                {status === "transcribing" || status === "generating" ? (
                  <LoaderIcon
                    data-icon="inline-start"
                    className="animate-spin"
                  />
                ) : (
                  <MicIcon data-icon="inline-start" />
                )}
                {status === "transcribing"
                  ? "Transcribing..."
                  : status === "generating"
                    ? "Generating..."
                    : "Start Recording"}
              </Button>
            )}

            {status === "recording" && (
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="size-2 animate-pulse rounded-full bg-destructive" />
                Recording...
              </span>
            )}
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          {transcript && (
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium text-muted-foreground">
                You said:
              </p>
              <p className="rounded-md bg-muted px-3 py-2 text-sm italic">
                {transcript}
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
