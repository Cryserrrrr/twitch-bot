import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

import { cn } from "../../lib/cn";

export function StatusDot({
  state,
  className,
}: {
  state: "on" | "off" | "warn";
  className?: string;
}) {
  const color =
    state === "on" ? "bg-positive" : state === "warn" ? "bg-warning" : "bg-faint";

  return (
    <span className={cn("relative flex h-2 w-2", className)}>
      {state === "on" && (
        <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-60 animate-pulse-ring", color)} />
      )}
      <span className={cn("relative inline-flex h-2 w-2 rounded-full", color)} />
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      {icon && (
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-elevated text-faint">
          {icon}
        </span>
      )}
      <div>
        <p className="text-sm font-medium text-ink">{title}</p>
        {description && <p className="mt-1 text-xs text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center py-12", className)}>
      <Loader2 className="h-5 w-5 animate-spin text-faint" />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-elevated", className)} />;
}
