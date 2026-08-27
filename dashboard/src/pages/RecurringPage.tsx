import { useState } from "react";
import { Pause, Pencil, Play, Plus, Timer, Trash2 } from "lucide-react";

import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { EmptyState, Spinner } from "../components/ui/Feedback";
import { Field, Input, Textarea } from "../components/ui/Field";
import { Modal } from "../components/ui/Modal";
import { PageHeader } from "../components/ui/PageHeader";
import { Switch } from "../components/ui/Switch";
import { Table, Td, Th, Tr } from "../components/ui/Table";
import { useToast } from "../components/ui/Toast";
import { useRealtime } from "../context/RealtimeContext";
import { useI18n } from "../i18n";
import { api } from "../lib/api";
import { formatRelative } from "../lib/format";
import type { RecurringMessage } from "../lib/types";
import { useFetch } from "../lib/useFetch";

interface Response {
  messages: RecurringMessage[];
  live: boolean;
}

interface Draft {
  id?: number;
  message: string;
  intervalMinutes: number;
}

export function RecurringPage() {
  const { t, language } = useI18n();
  const { push } = useToast();
  const { status } = useRealtime();
  const { data, loading, setData } = useFetch<Response>("/recurring-messages");

  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<RecurringMessage | null>(null);

  const live = status?.live ?? data?.live ?? false;

  const save = async () => {
    if (!draft?.message.trim()) return;
    setSaving(true);

    try {
      const response = draft.id
        ? await api.patch<Response>(`/recurring-messages/${draft.id}`, {
            message: draft.message,
            intervalMinutes: draft.intervalMinutes,
          })
        : await api.post<Response>("/recurring-messages", {
            message: draft.message,
            intervalMinutes: draft.intervalMinutes,
          });

      setData({ messages: response.messages, live });
      setDraft(null);
      push(t("common.saved"), "success");
    } catch {
      push(t("common.error"), "error");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (message: RecurringMessage) => {
    const response = await api.patch<Response>(`/recurring-messages/${message.id}`, {
      enabled: message.enabled === 0,
    });
    setData({ messages: response.messages, live });
  };

  const remove = async () => {
    if (!deleting) return;
    const response = await api.delete<Response>(`/recurring-messages/${deleting.id}`);
    setData({ messages: response.messages, live });
    setDeleting(null);
  };

  return (
    <>
      <PageHeader
        title={t("recurring.title")}
        description={t("recurring.subtitle")}
        action={
          <Button
            variant="primary"
            onClick={() => setDraft({ message: "", intervalMinutes: 30 })}
          >
            <Plus className="h-4 w-4" />
            {t("recurring.newMessage")}
          </Button>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <Badge tone={live ? "positive" : "neutral"}>
          {live ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
          {live ? t("recurring.runningHint") : t("recurring.pausedHint")}
        </Badge>
      </div>

      <Card className="overflow-hidden">
        {loading && !data ? (
          <Spinner />
        ) : data?.messages.length ? (
          <Table>
            <thead>
              <tr>
                <Th>{t("recurring.message")}</Th>
                <Th className="w-32">{t("recurring.interval")}</Th>
                <Th className="w-36">{t("recurring.lastSent")}</Th>
                <Th className="w-24">{t("common.enabled")}</Th>
                <Th className="w-24" />
              </tr>
            </thead>
            <tbody>
              {data.messages.map((message) => (
                <Tr key={message.id}>
                  <Td className="max-w-lg truncate text-xs">{message.message}</Td>
                  <Td className="text-xs tabular-nums text-muted">
                    {message.interval_minutes} {t("common.minutes")}
                  </Td>
                  <Td className="text-xs text-muted">
                    {message.last_sent
                      ? formatRelative(message.last_sent, language)
                      : t("common.never")}
                  </Td>
                  <Td>
                    <Switch
                      checked={message.enabled !== 0}
                      onChange={() => toggle(message)}
                    />
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setDraft({
                            id: message.id,
                            message: message.message,
                            intervalMinutes: message.interval_minutes,
                          })
                        }
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hover:text-danger"
                        onClick={() => setDeleting(message)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState
            icon={<Timer className="h-5 w-5" />}
            title={t("recurring.empty")}
            description={t("recurring.emptyHint")}
            action={
              <Button
                variant="primary"
                size="sm"
                onClick={() => setDraft({ message: "", intervalMinutes: 30 })}
              >
                <Plus className="h-3.5 w-3.5" />
                {t("recurring.newMessage")}
              </Button>
            }
          />
        )}
      </Card>

      <Modal
        open={draft !== null}
        title={draft?.id ? t("recurring.editMessage") : t("recurring.newMessage")}
        onClose={() => setDraft(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDraft(null)}>
              {t("common.cancel")}
            </Button>
            <Button variant="primary" onClick={save} loading={saving}>
              {t("common.save")}
            </Button>
          </>
        }
      >
        {draft && (
          <div className="space-y-4">
            <Field label={t("recurring.message")}>
              <Textarea
                value={draft.message}
                onChange={(event) => setDraft({ ...draft, message: event.target.value })}
              />
            </Field>

            <Field label={`${t("recurring.interval")} (${t("common.minutes")})`}>
              <Input
                type="number"
                min={1}
                max={720}
                value={draft.intervalMinutes}
                onChange={(event) =>
                  setDraft({ ...draft, intervalMinutes: Number(event.target.value) })
                }
              />
            </Field>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        name={deleting?.message.slice(0, 60) ?? ""}
        onCancel={() => setDeleting(null)}
        onConfirm={remove}
      />
    </>
  );
}
