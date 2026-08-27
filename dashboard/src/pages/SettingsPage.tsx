import { useState, type ReactNode } from "react";
import { Bell, Moon, Palette, Sun, Twitch, Unplug } from "lucide-react";

import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { StatusDot } from "../components/ui/Feedback";
import { PageHeader } from "../components/ui/PageHeader";
import { Switch } from "../components/ui/Switch";
import { useToast } from "../components/ui/Toast";
import { useAuth } from "../context/AuthContext";
import { useRealtime } from "../context/RealtimeContext";
import { useTheme } from "../context/ThemeContext";
import { useI18n } from "../i18n";
import { api } from "../lib/api";
import { cn } from "../lib/cn";
import type { Settings } from "../lib/types";
import { useFetch } from "../lib/useFetch";

const ANNOUNCEMENTS = [
  ["announceFollows", "settings.announceFollows"],
  ["announceSubs", "settings.announceSubs"],
  ["announceRaids", "settings.announceRaids"],
  ["announceCheers", "settings.announceCheers"],
] as const;

interface SettingsResponse {
  settings: Settings;
  language: string;
  channel: string;
  prefix: string;
}

function Row({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span className="text-sm text-ink">{label}</span>
      {children}
    </div>
  );
}

export function SettingsPage() {
  const { t, language, setLanguage } = useI18n();
  const { theme, setTheme } = useTheme();
  const { push } = useToast();
  const { user, signIn, signOut } = useAuth();
  const { status } = useRealtime();

  const { data, setData } = useFetch<SettingsResponse>("/settings");
  const [disconnecting, setDisconnecting] = useState(false);

  const isBroadcaster = user?.role === "broadcaster";
  const twitch = status?.twitch;

  const updateSetting = async (key: string, value: boolean) => {
    if (!data) return;
    try {
      const updated = await api.patch<{ settings: Settings }>("/settings", {
        [key]: value,
      });
      setData({ ...data, settings: updated.settings });
    } catch {
      push(t("common.error"), "error");
    }
  };

  const disconnect = async () => {
    setDisconnecting(true);
    try {
      await api.post("/auth/twitch/disconnect");
      signOut();
    } catch {
      push(t("common.error"), "error");
      setDisconnecting(false);
    }
  };

  const tokenState =
    twitch?.state === "ready"
      ? { tone: "positive" as const, label: t("status.tokenReady"), dot: "on" as const }
      : twitch?.state === "invalid"
        ? { tone: "warning" as const, label: t("status.tokenInvalid"), dot: "warn" as const }
        : { tone: "neutral" as const, label: t("status.tokenMissing"), dot: "off" as const };

  return (
    <>
      <PageHeader title={t("settings.title")} description={t("settings.subtitle")} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={t("settings.announcements")}
            description={t("settings.announcementsHint")}
            icon={<Bell className="h-4 w-4" />}
          />
          <CardBody className="divide-y divide-line/60 py-1">
            {ANNOUNCEMENTS.map(([key, label]) => (
              <Row key={key} label={t(label)}>
                <Switch
                  checked={Boolean(data?.settings[key])}
                  onChange={(value) => updateSetting(key, value)}
                  disabled={!isBroadcaster}
                />
              </Row>
            ))}
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title={t("settings.appearance")} icon={<Palette className="h-4 w-4" />} />
            <CardBody className="divide-y divide-line/60 py-1">
              <Row label={t("settings.theme")}>
                <div className="inline-flex rounded-lg border border-line p-0.5">
                  {(["dark", "light"] as const).map((option) => (
                    <button
                      key={option}
                      onClick={() => setTheme(option)}
                      className={cn(
                        "focus-ring flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors",
                        theme === option
                          ? "bg-brand/10 font-medium text-brand"
                          : "text-muted hover:text-ink"
                      )}
                    >
                      {option === "dark" ? (
                        <Moon className="h-3 w-3" />
                      ) : (
                        <Sun className="h-3 w-3" />
                      )}
                      {t(option === "dark" ? "settings.themeDark" : "settings.themeLight")}
                    </button>
                  ))}
                </div>
              </Row>

              <Row label={t("settings.language")}>
                <div className="inline-flex rounded-lg border border-line p-0.5">
                  {(["fr", "en"] as const).map((option) => (
                    <button
                      key={option}
                      onClick={() => setLanguage(option)}
                      className={cn(
                        "focus-ring rounded-md px-2.5 py-1 text-xs uppercase transition-colors",
                        language === option
                          ? "bg-brand/10 font-medium text-brand"
                          : "text-muted hover:text-ink"
                      )}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </Row>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("settings.version")} />
            <CardBody className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted">{t("settings.channel")}</span>
                <span className="text-ink">#{data?.channel ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">{t("settings.prefix")}</span>
                <span className="font-mono text-ink">{data?.prefix ?? "!"}</span>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      <Card className="mt-4">
        <CardHeader
          title={t("settings.account")}
          description={t("settings.accountHint")}
          icon={<Twitch className="h-4 w-4" />}
          action={
            <Badge tone={tokenState.tone}>
              <StatusDot state={tokenState.dot} />
              {tokenState.label}
            </Badge>
          }
        />
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-ink">{twitch?.user?.login ?? "—"}</p>
              <p className="mt-0.5 text-[11px] text-faint">
                {twitch?.scopes.length
                  ? `${twitch.scopes.length} ${t("settings.scopes").toLowerCase()}`
                  : ""}
              </p>
            </div>

            {isBroadcaster && (
              <div className="flex gap-2">
                {twitch?.state === "ready" ? (
                  <>
                    {/* Reconnecting is only useful to grant scopes it lacks. */}
                    {twitch.missingScopes.length > 0 && (
                      <Button variant="outline" size="sm" onClick={() => signIn("bot")}>
                        {t("settings.grantScopes")}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="hover:text-danger"
                      onClick={disconnect}
                      loading={disconnecting}
                    >
                      <Unplug className="h-3.5 w-3.5" />
                      {t("settings.disconnect")}
                    </Button>
                  </>
                ) : (
                  <Button variant="primary" size="sm" onClick={() => signIn("bot")}>
                    {twitch?.state === "invalid"
                      ? t("settings.reconnect")
                      : t("settings.connect")}
                  </Button>
                )}
              </div>
            )}
          </div>

          {twitch && twitch.missingScopes.length > 0 && (
            <p className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-ink">
              {t("settings.missingScopes")}
            </p>
          )}

          {isBroadcaster && twitch?.state === "ready" && (
            <p className="text-[11px] text-faint">{t("settings.disconnectHint")}</p>
          )}
        </CardBody>
      </Card>
    </>
  );
}
