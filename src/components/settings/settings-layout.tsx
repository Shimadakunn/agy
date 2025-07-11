import { useState, type ReactNode } from "react";
import { Mic, Keyboard, Palette, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type Section = "audio" | "hotkey" | "appearance" | "permissions";

const NAV_ITEMS: { id: Section; label: string; icon: typeof Mic }[] = [
  { id: "audio", label: "Audio", icon: Mic },
  { id: "hotkey", label: "Hotkey", icon: Keyboard },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "permissions", label: "Permissions", icon: ShieldCheck },
];

interface SettingsLayoutProps {
  children: Record<Section, ReactNode>;
}

export function SettingsLayout({ children }: SettingsLayoutProps) {
  const [active, setActive] = useState<Section>("audio");
  const isMac = window.electron.platform === "darwin";

  return (
    <div className="flex h-screen overflow-hidden select-none">
      <aside
        className="flex w-44 shrink-0 flex-col border-r border-border bg-card/50"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      >
        {isMac && <div className="h-13 shrink-0" />}

        <nav
          className="flex flex-col gap-0.5 px-2 py-2"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActive(id)}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                active === id
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto p-6">{children[active]}</main>
    </div>
  );
}
