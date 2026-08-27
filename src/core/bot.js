"use strict";

const { EventEmitter } = require("events");

const config = require("./config");
const logger = require("./logger").child("bot");
const Settings = require("./settings");
const Translator = require("../utils/translator");
const Database = require("../database/database");
const tokenManager = require("../auth/twitchTokenManager");
const ChatClient = require("../chat/chatClient");
const CommandManager = require("../commands/commandManager");
const ModerationManager = require("../moderation/moderationManager");
const RecurringMessageManager = require("../moderation/recurringMessageManager");
const EventManager = require("../events/eventManager");
const TwitchApiManager = require("../integrations/twitchApiManager");
const EventSubManager = require("../integrations/eventSubManager");
const SpotifyManager = require("../integrations/spotifyManager");
const OBSManager = require("../integrations/obsManager");
const ApexManager = require("../integrations/apexManager");

const RECENT_MESSAGE_LIMIT = 200;
const PRUNE_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * Wires every subsystem together and owns the bot lifecycle.
 *
 * Startup is deliberately fault tolerant: a missing Twitch login, an offline
 * OBS or a revoked Spotify token degrade the affected feature and leave
 * everything else running, instead of exiting the process.
 */
class Bot extends EventEmitter {
  constructor() {
    super();
    this.startedAt = Date.now();
    this.live = false;
    this.recentMessages = new Map(); // login -> { id, text, time }
    this.pruneTimer = null;

    this.translator = new Translator();
    this.database = new Database();
    this.tokens = tokenManager;
    this.chat = new ChatClient();
    this.apexManager = new ApexManager();
    this.spotifyManager = new SpotifyManager();
    this.obsManager = new OBSManager();
    this.twitchApiManager = new TwitchApiManager(this);
    this.eventSubManager = new EventSubManager(this);
  }

  async initialize() {
    await this.database.initialize();

    this.settings = new Settings(this.database);
    await this.settings.load();

    this.moderationManager = new ModerationManager({
      database: this.database,
      settings: this.settings,
      translator: this.translator,
    });
    this.moderationManager.setChannelOwner(config.bot.channel);
    await this.moderationManager.load();

    this.eventManager = new EventManager({
      translator: this.translator,
      settings: this.settings,
      database: this.database,
    });

    this.recurringMessages = new RecurringMessageManager({
      database: this.database,
      send: (message) => this.chat.say(message),
    });
    await this.recurringMessages.load();

    this.commandManager = new CommandManager(this);

    this.bindChat();
    this.bindIntegrations();

    this.pruneTimer = setInterval(() => {
      this.database.pruneEvents().catch(() => {});
    }, PRUNE_INTERVAL_MS);
  }

  bindChat() {
    this.chat.on("message", (payload) => {
      this.handleMessage(payload).catch((error) =>
        logger.error("Message pipeline failed", error)
      );
    });

    this.chat.on("connected", () => this.publishStatus());
    this.chat.on("disconnected", () => this.publishStatus());
  }

  bindIntegrations() {
    this.eventSubManager.on("activity", (activity) => {
      this.emit("activity", activity);
    });

    this.eventSubManager.on("stream", ({ live }) => {
      this.setLive(live);
    });

    this.obsManager.on("streaming", (active) => {
      // OBS knows before Twitch does when the stream stops.
      if (!active) this.setLive(false);
    });

    this.spotifyManager.on("track", (track) => {
      this.emit("track", track);
    });

    // Any subsystem going up or down must reach the dashboard, otherwise its
    // service indicators keep showing whatever was true when it connected.
    for (const [emitter, events] of [
      [this.eventSubManager, ["connected", "disconnected"]],
      [this.obsManager, ["connected", "disconnected", "streaming"]],
      [this.spotifyManager, ["state"]],
      [this.tokens, ["state"]],
    ]) {
      for (const event of events) {
        emitter.on(event, () => this.publishStatus());
      }
    }
  }

  publishStatus() {
    this.emit("status", this.getStatus());
  }

  setLive(live) {
    if (this.live === live) return;
    this.live = live;
    this.recurringMessages.setLive(live);
    this.publishStatus();
  }

  // Chat pipeline ------------------------------------------------------------

