import type { ReactNode } from "react";

import { cn } from "../../lib/cn";

type Tone = "neutral" | "brand" | "positive" | "warning" | "danger";

const TONES: Record<Tone, string> = {
  neutral: "bg-elevated text-muted border-line",
  brand: "bg-brand/10 text-brand border-brand/20",
  positive: "bg-positive/10 text-positive border-positive/20",
  warning: "bg-warning/10 text-warning border-warning/20",
  danger: "bg-danger/10 text-danger border-danger/20",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium",
        TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
