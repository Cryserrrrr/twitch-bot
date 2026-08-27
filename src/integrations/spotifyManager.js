"use strict";

const { EventEmitter } = require("events");
const SpotifyWebApi = require("spotify-web-api-node");

const config = require("../core/config");
const logger = require("../core/logger").child("spotify");
const TokenStore = require("../auth/tokenStore");

const SCOPES = [
  "user-read-currently-playing",
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-private",
  "playlist-modify-public",
  "playlist-modify-private",
];

/**
 * Polling cadence. The fast rate is what makes an OBS overlay feel immediate;
 * the slow one avoids hammering Spotify when nothing is playing. Both stay far
 * below the API rate limits.
 */
const ACTIVE_POLL_MS = 3000;
const IDLE_POLL_MS = 20000;
const REFRESH_MARGIN_MS = 60000;

const STATE = {
  DISABLED: "disabled", // no client id/secret configured
  MISSING: "missing", // never authorized
  REVOKED: "revoked", // refresh token rejected by Spotify
  READY: "ready",
};

/**
 * Spotify integration.
 *
 * The refresh token used to live in .env and was rewritten by the web server
 * at runtime. It now sits in data/tokens/spotify.json, and a revoked token
 * produces one actionable warning instead of an unbounded retry loop that
 * printed the whole Spotify error object every time.
 */
class SpotifyManager extends EventEmitter {
  constructor() {
    super();
    this.store = new TokenStore("spotify");
    this.state = config.spotify.enabled ? STATE.MISSING : STATE.DISABLED;
    this.currentTrack = null;
    this.refreshTimer = null;
    this.pollTimer = null;
    this.polling = false;

    this.api = new SpotifyWebApi({
      clientId: config.spotify.clientId,
      clientSecret: config.spotify.clientSecret,
      redirectUri: config.spotify.redirectUri,
    });
  }

  isConnected() {
    return this.state === STATE.READY;
  }

  getStatus() {
    return {
      enabled: config.spotify.enabled,
      state: this.state,
      connected: this.isConnected(),
      track: this.currentTrack,
    };
  }

  async initialize() {
    if (!config.spotify.enabled) {
      logger.debug("Spotify is not configured");
      return false;
    }

    const refreshToken = this.loadRefreshToken();
    if (!refreshToken) {
      logger.info("Spotify is not connected yet - authorize it from the dashboard");
      this.setState(STATE.MISSING);
      return false;
    }

    this.api.setRefreshToken(refreshToken);
    return this.refreshAccessToken();
  }

  /**
   * Reads the stored refresh token, migrating the legacy .env value on the
   * first run so existing setups keep working.
   */
  loadRefreshToken() {
    const stored = this.store.read();
    if (stored?.refreshToken) return stored.refreshToken;

    const legacy = process.env.SPOTIFY_REFRESH_TOKEN;
    if (legacy && legacy !== "your_spotify_refresh_token") {
      logger.info("Migrating the Spotify refresh token out of .env");
      this.store.write({
        refreshToken: legacy,
        updatedAt: new Date().toISOString(),
      });
      return legacy;
    }

    return null;
  }

  async refreshAccessToken() {
    try {
      const { body } = await this.api.refreshAccessToken();
      this.api.setAccessToken(body.access_token);
      this.setState(STATE.READY);

      const ttl = (body.expires_in || 3600) * 1000;
      this.scheduleRefresh(ttl - REFRESH_MARGIN_MS);
      this.startPolling();

      logger.info("Spotify connected");
      return true;
    } catch (error) {
      const reason = error.body?.error_description || error.message;

      if (error.body?.error === "invalid_grant") {
        this.setState(STATE.REVOKED);
        this.stopTimers();
        logger.warn(
          `Spotify access revoked (${reason}). Reconnect it from the dashboard`
        );
        return false;
      }

      logger.error("Spotify token refresh failed", error);
      // Transient failure: try again in a minute rather than giving up.
      this.scheduleRefresh(60000);
      return false;
    }
  }

  scheduleRefresh(delayMs) {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(
      () => this.refreshAccessToken(),
      Math.max(delayMs, 30000)
    );
  }

  /**
   * Self-scheduling poll loop rather than a fixed interval, so the cadence can
   * follow playback state instead of being locked in at start-up.
   */
  startPolling() {
    if (this.polling) return;
    this.polling = true;

    const tick = async () => {
      if (!this.polling) return;

      await this.fetchCurrentTrack().catch(() => {});

      const delay = this.currentTrack?.isPlaying ? ACTIVE_POLL_MS : IDLE_POLL_MS;
      this.pollTimer = setTimeout(tick, delay);
    };

    tick();
  }

