import { useEffect, useState } from "react";
import { Eye, Gift, Heart, Megaphone, Radio, Timer } from "lucide-react";

import { Button } from "../components/ui/Button";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Field, Input, Select } from "../components/ui/Field";
import { PageHeader } from "../components/ui/PageHeader";
import { StatCard } from "../components/ui/StatCard";
import { useToast } from "../components/ui/Toast";
import { useAuth } from "../context/AuthContext";
import { useRealtime } from "../context/RealtimeContext";
import { useI18n } from "../i18n";
import { api } from "../lib/api";
import { formatDuration, formatNumber, formatRelative } from "../lib/format";
import { useFetch } from "../lib/useFetch";

const AD_LENGTHS = [30, 60, 90, 120, 150, 180];

interface StreamData {
  channel: { title: string; game_name: string } | null;
  stream: { viewer_count: number; started_at: string } | null;
  followers: number | null;
  subscribers: number | null;
}

interface AdData {
  schedule: {
    next_ad_at?: string;
    last_ad_at?: string;
    duration?: number;
    preroll_free_time?: number;
    snooze_count?: number;
  } | null;
}

export function StreamPage() {
  const { t, language } = useI18n();
  const { push } = useToast();
  const { user } = useAuth();
  const { status } = useRealtime();

  const apiReady = status?.twitch.apiReady ?? false;
  const { data, refetch } = useFetch<StreamData>(apiReady ? "/stream" : null);
  const { data: ads, refetch: refetchAds } = useFetch<AdData>(apiReady ? "/ads" : null);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [adLength, setAdLength] = useState(30);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!data?.channel) return;
    setTitle(data.channel.title);
    setCategory(data.channel.game_name);
  }, [data?.channel]);

  if (!apiReady) {
    return (
      <>
        <PageHeader title={t("stream.title")} description={t("stream.subtitle")} />
        <Card>
          <CardBody>
            <p className="text-sm text-muted">{t("stream.apiOffline")}</p>
          </CardBody>
        </Card>
      </>
    );
  }

  const update = async () => {
    setSaving(true);
    try {
      await api.patch("/stream", {
        title: title !== data?.channel?.title ? title : undefined,
        category: category !== data?.channel?.game_name ? category : undefined,
      });
      push(t("common.saved"), "success");
      refetch();
    } catch {
      push(t("common.error"), "error");
    } finally {
      setSaving(false);
    }
  };

  const runAd = async () => {
    setRunning(true);
    try {
      await api.post("/ads/commercial", { length: adLength });
      push(t("common.saved"), "success");
      refetchAds();
    } catch {
      push(t("stream.adsUnavailable"), "error");
    } finally {
      setRunning(false);
    }
  };

  const snooze = async () => {
    setRunning(true);
    try {
      await api.post("/ads/snooze");
      refetchAds();
    } catch {
      push(t("stream.adsUnavailable"), "error");
    } finally {
      setRunning(false);
    }
  };

  const isBroadcaster = user?.role === "broadcaster";
  const uptime = data?.stream
    ? formatDuration(Date.now() - new Date(data.stream.started_at).getTime(), language)
    : null;

  return (
    <>
      <PageHeader title={t("stream.title")} description={t("stream.subtitle")} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label={t("stream.viewers")}
          value={data?.stream ? formatNumber(data.stream.viewer_count, language) : "—"}
          icon={Eye}
          tone={data?.stream ? "danger" : "neutral"}
        />
        <StatCard
          label={t("stream.followers")}
          value={data?.followers != null ? formatNumber(data.followers, language) : "—"}
          icon={Heart}
          tone="brand"
        />
        <StatCard
          label={t("stream.subscribers")}
          value={data?.subscribers != null ? formatNumber(data.subscribers, language) : "—"}
          icon={Gift}
          tone="neutral"
        />
        <StatCard
          label={t("overview.uptime")}
          value={uptime ?? t("overview.streamOffline")}
          icon={Timer}
          tone="neutral"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("stream.title")} icon={<Radio className="h-4 w-4" />} />
          <CardBody className="space-y-4">
            <Field label={t("stream.streamTitle")}>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={140}
              />
            </Field>

            <Field label={t("stream.category")}>
              <Input
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              />
            </Field>

            <Button variant="primary" onClick={update} loading={saving}>
              {t("stream.update")}
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t("stream.ads")} icon={<Megaphone className="h-4 w-4" />} />
          <CardBody className="space-y-4">
            {ads?.schedule ? (
              <dl className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <dt className="text-muted">{t("stream.nextAd")}</dt>
                  <dd className="text-ink">
                    {ads.schedule.next_ad_at
                      ? formatRelative(ads.schedule.next_ad_at, language)
                      : "—"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">{t("stream.lastAd")}</dt>
                  <dd className="text-ink">
                    {ads.schedule.last_ad_at
                      ? formatRelative(ads.schedule.last_ad_at, language)
                      : "—"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">{t("stream.snoozeCount")}</dt>
                  <dd className="text-ink">{ads.schedule.snooze_count ?? 0}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-xs text-muted">{t("stream.adsUnavailable")}</p>
            )}

            {isBroadcaster && (
              <div className="flex flex-wrap items-end gap-2 border-t border-line pt-4">
                <Field label={`${t("stream.runAd")} (${t("common.seconds")})`} className="w-32">
                  <Select
                    value={adLength}
                    onChange={(event) => setAdLength(Number(event.target.value))}
                  >
                    {AD_LENGTHS.map((length) => (
                      <option key={length} value={length}>
                        {length}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Button variant="primary" onClick={runAd} loading={running}>
                  {t("stream.runAd")}
                </Button>
                <Button variant="ghost" onClick={snooze} loading={running}>
                  {t("stream.snooze")}
                </Button>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
