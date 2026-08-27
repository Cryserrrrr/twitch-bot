"use strict";

const logger = require("../core/logger").child("moderation");

const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s]+|[a-z0-9-]+\.(?:com|net|org|fr|io|gg|tv|me|co|xyz|link|shop)\b/gi;
const CAPS_MIN_LENGTH = 12;
const CAPS_RATIO = 0.75;

/**
 * Chat moderation rules.
 *
 * Word and link lists are kept in memory and refreshed when the dashboard
 * changes them; the previous version queried the database several times per
 * message, which put a full round trip in front of every line of chat.
 */
class ModerationManager {
  constructor({ database, settings, translator }) {
    this.database = database;
    this.settings = settings;
    this.translator = translator;
    this.bannedWords = [];
    this.allowedLinks = new Set();
  }

  async load() {
    try {
      const [words, links] = await Promise.all([
        this.database.getBannedWords(),
        this.database.getAllowedLinks(),
      ]);

      this.bannedWords = words.map((row) => ({
        word: row.word.toLowerCase(),
        action: row.action || "timeout",
        duration: row.duration || 300,
      }));

      this.allowedLinks = new Set(
        links.map((row) => row.domain.toLowerCase().replace(/^www\./, ""))
      );

      logger.debug(
        `Loaded ${this.bannedWords.length} banned words and ${this.allowedLinks.size} allowed domains`
      );
    } catch (error) {
      logger.error("Could not load the moderation lists", error);
    }
  }

  /** Users the bot never acts on. */
  isExempt(tags) {
    return Boolean(
      tags.mod ||
        tags.badges?.broadcaster ||
        tags.vip ||
        tags.subscriber ||
        tags.username === this.channelOwner
    );
  }

  setChannelOwner(login) {
    this.channelOwner = login;
  }

  /**
   * Returns null when the message is fine, otherwise the action to apply:
   * { action: 'delete' | 'timeout' | 'ban', duration, reason }
   */
  check(message, tags) {
    if (this.isExempt(tags)) return null;

    if (this.settings.get("bannedWordsEnabled", true)) {
      const hit = this.findBannedWord(message);
      if (hit) {
        return {
          action: hit.action,
          duration: hit.duration,
          reason: this.translator.t("moderation.bannedWord", { word: hit.word }),
          rule: "banned_word",
        };
      }
    }

    if (this.settings.get("allowedLinksEnabled", true)) {
      const domain = this.findDisallowedLink(message);
      if (domain) {
        return {
          action: "timeout",
          duration: 600,
          reason: this.translator.t("moderation.unauthorizedLink", { domain }),
          rule: "link",
        };
      }
    }

    if (this.settings.get("capsFilterEnabled", false) && this.isShouting(message)) {
      return {
        action: "delete",
        duration: 0,
        reason: this.translator.t("moderation.caps"),
        rule: "caps",
      };
    }

    return null;
  }

  findBannedWord(message) {
    const normalized = message.toLowerCase();
    return this.bannedWords.find((entry) => normalized.includes(entry.word));
  }

  findDisallowedLink(message) {
    const matches = message.match(URL_PATTERN);
    if (!matches) return null;

    for (const match of matches) {
      const domain = this.extractDomain(match);
      if (domain && !this.allowedLinks.has(domain)) return domain;
    }
    return null;
  }

  extractDomain(value) {
    const withScheme = /^https?:\/\//i.test(value) ? value : `http://${value}`;
    try {
      return new URL(withScheme).hostname.toLowerCase().replace(/^www\./, "");
    } catch {
      return null;
    }
  }

  isShouting(message) {
    if (message.length < CAPS_MIN_LENGTH) return false;
    const letters = message.replace(/[^a-zA-Z]/g, "");
    if (letters.length < CAPS_MIN_LENGTH) return false;
    const upper = letters.replace(/[^A-Z]/g, "").length;
    return upper / letters.length >= CAPS_RATIO;
  }

  // Dashboard operations -----------------------------------------------------

  async addBannedWord(word, action = "timeout", duration = 300, addedBy) {
    await this.database.addBannedWord(word, action, duration, addedBy);
    await this.load();
  }

  async removeBannedWord(word) {
    await this.database.removeBannedWord(word);
    await this.load();
  }

  async addAllowedLink(domain, addedBy) {
    await this.database.addAllowedLink(domain, addedBy);
    await this.load();
  }

  async removeAllowedLink(domain) {
    await this.database.removeAllowedLink(domain);
    await this.load();
  }
}

module.exports = ModerationManager;
