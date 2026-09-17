"use strict";

const { EventEmitter } = require("events");
const WebSocket = require("ws");

const logger = require("../core/logger").child("eventsub");
const tokenManager = require("../auth/twitchTokenManager");

const DEFAULT_URL = "wss://eventsub.wss.twitch.tv/ws";
const MAX_RECONNECT_DELAY = 60000;

/**
 * Twitch EventSub over WebSocket.
 *
 * Notable fixes over the previous version: `fs`/`path` were used without being
 * required, so the readiness loop threw on its first iteration and silently
 * spun for sixty seconds; session_reconnect ignored the URL Twitch hands out;
 * and a client-side ping was sent even though EventSub drives keepalives.
 */
class EventSubManager extends EventEmitter {
  constructor(bot) {
    super();
    this.bot = bot;
    this.ws = null;
    this.sessionId = null;
    this.connected = false;
    this.broadcasterId = null;
    this.subscriptions = new Map();
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.keepaliveTimer = null;
    this.keepaliveSeconds = 10;
    this.stopped = false;
  }

  isConnected() {
    return this.connected;
  }

  getStatus() {
    return {
      connected: this.connected,
      subscriptions: [...this.subscriptions.values()].map((sub) => sub.type),
    };
  }

  async start(broadcasterId) {
    this.stopped = false;
    this.broadcasterId = broadcasterId;
    return this.connect();
  }

  async connect(url = DEFAULT_URL) {
    if (this.stopped) return false;
    this.clearReconnectTimer();

    if (!tokenManager.isReady() || !this.broadcasterId) {
      logger.debug("EventSub is waiting for an authenticated account");
      return false;
    }

    return new Promise((resolve) => {
      const socket = new WebSocket(url);
      this.ws = socket;

      socket.on("open", () => {
        this.reconnectAttempts = 0;
      });

      socket.on("message", (raw) => {
        let payload;
        try {
          payload = JSON.parse(raw.toString());
        } catch (error) {
          logger.warn("Received a malformed EventSub frame", error);
          return;
        }
        this.handleFrame(payload, resolve);
      });

      socket.on("close", (code) => {
        // During a session_reconnect the previous socket closes while the new
        // one is already live: only the current socket may change the state.
        if (this.ws !== null && this.ws !== socket) {
          resolve(false);
          return;
        }

        this.ws = null;
        this.connected = false;
        this.clearKeepalive();
        this.emit("disconnected");

        if (!this.stopped && code !== 1000) {
          logger.warn(`EventSub connection closed (code ${code})`);
          this.scheduleReconnect();
        }
        resolve(false);
      });

      socket.on("error", (error) => {
        logger.error("EventSub socket error", error);
      });
    });
  }

  async handleFrame(frame, resolve) {
    const type = frame.metadata?.message_type;

    switch (type) {
      case "session_welcome": {
        const session = frame.payload.session;
        this.sessionId = session.id;
        this.connected = true;
        this.keepaliveSeconds = session.keepalive_timeout_seconds || 10;
        this.resetKeepalive();
        logger.info("EventSub session established");
        await this.createSubscriptions();
        this.emit("connected");
        if (resolve) resolve(true);
        break;
      }

      case "session_keepalive":
        this.resetKeepalive();
        break;

      case "session_reconnect": {
        // Twitch hands over a new URL and keeps the old socket alive briefly.
        const nextUrl = frame.payload.session?.reconnect_url;
        logger.info("EventSub asked for a reconnect");
        const previous = this.ws;
        this.ws = null;
        await this.connect(nextUrl || DEFAULT_URL);
        previous?.close(1000);
        break;
      }

      case "notification":
        this.resetKeepalive();
        await this.dispatch(frame.payload);
        break;

      case "revocation": {
        const sub = frame.payload.subscription;
        logger.warn(`EventSub subscription revoked: ${sub.type} (${sub.status})`);
        this.subscriptions.delete(sub.id);
        break;
      }

      default:
        logger.debug(`Unhandled EventSub frame: ${type}`);
    }
  }

  /**
   * Missing keepalives mean the connection is dead even though the socket
   * still looks open, so the connection is recycled proactively.
   */
  resetKeepalive() {
    this.clearKeepalive();
    this.keepaliveTimer = setTimeout(() => {
      logger.warn("No EventSub keepalive received, reconnecting");
      this.ws?.close(4000);
    }, (this.keepaliveSeconds + 5) * 1000);
  }

  clearKeepalive() {
    if (this.keepaliveTimer) {
      clearTimeout(this.keepaliveTimer);
      this.keepaliveTimer = null;
    }
  }

