"use strict";

const config = require("../core/config");
const logger = require("../core/logger").child("twitch-api");
const tokenManager = require("../auth/twitchTokenManager");

/**
 * Thin wrapper around the Helix endpoints the bot uses.
 * Authentication, refreshing and retries all live in the token manager, so
 * every method here is a plain request.
 */
class TwitchApiManager {
  constructor(bot) {
    this.bot = bot;
    this.broadcasterId = null;
    this.moderatorId = null;
    this.ready = false;
  }

  isReady() {
    return this.ready;
  }

  /** Resolves the channel and bot user ids used by every moderation call. */
  async initialize() {
    if (!tokenManager.isReady()) return false;

    try {
      const broadcaster = await this.getUserByLogin(config.bot.channel);
      if (!broadcaster) {
        logger.error(`Channel ${config.bot.channel} not found on Twitch`);
        return false;
      }

      this.broadcasterId = broadcaster.id;
      // The authenticated account is the one acting as moderator.
      this.moderatorId = tokenManager.user?.id || broadcaster.id;
      this.ready = true;

      logger.info(`Helix API ready for #${config.bot.channel}`);
      return true;
    } catch (error) {
      logger.error("Helix API initialization failed", error);
      return false;
    }
  }

  async getUserByLogin(login) {
    const { data } = await tokenManager.request("get", "/users", {
      params: { login: String(login).toLowerCase().replace(/^@/, "") },
    });
    return data.data?.[0] || null;
  }

  async getUserInfo(username) {
    const user = await this.getUserByLogin(username);
    if (!user) throw new Error(`Twitch user ${username} not found`);
    return user;
  }

  async getUserId(username) {
    const user = await this.getUserInfo(username);
    return user.id;
  }

  // Stream and channel -------------------------------------------------------

  async getStreamInfo() {
    const { data } = await tokenManager.request("get", "/streams", {
      params: { user_id: this.broadcasterId },
    });
    return data.data?.[0] || null;
  }

  async getChannelInfo() {
    const { data } = await tokenManager.request("get", "/channels", {
      params: { broadcaster_id: this.broadcasterId },
    });
    return data.data?.[0] || null;
  }

  async changeStreamTitle(title) {
    await tokenManager.request("patch", "/channels", {
      params: { broadcaster_id: this.broadcasterId },
      data: { title },
    });
    return true;
  }

  async changeStreamCategory(categoryName) {
    const { data: search } = await tokenManager.request(
      "get",
      "/search/categories",
      { params: { query: categoryName, first: 1 } }
    );

    const category = search.data?.[0];
    if (!category) throw new Error(`Category "${categoryName}" not found`);

    await tokenManager.request("patch", "/channels", {
      params: { broadcaster_id: this.broadcasterId },
      data: { game_id: category.id },
    });

    return { success: true, categoryName: category.name };
  }

  async getFollowerCount() {
    const { data } = await tokenManager.request("get", "/channels/followers", {
      params: { broadcaster_id: this.broadcasterId, first: 1 },
    });
    return data.total ?? 0;
  }

  async getSubscriberCount() {
    const { data } = await tokenManager.request("get", "/subscriptions", {
      params: { broadcaster_id: this.broadcasterId, first: 1 },
    });
    return data.total ?? 0;
  }

  async getFollowers(first = 20) {
    const { data } = await tokenManager.request("get", "/channels/followers", {
      params: { broadcaster_id: this.broadcasterId, first },
    });
    return data.data || [];
  }

  async getSubscribers(first = 20) {
    const { data } = await tokenManager.request("get", "/subscriptions", {
      params: { broadcaster_id: this.broadcasterId, first },
    });
    return data.data || [];
  }

  async getChatterCount() {
    const { data } = await tokenManager.request("get", "/chat/chatters", {
      params: {
        broadcaster_id: this.broadcasterId,
        moderator_id: this.moderatorId,
        first: 1,
      },
    });
    return data.total ?? 0;
  }

  // Moderation ---------------------------------------------------------------

  async timeoutUser(userId, duration, reason = "") {
    await tokenManager.request("post", "/moderation/bans", {
      params: {
        broadcaster_id: this.broadcasterId,
        moderator_id: this.moderatorId,
      },
      data: { data: { user_id: userId, duration, reason } },
    });
    return true;
  }

  async banUser(userId, reason = "") {
    await tokenManager.request("post", "/moderation/bans", {
      params: {
        broadcaster_id: this.broadcasterId,
        moderator_id: this.moderatorId,
      },
      data: { data: { user_id: userId, reason } },
    });
    return true;
  }

  async unbanUser(userId) {
    await tokenManager.request("delete", "/moderation/bans", {
      params: {
        broadcaster_id: this.broadcasterId,
        moderator_id: this.moderatorId,
        user_id: userId,
      },
    });
    return true;
  }

  /**
   * Deletes a single chat message. The previous implementation issued a
   * one-second timeout instead, which punished the user for a message the
   * moderator only wanted removed.
   */
  async deleteMessage(messageId) {
    await tokenManager.request("delete", "/moderation/chat", {
      params: {
        broadcaster_id: this.broadcasterId,
        moderator_id: this.moderatorId,
        message_id: messageId,
      },
    });
    return true;
  }

  async checkUserModerator(userId) {
    try {
      const { data } = await tokenManager.request(
        "get",
        "/moderation/moderators",
        { params: { broadcaster_id: this.broadcasterId, user_id: userId } }
      );
      return (data.data || []).length > 0;
    } catch (error) {
      logger.warn("Moderator check failed", error);
      return false;
    }
  }

  async checkUserVip(userId) {
    try {
      const { data } = await tokenManager.request("get", "/channels/vips", {
        params: { broadcaster_id: this.broadcasterId, user_id: userId },
      });
      return (data.data || []).length > 0;
    } catch (error) {
      logger.warn("VIP check failed", error);
      return false;
    }
  }

  async getModerators() {
    const { data } = await tokenManager.request(
      "get",
      "/moderation/moderators",
      { params: { broadcaster_id: this.broadcasterId, first: 100 } }
    );
    return data.data || [];
  }

  /** Mirrors the channel moderator list into the local database. */
  async updateModeratorsList() {
    if (!this.bot?.database) return [];

    try {
      const moderators = await this.getModerators();
      await this.bot.database.replaceModerators(moderators);
      logger.info(`Moderator list synchronized (${moderators.length})`);
      return moderators;
    } catch (error) {
      logger.error("Moderator list synchronization failed", error);
      return [];
    }
  }

  // Ads ----------------------------------------------------------------------

  async startCommercial(length = 30) {
    const { data } = await tokenManager.request("post", "/channels/commercial", {
      data: { broadcaster_id: this.broadcasterId, length },
    });
    return { success: true, data: data.data?.[0] || null };
  }

  async getAdSchedule() {
    try {
      const { data } = await tokenManager.request("get", "/channels/ads", {
        params: { broadcaster_id: this.broadcasterId },
      });
      return data.data?.[0] || null;
    } catch (error) {
      // Affiliates and non-partners simply do not have this endpoint.
      if ([401, 404].includes(error.response?.status)) return null;
      throw error;
    }
  }

  async snoozeNextAd() {
    const { data } = await tokenManager.request(
      "post",
      "/channels/ads/schedule/snooze",
      { params: { broadcaster_id: this.broadcasterId } }
    );
    return { success: true, data: data.data?.[0] || null };
  }
}

module.exports = TwitchApiManager;
