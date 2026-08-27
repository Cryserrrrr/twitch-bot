import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useI18n } from "../../i18n";
import { useChartTheme } from "../../lib/chartTheme";
import { formatDate } from "../../lib/format";

interface Point {
  day: string;
  message: number;
  command: number;
  follow: number;
  subscription: number;
  moderation: number;
}

interface SeriesSpec {
  key: keyof Point;
  label: string;
  color: string;
}

function Legend({ series }: { series: SeriesSpec[] }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
      {series.map((entry) => (
        <span key={entry.key} className="flex items-center gap-1.5 text-[11px] text-muted">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: entry.color }}
            aria-hidden
          />
          {entry.label}
        </span>
      ))}
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  series,
  locale,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number }>;
  label?: string;
  series: SeriesSpec[];
  locale: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 shadow-lg">
      <p className="mb-1.5 text-[11px] font-medium text-ink">
        {label ? formatDate(label, locale) : ""}
      </p>
      {payload.map((entry) => {
        const spec = series.find((item) => item.key === entry.dataKey);
        if (!spec) return null;
        return (
          <p key={entry.dataKey} className="flex items-center gap-2 text-[11px] text-muted">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: spec.color }}
              aria-hidden
            />
            <span className="flex-1">{spec.label}</span>
            <span className="font-medium tabular-nums text-ink">{entry.value}</span>
          </p>
        );
      })}
    </div>
  );
}

/** Chat volume: messages and commands share the same unit, so one axis is safe. */
export function ChatVolumeChart({ data }: { data: Point[] }) {
  const { t, language } = useI18n();
  const chart = useChartTheme();

  const series: SeriesSpec[] = [
    { key: "message", label: t("overview.messages"), color: chart.series[0] },
    { key: "command", label: t("overview.commandsUsed"), color: chart.series[1] },
  ];

  return (
    <div>
      <Legend series={series} />
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
          <defs>
            {series.map((entry) => (
              <linearGradient
                key={entry.key}
                id={`fill-${entry.key}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={entry.color} stopOpacity={0.28} />
                <stop offset="100%" stopColor={entry.color} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>

          <CartesianGrid stroke={chart.grid} vertical={false} />
          <XAxis
            dataKey="day"
            tickFormatter={(value) => formatDate(value, language)}
            tick={{ fontSize: 11, fill: chart.axis }}
            axisLine={false}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            tick={{ fontSize: 11, fill: chart.axis }}
            axisLine={false}
            tickLine={false}
            width={48}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ stroke: chart.axis, strokeWidth: 1, strokeDasharray: "3 3" }}
            content={<ChartTooltip series={series} locale={language} />}
          />

          {series.map((entry) => (
            <Area
              key={entry.key}
              type="monotone"
              dataKey={entry.key}
              stroke={entry.color}
              strokeWidth={2}
              fill={`url(#fill-${entry.key})`}
              activeDot={{ r: 4, strokeWidth: 2, stroke: chart.surface }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Channel events. Kept on a separate chart because a handful of follows a day
 * would be invisible next to hundreds of chat messages.
 */
export function EventsChart({ data }: { data: Point[] }) {
  const { t, language } = useI18n();
  const chart = useChartTheme();

  const series: SeriesSpec[] = [
    { key: "follow", label: t("events.follow"), color: chart.series[0] },
    { key: "subscription", label: t("events.subscription"), color: chart.series[1] },
    { key: "moderation", label: t("events.moderation"), color: chart.series[2] },
  ];

  return (
    <div>
      <Legend series={series} />
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }} barGap={2}>
          <CartesianGrid stroke={chart.grid} vertical={false} />
          <XAxis
            dataKey="day"
            tickFormatter={(value) => formatDate(value, language)}
            tick={{ fontSize: 11, fill: chart.axis }}
            axisLine={false}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            tick={{ fontSize: 11, fill: chart.axis }}
            axisLine={false}
            tickLine={false}
            width={48}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: chart.grid }}
            content={<ChartTooltip series={series} locale={language} />}
          />

          {series.map((entry) => (
            <Bar
              key={entry.key}
              dataKey={entry.key}
              fill={entry.color}
              radius={[4, 4, 0, 0]}
              maxBarSize={14}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