  stopTimers() {
    this.polling = false;
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.refreshTimer = null;
    this.pollTimer = null;
  }

  async fetchCurrentTrack() {
    if (!this.isConnected()) return null;

    try {
      const { body } = await this.api.getMyCurrentPlayingTrack();
      const item = body?.item;

      if (!item) {
        this.setTrack(null);
        return null;
      }

      this.setTrack({
        id: item.id,
        name: item.name,
        artists: item.artists.map((artist) => artist.name).join(", "),
        album: item.album?.name || "",
        cover: item.album?.images?.[0]?.url || null,
        url: item.external_urls?.spotify || null,
        duration: item.duration_ms,
        progress: body.progress_ms,
        isPlaying: body.is_playing,
      });

      return this.currentTrack;
    } catch (error) {
      if (error.statusCode === 401) {
        await this.refreshAccessToken();
      } else {
        logger.debug("Could not read the current track", error);
      }
      return null;
    }
  }

  /**
   * Emits on every poll, not only on track changes: overlays interpolate the
   * progress bar locally between updates and need a regular reference point to
   * resync against, and pause/resume has to reach them too.
   */
  setTrack(track) {
    const changed = track?.id !== this.currentTrack?.id;
    this.currentTrack = track ? { ...track, receivedAt: Date.now() } : null;
    this.emit("track", this.currentTrack, { changed });
  }

  getCurrentTrack() {
    return this.currentTrack;
  }

  extractTrackId(input) {
    const patterns = [
      /spotify\.com\/(?:intl-[a-z]{2}\/)?track\/([a-zA-Z0-9]+)/,
      /spotify:track:([a-zA-Z0-9]+)/,
    ];

    for (const pattern of patterns) {
      const match = String(input).match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  /** Adds a track to the playback queue, by link or by search terms. */
  async requestSong(query) {
    if (!this.isConnected()) {
      return { ok: false, reason: "not_connected" };
    }

    try {
      let trackId = this.extractTrackId(query);

      if (!trackId) {
        const { body } = await this.api.searchTracks(query, { limit: 1 });
        trackId = body.tracks?.items?.[0]?.id;
        if (!trackId) return { ok: false, reason: "not_found" };
      }

      const { body: track } = await this.api.getTrack(trackId);
      await this.api.addToQueue(`spotify:track:${trackId}`);

      if (config.spotify.playlistId) {
        await this.api
          .addTracksToPlaylist(config.spotify.playlistId, [
            `spotify:track:${trackId}`,
          ])
          .catch((error) =>
            logger.debug("Could not add the track to the playlist", error)
          );
      }

      return {
        ok: true,
        track: {
          name: track.name,
          artists: track.artists.map((artist) => artist.name).join(", "),
        },
      };
    } catch (error) {
      // 404 from the queue endpoint means no active Spotify device.
      if (error.statusCode === 404) return { ok: false, reason: "no_device" };
      logger.error("Song request failed", error);
      return { ok: false, reason: "error" };
    }
  }

  getAuthorizationUrl() {
    return this.api.createAuthorizeURL(SCOPES, "spotify");
  }

  /** Completes the Spotify OAuth flow and persists the refresh token. */
  async handleAuthorizationCode(code) {
    const { body } = await this.api.authorizationCodeGrant(code);

    this.api.setAccessToken(body.access_token);
    this.api.setRefreshToken(body.refresh_token);
    this.store.write({
      refreshToken: body.refresh_token,
      updatedAt: new Date().toISOString(),
    });

    this.setState(STATE.READY);
    this.scheduleRefresh((body.expires_in || 3600) * 1000 - REFRESH_MARGIN_MS);
    this.startPolling();

    logger.info("Spotify connected");
    return true;
  }

  disconnect() {
    this.stopTimers();
    this.store.clear();
    this.currentTrack = null;
    this.setState(config.spotify.enabled ? STATE.MISSING : STATE.DISABLED);
  }

  setState(next) {
    if (this.state === next) return;
    this.state = next;
    this.emit("state", next);
  }

  async stop() {
    this.stopTimers();
  }
}

module.exports = SpotifyManager;
module.exports.STATE = STATE;
