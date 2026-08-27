import type { LucideIcon } from "lucide-react";

import { cn } from "../../lib/cn";

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  tone?: "brand" | "positive" | "warning" | "danger" | "neutral";
}

const TONES = {
  brand: "bg-brand/10 text-brand",
  positive: "bg-positive/10 text-positive",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
  neutral: "bg-elevated text-muted",
};

export function StatCard({ label, value, hint, icon: Icon, tone = "neutral" }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted">{label}</p>
          <p className="mt-1.5 truncate text-2xl font-semibold tabular-nums tracking-tight text-ink">
            {value}
          </p>
          {hint && <p className="mt-1 truncate text-[11px] text-faint">{hint}</p>}
        </div>
        <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", TONES[tone])}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}
