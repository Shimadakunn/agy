import { useState, useEffect, useCallback } from "react";
import { Mic, Accessibility, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type PermKey = "microphone" | "accessibility" | "screenRecording";

const PERMISSION_INFO: {
  key: PermKey;
  label: string;
  description: string;
  icon: typeof Mic;
}[] = [
  {
    key: "microphone",
    label: "Microphone",
    description: "Required for voice recording.",
    icon: Mic,
  },
  {
    key: "accessibility",
    label: "Accessibility",
    description: "Required for global hotkey and keyboard automation.",
    icon: Accessibility,
  },
  {
    key: "screenRecording",
    label: "Screen Recording",
    description: "Required for the screenshot tool.",
    icon: Monitor,
  },
];

const STATUS_LABELS: Record<string, string> = {
  granted: "Granted",
  denied: "Denied",
  "not-determined": "Not Asked",
  restricted: "Restricted",
  unknown: "Unknown",
};

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  granted: "default",
  denied: "destructive",
  "not-determined": "outline",
  restricted: "destructive",
  unknown: "outline",
};

export function PermissionsSection() {
  const [permissions, setPermissions] = useState<PermissionsState | null>(null);

  const refresh = useCallback(() => {
    window.electron.checkPermissions().then(setPermissions);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleRequest = useCallback(
    async (type: string) => {
      await window.electron.requestPermission(type);
      // re-check after a short delay to let the OS update
      setTimeout(refresh, 1000);
    },
    [refresh],
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Permissions</h2>
        <Button variant="ghost" size="xs" onClick={refresh}>
          Refresh
        </Button>
      </div>

      {!permissions ? (
        <p className="text-xs text-muted-foreground">Checking...</p>
      ) : (
        <div className="flex flex-col gap-3">
          {PERMISSION_INFO.map(({ key, label, description, icon: Icon }) => {
            const status = permissions[key] as string;
            const isGranted = status === "granted";

            return (
              <div
                key={key}
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-3",
                  isGranted
                    ? "border-border/50 bg-card/30"
                    : "border-destructive/20 bg-destructive/5",
                )}
              >
                <Icon
                  size={16}
                  className={cn(
                    "shrink-0",
                    isGranted ? "text-primary" : "text-destructive",
                  )}
                />

                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">{label}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {description}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Badge
                    variant={STATUS_VARIANTS[status]}
                    className="text-[10px]"
                  >
                    {STATUS_LABELS[status]}
                  </Badge>
                  {!isGranted && (
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => handleRequest(key)}
                    >
                      Grant
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground/60">
        Some permissions require granting access in System Settings. After
        granting, click Refresh.
      </p>
    </div>
  );
}
