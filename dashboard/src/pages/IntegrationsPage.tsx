import { useEffect, useState } from "react";
import { Gamepad2, Megaphone, Music, Radio, RefreshCw, Send, Video } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { StatusDot } from "../components/ui/Feedback";
import { Field, Input, Select, Textarea } from "../components/ui/Field";
import { PageHeader } from "../components/ui/PageHeader";
import { Switch } from "../components/ui/Switch";
import { useToast } from "../components/ui/Toast";
import { useAuth } from "../context/AuthContext";
import { useRealtime } from "../context/RealtimeContext";
import { useI18n } from "../i18n";
import { api, ApiError } from "../lib/api";
import { cn } from "../lib/cn";
import { useFetch } from "../lib/useFetch";

interface ObsState {
  enabled: boolean;
  connected: boolean;
  streaming: boolean;
  currentScene: string | null;
  scenes: string[];
}

interface ApexState {
  enabled: boolean;
  username: string;
  platform: string;
  api: { status: string; message: string };
  rank: { name: string; rankName: string; rankDiv: number; rankScore: number } | null;
}

type DiscordMention = "none" | "everyone" | "here" | "role";

interface DiscordState {
  enabled: boolean;
  configured: boolean;
  webhookId: string | null;
  message: string;
  defaultMessage: string;
  mention: DiscordMention;
  roleId: string;
  editOnEnd: boolean;
  lastAnnouncement: { startedAt: string | null; endedAt: string | null } | null;
}

function ConnectionBadge({ connected, label }: { connected: boolean; label: string }) {
  return (
    <Badge tone={connected ? "positive" : "neutral"}>
      <StatusDot state={connected ? "on" : "off"} />
      {label}
    </Badge>
  );
}

