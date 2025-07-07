import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Status, ToolAction } from "./types";
import {
  useAudioDevices,
  useAudioRecording,
  useAssistantListeners,
  usePushToTalk,
} from "@/hooks/transcription";

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
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Settings</CardTitle>
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

          {error && <p className="text-xs text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
