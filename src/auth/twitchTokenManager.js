"use strict";

const { EventEmitter } = require("events");
const axios = require("axios");

const config = require("../core/config");
const logger = require("../core/logger").child("auth");
const TokenStore = require("./tokenStore");

const OAUTH_BASE = "https://id.twitch.tv/oauth2";
const HELIX_BASE = "https://api.twitch.tv/helix";

/** Refresh a little before expiry so no request ever races the deadline. */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

/**
 * Every scope the bot needs, chat included.
 * Chat scopes matter: the same user token now powers IRC, Helix and EventSub,
 * which replaces the hand-pasted TWITCH_OAUTH that silently expired.
 */
const SCOPES = [
  "chat:read",
  "chat:edit",
  "user:read:email",
  "user:read:follows",
  "moderation:read",
  "channel:manage:moderators",
  "channel:manage:broadcast",
  "channel:read:subscriptions",
  "channel:read:redemptions",
  "channel:read:hype_train",
  "channel:read:polls",
  "channel:read:predictions",
  "channel:read:ads",
  "channel:manage:ads",
  "channel:read:editors",
  "channel:read:vips",
  "bits:read",
  "moderator:read:followers",
  "moderator:read:chatters",
  "moderator:manage:chat_messages",
  "moderator:manage:banned_users",
];

const STATE = {
  MISSING: "missing", // no token on disk, the streamer must log in
  READY: "ready",
  INVALID: "invalid", // token exists but Twitch rejected it
};

/**
 * Single source of truth for the Twitch user token.
 *
 * The previous version kept three independent copies of the same token
 * (API manager, EventSub manager, commands) each with its own refresh logic,
 * so a refresh in one place left the others stale. Everything now goes
 * through this manager, which also de-duplicates concurrent refreshes.
 */
class TwitchTokenManager extends EventEmitter {
  constructor() {
    super();
    this.store = new TokenStore("twitch");
    this.state = STATE.MISSING;
    this.accessToken = null;
    this.refreshToken = null;
    this.expiresAt = 0;
    this.scopes = [];
    this.user = null; // { id, login }
    this.refreshPromise = null;

    this.load();
  }

  load() {
    const data = this.store.read();
    if (!data?.accessToken || !data?.refreshToken) return;

    this.accessToken = data.accessToken;
    this.refreshToken = data.refreshToken;
    this.expiresAt = data.expiresAt || 0;
    this.scopes = data.scopes || [];
    this.user = data.user || null;
    this.state = STATE.READY;
  }

  persist() {
    this.store.write({
      accessToken: this.accessToken,
      refreshToken: this.refreshToken,
      expiresAt: this.expiresAt,
      scopes: this.scopes,
      user: this.user,
      updatedAt: new Date().toISOString(),
    });
  }

  isReady() {
    return this.state === STATE.READY && Boolean(this.accessToken);
  }

  getStatus() {
    return {
      state: this.state,
      user: this.user,
      expiresAt: this.expiresAt,
      scopes: this.scopes,
      missingScopes: this.getMissingScopes(),
    };
  }

  getMissingScopes() {
    if (!this.scopes.length) return [];
    return SCOPES.filter((scope) => !this.scopes.includes(scope));
  }

  getAuthorizationUrl(state) {
    const params = new URLSearchParams({
      client_id: config.twitch.clientId,
      redirect_uri: config.twitch.redirectUri,
      response_type: "code",
      scope: SCOPES.join(" "),
      // Always show the consent screen so scope changes are actually granted.
      force_verify: "true",
    });
    if (state) params.set("state", state);
    return `${OAUTH_BASE}/authorize?${params.toString()}`;
  }

  /**
   * Checks the stored token against Twitch and refreshes it when needed.
   * Called once at boot so the bot knows straight away whether it can connect.
   */
  async initialize() {
    if (!this.accessToken) {
      this.setState(STATE.MISSING);
      return false;
    }

    const valid = await this.validate();
    if (valid) return true;

    try {
      await this.refresh();
      return true;
    } catch {
      return false;
    }
  }

  async validate() {
    try {
      const { data } = await axios.get(`${OAUTH_BASE}/validate`, {
        headers: { Authorization: `OAuth ${this.accessToken}` },
        timeout: 10000,
      });

      this.scopes = data.scopes || [];
      this.user = { id: data.user_id, login: data.login };
      this.expiresAt = Date.now() + (data.expires_in || 0) * 1000;
      this.setState(STATE.READY);
      this.persist();
      return true;
    } catch (error) {
      if (error.response?.status === 401) return false;
      logger.warn("Could not validate the Twitch token", error);
      return false;
    }
  }

