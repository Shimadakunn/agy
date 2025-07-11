import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const THEME_OPTIONS = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

interface AppearanceSectionProps {
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
}

export function AppearanceSection({
  theme,
  onThemeChange,
}: AppearanceSectionProps) {
  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-sm font-semibold">Appearance</h2>

      <div className="flex flex-col gap-1.5">
        <Label>Theme</Label>
        <p className="text-[11px] text-muted-foreground">
          Choose how the app looks. System follows your OS preference.
        </p>
        <Select
          items={THEME_OPTIONS}
          value={theme}
          onValueChange={(value) => onThemeChange(value as ThemeMode)}
        >
          <SelectTrigger className="w-full mt-1">
            <SelectValue placeholder="System" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {THEME_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
