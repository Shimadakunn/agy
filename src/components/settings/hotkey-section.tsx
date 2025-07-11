import { useState, useEffect, useCallback } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface HotkeySectionProps {
  hotkey: AppSettings["hotkey"];
  onHotkeyChange: (hotkey: AppSettings["hotkey"]) => void;
}

export function HotkeySection({ hotkey, onHotkeyChange }: HotkeySectionProps) {
  const [capturing, setCapturing] = useState(false);

  const startCapture = useCallback(() => {
    setCapturing(true);
    window.electron.startHotkeyCapture();
  }, []);

  const cancelCapture = useCallback(() => {
    setCapturing(false);
    window.electron.cancelHotkeyCapture();
  }, []);

  useEffect(() => {
    if (!capturing) return;

    const unsub = window.electron.onHotkeyCaptured((data) => {
      setCapturing(false);
      onHotkeyChange({
        ...hotkey,
        keycode: data.keycode,
        keyName: data.keyName,
      });
    });

    return unsub;
  }, [capturing, hotkey, onHotkeyChange]);

  useEffect(() => {
    if (!capturing) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cancelCapture();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [capturing, cancelCapture]);

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-sm font-semibold">Hotkey</h2>

      <div className="flex flex-col gap-1.5">
        <Label>Push-to-talk key</Label>
        <p className="text-[11px] text-muted-foreground">
          The key to hold (or press) to start voice recording.
        </p>

        <div className="flex items-center gap-2 mt-1">
          <div
            className={cn(
              "flex h-7 min-w-24 items-center justify-center rounded-md border px-3 text-xs font-mono transition-all",
              capturing
                ? "border-primary/50 bg-primary/10 text-primary animate-pulse"
                : "border-border bg-input/20 text-foreground",
            )}
          >
            {capturing ? "Press any key..." : hotkey.keyName}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={capturing ? cancelCapture : startCapture}
          >
            {capturing ? "Cancel" : "Change"}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Mode</Label>
        <p className="text-[11px] text-muted-foreground">
          How the hotkey triggers recording.
        </p>

        <div className="flex gap-1 rounded-md bg-input/20 p-0.5 w-fit mt-1">
          <button
            onClick={() => onHotkeyChange({ ...hotkey, mode: "hold" })}
            className={cn(
              "rounded px-3 py-1 text-xs font-medium transition-colors",
              hotkey.mode === "hold"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Hold
          </button>
          <button
            onClick={() => onHotkeyChange({ ...hotkey, mode: "toggle" })}
            className={cn(
              "rounded px-3 py-1 text-xs font-medium transition-colors",
              hotkey.mode === "toggle"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Toggle
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground/60">
          {hotkey.mode === "hold"
            ? "Hold the key to record, release to stop."
            : "Press once to start, press again to stop."}
        </p>
      </div>
    </div>
  );
}
