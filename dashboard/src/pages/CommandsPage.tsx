import { useState } from "react";
import { Pencil, Plus, Terminal, Trash2 } from "lucide-react";

import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { EmptyState, Spinner } from "../components/ui/Feedback";
import { Field, Input, Select, Textarea } from "../components/ui/Field";
import { Modal } from "../components/ui/Modal";
import { PageHeader } from "../components/ui/PageHeader";
import { Switch } from "../components/ui/Switch";
import { Table, Td, Th, Tr } from "../components/ui/Table";
import { useToast } from "../components/ui/Toast";
import { useI18n } from "../i18n";
import { api, ApiError } from "../lib/api";
import { cn } from "../lib/cn";
import type { BuiltinCommand, CustomCommand } from "../lib/types";
import { useFetch } from "../lib/useFetch";

const PERMISSIONS = ["everyone", "subscriber", "vip", "moderator", "broadcaster"] as const;

interface CommandsResponse {
  builtin: BuiltinCommand[];
  custom: CustomCommand[];
}

interface Draft {
  name: string;
  content: string;
  permission: string;
  cooldownSeconds: number;
}

const EMPTY_DRAFT: Draft = {
  name: "",
  content: "",
  permission: "everyone",
  cooldownSeconds: 0,
};

export function CommandsPage() {
  const { t } = useI18n();
  const { push } = useToast();
  const { data, loading, refetch } = useFetch<CommandsResponse>("/commands");

  const [tab, setTab] = useState<"custom" | "builtin">("custom");
  const [editing, setEditing] = useState<CustomCommand | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<CustomCommand | null>(null);

  const openCreate = () => {
    setEditing(null);
    setError(null);
    setDraft({ ...EMPTY_DRAFT });
  };

  const openEdit = (command: CustomCommand) => {
    setEditing(command);
    setError(null);
    setDraft({
      name: command.name,
      content: command.content,
      permission: command.permission || "everyone",
      cooldownSeconds: command.cooldown_seconds || 0,
    });
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setError(null);

    try {
      if (editing) {
        await api.patch(`/commands/${encodeURIComponent(editing.name)}`, {
          content: draft.content,
          permission: draft.permission,
          cooldownSeconds: draft.cooldownSeconds,
        });
      } else {
        await api.post("/commands", draft);
      }

      setDraft(null);
      push(t("common.saved"), "success");
      refetch();
    } catch (caught) {
      const code = caught instanceof ApiError ? caught.code : "error";
      setError(
        code === "reserved_name"
          ? t("commands.reserved")
          : code === "invalid_name"
            ? t("commands.invalidName")
            : t("common.error")
      );
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (command: CustomCommand) => {
    await api.patch(`/commands/${encodeURIComponent(command.name)}`, {
      enabled: command.enabled === 0,
    });
    refetch();
  };

  const remove = async () => {
    if (!deleting) return;
    await api.delete(`/commands/${encodeURIComponent(deleting.name)}`);
    setDeleting(null);
    push(t("common.saved"), "success");
    refetch();
  };

  const tabs = [
    { key: "custom" as const, label: t("commands.custom"), count: data?.custom.length ?? 0 },
    { key: "builtin" as const, label: t("commands.builtin"), count: data?.builtin.length ?? 0 },
  ];

  return (
    <>
      <PageHeader
        title={t("commands.title")}
        description={t("commands.subtitle")}
        action={
          <Button variant="primary" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            {t("commands.newCommand")}
          </Button>
        }
      />

      <div className="mb-4 inline-flex rounded-lg border border-line bg-surface p-1">
        {tabs.map((entry) => (
          <button
            key={entry.key}
            onClick={() => setTab(entry.key)}
            className={cn(
              "focus-ring rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              tab === entry.key
                ? "bg-brand/10 text-brand"
                : "text-muted hover:text-ink"
            )}
          >
            {entry.label}
            <span className="ml-1.5 text-[10px] tabular-nums opacity-60">{entry.count}</span>
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        {loading && !data ? (
          <Spinner />
        ) : tab === "custom" ? (
          data?.custom.length ? (
            <Table>
              <thead>
                <tr>
                  <Th>{t("commands.name")}</Th>
                  <Th>{t("commands.content")}</Th>
                  <Th className="w-32">{t("commands.permission")}</Th>
                  <Th className="w-20 text-right">{t("commands.uses")}</Th>
                  <Th className="w-24">{t("common.enabled")}</Th>
                  <Th className="w-24" />
                </tr>
              </thead>
              <tbody>
                {data.custom.map((command) => (
                  <Tr key={command.id}>
                    <Td className="font-mono text-xs font-medium">!{command.name}</Td>
                    <Td className="max-w-md truncate text-xs text-muted">
                      {command.content}
                    </Td>
                    <Td>
                      <Badge>{t(`commands.permissions.${command.permission || "everyone"}`)}</Badge>
                    </Td>
                    <Td className="text-right text-xs tabular-nums text-muted">
                      {command.usage_count}
                    </Td>
                    <Td>
                      <Switch
                        checked={command.enabled !== 0}
                        onChange={() => toggle(command)}
                      />
                    </Td>
                    <Td>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(command)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleting(command)}
                          className="hover:text-danger"
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
              icon={<Terminal className="h-5 w-5" />}
              title={t("commands.empty")}
              description={t("commands.emptyHint")}
              action={
                <Button variant="primary" size="sm" onClick={openCreate}>
                  <Plus className="h-3.5 w-3.5" />
                  {t("commands.newCommand")}
                </Button>
              }
            />
          )
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t("commands.name")}</Th>
                <Th>{t("commands.description")}</Th>
                <Th className="w-32">{t("commands.permission")}</Th>
                <Th className="w-24 text-right">{t("commands.cooldown")}</Th>
              </tr>
            </thead>
            <tbody>
              {data?.builtin.map((command) => (
                <Tr key={command.name}>
                  <Td>
                    <span className="font-mono text-xs font-medium">!{command.name}</span>
                    {command.aliases.length > 0 && (
                      <span className="ml-2 text-[10px] text-faint">
                        {command.aliases.map((alias) => `!${alias}`).join(" ")}
                      </span>
                    )}
                  </Td>
                  <Td className="text-xs text-muted">{command.description}</Td>
                  <Td>
                    <Badge tone={command.permission === "everyone" ? "neutral" : "brand"}>
                      {t(`commands.permissions.${command.permission}`)}
                    </Badge>
                  </Td>
                  <Td className="text-right text-xs tabular-nums text-muted">
                    {command.cooldown ? `${command.cooldown}s` : "—"}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Modal
        open={draft !== null}
        title={editing ? t("commands.editCommand") : t("commands.newCommand")}
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
            <Field label={t("commands.name")} error={error}>
              <Input
                value={draft.name}
                disabled={Boolean(editing)}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                placeholder="discord"
                className="font-mono"
              />
            </Field>

            <Field label={t("commands.content")} hint={t("commands.contentHint")}>
              <Textarea
                value={draft.content}
                onChange={(event) => setDraft({ ...draft, content: event.target.value })}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label={t("commands.permission")}>
                <Select
                  value={draft.permission}
                  onChange={(event) => setDraft({ ...draft, permission: event.target.value })}
                >
                  {PERMISSIONS.map((permission) => (
                    <option key={permission} value={permission}>
                      {t(`commands.permissions.${permission}`)}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label={`${t("commands.cooldown")} (${t("common.seconds")})`}>
                <Input
                  type="number"
                  min={0}
                  max={3600}
                  value={draft.cooldownSeconds}
                  onChange={(event) =>
                    setDraft({ ...draft, cooldownSeconds: Number(event.target.value) })
                  }
                />
              </Field>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        name={deleting ? `!${deleting.name}` : ""}
        onCancel={() => setDeleting(null)}
        onConfirm={remove}
      />
    </>
  );
}
