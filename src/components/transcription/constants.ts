export const TOOL_LABELS: Record<string, string> = {
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

export function formatToolLabel(
  name: string,
  args: Record<string, unknown>,
): string {
  const base = TOOL_LABELS[name] ?? name;
  const target = (args.name ?? args.url ?? args.path ?? args.query) as
    | string
    | undefined;
  if (target) return `${base}: ${target}`;
  if (name === "set_volume" && args.level != null)
    return `${base}: ${args.level}%`;
  return base;
}
