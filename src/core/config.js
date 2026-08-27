"use strict";

const path = require("path");

const ROOT_DIR = path.join(__dirname, "..", "..");
const DATA_DIR = path.join(ROOT_DIR, "data");

function str(name, fallback = "") {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value.trim();
}

function int(name, fallback) {
  const value = parseInt(process.env[name], 10);
  return Number.isFinite(value) ? value : fallback;
}

function bool(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

const webPort = int("WEB_PORT", 3000);
const webHost = str("WEB_HOST", "127.0.0.1");
const overlayPort = int("OVERLAY_PORT", webPort + 1);

/**
 * Address the bot is reached at from the outside. Behind a reverse proxy this
 * is the public domain, which is what OAuth redirects and overlay URLs must be
 * built from; locally it falls back to the loopback address.
 */
const configuredPublicUrl = str("PUBLIC_URL").replace(/\/+$/, "");
const publicUrl = configuredPublicUrl || `https://${webHost}:${webPort}`;
const isProxied = Boolean(configuredPublicUrl);

const config = {
  rootDir: ROOT_DIR,
  dataDir: DATA_DIR,
  tokensDir: path.join(DATA_DIR, "tokens"),
  databasePath: path.join(DATA_DIR, "bot.db"),

  env: str("NODE_ENV", "production"),
  logLevel: str("LOG_LEVEL", "info"),
  language: str("LANGUAGE", "fr"),

  bot: {
    prefix: str("BOT_PREFIX", "!"),
    /** Channel the bot joins and moderates. */
    channel: str("TWITCH_CHANNEL").toLowerCase(),
    /**
     * Set to false to run everything except the chat connection. Useful to
     * work on the dashboard or an overlay without the bot appearing in chat,
     * and to run a second instance alongside a live one.
     */
    chatEnabled: bool("BOT_CHAT_ENABLED", true),
  },

  twitch: {
    clientId: str("TWITCH_CLIENT_ID"),
    clientSecret: str("TWITCH_CLIENT_SECRET"),
    redirectUri: str("TWITCH_REDIRECT_URI", `${publicUrl}/callback/twitch`),
  },

  spotify: {
    clientId: str("SPOTIFY_CLIENT_ID"),
    clientSecret: str("SPOTIFY_CLIENT_SECRET"),
    redirectUri: str("SPOTIFY_REDIRECT_URI", `${publicUrl}/callback/spotify`),
    playlistId: str("SPOTIFY_PLAYLIST_ID"),
  },

  obs: {
    host: str("OBS_HOST"),
    port: int("OBS_PORT", 4455),
    password: str("OBS_PASSWORD"),
  },

  apex: {
    platform: str("APEX_PLATFORM", "PC"),
    username: str("APEX_USERNAME"),
    apiKey: str("APEX_API_KEY"),
  },

  /**
   * OBS browser sources run on a Chromium build that often refuses the
   * self-signed certificate the dashboard uses, and they cannot send an
   * Authorization header. Overlays therefore get their own plain-HTTP
   * listener, bound to the loopback interface and guarded by a key.
   */
  overlay: {
    host: webHost,
    port: overlayPort,
    /**
     * The dedicated listener exists only to dodge the self-signed certificate
     * locally. Behind a real one the overlay is served from the public domain
     * on the main port, so the extra listener is not started.
     */
    standalone: !isProxied,
    base: isProxied ? `${publicUrl}/overlay` : `http://${webHost}:${overlayPort}`,
  },

  web: {
    host: webHost,
    port: webPort,
    authEnabled: bool("WEB_AUTH_ENABLED", true),
    /** Absolute paths, checked at boot; HTTP is used when absent. */
    tlsCert: path.join(ROOT_DIR, str("TLS_CERT_FILE", "127.0.0.1.pem")),
    tlsKey: path.join(ROOT_DIR, str("TLS_KEY_FILE", "127.0.0.1-key.pem")),
    dashboardDir: path.join(ROOT_DIR, "dashboard", "dist"),
  },
};

config.spotify.enabled = Boolean(
  config.spotify.clientId && config.spotify.clientSecret
);
config.obs.enabled = Boolean(config.obs.host && config.obs.password);
config.apex.enabled = Boolean(config.apex.apiKey && config.apex.username);

/**
 * Returns the list of missing settings the bot cannot start without.
 * Integrations are optional by design and simply stay disabled.
 */
function validate() {
  const missing = [];
  if (!config.twitch.clientId) missing.push("TWITCH_CLIENT_ID");
  if (!config.twitch.clientSecret) missing.push("TWITCH_CLIENT_SECRET");
  if (!config.bot.channel) missing.push("TWITCH_CHANNEL");
  return missing;
}

config.validate = validate;
config.publicUrl = publicUrl;
config.isProxied = isProxied;

module.exports = config;