  buildSubscriptions() {
    const broadcaster = this.broadcasterId;
    const moderator = this.bot.twitchApiManager?.moderatorId || broadcaster;
    const transport = { method: "websocket", session_id: this.sessionId };

    return [
      {
        type: "channel.follow",
        version: "2",
        condition: {
          broadcaster_user_id: broadcaster,
          moderator_user_id: moderator,
        },
        transport,
      },
      {
        type: "channel.subscribe",
        version: "1",
        condition: { broadcaster_user_id: broadcaster },
        transport,
      },
      {
        type: "channel.subscription.message",
        version: "1",
        condition: { broadcaster_user_id: broadcaster },
        transport,
      },
      {
        type: "channel.subscription.gift",
        version: "1",
        condition: { broadcaster_user_id: broadcaster },
        transport,
      },
      {
        type: "channel.cheer",
        version: "1",
        condition: { broadcaster_user_id: broadcaster },
        transport,
      },
      {
        type: "channel.raid",
        version: "1",
        condition: { to_broadcaster_user_id: broadcaster },
        transport,
      },
      {
        type: "channel.channel_points_custom_reward_redemption.add",
        version: "1",
        condition: { broadcaster_user_id: broadcaster },
        transport,
      },
      {
        type: "stream.online",
        version: "1",
        condition: { broadcaster_user_id: broadcaster },
        transport,
      },
      {
        type: "stream.offline",
        version: "1",
        condition: { broadcaster_user_id: broadcaster },
        transport,
      },
    ];
  }

  async createSubscriptions() {
    this.subscriptions.clear();
    const wanted = this.buildSubscriptions();
    const failed = [];

    for (const subscription of wanted) {
      try {
        const { data } = await tokenManager.request(
          "post",
          "/eventsub/subscriptions",
          { data: subscription }
        );
        const created = data.data?.[0];
        if (created) this.subscriptions.set(created.id, created);
      } catch (error) {
        // Missing scopes and non-affiliate channels are expected here.
        failed.push(subscription.type);
        logger.debug(`Subscription refused: ${subscription.type}`, error);
      }
    }

    logger.info(
      `EventSub listening to ${this.subscriptions.size}/${wanted.length} event types`
    );
    if (failed.length) {
      logger.warn(`Event types unavailable for this channel: ${failed.join(", ")}`);
    }
  }

  async dispatch(payload) {
    const type = payload.subscription?.type;
    const event = payload.event || {};

    try {
      switch (type) {
        case "channel.follow":
          await this.announce("follow", { username: event.user_name });
          break;

        case "channel.subscribe":
          if (event.is_gift) return; // Announced by the gift event instead.
          await this.announce("subscription", {
            username: event.user_name,
            tier: event.tier,
          });
          break;

        case "channel.subscription.message":
          await this.announce("resub", {
            username: event.user_name,
            months: event.cumulative_months,
            message: event.message?.text,
          });
          break;

        case "channel.subscription.gift":
          await this.announce("subgift", {
            username: event.is_anonymous ? "Anonymous" : event.user_name,
            total: event.total,
          });
          break;

        case "channel.cheer":
          await this.announce("cheer", {
            username: event.is_anonymous ? "Anonymous" : event.user_name,
            bits: event.bits,
            message: event.message,
          });
          break;

        case "channel.raid":
          await this.announce("raid", {
            username: event.from_broadcaster_user_name,
            viewers: event.viewers,
          });
          break;

        case "channel.channel_points_custom_reward_redemption.add":
          this.emitActivity("redemption", {
            username: event.user_name,
            reward: event.reward?.title,
            cost: event.reward?.cost,
          });
          break;

        case "stream.online":
          logger.info("Stream is live");
          this.emit("stream", { live: true, event });
          this.emitActivity("stream.online", {});
          break;

        case "stream.offline":
          logger.info("Stream went offline");
          this.emit("stream", { live: false, event });
          this.emitActivity("stream.offline", {});
          break;

        default:
          logger.debug(`Unhandled event type: ${type}`);
      }
    } catch (error) {
      logger.error(`Failed to process event ${type}`, error);
    }
  }

  /** Builds the chat announcement for an event and posts it. */
  async announce(kind, data) {
    const message = this.bot.eventManager.buildMessage(kind, data);
    this.emitActivity(kind, data);
    if (message) await this.bot.chat.say(message);
  }

  emitActivity(kind, data) {
    this.emit("activity", { kind, data, time: Date.now() });
  }

  scheduleReconnect() {
    if (this.stopped || this.reconnectTimer) return;

    this.reconnectAttempts += 1;
    const delay = Math.min(
      2000 * 2 ** (this.reconnectAttempts - 1),
      MAX_RECONNECT_DELAY
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

  async stop() {
    this.stopped = true;
    this.clearReconnectTimer();
    this.clearKeepalive();
    if (this.ws) {
      this.ws.close(1000);
      this.ws = null;
    }
    this.connected = false;
  }
}

module.exports = EventSubManager;
