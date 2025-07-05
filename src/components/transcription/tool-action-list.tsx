import {
  LoaderIcon,
  WrenchIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "lucide-react";
import type { ToolAction } from "./types";
import { formatToolLabel } from "./constants";

interface ToolActionListProps {
  actions: ToolAction[];
}

export function ToolActionList({ actions }: ToolActionListProps) {
  if (actions.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium text-muted-foreground">Actions:</p>
      <div className="flex flex-col gap-1">
        {actions.map((action) => (
          <div
            key={action.id}
            className="flex items-center gap-2 rounded-md bg-muted px-3 py-1.5 text-xs"
          >
            {action.status === "running" ? (
              <LoaderIcon className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
            ) : action.status === "done" ? (
              <CheckCircleIcon className="size-3.5 shrink-0 text-green-600" />
            ) : (
              <XCircleIcon className="size-3.5 shrink-0 text-destructive" />
            )}
            <WrenchIcon className="size-3 shrink-0 text-muted-foreground" />
            <span className="min-w-0 truncate">
              {formatToolLabel(action.name, action.args)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
