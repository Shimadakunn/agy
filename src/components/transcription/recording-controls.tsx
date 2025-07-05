import { MicIcon, SquareIcon, LoaderIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AudioDevice, Status } from "./types";

interface RecordingControlsProps {
  status: Status;
  devices: AudioDevice[];
  selectedDeviceId: string | null;
  onDeviceChange: (deviceId: string | null) => void;
  onStart: () => void;
  onStop: () => void;
}

export function RecordingControls({
  status,
  devices,
  selectedDeviceId,
  onDeviceChange,
  onStart,
  onStop,
}: RecordingControlsProps) {
  return (
    <>
      {devices.length > 0 && (
        <Select
          items={devices}
          value={selectedDeviceId}
          onValueChange={onDeviceChange}
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
          <Button variant="destructive" size="lg" onClick={onStop}>
            <SquareIcon data-icon="inline-start" />
            Stop Recording
          </Button>
        ) : (
          <Button
            size="lg"
            onClick={onStart}
            disabled={status === "finalizing" || status === "generating"}
          >
            {status === "finalizing" || status === "generating" ? (
              <LoaderIcon data-icon="inline-start" className="animate-spin" />
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
    </>
  );
}
