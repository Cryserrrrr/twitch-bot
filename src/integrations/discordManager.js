"use strict";

const axios = require("axios");

const config = require("../core/config");
const logger = require("../core/logger").child("discord");

/** Only genuine Discord webhook URLs are accepted, so the bot cannot be used to reach arbitrary hosts. */
const WEBHOOK_PATTERN =
  /^https:\/\/(?:(?:ptb|canary)\.)?discord(?:app)?\.com\/api(?:\/v\d+)?\/webhooks\/(\d+)\/([\w-]+)\/?$/;

const MENTIONS = ["none", "everyone", "here", "role"];
const TWITCH_PURPLE = 0x9146ff;
const ENDED_GREY = 0x4f545c;

/** A stream that comes back within this window reuses its announcement instead of pinging again. */
const RESUME_WINDOW_MS = 15 * 60 * 1000;
/** Helix /streams lags a few seconds behind the stream.online notification. */
const STREAM_LOOKUP_ATTEMPTS = 6;
const STREAM_LOOKUP_DELAY_MS = 5000;

/** Persisted in the settings table so a restart mid-stream still edits the right message. */
const KEYS = {
  enabled: "discordEnabled",
  webhookUrl: "discordWebhookUrl",
  message: "discordMessage",
  mention: "discordMention",
  roleId: "discordRoleId",
  editOnEnd: "discordEditOnEnd",
  messageId: "discordLastMessageId",
  /** started_at of the latest stream.online, used to drop duplicate notifications. */
  streamStartedAt: "discordLastStartedAt",
  /** Start of the announced session, which survives a resumed stream. */
  sessionStartedAt: "discordSessionStartedAt",
  streamEndedAt: "discordLastEndedAt",
  streamTitle: "discordLastTitle",
  streamGame: "discordLastGame",
};

const SECRET_KEYS = [KEYS.webhookUrl];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normalizeWebhookUrl(url) {
  const trimmed = String(url || "").trim().split("?")[0];
  return WEBHOOK_PATTERN.test(trimmed) ? trimmed.replace(/\/$/, "") : null;
}

