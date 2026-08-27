"use strict";

const { EventEmitter } = require("events");

const LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

const COLORS = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  debug: "\x1b[90m",
  info: "\x1b[36m",
  warn: "\x1b[33m",
  error: "\x1b[31m",
  scope: "\x1b[35m",
};

const LABELS = {
  debug: "DEBUG",
  info: "INFO ",
  warn: "WARN ",
  error: "ERROR",
};

const HISTORY_LIMIT = 300;

/**
 * Turns any thrown value into a single readable line.
 * Axios and spotify-web-api-node errors carry huge nested payloads that make
 * the console unusable, so only the meaningful fields are kept.
 */
function describeError(error) {
  if (error === null || error === undefined) return "";
  if (typeof error === "string") return error;

  const parts = [];
  const message = error.message || String(error);
  parts.push(message);

  const status = error.response?.status || error.statusCode;
  if (status) parts.push(`status=${status}`);

  if (error.code) parts.push(`code=${error.code}`);

  const body = error.response?.data || error.body;
  if (body && typeof body === "object") {
    const detail =
      body.error_description || body.message || body.error || body.status;
    if (detail && typeof detail === "string" && detail !== message) {
      parts.push(detail);
    }
  }

  return parts.join(" | ");
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatTime(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
    date.getSeconds()
  )}`;
}

class Logger extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(0);
    this.level = LEVELS[process.env.LOG_LEVEL] ?? LEVELS.info;
    this.useColor =
      process.env.NO_COLOR === undefined && process.stdout.isTTY === true;
    this.history = [];
  }

  setLevel(name) {
    if (LEVELS[name] !== undefined) this.level = LEVELS[name];
  }

  isEnabled(level) {
    return LEVELS[level] >= this.level;
  }

  /** Returns a logger bound to a scope, e.g. logger.child("twitch"). */
  child(scope) {
    return {
      debug: (message, error) => this.write("debug", scope, message, error),
      info: (message, error) => this.write("info", scope, message, error),
      warn: (message, error) => this.write("warn", scope, message, error),
      error: (message, error) => this.write("error", scope, message, error),
      child: (sub) => this.child(`${scope}:${sub}`),
    };
  }

  write(level, scope, message, error) {
    const detail = error !== undefined ? describeError(error) : "";
    const text = detail ? `${message}: ${detail}` : message;
    const entry = {
      time: Date.now(),
      level,
      scope,
      message: text,
    };

    this.history.push(entry);
    if (this.history.length > HISTORY_LIMIT) this.history.shift();
    this.emit("entry", entry);

    if (!this.isEnabled(level)) return;

    const time = formatTime(new Date(entry.time));
    const label = LABELS[level];
    const paddedScope = scope.padEnd(11).slice(0, 11);

    const line = this.useColor
      ? `${COLORS.dim}${time}${COLORS.reset} ${COLORS[level]}${label}${COLORS.reset} ${COLORS.scope}${paddedScope}${COLORS.reset} ${text}`
      : `${time} ${label} ${paddedScope} ${text}`;

    if (level === "error" || level === "warn") {
      process.stderr.write(`${line}\n`);
    } else {
      process.stdout.write(`${line}\n`);
    }

    // Full stack traces are only useful while debugging.
    if (level === "error" && error?.stack && this.isEnabled("debug")) {
      process.stderr.write(`${error.stack}\n`);
    }
  }

  /** Prints a titled block used for the startup summary. */
  banner(title, lines) {
    const width = Math.max(
      title.length,
      ...lines.map((line) => line.length),
      42
    );
    const bar = "-".repeat(width + 2);
    const out = [bar, ` ${title}`, bar];
    for (const line of lines) out.push(` ${line}`);
    out.push(bar);
    process.stdout.write(`${out.join("\n")}\n`);
  }

  getHistory() {
    return this.history.slice();
  }
}

const logger = new Logger();

module.exports = logger;
module.exports.describeError = describeError;
module.exports.LEVELS = LEVELS;
