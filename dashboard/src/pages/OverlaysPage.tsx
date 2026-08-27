import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  KeyRound,
  Monitor,
  Music,
} from "lucide-react";

import { Button } from "../components/ui/Button";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Spinner } from "../components/ui/Feedback";
import { PageHeader } from "../components/ui/PageHeader";
import { Switch } from "../components/ui/Switch";
import { useToast } from "../components/ui/Toast";
import { useAuth } from "../context/AuthContext";
import { useRealtime } from "../context/RealtimeContext";
import { useI18n } from "../i18n";
import { api } from "../lib/api";
import { cn } from "../lib/cn";
import { useFetch } from "../lib/useFetch";

interface OverlayConfig {
  preset: string;
  mode: string;
  revealSeconds: number;
  accent: string;
  scale: number;
  opacity: number;
  align: string;
  showCover: boolean;
  showProgress: boolean;
  showArtist: boolean;
  progressColor: string;
  spinCover: boolean;
  hideWhenIdle: boolean;
  hideWhenPaused: boolean;
}

interface OverlaysResponse {
  spotify: { url: string; config: OverlayConfig };
  options: {
    presets: string[];
    modes: string[];
    alignments: string[];
    progressColors: string[];
  };
}

/**
 * Backdrop for the preview, deliberately the same in both themes: an overlay
 * is composited over video, never over a white page, and its white text has to
 * stay readable while it is being styled.
 */
const PREVIEW_STAGE = "#17171d";

/**
 * Footprint of each style at 100%, in CSS pixels, with room for the drop
 * shadow. A browser source rendered at these dimensions and left unscaled in
 * OBS stays pixel-sharp; stretching the source upscales a bitmap instead.
 * The bar style spans the canvas, so its width is the canvas width.
 */
const PRESET_SIZES: Record<string, { width: number; height: number; fullWidth?: boolean }> = {
  card: { width: 380, height: 120 },
  minimal: { width: 340, height: 90 },
  bar: { width: 1920, height: 80, fullWidth: true },
  text: { width: 440, height: 60 },
};

const TOGGLES = [
  "showCover",
  "showProgress",
  "showArtist",
  "hideWhenIdle",
  "hideWhenPaused",
] as const;

function Segmented<T extends string>({
  value,
  options,
  labels,
  onChange,
}: {
  value: T;
  options: readonly T[];
  labels: (option: T) => string;
  onChange: (option: T) => void;
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-lg border border-line p-0.5">
      {options.map((option) => (
        <button
          key={option}
          onClick={() => onChange(option)}
          className={cn(
            "focus-ring rounded-md px-2.5 py-1 text-xs transition-colors",
            value === option
              ? "bg-brand/10 font-medium text-brand"
              : "text-muted hover:text-ink"
          )}
        >
          {labels(option)}
        </button>
      ))}
    </div>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-2.5">
      <span className="min-w-0">
        <span className="block text-sm text-ink">{label}</span>
        {hint && <span className="mt-0.5 block text-[11px] text-faint">{hint}</span>}
      </span>
      {children}
    </div>
  );
}

function Slider({
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <span className="flex items-center gap-2">
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1 w-36 cursor-pointer appearance-none rounded-full bg-line accent-[rgb(var(--brand))]"
      />
      <span className="w-12 text-right text-xs tabular-nums text-muted">
        {value}
        {suffix}
      </span>
    </span>
  );
}

