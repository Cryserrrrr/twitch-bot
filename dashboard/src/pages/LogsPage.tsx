import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollText } from "lucide-react";

import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/Feedback";
import { Select } from "../components/ui/Field";
import { PageHeader } from "../components/ui/PageHeader";
import { Switch } from "../components/ui/Switch";
import { useRealtime } from "../context/RealtimeContext";
import { useI18n } from "../i18n";
import { cn } from "../lib/cn";
import { formatTime } from "../lib/format";
import type { LogEntry } from "../lib/types";
import { useFetch } from "../lib/useFetch";

const LEVELS = ["debug", "info", "warn", "error"] as const;

const LEVEL_STYLES: Record<string, string> = {
  debug: "text-faint",
  info: "text-brand",
  warn: "text-warning",
  error: "text-danger",
};

export function LogsPage() {
  const { t, language } = useI18n();
  const { logs: live } = useRealtime();
  const { data: history } = useFetch<LogEntry[]>("/logs");

  const [level, setLevel] = useState<string>("all");
  const [autoscroll, setAutoscroll] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  // History covers what happened before the socket opened; live extends it.
  const entries = useMemo(() => {
    const seen = new Set<string>();
    const merged: LogEntry[] = [];

    for (const entry of [...(history ?? []), ...live]) {
      const key = `${entry.time}:${entry.scope}:${entry.message}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(entry);
    }

    return level === "all"
      ? merged
      : merged.filter((entry) => entry.level === level);
  }, [history, live, level]);

  useEffect(() => {
    if (autoscroll) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries, autoscroll]);

  return (
    <>
      <PageHeader
        title={t("logs.title")}
        description={t("logs.subtitle")}
        action={
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-muted">
              <Switch checked={autoscroll} onChange={setAutoscroll} />
              {t("logs.autoscroll")}
            </label>
            <Select
              value={level}
              onChange={(event) => setLevel(event.target.value)}
              className="h-8 w-32 text-xs"
            >
              <option value="all">{t("common.all")}</option>
              {LEVELS.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </Select>
          </div>
        }
      />

      <Card className="h-[calc(100vh-13rem)] overflow-hidden">
        <div className="h-full overflow-y-auto scrollbar-thin p-3 font-mono text-[11px] leading-relaxed">
          {entries.length === 0 ? (
            <EmptyState icon={<ScrollText className="h-5 w-5" />} title={t("logs.empty")} />
          ) : (
            entries.map((entry, index) => (
              <div
                key={`${entry.time}-${index}`}
                className="flex gap-3 rounded px-2 py-0.5 hover:bg-elevated/60"
              >
                <span className="shrink-0 tabular-nums text-faint">
                  {formatTime(entry.time, language)}
                </span>
                <span className={cn("w-12 shrink-0 uppercase", LEVEL_STYLES[entry.level])}>
                  {entry.level}
                </span>
                <span className="w-24 shrink-0 truncate text-muted">{entry.scope}</span>
                <span className="min-w-0 flex-1 break-words text-ink">{entry.message}</span>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </Card>
    </>
  );
}
