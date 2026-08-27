import { useSearchParams } from "react-router-dom";
import { AlertTriangle, Bot, ShieldAlert, Twitch } from "lucide-react";

import { Button } from "../components/ui/Button";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n";

export function LoginPage() {
  const { t } = useI18n();
  const { config, signIn } = useAuth();
  const [params] = useSearchParams();
  const denied = params.get("denied");

  const configured = config?.configured ?? false;
  const needsBotAccount = configured && config && !config.botConnected;

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-canvas px-4">
      {/* Ambient brand glow, purely decorative. */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[36rem] -translate-x-1/2 rounded-full bg-brand/20 blur-[120px]"
        aria-hidden
      />

      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-brand text-white shadow-lg shadow-brand/30">
            <Bot className="h-6 w-6" />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {t("login.title")}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {t("login.subtitle", { channel: config?.channel ?? "" })}
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-6 shadow-xl shadow-black/5">
          {!configured ? (
            <div className="flex gap-3 rounded-xl border border-warning/30 bg-warning/5 p-4">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <div>
                <p className="text-sm font-medium text-ink">
                  {t("login.notConfigured")}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {t("login.notConfiguredHint")}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {denied && (
                <div className="flex gap-3 rounded-xl border border-danger/30 bg-danger/5 p-4">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                  <div>
                    <p className="text-sm font-medium text-ink">{t("login.denied")}</p>
                    <p className="mt-1 text-xs text-muted">{t("login.deniedHint")}</p>
                  </div>
                </div>
              )}

              <Button
                variant="primary"
                className="w-full justify-center"
                onClick={() => signIn("signin")}
              >
                <Twitch className="h-4 w-4" />
                {t("login.signIn")}
              </Button>

              {needsBotAccount && (
                <div className="rounded-xl border border-line bg-canvas p-4">
                  <p className="text-xs text-muted">{t("login.connectBotHint")}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full justify-center"
                    onClick={() => signIn("bot")}
                  >
                    {t("login.connectBot")}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-[11px] text-faint">
          {config?.channel ? `#${config.channel}` : ""}
        </p>
      </div>
    </div>
  );
}
