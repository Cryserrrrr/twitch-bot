"use strict";

const SETTING_KEY = "overlaySpotify";

const PRESETS = ["card", "minimal", "bar", "text"];
const MODES = ["always", "onChange"];
const ALIGNMENTS = ["left", "center", "right"];
/** Where the progress bar takes its colour from. */
const PROGRESS_COLORS = ["album", "custom"];

/**
 * Shape of the Spotify overlay configuration.
 * Stored as a single JSON value in the settings table so the whole overlay can
 * be reconfigured in one write and pushed to the browser source live.
 */
const DEFAULTS = {
  preset: "card",
  /** "always" keeps it on screen; "onChange" reveals it on each new track. */
  mode: "always",
  revealSeconds: 8,
  /** Custom colour, and the fallback whenever a cover yields no usable hue. */
  accent: "#9146FF",
  progressColor: "album",
  /** Turn the cover like a record while the track plays. */
  spinCover: true,
  scale: 100,
  opacity: 100,
  align: "left",
  showCover: true,
  showProgress: true,
  showArtist: true,
  hideWhenIdle: true,
  hideWhenPaused: false,
};

function clamp(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(Math.max(number, min), max);
}

function isHexColor(value) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

/** Validates and normalizes a partial config coming from the dashboard. */
function normalize(input = {}) {
  const source = { ...DEFAULTS, ...input };

  return {
    preset: PRESETS.includes(source.preset) ? source.preset : DEFAULTS.preset,
    mode: MODES.includes(source.mode) ? source.mode : DEFAULTS.mode,
    revealSeconds: clamp(source.revealSeconds, 3, 60, DEFAULTS.revealSeconds),
    accent: isHexColor(source.accent) ? source.accent : DEFAULTS.accent,
    progressColor: PROGRESS_COLORS.includes(source.progressColor)
      ? source.progressColor
      : DEFAULTS.progressColor,
    spinCover: Boolean(source.spinCover),
    scale: clamp(source.scale, 50, 200, DEFAULTS.scale),
    opacity: clamp(source.opacity, 20, 100, DEFAULTS.opacity),
    align: ALIGNMENTS.includes(source.align) ? source.align : DEFAULTS.align,
    showCover: Boolean(source.showCover),
    showProgress: Boolean(source.showProgress),
    showArtist: Boolean(source.showArtist),
    hideWhenIdle: Boolean(source.hideWhenIdle),
    hideWhenPaused: Boolean(source.hideWhenPaused),
  };
}

function parse(stored) {
  if (!stored) return { ...DEFAULTS };
  try {
    return normalize(typeof stored === "string" ? JSON.parse(stored) : stored);
  } catch {
    return { ...DEFAULTS };
  }
}

module.exports = {
  SETTING_KEY,
  DEFAULTS,
  PRESETS,
  MODES,
  ALIGNMENTS,
  PROGRESS_COLORS,
  normalize,
  parse,
};