export function OverlaysPage() {
  const { t } = useI18n();
  const { push } = useToast();
  const { user } = useAuth();
  const { status } = useRealtime();

  const { data, loading, setData } = useFetch<OverlaysResponse>("/overlays");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [frameLoaded, setFrameLoaded] = useState(false);
  const [frameStalled, setFrameStalled] = useState(false);
  const [urlVisible, setUrlVisible] = useState(false);
  const saveTimer = useRef<number | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);


  const config = data?.spotify.config;
  const canEdit = user?.role === "broadcaster";

  /**
   * Changes are applied optimistically and written through after a short
   * pause: dragging a slider would otherwise fire a request per pixel, and the
   * whole point is watching the overlay react while you drag.
   */
  const patch = useCallback(
    (changes: Partial<OverlayConfig>) => {
      if (!data || !canEdit) return;

      const next = { ...data.spotify.config, ...changes };
      setData({ ...data, spotify: { ...data.spotify, config: next } });

      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(async () => {
        try {
          await api.patch("/overlays/spotify", changes);
        } catch {
          push(t("common.error"), "error");
        }
      }, 250);
    },
    [data, canEdit, setData, push, t]
  );

  useEffect(
    () => () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    },
    []
  );

  // Only complain once a normal load has had time to finish, so the hint never
  // flashes on a healthy page.
  useEffect(() => {
    if (frameLoaded) return undefined;
    const timer = window.setTimeout(() => setFrameStalled(true), 4000);
    return () => window.clearTimeout(timer);
  }, [frameLoaded]);

  const copy = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.spotify.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      push(t("common.error"), "error");
    }
  };

  const regenerate = async () => {
    setBusy(true);
    try {
      const result = await api.post<{ url: string }>("/overlays/spotify/key");
      if (data) setData({ ...data, spotify: { ...data.spotify, url: result.url } });
      push(t("common.saved"), "success");
    } catch {
      push(t("common.error"), "error");
    } finally {
      setBusy(false);
    }
  };

  if (loading && !data) {
    return (
      <>
        <PageHeader title={t("overlays.title")} description={t("overlays.subtitle")} />
        <Card>
          <Spinner />
        </Card>
      </>
    );
  }

  if (!data || !config) return null;

  // Framed from this origin rather than the plain-HTTP overlay port, which a
  // secure page is not allowed to embed. The preview flag keeps the overlay on
  // screen with a sample track when nothing is playing.
  const previewParams = new URLSearchParams(data.spotify.url.split("?")[1]);
  previewParams.set("preview", "1");
  previewParams.set("sampleTitle", t("overlays.sampleTitle"));
  previewParams.set("sampleArtist", t("overlays.sampleArtist"));
  previewParams.set("bg", PREVIEW_STAGE);
  const previewUrl = `/overlay/spotify?${previewParams.toString()}`;

  const usingSample = !status?.spotify.track;

  const footprint = PRESET_SIZES[config.preset] ?? PRESET_SIZES.card;

  const sizeAt = (percent: number) =>
    `${
      footprint.fullWidth
        ? footprint.width
        : Math.round((footprint.width * percent) / 100)
    } × ${Math.round((footprint.height * percent) / 100)}`;

  const maskedUrl = data.spotify.url.replace(/key=.*/, "key=••••••••••••");
  const suggestedSize = sizeAt(config.scale);

  return (
    <>
      <PageHeader title={t("overlays.title")} description={t("overlays.subtitle")} />

      <div className="grid gap-4 xl:grid-cols-5">
        <div className="space-y-4 xl:col-span-3">
          <Card>
            <CardHeader
              title={t("overlays.spotify")}
              description={t("overlays.urlHint")}
              icon={<Music className="h-4 w-4" />}
            />
            <CardBody className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {/* The key is hidden by default: this page is the kind of thing
                    that ends up visible on stream, and the key is the only
                    thing guarding the overlay. */}
                <code className="flex min-w-0 flex-1 items-center gap-2 truncate rounded-lg border border-line bg-canvas px-3 py-2.5 font-mono text-xs text-muted">
                  <span className="truncate">
                    {urlVisible ? data.spotify.url : maskedUrl}
                  </span>
                  <button
                    onClick={() => setUrlVisible((visible) => !visible)}
                    className="focus-ring ml-auto shrink-0 rounded p-0.5 text-faint transition-colors hover:text-ink"
                    title={t(urlVisible ? "overlays.hideUrl" : "overlays.showUrl")}
                  >
                    {urlVisible ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </button>
                </code>
                <Button onClick={copy}>
                  {copied ? (
                    <Check className="h-4 w-4 text-positive" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  {copied ? t("overlays.copied") : t("overlays.copy")}
                </Button>
                {canEdit && (
                  <Button variant="ghost" onClick={regenerate} loading={busy}>
                    <KeyRound className="h-4 w-4" />
                    {t("overlays.regenerate")}
                  </Button>
                )}
              </div>

              <p className="text-[11px] text-muted">
                {t("overlays.size", { size: suggestedSize })}
              </p>

              {!status?.spotify.connected && (
                <p className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-ink">
                  {t("overlays.spotifyOffline")}
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={t("overlays.preview")}
              description={
                usingSample ? t("overlays.previewSample") : t("overlays.previewHint")
              }
              icon={<Monitor className="h-4 w-4" />}
            />
            <CardBody>
              <div
                className="overflow-hidden rounded-xl border border-line"
                style={{ backgroundColor: PREVIEW_STAGE }}
              >
                {/*
                  No `key`: a changing key would remount the frame on every
                  status tick and restart its event stream. The explicit
                  transparent background stops the browser from painting its
                  default white canvas over the checkerboard.
                */}
                <iframe
                  ref={frameRef}
                  src={previewUrl}
                  title={t("overlays.preview")}
                  onLoad={() => setFrameLoaded(true)}
                  className="h-44 w-full border-0"
                  style={{ background: "transparent" }}
                />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {!frameLoaded && frameStalled && (
                  <p className="text-[11px] text-warning">
                    {t("overlays.previewBlocked")}
                  </p>
                )}
                {/* Always available: the frame is the convenience, not the
                    only way to look at the overlay. */}
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="focus-ring ml-auto inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] text-muted transition-colors hover:text-ink"
                >
                  <ExternalLink className="h-3 w-3" />
                  {t("overlays.openTab")}
                </a>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader title={t("overlays.appearance")} />
            <CardBody className="divide-y divide-line/60 py-1">
              <Row label={t("overlays.preset")}>
                <Segmented
                  value={config.preset}
                  options={data.options.presets}
                  labels={(option) => t(`overlays.presets.${option}`)}
                  onChange={(preset) => patch({ preset })}
                />
              </Row>

              <Row label={t("overlays.spinCover")}>
                <Switch
                  checked={config.spinCover}
                  onChange={(spinCover) => patch({ spinCover })}
                  disabled={!canEdit}
                />
              </Row>

              <Row label={t("overlays.align")} hint={t("overlays.alignHint")}>
                <Segmented
                  value={config.align}
                  options={data.options.alignments}
                  labels={(option) => t(`overlays.aligns.${option}`)}
                  onChange={(align) => patch({ align })}
                />
              </Row>

              <Row label={t("overlays.progressColor")}>
                <Segmented
                  value={config.progressColor}
                  options={data.options.progressColors}
                  labels={(option) => t(`overlays.progressColors.${option}`)}
                  onChange={(progressColor) => patch({ progressColor })}
                />
              </Row>

              <Row
                label={t("overlays.accent")}
                hint={
                  config.progressColor === "album"
                    ? t("overlays.accentFallback")
                    : undefined
                }
              >
                <input
                  type="color"
                  value={config.accent}
                  onChange={(event) => patch({ accent: event.target.value })}
                  disabled={!canEdit}
                  className="h-8 w-14 cursor-pointer rounded border border-line bg-canvas"
                />
              </Row>

              <Row label={t("overlays.scale")} hint={t("overlays.scaleHint")}>
                <Slider
                  value={config.scale}
                  min={50}
                  max={200}
                  suffix="%"
                  onChange={(scale) => patch({ scale })}
                />
              </Row>

              <Row label={t("overlays.opacity")}>
                <Slider
                  value={config.opacity}
                  min={20}
                  max={100}
                  suffix="%"
                  onChange={(opacity) => patch({ opacity })}
                />
              </Row>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("overlays.behaviour")} />
            <CardBody className="divide-y divide-line/60 py-1">
              <Row label={t("overlays.mode")}>
                <Segmented
                  value={config.mode}
                  options={data.options.modes}
                  labels={(option) => t(`overlays.modes.${option}`)}
                  onChange={(mode) => patch({ mode })}
                />
              </Row>

              {config.mode === "onChange" && (
                <Row label={t("overlays.revealSeconds")}>
                  <Slider
                    value={config.revealSeconds}
                    min={3}
                    max={60}
                    suffix="s"
                    onChange={(revealSeconds) => patch({ revealSeconds })}
                  />
                </Row>
              )}

              {TOGGLES.map((key) => (
                <Row key={key} label={t(`overlays.${key}`)}>
                  <Switch
                    checked={config[key]}
                    onChange={(value) => patch({ [key]: value })}
                    disabled={!canEdit}
                  />
                </Row>
              ))}
            </CardBody>
          </Card>

        </div>
      </div>
    </>
  );
}
