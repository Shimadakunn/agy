import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Status, ToolAction } from "./types";
import {
  useAudioDevices,
  useAudioRecording,
  useAssistantListeners,
  usePushToTalk,
} from "@/hooks/transcription";
import { RecordingControls } from "./recording-controls";
import { ToolActionList } from "./tool-action-list";

export function Transcription() {
  const [status, setStatus] = useState<Status>("idle");
  const [transcript, setTranscript] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [toolActions, setToolActions] = useState<ToolAction[]>([]);

  const devices = useAudioDevices();
  const { startRecording, stopRecording } = useAudioRecording(
    selectedDeviceId,
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

  usePushToTalk(status, startRecording, stopRecording);

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
          <RecordingControls
            status={status}
            devices={devices}
            selectedDeviceId={selectedDeviceId}
            onDeviceChange={setSelectedDeviceId}
            onStart={startRecording}
            onStop={stopRecording}
          />

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

          <ToolActionList actions={toolActions} />

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
