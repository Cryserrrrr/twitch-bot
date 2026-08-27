import { useState } from "react";
import { Languages, LogOut, Menu, Moon, Sun, WifiOff } from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import { useRealtime } from "../../context/RealtimeContext";
import { useTheme } from "../../context/ThemeContext";
import { useI18n } from "../../i18n";
import { formatDuration } from "../../lib/format";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { StatusDot } from "../ui/Feedback";

export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { t, language, setLanguage } = useI18n();
  const { theme, toggle } = useTheme();
  const { user, signOut } = useAuth();
  const { status, connected } = useRealtime();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-canvas/80 px-4 backdrop-blur-md lg:px-6">
      <Button variant="ghost" size="icon" onClick={onOpenMenu} className="lg:hidden">
        <Menu className="h-4 w-4" />
      </Button>

      <div className="flex items-center gap-2">
        {status?.live ? (
          <Badge tone="danger">
            <StatusDot state="on" />
            {t("topbar.live")}
          </Badge>
        ) : (
          <Badge>
            <StatusDot state="off" />
            {t("topbar.offline")}
          </Badge>
        )}

        {status && (
          <span className="hidden text-xs text-faint sm:inline">
            {formatDuration(status.uptime, language)}
          </span>
        )}
      </div>

      <div className="ml-auto flex items-center gap-1">
        {!connected && (
          <Badge tone="warning" className="mr-1">
            <WifiOff className="h-3 w-3" />
            {t("common.offline")}
          </Badge>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLanguage(language === "fr" ? "en" : "fr")}
          title={t("topbar.language")}
        >
          <Languages className="h-4 w-4" />
        </Button>

        <Button variant="ghost" size="icon" onClick={toggle} title={t("topbar.theme")}>
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <div className="relative">
          <button
            onClick={() => setMenuOpen((open) => !open)}
            className="focus-ring flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition-colors hover:bg-elevated"
          >
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt=""
                className="h-7 w-7 rounded-full object-cover"
              />
            ) : (
              <span className="grid h-7 w-7 place-items-center rounded-full bg-brand/15 text-xs font-semibold text-brand">
                {user?.displayName?.[0]?.toUpperCase() ?? "?"}
              </span>
            )}
            <span className="hidden text-xs font-medium text-ink sm:inline">
              {user?.displayName}
            </span>
          </button>

          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
                aria-hidden
              />
              <div className="animate-fade-in absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-xl border border-line bg-surface shadow-xl">
                <div className="border-b border-line px-4 py-3">
                  <p className="truncate text-sm font-medium text-ink">
                    {user?.displayName}
                  </p>
                  <p className="mt-0.5 text-[11px] capitalize text-faint">
                    {user?.role}
                  </p>
                </div>
                <button
                  onClick={signOut}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs text-muted transition-colors hover:bg-elevated hover:text-ink"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  {t("topbar.signOut")}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
