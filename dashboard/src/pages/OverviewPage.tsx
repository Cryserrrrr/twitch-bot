import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Eye,
  Gift,
  Hash,
  Heart,
  MessageSquare,
  Music,
  Shield,
  Terminal,
  Timer,
  TrendingUp,
  Users,
} from "lucide-react";

import { ChatVolumeChart, EventsChart } from "../components/charts/ActivityChart";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { EmptyState, Skeleton } from "../components/ui/Feedback";
import { PageHeader } from "../components/ui/PageHeader";
import { StatCard } from "../components/ui/StatCard";
import { useRealtime } from "../context/RealtimeContext";
import { useI18n } from "../i18n";
import { formatDuration, formatNumber, formatRelative } from "../lib/format";
import type { Overview } from "../lib/types";
import { useFetch } from "../lib/useFetch";

const PERIOD_DAYS = 14;

const EVENT_ICONS: Record<string, typeof Heart> = {
  follow: Heart,
  subscription: Gift,
  resub: Gift,
  subgift: Gift,
  cheer: TrendingUp,
  raid: Users,
  moderation: Shield,
  command: Terminal,
  message: MessageSquare,
};

function ActivityFeed({ events }: { events: Overview["recentEvents"] }) {
  const { t, language } = useI18n();

  const visible = events.filter((event) => event.type !== "message").slice(0, 12);

  if (!visible.length) {
    return <EmptyState icon={<Hash className="h-5 w-5" />} title={t("overview.noActivity")} />;
  }

  return (
    <ul className="divide-y divide-line/60">
      {visible.map((event) => {
        const Icon = EVENT_ICONS[event.type] ?? Hash;
        return (
          <li key={event.id} className="flex items-center gap-3 px-5 py-2.5">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-elevated text-muted">
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-ink">
                <span className="font-medium">{event.username ?? "—"}</span>{" "}
                <span className="text-muted">{t(`events.${event.type}`)}</span>
              </p>
            </div>
            <span className="shrink-0 text-[11px] text-faint">
              {formatRelative(event.created_at, language)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function NowPlaying() {
  const { t } = useI18n();
  const { track, status } = useRealtime();

  if (!status?.spotify.enabled) return null;

  return (
    <Card>
      <CardHeader title={t("overview.nowPlaying")} icon={<Music className="h-4 w-4" />} />
      <CardBody>
        {track ? (
          <div className="flex items-center gap-3">
            {track.cover ? (
              <img
                src={track.cover}
                alt=""
                className="h-14 w-14 rounded-lg object-cover"
              />
            ) : (
              <span className="grid h-14 w-14 place-items-center rounded-lg bg-elevated text-faint">
                <Music className="h-5 w-5" />
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{track.name}</p>
              <p className="truncate text-xs text-muted">{track.artists}</p>
              {track.duration > 0 && (
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-elevated">
                  <div
                    className="h-full rounded-full bg-brand transition-all"
                    style={{ width: `${(track.progress / track.duration) * 100}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted">{t("integrations.nothingPlaying")}</p>
        )}
      </CardBody>
    </Card>
  );
}

export function OverviewPage() {
  const { t, language } = useI18n();
  const { status } = useRealtime();
  const { data, loading } = useFetch<Overview>(`/overview?days=${PERIOD_DAYS}`);

  const totals = data?.totals ?? {};
  const period = t("overview.period", { days: PERIOD_DAYS });
  const needsAccount = status && status.twitch.state !== "ready";

  return (
    <>
      <PageHeader
        title={t("overview.title")}
        description={t("overview.subtitle")}
        action={
          status?.live && data?.stream ? (
            <Badge tone="danger">
              <Eye className="h-3 w-3" />
              {formatNumber(data.stream.viewer_count, language)}
            </Badge>
          ) : null
        }
      />

      {needsAccount && (
        <Card className="mb-6 border-warning/30 bg-warning/5">
          <CardBody className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
            <p className="flex-1 text-xs text-ink">
              {status.twitch.state === "invalid"
                ? t("status.tokenInvalid")
                : t("status.tokenMissing")}
            </p>
            <Link to="/settings">
              <Button size="sm" variant="outline">
                {t("settings.reconnect")}
              </Button>
            </Link>
          </CardBody>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {loading && !data ? (
          Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-[88px]" />
          ))
        ) : (
          <>
            <StatCard
              label={status?.live ? t("overview.viewers") : t("overview.followers")}
              value={
                status?.live && data?.stream
                  ? formatNumber(data.stream.viewer_count, language)
                  : formatNumber(data?.followers ?? 0, language)
              }
              hint={status?.live ? t("topbar.live") : t("overview.streamOffline")}
              icon={status?.live ? Eye : Heart}
              tone={status?.live ? "danger" : "brand"}
            />
            <StatCard
              label={t("overview.messages")}
              value={formatNumber(totals.message ?? 0, language)}
              hint={period}
              icon={MessageSquare}
              tone="neutral"
            />
            <StatCard
              label={t("overview.commandsUsed")}
              value={formatNumber(totals.command ?? 0, language)}
              hint={period}
              icon={Terminal}
              tone="neutral"
            />
            <StatCard
              label={t("overview.moderationActions")}
              value={formatNumber(totals.moderation ?? 0, language)}
              hint={period}
              icon={Shield}
              tone={totals.moderation ? "warning" : "neutral"}
            />
          </>
        )}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title={t("overview.chartTitle")}
            description={t("overview.chartSubtitle")}
          />
          <CardBody>
            {data ? <ChatVolumeChart data={data.series} /> : <Skeleton className="h-[240px]" />}
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title={t("overview.botUptime")}
              icon={<Timer className="h-4 w-4" />}
            />
            <CardBody className="space-y-3">
              <p className="text-2xl font-semibold tabular-nums text-ink">
                {status ? formatDuration(status.uptime, language) : "—"}
              </p>
              {data?.channel && (
                <div className="space-y-1 border-t border-line pt-3">
                  <p className="truncate text-xs text-ink">{data.channel.title}</p>
                  <p className="text-[11px] text-faint">{data.channel.game_name}</p>
                </div>
              )}
            </CardBody>
          </Card>

          <NowPlaying />
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title={t("overview.activity")} />
          {data ? (
            <ActivityFeed events={data.recentEvents} />
          ) : (
            <CardBody>
              <Skeleton className="h-40" />
            </CardBody>
          )}
        </Card>

        <Card>
          <CardHeader title={t("overview.topChatters")} description={period} />
          <CardBody>
            {data?.topChatters.length ? (
              <ol className="space-y-2.5">
                {data.topChatters.map((chatter, index) => (
                  <li key={chatter.username} className="flex items-center gap-3">
                    <span className="w-4 text-[11px] tabular-nums text-faint">
                      {index + 1}
                    </span>
                    <span className="flex-1 truncate text-xs text-ink">
                      {chatter.username}
                    </span>
                    <span className="text-[11px] tabular-nums text-muted">
                      {formatNumber(chatter.count, language)}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-xs text-muted">{t("overview.noActivity")}</p>
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader
          title={t("overview.eventsTitle")}
          description={t("overview.eventsSubtitle")}
        />
        <CardBody>
          {data ? <EventsChart data={data.series} /> : <Skeleton className="h-[200px]" />}
        </CardBody>
      </Card>
    </>
  );
}