  /**
   * Returns a usable access token, refreshing it first when it is about to
   * expire. Concurrent callers share a single refresh request.
   */
  async getAccessToken() {
    if (!this.accessToken && !this.refreshToken) {
      throw new Error("Twitch account not connected");
    }

    if (this.accessToken && Date.now() < this.expiresAt - REFRESH_MARGIN_MS) {
      return this.accessToken;
    }

    await this.refresh();
    return this.accessToken;
  }

  async refresh() {
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = this.performRefresh().finally(() => {
      this.refreshPromise = null;
    });

    return this.refreshPromise;
  }

  async performRefresh() {
    if (!this.refreshToken) {
      this.setState(STATE.MISSING);
      throw new Error("Twitch account not connected");
    }

    try {
      const { data } = await axios.post(`${OAUTH_BASE}/token`, null, {
        params: {
          client_id: config.twitch.clientId,
          client_secret: config.twitch.clientSecret,
          grant_type: "refresh_token",
          refresh_token: this.refreshToken,
        },
        timeout: 10000,
      });

      this.accessToken = data.access_token;
      this.refreshToken = data.refresh_token || this.refreshToken;
      this.expiresAt = Date.now() + (data.expires_in || 3600) * 1000;
      this.scopes = data.scope || this.scopes;
      this.persist();
      this.setState(STATE.READY);

      logger.debug("Twitch token refreshed");
      return this.accessToken;
    } catch (error) {
      const reason = error.response?.data?.message || error.message;
      // invalid_grant means the user revoked access or changed their password.
      if (error.response?.status === 400 || error.response?.status === 401) {
        this.setState(STATE.INVALID);
        logger.warn(
          `Twitch refresh token rejected (${reason}). Sign in again from the dashboard`
        );
      } else {
        logger.error("Twitch token refresh failed", error);
      }
      throw error;
    }
  }

  /** Completes the OAuth flow started from the dashboard. */
  async exchangeCode(code) {
    const { data } = await axios.post(`${OAUTH_BASE}/token`, null, {
      params: {
        client_id: config.twitch.clientId,
        client_secret: config.twitch.clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: config.twitch.redirectUri,
      },
      timeout: 10000,
    });

    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token;
    this.expiresAt = Date.now() + (data.expires_in || 3600) * 1000;
    this.scopes = data.scope || [];

    const user = await this.fetchCurrentUser();
    this.user = { id: user.id, login: user.login };
    this.persist();
    this.setState(STATE.READY);

    logger.info(`Twitch account connected as ${user.login}`);
    return user;
  }

  async fetchCurrentUser() {
    const { data } = await axios.get(`${HELIX_BASE}/users`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Client-Id": config.twitch.clientId,
      },
      timeout: 10000,
    });

    const user = data.data?.[0];
    if (!user) throw new Error("Twitch returned no user for this token");
    return user;
  }

  async disconnect() {
    if (this.accessToken) {
      try {
        await axios.post(`${OAUTH_BASE}/revoke`, null, {
          params: {
            client_id: config.twitch.clientId,
            token: this.accessToken,
          },
          timeout: 10000,
        });
      } catch (error) {
        logger.debug("Token revocation call failed", error);
      }
    }

    this.accessToken = null;
    this.refreshToken = null;
    this.expiresAt = 0;
    this.scopes = [];
    this.user = null;
    this.store.clear();
    this.setState(STATE.MISSING);
  }

  setState(next) {
    if (this.state === next) return;
    this.state = next;
    this.emit("state", next);
    if (next === STATE.READY) this.emit("ready");
  }

  /** Authenticated Helix request helper shared by every integration. */
  async request(method, endpoint, options = {}) {
    const token = await this.getAccessToken();
    try {
      const response = await axios({
        method,
        url: `${HELIX_BASE}${endpoint}`,
        headers: {
          Authorization: `Bearer ${token}`,
          "Client-Id": config.twitch.clientId,
          ...(options.data ? { "Content-Type": "application/json" } : {}),
        },
        params: options.params,
        data: options.data,
        timeout: options.timeout || 10000,
      });
      return response;
    } catch (error) {
      // A 401 here means the token died between refreshes; retry once.
      if (error.response?.status === 401 && !options.retried) {
        await this.refresh();
        return this.request(method, endpoint, { ...options, retried: true });
      }
      throw error;
    }
  }
}

module.exports = new TwitchTokenManager();
module.exports.SCOPES = SCOPES;
module.exports.STATE = STATE;
