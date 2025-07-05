export type Status = "idle" | "recording" | "finalizing" | "generating";

export type AudioDevice = { label: string; value: string };

export type ToolAction = {
  id: string;
  name: string;
  args: Record<string, unknown>;
  status: "running" | "done" | "error";
  result?: string;
};
