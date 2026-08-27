import { useState, type FormEvent } from "react";
import { Link2, RefreshCw, Shield, Trash2, Users } from "lucide-react";

import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { EmptyState } from "../components/ui/Feedback";
import { Input, Select } from "../components/ui/Field";
import { PageHeader } from "../components/ui/PageHeader";
import { Switch } from "../components/ui/Switch";
import { Table, Td, Th, Tr } from "../components/ui/Table";
import { useToast } from "../components/ui/Toast";
import { useI18n } from "../i18n";
import { api } from "../lib/api";
import type { AllowedLink, BannedWord, Moderator, Settings } from "../lib/types";
import { useFetch } from "../lib/useFetch";

const ACTIONS = ["delete", "timeout", "ban"] as const;

function FilterRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm text-ink">{label}</p>
        <p className="mt-0.5 text-xs text-muted">{hint}</p>
      </div>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

export function ModerationPage() {
  const { t } = useI18n();
  const { push } = useToast();

  const settings = useFetch<{ settings: Settings }>("/settings");
  const words = useFetch<BannedWord[]>("/moderation/banned-words");
  const links = useFetch<AllowedLink[]>("/moderation/allowed-links");
  const moderators = useFetch<Moderator[]>("/moderators");

  const [newWord, setNewWord] = useState("");
  const [newAction, setNewAction] = useState<string>("timeout");
  const [newDuration, setNewDuration] = useState(300);
  const [newDomain, setNewDomain] = useState("");
  const [syncing, setSyncing] = useState(false);

  const values = settings.data?.settings;

  const updateSetting = async (key: string, value: boolean) => {
    const updated = await api.patch<{ settings: Settings }>("/settings", { [key]: value });
    settings.setData({ settings: updated.settings });
  };

  const addWord = async (event: FormEvent) => {
    event.preventDefault();
    if (!newWord.trim()) return;

    await api.post("/moderation/banned-words", {
      word: newWord.trim(),
      action: newAction,
      duration: newDuration,
    });
    setNewWord("");
    words.refetch();
  };

  const addDomain = async (event: FormEvent) => {
    event.preventDefault();
    if (!newDomain.trim()) return;

    await api.post("/moderation/allowed-links", { domain: newDomain.trim() });
    setNewDomain("");
    links.refetch();
  };

  const syncModerators = async () => {
    setSyncing(true);
    try {
      const result = await api.post<{ count: number }>("/moderators/refresh");
      push(t("moderation.moderatorsSynced", { count: result.count }), "success");
      moderators.refetch();
    } catch {
      push(t("common.error"), "error");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <>
      <PageHeader title={t("moderation.title")} description={t("moderation.subtitle")} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title={t("moderation.filters")} icon={<Shield className="h-4 w-4" />} />
          <CardBody className="divide-y divide-line/60 py-1">
            <FilterRow
              label={t("moderation.bannedWordsToggle")}
              hint={t("moderation.bannedWordsHint")}
              checked={Boolean(values?.bannedWordsEnabled)}
              onChange={(value) => updateSetting("bannedWordsEnabled", value)}
            />
            <FilterRow
              label={t("moderation.linksToggle")}
              hint={t("moderation.linksHint")}
              checked={Boolean(values?.allowedLinksEnabled)}
              onChange={(value) => updateSetting("allowedLinksEnabled", value)}
            />
            <FilterRow
              label={t("moderation.capsToggle")}
              hint={t("moderation.capsHint")}
              checked={Boolean(values?.capsFilterEnabled)}
              onChange={(value) => updateSetting("capsFilterEnabled", value)}
            />
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title={t("moderation.bannedWords")}
            description={`${words.data?.length ?? 0}`}
          />
          <CardBody className="border-b border-line">
            <form onSubmit={addWord} className="flex flex-wrap gap-2">
              <Input
                value={newWord}
                onChange={(event) => setNewWord(event.target.value)}
                placeholder={t("moderation.word")}
                className="min-w-[10rem] flex-1"
              />
              <Select
                value={newAction}
                onChange={(event) => setNewAction(event.target.value)}
                className="w-56"
              >
                {ACTIONS.map((action) => (
                  <option key={action} value={action}>
                    {t(`moderation.actions.${action}`)}
                  </option>
                ))}
              </Select>
              {newAction === "timeout" && (
                <Input
                  type="number"
                  min={1}
                  value={newDuration}
                  onChange={(event) => setNewDuration(Number(event.target.value))}
                  className="w-24"
                />
              )}
              <Button type="submit" variant="primary">
                {t("common.add")}
              </Button>
            </form>
          </CardBody>

          {words.data?.length ? (
            <Table>
              <thead>
                <tr>
                  <Th>{t("moderation.word")}</Th>
                  <Th className="w-44">{t("moderation.action")}</Th>
                  <Th className="w-24 text-right">{t("moderation.duration")}</Th>
                  <Th className="w-12" />
                </tr>
              </thead>
              <tbody>
                {words.data.map((word) => (
                  <Tr key={word.id}>
                    <Td className="font-mono text-xs">{word.word}</Td>
                    <Td>
                      <Badge tone={word.action === "ban" ? "danger" : "warning"}>
                        {t(`moderation.actions.${word.action}`)}
                      </Badge>
                    </Td>
                    <Td className="text-right text-xs tabular-nums text-muted">
                      {word.action === "timeout" ? `${word.duration}s` : "—"}
                    </Td>
                    <Td>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hover:text-danger"
                        onClick={async () => {
                          await api.delete(
                            `/moderation/banned-words/${encodeURIComponent(word.word)}`
                          );
                          words.refetch();
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState icon={<Shield className="h-5 w-5" />} title={t("moderation.emptyWords")} />
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={t("moderation.allowedLinks")}
            icon={<Link2 className="h-4 w-4" />}
          />
          <CardBody className="border-b border-line">
            <form onSubmit={addDomain} className="flex gap-2">
              <Input
                value={newDomain}
                onChange={(event) => setNewDomain(event.target.value)}
                placeholder="youtube.com"
              />
              <Button type="submit" variant="primary">
                {t("common.add")}
              </Button>
            </form>
          </CardBody>

          {links.data?.length ? (
            <ul className="divide-y divide-line/60">
              {links.data.map((link) => (
                <li key={link.id} className="flex items-center gap-3 px-5 py-2.5">
                  <span className="flex-1 truncate font-mono text-xs text-ink">
                    {link.domain}
                  </span>
                  <span className="text-[11px] text-faint">{link.added_by}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="hover:text-danger"
                    onClick={async () => {
                      await api.delete(
                        `/moderation/allowed-links/${encodeURIComponent(link.domain)}`
                      );
                      links.refetch();
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<Link2 className="h-5 w-5" />} title={t("moderation.emptyLinks")} />
          )}
        </Card>

        <Card>
          <CardHeader
            title={t("moderation.moderators")}
            icon={<Users className="h-4 w-4" />}
            action={
              <Button size="sm" onClick={syncModerators} loading={syncing}>
                <RefreshCw className="h-3.5 w-3.5" />
                {t("moderation.refreshModerators")}
              </Button>
            }
          />

          {moderators.data?.length ? (
            <ul className="divide-y divide-line/60">
              {moderators.data.map((moderator) => (
                <li key={moderator.id} className="flex items-center gap-3 px-5 py-2.5">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-brand/10 text-[11px] font-semibold text-brand">
                    {moderator.display_name[0]?.toUpperCase()}
                  </span>
                  <span className="flex-1 truncate text-xs text-ink">
                    {moderator.display_name}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<Users className="h-5 w-5" />}
              title={t("moderation.emptyModerators")}
            />
          )}
        </Card>
      </div>
    </>
  );
}
