"use strict";

const { EventEmitter } = require("events");
const tmi = require("tmi.js");

const config = require("../core/config");
const logger = require("../core/logger").child("chat");
const tokenManager = require("../auth/twitchTokenManager");

const MAX_MESSAGE_LENGTH = 480;
const BASE_RECONNECT_DELAY = 2000;
const MAX_RECONNECT_DELAY = 60000;

/**
 * Twitch chat connection.
 *
 * The old implementation authenticated with the static TWITCH_OAUTH value from
 * .env. Those tokens expire, and tmi.js then retried forever with the same dead
 * credentials, which is exactly the "Login authentication failed" loop.
 * The client now borrows the OAuth token from the token manager and refreshes
 * it before reconnecting.
 */
class ChatClient extends EventEmitter {
  constructor() {
    super();
    this.client = null;
    this.connected = false;
    this.channel = config.bot.channel;
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.stopped = false;
    this.identity = null;
  }

  isConnected() {
    return this.connected;
  }

  getStatus() {
    return {
      connected: this.connected,
      channel: this.channel,
      identity: this.identity,
    };
  }

  async start() {
    this.stopped = false;

    if (!config.bot.chatEnabled) {
      logger.info("Chat disabled by configuration (BOT_CHAT_ENABLED=false)");
      return false;
    }

    if (!tokenManager.isReady()) {
      logger.warn(
        "Chat is waiting for a Twitch account - sign in from the dashboard"
      );
      // Connect by itself as soon as the streamer completes the OAuth flow.
      tokenManager.once("ready", () => {
        if (!this.stopped) this.connect();
      });
      return false;
    }

    return this.connect();
  }

  async connect() {
    this.clearReconnectTimer();

    let token;
    try {
      token = await tokenManager.getAccessToken();
    } catch (error) {
      logger.warn("Cannot connect to chat without a valid Twitch token");
      tokenManager.once("ready", () => {
        if (!this.stopped) this.connect();
      });
      return false;
    }

    const login = tokenManager.user?.login || config.bot.channel;
    this.identity = login;

    // tmi.js reads the password once, at construction time, so the client is
    // rebuilt on every attempt to guarantee it uses the freshest token.
    await this.destroyClient();

    this.client = new tmi.Client({
      options: { debug: false, skipUpdatingEmotesets: true },
      logger: { info: () => {}, warn: () => {}, error: () => {} },
      // Reconnection is handled here so a dead token can be refreshed first.
      connection: { reconnect: false, secure: true },
      identity: { username: login, password: `oauth:${token}` },
      channels: [this.channel],
    });

    this.bindEvents();

    try {
      await this.client.connect();
      return true;
    } catch (error) {
      const reason = typeof error === "string" ? error : error?.message;
      await this.handleFailure(reason || "connection failed");
      return false;
    }
  }

  bindEvents() {
    this.client.on("connected", () => {
      this.connected = true;
      this.reconnectAttempts = 0;
      logger.info(`Connected to #${this.channel} as ${this.identity}`);
      this.emit("connected", { channel: this.channel, login: this.identity });
    });

    this.client.on("disconnected", (reason) => {
      const wasConnected = this.connected;
      this.connected = false;
      if (wasConnected) {
        logger.warn(`Disconnected from chat: ${reason}`);
        this.emit("disconnected", reason);
      }
      this.handleFailure(reason);
    });

    this.client.on("message", (channel, tags, message, self) => {
      if (self) return;
      this.emit("message", { channel, tags, message });
    });

    this.client.on("messagedeleted", (channel, username, deletedMessage, tags) => {
      this.emit("messagedeleted", { channel, username, deletedMessage, tags });
    });
  }

  /**
   * Decides what to do after a drop. An auth error means the token is stale,
   * so it is refreshed before the next attempt instead of hammering Twitch
   * with credentials it already rejected.
   */
  async handleFailure(reason) {
    if (this.stopped) return;

    const isAuthError = /login authentication failed|improperly formatted auth/i.test(
      String(reason || "")
    );

    if (isAuthError) {
      logger.warn("Chat token rejected, refreshing it");
      try {
        await tokenManager.refresh();
      } catch {
        logger.warn(
          "Chat is paused until the Twitch account is reconnected from the dashboard"
        );
        tokenManager.once("ready", () => {
          if (!this.stopped) this.connect();
        });
        return;
      }
    }

    this.scheduleReconnect();
  }

  scheduleReconnect() {
    if (this.stopped || this.reconnectTimer) return;

    this.reconnectAttempts += 1;
    const delay = Math.min(
      BASE_RECONNECT_DELAY * 2 ** (this.reconnectAttempts - 1),
      MAX_RECONNECT_DELAY
    );

    logger.info(
      `Reconnecting to chat in ${Math.round(delay / 1000)}s (attempt ${
        this.reconnectAttempts
      })`
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /** Sends a message to the channel; long messages are truncated, not dropped. */
  async say(message) {
    if (!this.connected || !this.client) {
      logger.debug("Message not sent, chat is offline");
      return false;
    }

    const text = String(message).replace(/\s+/g, " ").trim();
    if (!text) return false;

    try {
      await this.client.say(
        `#${this.channel}`,
        text.length > MAX_MESSAGE_LENGTH
          ? `${text.slice(0, MAX_MESSAGE_LENGTH - 1)}…`
          : text
      );
      this.emit("sent", text);
      return true;
    } catch (error) {
      logger.error("Failed to send a chat message", error);
      return false;
    }
  }

  async reply(tags, message) {
    return this.say(`@${tags.username} ${message}`);
  }

  async destroyClient() {
    if (!this.client) return;
    const client = this.client;
    this.client = null;
    client.removeAllListeners();
    try {
      if (client.readyState() === "OPEN") await client.disconnect();
    } catch {
      // The socket was already gone; nothing to clean up.
    }
  }

  async stop() {
    this.stopped = true;
    this.clearReconnectTimer();
    await this.destroyClient();
    this.connected = false;
  }
}

module.exports = ChatClient;