  async handleMessage({ tags, message }) {
    const username = tags.username;

    this.rememberMessage(username, tags.id, message);
    this.emit("chat", {
      id: tags.id,
      username,
      displayName: tags["display-name"] || username,
      color: tags.color || null,
      badges: Object.keys(tags.badges || {}),
      message,
      time: Date.now(),
    });

    this.database
      .recordEvent("message", username, null)
      .catch((error) => logger.debug("Could not record the message", error));

    const verdict = this.moderationManager.check(message, tags);
    if (verdict) {
      await this.applyModeration(verdict, tags);
      return;
    }

    await this.commandManager.handle({ tags, message });
  }

  rememberMessage(username, id, text) {
    if (!id) return;
    this.recentMessages.set(username, { id, text, time: Date.now() });

    if (this.recentMessages.size > RECENT_MESSAGE_LIMIT) {
      const oldest = this.recentMessages.keys().next().value;
      this.recentMessages.delete(oldest);
    }
  }

  getLastMessage(username) {
    return this.recentMessages.get(String(username).toLowerCase()) || null;
  }

  async applyModeration(verdict, tags) {
    const username = tags.username;

    if (!this.twitchApiManager.isReady()) {
      logger.warn(
        `Moderation skipped for ${username}, the Twitch API is not connected`
      );
      return;
    }

    try {
      if (verdict.action === "delete") {
        await this.twitchApiManager.deleteMessage(tags.id);
      } else {
        const user = await this.twitchApiManager.getUserInfo(username);
        if (verdict.action === "ban") {
          await this.twitchApiManager.banUser(user.id, verdict.reason);
        } else {
          await this.twitchApiManager.timeoutUser(
            user.id,
            verdict.duration,
            verdict.reason
          );
        }
      }

      logger.info(
        `Moderation: ${verdict.action} on ${username} (${verdict.reason})`
      );

      await this.database.recordEvent("moderation", username, {
        action: verdict.action,
        rule: verdict.rule,
        reason: verdict.reason,
      });
      this.emit("activity", {
        kind: "moderation",
        data: { username, ...verdict },
        time: Date.now(),
      });
    } catch (error) {
      logger.error(`Moderation action failed for ${username}`, error);
    }
  }

  // Lifecycle ----------------------------------------------------------------

  /**
   * Connects everything. Split from initialize() so the web server can be
   * listening before any network call is attempted: if the Twitch token is
   * dead, the dashboard is already up to fix it.
   */
  async launch() {
    // Integrations that do not depend on the Twitch login can start now.
    this.obsManager.connect().catch(() => {});
    this.spotifyManager.initialize().catch((error) =>
      logger.error("Spotify initialization failed", error)
    );

    const authenticated = await this.tokens.initialize();
    if (authenticated) {
      await this.connectTwitch();
    } else {
      logger.warn(
        `No Twitch account connected - open ${config.publicUrl} and sign in`
      );
      this.tokens.once("ready", () => {
        this.connectTwitch().catch((error) =>
          logger.error("Twitch startup failed", error)
        );
      });
    }
  }

  /** Brings up everything that needs a valid Twitch user token. */
  async connectTwitch() {
    const apiReady = await this.twitchApiManager.initialize();
    if (!apiReady) return;

    await this.chat.start();
    await this.twitchApiManager.updateModeratorsList();
    await this.eventSubManager.start(this.twitchApiManager.broadcasterId);

    try {
      const stream = await this.twitchApiManager.getStreamInfo();
      this.setLive(Boolean(stream));
    } catch (error) {
      logger.debug("Could not read the initial stream status", error);
    }

    this.publishStatus();
  }

  getStatus() {
    return {
      startedAt: this.startedAt,
      uptime: Date.now() - this.startedAt,
      channel: config.bot.channel,
      prefix: config.bot.prefix,
      language: this.translator.getLanguage(),
      live: this.live,
      chat: this.chat.getStatus(),
      twitch: {
        ...this.tokens.getStatus(),
        apiReady: this.twitchApiManager.isReady(),
      },
      eventsub: this.eventSubManager.getStatus(),
      spotify: this.spotifyManager.getStatus(),
      obs: this.obsManager.getStatus(),
      apex: this.apexManager.getStatus(),
    };
  }

  async stop() {
    if (this.pruneTimer) clearInterval(this.pruneTimer);

    await Promise.allSettled([
      this.chat.stop(),
      this.eventSubManager.stop(),
      this.spotifyManager.stop(),
      this.obsManager.stop(),
    ]);

    this.recurringMessages?.stop();
    await this.database.close();
  }
}

module.exports = Bot;
