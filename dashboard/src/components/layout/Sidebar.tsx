import { NavLink } from "react-router-dom";
import {
  Activity,
  Bot,
  Gauge,
  MessageSquare,
  MonitorPlay,
  Plug,
  Radio,
  ScrollText,
  Settings,
  Shield,
  Terminal,
  Timer,
  X,
} from "lucide-react";

import { useI18n } from "../../i18n";
import { useRealtime } from "../../context/RealtimeContext";
import { cn } from "../../lib/cn";
import { Button } from "../ui/Button";
import { StatusDot } from "../ui/Feedback";

const SECTIONS = [
  {
    label: "nav.section_monitor",
    items: [
      { to: "/", key: "overview", icon: Gauge, end: true },
      { to: "/chat", key: "chat", icon: MessageSquare },
      { to: "/stream", key: "stream", icon: Radio },
    ],
  },
  {
    label: "nav.section_configure",
    items: [
      { to: "/commands", key: "commands", icon: Terminal },
      { to: "/moderation", key: "moderation", icon: Shield },
      { to: "/recurring", key: "recurring", icon: Timer },
      { to: "/integrations", key: "integrations", icon: Plug },
      { to: "/overlays", key: "overlays", icon: MonitorPlay },
    ],
  },
  {
    label: "nav.section_system",
    items: [
      { to: "/logs", key: "logs", icon: ScrollText },
      { to: "/settings", key: "settings", icon: Settings },
    ],
  },
];

function ServiceRow({ label, state }: { label: string; state: "on" | "off" | "warn" }) {
  const { t } = useI18n();

  // The state is spelled out as well as coloured: a row of identical dots is
  // impossible to read, and colour alone excludes colour-blind viewers.
  const text =
    state === "on"
      ? t("common.connected")
      : state === "warn"
        ? t("common.warning")
        : t("common.offline");

  const tone =
    state === "on" ? "text-positive" : state === "warn" ? "text-warning" : "text-faint";

  return (
    <div className="flex items-center justify-between gap-2 text-[11px]">
      <span className="truncate text-faint">{label}</span>
      <span className="flex shrink-0 items-center gap-1.5">
        <span className={tone}>{text}</span>
        <StatusDot state={state} />
      </span>
    </div>
  );
}

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const { status } = useRealtime();

  const services: Array<[string, "on" | "off" | "warn"]> = [
    ["status.chat", status?.chat.connected ? "on" : "off"],
    [
      "status.twitch",
      status?.twitch.apiReady ? "on" : status?.twitch.state === "invalid" ? "warn" : "off",
    ],
    ["status.eventsub", status?.eventsub.connected ? "on" : "off"],
    [
      "status.spotify",
      status?.spotify.connected ? "on" : status?.spotify.state === "revoked" ? "warn" : "off",
    ],
    ["status.obs", status?.obs.connected ? "on" : "off"],
  ];

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-surface transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between gap-2 border-b border-line px-5">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white">
              <Bot className="h-4 w-4" />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-ink">Console</p>
              <p className="text-[11px] text-faint">
                {status ? `#${status.channel}` : "—"}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="lg:hidden">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto scrollbar-thin px-3 py-5">
          {SECTIONS.map((section) => (
            <div key={section.label}>
              <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-faint">
                {t(section.label)}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={onClose}
                    className={({ isActive }) =>
                      cn(
                        "focus-ring flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                        isActive
                          ? "bg-brand/10 font-medium text-brand"
                          : "text-muted hover:bg-elevated hover:text-ink"
                      )
                    }
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {t(`nav.${item.key}`)}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="space-y-2 border-t border-line px-5 py-4">
          <div className="flex items-center gap-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-faint">
            <Activity className="h-3 w-3" />
            Services
          </div>
          {services.map(([label, state]) => (
            <ServiceRow key={label} label={t(label)} state={state} />
          ))}
        </div>
      </aside>
    </>
  );
}
