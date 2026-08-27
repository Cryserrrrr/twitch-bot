import { useEffect, useRef, useState, type FormEvent } from "react";
import { MessageSquare, Send } from "lucide-react";

import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState, StatusDot } from "../components/ui/Feedback";
import { Input } from "../components/ui/Field";
import { PageHeader } from "../components/ui/PageHeader";
import { Switch } from "../components/ui/Switch";
import { useToast } from "../components/ui/Toast";
import { useRealtime } from "../context/RealtimeContext";
import { useI18n } from "../i18n";
import { api } from "../lib/api";
import { formatTime } from "../lib/format";

const BADGE_LABELS: Record<string, string> = {
  broadcaster: "STR",
  moderator: "MOD",
  vip: "VIP",
  subscriber: "SUB",
};

export function ChatPage() {
  const { t, language } = useI18n();
  const { chat, status } = useRealtime();
  const { push } = useToast();

  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [autoscroll, setAutoscroll] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoscroll) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, autoscroll]);

  const online = status?.chat.connected ?? false;

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const text = message.trim();
    if (!text) return;

    setSending(true);
    try {
      await api.post("/chat/say", { message: text });
      setMessage("");
    } catch {
      push(t("chat.offline"), "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <PageHeader
        title={t("chat.title")}
        description={t("chat.subtitle")}
        action={
          <label className="flex items-center gap-2 text-xs text-muted">
            <Switch checked={autoscroll} onChange={setAutoscroll} label={t("chat.autoscroll")} />
            {t("chat.autoscroll")}
          </label>
        }
      />

      <Card className="flex h-[calc(100vh-14rem)] flex-col overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line px-5 py-3">
          <StatusDot state={online ? "on" : "off"} />
          <span className="text-xs font-medium text-ink">
            #{status?.chat.channel ?? "—"}
          </span>
          {status?.chat.identity && (
            <span className="text-[11px] text-faint">— {status.chat.identity}</span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin px-2 py-2">
          {chat.length === 0 ? (
            <EmptyState
              icon={<MessageSquare className="h-5 w-5" />}
              title={t("chat.empty")}
              description={online ? undefined : t("chat.offline")}
            />
          ) : (
            <ul className="space-y-0.5">
              {chat.map((entry) => (
                <li
                  key={entry.id}
                  className="flex gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors hover:bg-elevated/60"
                >
                  <span className="shrink-0 pt-0.5 text-[10px] tabular-nums text-faint">
                    {formatTime(entry.time, language)}
                  </span>

                  <div className="min-w-0 flex-1">
                    <span className="mr-1.5 inline-flex items-center gap-1">
                      {entry.badges
                        .filter((badge) => BADGE_LABELS[badge])
                        .map((badge) => (
                          <span
                            key={badge}
                            className="rounded bg-elevated px-1 text-[9px] font-semibold tracking-wide text-muted"
                          >
                            {BADGE_LABELS[badge]}
                          </span>
                        ))}
                      <span
                        className="font-semibold"
                        style={{ color: entry.color ?? undefined }}
                      >
                        {entry.displayName}
                      </span>
                    </span>
                    <span className="break-words text-ink">{entry.message}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={send} className="flex gap-2 border-t border-line p-3">
          <Input
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={t("chat.placeholder")}
            maxLength={480}
            disabled={!online}
          />
          <Button
            type="submit"
            variant="primary"
            loading={sending}
            disabled={!online || !message.trim()}
          >
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">{t("chat.send")}</span>
          </Button>
        </form>
      </Card>
    </>
  );
}