function formatDuration(ms, language) {
  const minutes = Math.max(1, Math.round(ms / 60000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} min`;
  const separator = language === "fr" ? " h " : "h ";
  return rest ? `${hours}${separator}${String(rest).padStart(2, "0")}` : `${hours}${separator.trimEnd()}`;
}

/**
 * Announces the stream on Discord through a channel webhook.
 *
 * A webhook needs no gateway connection or bot account: the announcement is a
 * single POST, and `?wait=true` returns the message id so the post can be
 * edited once the stream ends.
 */
class DiscordManager {
  constructor({ settings, translator, twitchApi }) {
    this.settings = settings;
    this.translator = translator;
    this.twitchApi = twitchApi;
    this.pending = Promise.resolve();
  }

  static get SECRET_KEYS() {
    return SECRET_KEYS;
  }

  static normalizeWebhookUrl(url) {
    return normalizeWebhookUrl(url);
  }

  get webhookUrl() {
    return normalizeWebhookUrl(this.settings.get(KEYS.webhookUrl));
  }

  isActive() {
    return Boolean(this.settings.get(KEYS.enabled, false) && this.webhookUrl);
  }

  /** Public configuration; the webhook token never leaves the server. */
  getConfig() {
    const url = this.webhookUrl;
    const match = url?.match(WEBHOOK_PATTERN);

    return {
      enabled: Boolean(this.settings.get(KEYS.enabled, false)),
      configured: Boolean(url),
      webhookId: match ? match[1] : null,
      message: this.settings.get(KEYS.message) || this.defaultMessage(),
      defaultMessage: this.defaultMessage(),
      mention: this.settings.get(KEYS.mention, "none"),
      roleId: this.settings.get(KEYS.roleId, ""),
      editOnEnd: Boolean(this.settings.get(KEYS.editOnEnd, true)),
      lastAnnouncement: this.settings.get(KEYS.messageId)
        ? {
            startedAt: this.settings.get(KEYS.sessionStartedAt) || null,
            endedAt: this.settings.get(KEYS.streamEndedAt) || null,
          }
        : null,
    };
  }

  /** Validates and stores a configuration patch coming from the dashboard. */
  async updateConfig(input = {}) {
    const patch = {};

    if (input.webhookUrl !== undefined) {
      if (input.webhookUrl === null || input.webhookUrl === "") {
        patch[KEYS.webhookUrl] = "";
      } else {
        const url = normalizeWebhookUrl(input.webhookUrl);
        if (!url) throw Object.assign(new Error("invalid_webhook_url"), { status: 400 });
        patch[KEYS.webhookUrl] = url;
      }
    }

    if (input.enabled !== undefined) patch[KEYS.enabled] = Boolean(input.enabled);
    if (input.editOnEnd !== undefined) patch[KEYS.editOnEnd] = Boolean(input.editOnEnd);

    if (input.message !== undefined) {
      const message = String(input.message).trim();
      if (message.length > 1800) throw Object.assign(new Error("message_too_long"), { status: 400 });
      // The default is stored as empty so it follows the bot language.
      patch[KEYS.message] = message === this.defaultMessage() ? "" : message;
    }

    if (input.mention !== undefined) {
      if (!MENTIONS.includes(input.mention)) throw Object.assign(new Error("invalid_mention"), { status: 400 });
      patch[KEYS.mention] = input.mention;
    }

    if (input.roleId !== undefined) {
      const roleId = String(input.roleId).trim().replace(/^<@&(\d+)>$/, "$1");
      if (roleId && !/^\d{5,25}$/.test(roleId)) throw Object.assign(new Error("invalid_role_id"), { status: 400 });
      patch[KEYS.roleId] = roleId;
    }

    const mention = patch[KEYS.mention] ?? this.settings.get(KEYS.mention, "none");
    const roleId = patch[KEYS.roleId] ?? this.settings.get(KEYS.roleId, "");
    if (mention === "role" && !roleId) throw Object.assign(new Error("role_id_required"), { status: 400 });

    if (Object.keys(patch).length) await this.settings.update(patch);
    return this.getConfig();
  }

  // Stream lifecycle ---------------------------------------------------------

  /** Events are serialized so a quick offline/online flap cannot race itself. */
  handleStream({ live, event }) {
    this.pending = this.pending
      .then(() => (live ? this.onOnline(event) : this.onOffline(event)))
      .catch((error) => logger.error("Discord announcement failed", error));
    return this.pending;
  }

  async onOnline(event = {}) {
    // Reruns and premieres also trigger stream.online.
    if (event.type && event.type !== "live") return;
    if (!this.isActive()) return;

    const startedAt = event.started_at || new Date().toISOString();
    const messageId = this.settings.get(KEYS.messageId);
    const endedAt = this.settings.get(KEYS.streamEndedAt);
    const previousStart = this.settings.get(KEYS.streamStartedAt);

    // Twitch can deliver the same notification twice.
    if (messageId && previousStart === startedAt) return;

    const info = await this.collectStreamInfo();

    // Without a recorded end the previous stream was missed entirely (bot
    // offline), so its post is too old to revive.
    const resumed =
      messageId &&
      endedAt &&
      Date.parse(startedAt) - Date.parse(endedAt) < RESUME_WINDOW_MS;

    if (resumed) {
      // A dropped connection: bring the existing post back to life silently.
      try {
        await this.editMessage(messageId, {
          embeds: [this.buildLiveEmbed(info, this.settings.get(KEYS.sessionStartedAt) || startedAt)],
          allowed_mentions: { parse: [] },
        });
        await this.settings.update({
          [KEYS.streamStartedAt]: startedAt,
          [KEYS.streamEndedAt]: "",
        });
        logger.info("Stream resumed, Discord announcement restored");
        return;
      } catch (error) {
        if (error.response?.status !== 404) throw error;
        // The post was deleted by hand: fall through to a fresh one.
      }
    }

    const message = await this.send(this.buildLivePayload(info, startedAt));
    await this.settings.update({
      [KEYS.messageId]: message.id,
      [KEYS.streamStartedAt]: startedAt,
      [KEYS.sessionStartedAt]: startedAt,
      [KEYS.streamEndedAt]: "",
      [KEYS.streamTitle]: info.title,
      [KEYS.streamGame]: info.game,
    });
    logger.info("Stream announced on Discord");
  }

  async onOffline() {
    const messageId = this.settings.get(KEYS.messageId);
    if (!messageId || this.settings.get(KEYS.streamEndedAt)) return;

    const endedAt = new Date().toISOString();
    await this.settings.update({ [KEYS.streamEndedAt]: endedAt });

    if (!this.webhookUrl || !this.settings.get(KEYS.editOnEnd, true)) return;

    const startedAt = this.settings.get(KEYS.sessionStartedAt) || endedAt;
    const info = await this.collectStreamInfo({ live: false });

    try {
      await this.editMessage(messageId, {
        embeds: [this.buildEndedEmbed(info, startedAt, endedAt)],
        allowed_mentions: { parse: [] },
      });
      logger.info("Discord announcement marked as ended");
    } catch (error) {
      if (error.response?.status === 404) {
        logger.debug("The Discord announcement no longer exists");
        return;
      }
      throw error;
    }
  }

  /** Sends a sample announcement without pinging anyone. */
  async sendTest() {
    if (!this.webhookUrl) throw Object.assign(new Error("webhook_not_configured"), { status: 409 });

    const info = await this.collectStreamInfo({ live: true, attempts: 1 });
    const payload = this.buildLivePayload(info, new Date().toISOString());
    payload.allowed_mentions = { parse: [] };
    payload.content = `${this.translator.t("discord.testPrefix")}\n${payload.content}`.trim();

    const message = await this.send(payload);
    return { id: message.id };
  }

  // Payloads -----------------------------------------------------------------

  defaultMessage() {
    return this.translator.t("discord.defaultMessage");
  }

  async collectStreamInfo({ live = true, attempts = STREAM_LOOKUP_ATTEMPTS } = {}) {
    const channel = config.bot.channel;
    const info = {
      login: channel,
      name: channel,
      avatar: null,
      title: this.settings.get(KEYS.streamTitle) || "",
      game: this.settings.get(KEYS.streamGame) || "",
      thumbnail: null,
      url: `https://www.twitch.tv/${channel}`,
    };

    if (!this.twitchApi?.isReady()) return info;

    try {
      const user = await this.twitchApi.getUserByLogin(channel);
      if (user) {
        info.name = user.display_name || info.name;
        info.avatar = user.profile_image_url || null;
      }
    } catch (error) {
      logger.debug("Could not read the channel profile", error);
    }

    if (live) {
      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
          const stream = await this.twitchApi.getStreamInfo();
          if (stream) {
            info.title = stream.title || info.title;
            info.game = stream.game_name || info.game;
            info.thumbnail = stream.thumbnail_url
              ? `${stream.thumbnail_url.replace("{width}", "1280").replace("{height}", "720")}?t=${Date.now()}`
              : null;
            return info;
          }
        } catch (error) {
          logger.debug("Could not read the stream info", error);
        }
        if (attempt < attempts) await wait(STREAM_LOOKUP_DELAY_MS);
      }
    }

    // Not listed yet (or already gone): the channel carries the same title and game.
    try {
      const channelInfo = await this.twitchApi.getChannelInfo();
      if (channelInfo) {
        info.title = channelInfo.title || info.title;
        info.game = channelInfo.game_name || info.game;
      }
    } catch (error) {
      logger.debug("Could not read the channel info", error);
    }

    return info;
  }

  renderTemplate(template, info) {
    const values = {
      streamer: info.name,
      title: info.title || this.translator.t("discord.liveNow"),
      game: info.game,
      url: info.url,
    };
    return template.replace(/\{(streamer|title|game|url)\}/g, (_, name) => values[name] || "");
  }

  buildMention() {
    const mention = this.settings.get(KEYS.mention, "none");
    const roleId = this.settings.get(KEYS.roleId, "");

    if (mention === "everyone") return { text: "@everyone", allowed: { parse: ["everyone"] } };
    if (mention === "here") return { text: "@here", allowed: { parse: ["everyone"] } };
    if (mention === "role" && roleId) return { text: `<@&${roleId}>`, allowed: { parse: [], roles: [roleId] } };
    return { text: "", allowed: { parse: [] } };
  }

  buildLivePayload(info, startedAt) {
    const template = this.settings.get(KEYS.message) || this.defaultMessage();
    const mention = this.buildMention();
    const content = [mention.text, this.renderTemplate(template, info)].filter(Boolean).join(" ");

    return {
      content: content.slice(0, 2000),
      embeds: [this.buildLiveEmbed(info, startedAt)],
      allowed_mentions: mention.allowed,
    };
  }

  buildAuthor(info) {
    return {
      name: info.name,
      url: info.url,
      ...(info.avatar ? { icon_url: info.avatar } : {}),
    };
  }

  buildLiveEmbed(info, startedAt) {
    const t = (key) => this.translator.t(key);
    return {
      color: TWITCH_PURPLE,
      author: this.buildAuthor(info),
      title: (info.title || t("discord.liveNow")).slice(0, 256),
      url: info.url,
      fields: info.game ? [{ name: t("discord.game"), value: info.game.slice(0, 1024), inline: true }] : [],
      ...(info.thumbnail ? { image: { url: info.thumbnail } } : {}),
      ...(info.avatar ? { thumbnail: { url: info.avatar } } : {}),
      footer: { text: "Twitch" },
      timestamp: startedAt,
    };
  }

  buildEndedEmbed(info, startedAt, endedAt) {
    const language = this.translator.getLanguage();
    const t = (key, vars) => this.translator.t(key, vars);
    const duration = formatDuration(Date.parse(endedAt) - Date.parse(startedAt), language);

    return {
      color: ENDED_GREY,
      author: this.buildAuthor(info),
      title: (info.title || t("discord.ended")).slice(0, 256),
      url: `${info.url}/videos`,
      description: t("discord.endedDescription", { duration }),
      fields: info.game ? [{ name: t("discord.game"), value: info.game.slice(0, 1024), inline: true }] : [],
      ...(info.avatar ? { thumbnail: { url: info.avatar } } : {}),
      footer: { text: t("discord.ended") },
      timestamp: endedAt,
    };
  }

  // Webhook transport --------------------------------------------------------

  async send(payload) {
    const { data } = await this.call("post", "?wait=true", payload);
    return data;
  }

  editMessage(messageId, payload) {
    return this.call("patch", `/messages/${encodeURIComponent(messageId)}`, payload);
  }

  async call(method, suffix, payload, retried = false) {
    const url = this.webhookUrl;
    if (!url) throw Object.assign(new Error("webhook_not_configured"), { status: 409 });

    try {
      return await axios({ method, url: `${url}${suffix}`, data: payload, timeout: 10000 });
    } catch (error) {
      // Rate limited: Discord says exactly how long to wait.
      const retryAfter = Number(error.response?.data?.retry_after);
      if (error.response?.status === 429 && !retried && retryAfter < 30) {
        await wait(Math.ceil(retryAfter * 1000) + 250);
        return this.call(method, suffix, payload, true);
      }
      if (error.response?.status === 404 && !suffix.startsWith("/messages/")) {
        logger.warn("The Discord webhook was deleted or its URL is wrong");
      }
      // Never let axios carry the webhook token into logs or API responses.
      const clean = new Error(error.response?.data?.message || error.message);
      clean.response = error.response ? { status: error.response.status, data: {} } : undefined;
      clean.status = error.response ? 502 : 504;
      throw clean;
    }
  }
}

module.exports = DiscordManager;
