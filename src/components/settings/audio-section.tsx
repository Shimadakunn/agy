import { useAudioDevices } from "@/hooks/transcription";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AudioSectionProps {
  deviceId: string | null;
  onDeviceChange: (deviceId: string | null) => void;
}

export function AudioSection({ deviceId, onDeviceChange }: AudioSectionProps) {
  const devices = useAudioDevices();

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-sm font-semibold">Audio</h2>

      <div className="flex flex-col gap-1.5">
        <Label>Microphone</Label>
        <p className="text-[11px] text-muted-foreground">
          Select which microphone to use for voice recording.
        </p>
        {devices.length > 0 ? (
          <Select
            items={devices}
            value={deviceId}
            onValueChange={onDeviceChange}
          >
            <SelectTrigger className="w-full mt-1">
              <SelectValue placeholder="System default" />
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
        ) : (
          <p className="text-[11px] text-muted-foreground/60 italic mt-1">
            No microphones detected
          </p>
        )}
      </div>
    </div>
  );
}