function SpotifyCard() {
  const { t } = useI18n();
  const { push } = useToast();
  const { user } = useAuth();
  const { status, track } = useRealtime();
  const [busy, setBusy] = useState(false);
  const [params, setParams] = useSearchParams();

  const spotify = status?.spotify;
  const isBroadcaster = user?.role === "broadcaster";

  // The OAuth callback comes back as a redirect, so its outcome is reported
  // through the URL rather than a response the dashboard could read.
  useEffect(() => {
    const outcome = params.get("spotify");
    if (!outcome) return;

    if (outcome === "connected") push(t("common.saved"), "success");
    else push(t("integrations.spotifyFailed"), "error");

    params.delete("spotify");
    setParams(params, { replace: true });
  }, [params, push, setParams, t]);

  const connect = async () => {
    setBusy(true);
    try {
      const { url } = await api.get<{ url: string }>("/integrations/spotify/authorize");
      window.location.href = url;
    } catch {
      push(t("common.error"), "error");
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await api.post("/integrations/spotify/disconnect");
      push(t("common.saved"), "success");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Spotify"
        icon={<Music className="h-4 w-4" />}
        action={
          <ConnectionBadge
            connected={Boolean(spotify?.connected)}
            label={spotify?.connected ? t("common.connected") : t("common.offline")}
          />
        }
      />
      <CardBody className="space-y-4">
        {!spotify?.enabled ? (
          <p className="text-xs text-muted">{t("integrations.spotifyDisabled")}</p>
        ) : (
          <>
            {spotify.state === "revoked" && (
              <p className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-ink">
                {t("integrations.spotifyRevoked")}
              </p>
            )}

            {spotify.connected ? (
              track ? (
                <div className="flex items-center gap-3">
                  {track.cover && (
                    <img src={track.cover} alt="" className="h-12 w-12 rounded-lg object-cover" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink">{track.name}</p>
                    <p className="truncate text-xs text-muted">{track.artists}</p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted">{t("integrations.nothingPlaying")}</p>
              )
            ) : (
              <p className="text-xs text-muted">{t("integrations.spotifyMissing")}</p>
            )}

            {isBroadcaster && (
              <div className="flex gap-2">
                {spotify.connected ? (
                  // Already linked: the only action left is unlinking.
                  <Button variant="ghost" size="sm" onClick={disconnect} loading={busy}>
                    {t("integrations.spotifyDisconnect")}
                  </Button>
                ) : (
                  <Button variant="primary" size="sm" onClick={connect} loading={busy}>
                    {spotify.state === "revoked"
                      ? t("integrations.spotifyReconnect")
                      : t("integrations.spotifyConnect")}
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}

function ObsCard() {
  const { t } = useI18n();
  const { push } = useToast();
  const { user } = useAuth();
  const { data, refetch } = useFetch<ObsState>("/integrations/obs");
  const [busy, setBusy] = useState(false);

  const switchScene = async (scene: string) => {
    setBusy(true);
    try {
      await api.post("/integrations/obs/scene", { scene });
      refetch();
    } catch {
      push(t("common.error"), "error");
    } finally {
      setBusy(false);
    }
  };

  const toggleStream = async () => {
    setBusy(true);
    try {
      await api.post("/integrations/obs/stream", { active: !data?.streaming });
      refetch();
    } catch {
      push(t("common.error"), "error");
    } finally {
      setBusy(false);
    }
  };

  const reconnect = async () => {
    setBusy(true);
    try {
      await api.post("/integrations/obs/reconnect");
      refetch();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="OBS Studio"
        icon={<Video className="h-4 w-4" />}
        action={
          <ConnectionBadge
            connected={Boolean(data?.connected)}
            label={data?.connected ? t("common.connected") : t("common.offline")}
          />
        }
      />
      <CardBody className="space-y-4">
        {!data?.enabled ? (
          <p className="text-xs text-muted">{t("integrations.obsDisabled")}</p>
        ) : !data.connected ? (
          <div className="space-y-3">
            <p className="text-xs text-muted">{t("integrations.obsOffline")}</p>
            <Button size="sm" onClick={reconnect} loading={busy}>
              <RefreshCw className="h-3.5 w-3.5" />
              {t("integrations.obsReconnect")}
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Badge tone={data.streaming ? "danger" : "neutral"}>
                <Radio className="h-3 w-3" />
                {data.streaming ? t("topbar.live") : t("topbar.offline")}
              </Badge>
              {user?.role === "broadcaster" && (
                <Button size="sm" variant="ghost" onClick={toggleStream} loading={busy}>
                  {data.streaming
                    ? t("integrations.obsStopStream")
                    : t("integrations.obsStartStream")}
                </Button>
              )}
            </div>

            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-faint">
                {t("integrations.obsScenes")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {data.scenes.map((scene) => (
                  <button
                    key={scene}
                    onClick={() => switchScene(scene)}
                    disabled={busy}
                    className={cn(
                      "focus-ring rounded-lg border px-2.5 py-1.5 text-xs transition-colors disabled:opacity-50",
                      scene === data.currentScene
                        ? "border-brand/40 bg-brand/10 font-medium text-brand"
                        : "border-line text-muted hover:bg-elevated hover:text-ink"
                    )}
                  >
                    {scene}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}

function ApexCard() {
  const { t } = useI18n();
  const { data } = useFetch<ApexState>("/integrations/apex");

  return (
    <Card>
      <CardHeader
        title="Apex Legends"
        icon={<Gamepad2 className="h-4 w-4" />}
        action={
          <ConnectionBadge
            connected={data?.api.status === "online"}
            label={data?.api.status === "online" ? t("common.connected") : t("common.offline")}
          />
        }
      />
      <CardBody className="space-y-3">
        {!data?.enabled ? (
          <p className="text-xs text-muted">{t("integrations.apexDisabled")}</p>
        ) : (
          <>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted">{t("integrations.apexPlayer")}</span>
              <span className="text-ink">
                {data.username} · {data.platform}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted">{t("integrations.apexRank")}</span>
              <span className="text-ink">
                {data.rank
                  ? `${data.rank.rankName} ${data.rank.rankDiv} — ${data.rank.rankScore} RP`
                  : "—"}
              </span>
            </div>
            {data.api.status !== "online" && (
              <p className="text-[11px] text-warning">{data.api.message}</p>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}

const DISCORD_ERRORS: Record<string, string> = {
  invalid_webhook_url: "integrations.discordInvalidUrl",
  role_id_required: "integrations.discordRoleRequired",
  invalid_role_id: "integrations.discordInvalidRole",
  message_too_long: "integrations.discordMessageTooLong",
  "Unknown Webhook": "integrations.discordUnknownWebhook",
};

function DiscordCard() {
  const { t } = useI18n();
  const { push } = useToast();
  const { user } = useAuth();
  const { data, setData } = useFetch<DiscordState>("/integrations/discord");
  const [draft, setDraft] = useState<DiscordState | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [busy, setBusy] = useState<"save" | "test" | "remove" | null>(null);

  const canEdit = user?.role === "broadcaster";

  useEffect(() => {
    if (data) setDraft(data);
  }, [data]);

  const fail = (error: unknown) => {
    const code = error instanceof ApiError ? error.code : "";
    push(DISCORD_ERRORS[code] ? t(DISCORD_ERRORS[code]) : t("common.error"), "error");
  };

  const save = async (
    patch: Partial<DiscordState> & { webhookUrl?: string },
    kind: "save" | "remove" = "save"
  ) => {
    setBusy(kind);
    try {
      const updated = await api.put<DiscordState>("/integrations/discord", patch);
      setData(updated);
      setWebhookUrl("");
      push(t("common.saved"), "success");
    } catch (error) {
      fail(error);
    } finally {
      setBusy(null);
    }
  };

  const submit = () => {
    if (!draft) return;
    save({
      enabled: draft.enabled,
      message: draft.message,
      mention: draft.mention,
      roleId: draft.roleId,
      editOnEnd: draft.editOnEnd,
      // Left empty, the stored webhook is kept: it is never sent back to the browser.
      ...(webhookUrl.trim() ? { webhookUrl: webhookUrl.trim() } : {}),
    });
  };

  const sendTest = async () => {
    setBusy("test");
    try {
      await api.post("/integrations/discord/test");
      push(t("integrations.discordTestSent"), "success");
    } catch (error) {
      fail(error);
    } finally {
      setBusy(null);
    }
  };

  const update = <K extends keyof DiscordState>(key: K, value: DiscordState[K]) =>
    setDraft((current) => (current ? { ...current, [key]: value } : current));

  const active = Boolean(data?.enabled && data.configured);

  return (
    <Card className="lg:col-span-2">
      <CardHeader
        title="Discord"
        description={t("integrations.discordHint")}
        icon={<Megaphone className="h-4 w-4" />}
        action={
          <ConnectionBadge
            connected={active}
            label={active ? t("common.enabled") : t("common.disabled")}
          />
        }
      />
      {draft && (
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-ink">{t("integrations.discordEnabled")}</span>
            <Switch
              checked={draft.enabled}
              onChange={(value) => update("enabled", value)}
              disabled={!canEdit}
              label={t("integrations.discordEnabled")}
            />
          </div>

          <Field
            label={t("integrations.discordWebhook")}
            hint={
              draft.configured
                ? t("integrations.discordWebhookSet", { id: draft.webhookId ?? "" })
                : t("integrations.discordWebhookHint")
            }
          >
            <div className="flex gap-2">
              <Input
                type="password"
                autoComplete="off"
                value={webhookUrl}
                onChange={(event) => setWebhookUrl(event.target.value)}
                placeholder={
                  draft.configured
                    ? t("integrations.discordWebhookReplace")
                    : "https://discord.com/api/webhooks/…"
                }
                disabled={!canEdit}
              />
              {draft.configured && canEdit && (
                <Button
                  variant="ghost"
                  onClick={() => save({ webhookUrl: "", enabled: false }, "remove")}
                  loading={busy === "remove"}
                >
                  {t("common.delete")}
                </Button>
              )}
            </div>
          </Field>

          <Field label={t("integrations.discordMessage")} hint={t("integrations.discordMessageHint")}>
            <Textarea
              value={draft.message}
              onChange={(event) => update("message", event.target.value)}
              placeholder={draft.defaultMessage}
              maxLength={1800}
              disabled={!canEdit}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("integrations.discordMention")}>
              <Select
                value={draft.mention}
                onChange={(event) => update("mention", event.target.value as DiscordMention)}
                disabled={!canEdit}
              >
                <option value="none">{t("common.none")}</option>
                <option value="everyone">@everyone</option>
                <option value="here">@here</option>
                <option value="role">{t("integrations.discordMentionRole")}</option>
              </Select>
            </Field>
            {draft.mention === "role" && (
              <Field label={t("integrations.discordRoleId")} hint={t("integrations.discordRoleIdHint")}>
                <Input
                  value={draft.roleId}
                  onChange={(event) => update("roleId", event.target.value)}
                  placeholder="123456789012345678"
                  inputMode="numeric"
                  disabled={!canEdit}
                />
              </Field>
            )}
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-ink">{t("integrations.discordEditOnEnd")}</p>
              <p className="text-[11px] text-faint">{t("integrations.discordEditOnEndHint")}</p>
            </div>
            <Switch
              checked={draft.editOnEnd}
              onChange={(value) => update("editOnEnd", value)}
              disabled={!canEdit}
              label={t("integrations.discordEditOnEnd")}
            />
          </div>

          {canEdit && (
            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              <Button variant="primary" size="sm" onClick={submit} loading={busy === "save"}>
                {t("common.save")}
              </Button>
              <Button
                size="sm"
                onClick={sendTest}
                loading={busy === "test"}
                disabled={!data?.configured}
              >
                <Send className="h-3.5 w-3.5" />
                {t("integrations.discordTest")}
              </Button>
            </div>
          )}
        </CardBody>
      )}
    </Card>
  );
}

export function IntegrationsPage() {
  const { t } = useI18n();

  return (
    <>
      <PageHeader title={t("integrations.title")} description={t("integrations.subtitle")} />
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <SpotifyCard />
        <ObsCard />
        <ApexCard />
        <DiscordCard />
      </div>
    </>
  );
}
