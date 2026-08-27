"use strict";

const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");

const config = require("../core/config");
const logger = require("../core/logger").child("overlay");
const overlayConfig = require("../overlays/config");

const KEY_SETTING = "overlayKey";
const HEARTBEAT_MS = 15000;
const PAGE_FILE = path.join(__dirname, "..", "overlays", "spotify.html");

/**
 * Set explicitly on every overlay response rather than relying on this route
 * being registered before the dashboard's helmet middleware. An overlay is a
 * single self-contained file: its style and script are inline, and the
 * dashboard policy both refuses those and forbids framing, which showed up as
 * a blank preview.
 */
const OVERLAY_CSP = [
  "default-src 'none'",
  "img-src 'self' https: data:",
  "font-src 'self' data:",
  "style-src 'unsafe-inline'",
  "script-src 'unsafe-inline'",
  // i.scdn.co is fetched directly to sample the sleeve's colours.
  "connect-src 'self' https://i.scdn.co",
  "frame-ancestors 'self'",
].join("; ");

/**
 * Plain-HTTP server dedicated to OBS browser sources.
 *
 * It is separate from the dashboard for two reasons: the browser source cannot
 * send an Authorization header, and OBS's embedded Chromium frequently rejects
 * the self-signed certificate the dashboard runs on - which shows up as a blank
 * source with no error message. Access is gated by a random key instead, and
 * the listener is bound to the loopback interface.
 */
class OverlayServer {
  constructor(bot) {
    this.bot = bot;
    this.server = null;
    this.clients = new Set();
    this.heartbeat = null;
    this.page = null;
    this.pageStamp = 0;
  }

  getKey() {
    return this.bot.settings.get(KEY_SETTING, "");
  }

  /** Creates the access key on first run. */
  async ensureKey() {
    if (this.getKey()) return this.getKey();

    const key = crypto.randomBytes(16).toString("hex");
    await this.bot.settings.update({ [KEY_SETTING]: key });
    logger.info("Overlay access key generated");
    return key;
  }

  async regenerateKey() {
    const key = crypto.randomBytes(16).toString("hex");
    await this.bot.settings.update({ [KEY_SETTING]: key });
    // Existing browser sources now hold a stale key; drop them so they retry.
    this.disconnectAll();
    return key;
  }

  isAuthorized(url) {
    const provided = url.searchParams.get("key") || "";
    const expected = this.getKey();
    if (!expected) return false;

    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  getOverlayConfig() {
    return overlayConfig.parse(this.bot.settings.get(overlayConfig.SETTING_KEY));
  }

  buildState() {
    return {
      config: this.getOverlayConfig(),
      track: this.bot.spotifyManager.getCurrentTrack(),
      connected: this.bot.spotifyManager.isConnected(),
      // The browser corrects for the delay between the poll and this frame.
      serverTime: Date.now(),
    };
  }

  /**
   * Serves the overlay page from memory, reloading it when the file changes.
   *
   * Keying the cache on NODE_ENV was a trap: running `npm run dev` with
   * NODE_ENV=production in .env pinned the page to whatever was on disk at
   * boot, so edits silently never shipped. A stat per request costs nothing
   * here - overlay pages are loaded once per browser source.
   */
  loadPage() {
    const stamp = fs.statSync(PAGE_FILE).mtimeMs;
    if (this.page && this.pageStamp === stamp) return this.page;

    this.page = fs.readFileSync(PAGE_FILE, "utf8");
    this.pageStamp = stamp;
    return this.page;
  }

  handleRequest(request, response) {
    const url = new URL(request.url, `http://${config.overlay.host}`);
    logger.debug(`${request.method} ${url.pathname}`);

    if (!this.isAuthorized(url)) {
      response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Invalid or missing overlay key");
      return;
    }

    if (url.pathname === "/spotify") {
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        // Values passed here take precedence over anything already set.
        "Content-Security-Policy": OVERLAY_CSP,
        "X-Frame-Options": "SAMEORIGIN",
      });
      response.end(this.loadPage());
      return;
    }

    if (url.pathname === "/spotify/stream") {
      this.openStream(response);
      return;
    }

    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }

  openStream(response) {
    response.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
      // Chromium buffers otherwise and the overlay updates in bursts.
      "X-Accel-Buffering": "no",
    });

    this.clients.add(response);
    this.send(response, this.buildState());

    response.on("close", () => this.clients.delete(response));
  }

  send(response, payload) {
    response.write(`data: ${JSON.stringify(payload)}\n\n`);
  }

  publish() {
    if (!this.clients.size) return;
    const frame = `data: ${JSON.stringify(this.buildState())}\n\n`;
    for (const client of this.clients) client.write(frame);
  }

  disconnectAll() {
    for (const client of this.clients) client.end();
    this.clients.clear();
  }

  bindSources() {
    this.bot.spotifyManager.on("track", () => this.publish());
    this.bot.settings.on("change", () => this.publish());

    // SSE connections idle for long stretches while music is paused.
    this.heartbeat = setInterval(() => {
      for (const client of this.clients) client.write(": keep-alive\n\n");
    }, HEARTBEAT_MS);
  }

  async start() {
    await this.ensureKey();
    this.bindSources();

    if (!config.overlay.standalone) {
      // Served from the main port instead, through the reverse proxy.
      logger.info(`Overlays available at ${config.overlay.base}`);
      return config.overlay.base;
    }

    this.server = http.createServer((request, response) =>
      this.handleRequest(request, response)
    );

    await new Promise((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(config.overlay.port, config.overlay.host, resolve);
    });

    logger.info(`Overlay server listening on ${config.overlay.base}`);
    return config.overlay.base;
  }

  /** Full browser-source URL, including the key. */
  getSpotifyUrl() {
    return `${config.overlay.base}/spotify?key=${this.getKey()}`;
  }

  async stop() {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.disconnectAll();
    if (!this.server) return;
    await new Promise((resolve) => this.server.close(resolve));
  }
}

module.exports = OverlayServer;
module.exports.KEY_SETTING = KEY_SETTING;
