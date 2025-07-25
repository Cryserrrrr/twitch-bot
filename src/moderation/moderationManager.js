const Translator = require("../utils/translator");

class ModerationManager {
  constructor() {
    this.bannedWords = new Set();
    this.allowedLinks = new Set();
    this.database = null;
    this.translator = new Translator();
  }

  async setDatabase(database) {
    this.database = database;
    await this.loadModerationData();
  }

  async loadModerationData() {
    if (!this.database) return;

    try {
      // Load banned words
      const bannedWords = await this.database.getBannedWords();
      this.bannedWords.clear();
      bannedWords.forEach((word) =>
        this.bannedWords.add(word.word.toLowerCase())
      );

      // Load allowed links
      const allowedLinks = await this.database.getAllowedLinks();
      this.allowedLinks.clear();
      allowedLinks.forEach((link) =>
        this.allowedLinks.add(link.domain.toLowerCase())
      );
    } catch (error) {
      console.error(
        this.translator.t("moderation.manager.errorLoadingData"),
        error
      );
    }
  }

  async checkMessage(message, tags) {
    const username = tags.username;
    const isModerator =
      tags.mod || tags.username === process.env.TWITCH_CHANNEL;
    const isSubscriber = tags.subscriber;
    const isVip = tags.vip;

    // Don't moderate moderators, streamer, VIPs or subscribers
    if (isModerator || isVip || isSubscriber) {
      return { shouldModerate: false };
    }

    const lowerMessage = message.toLowerCase();

    // Check if banned words moderation is enabled
    const settings = await this.database.getModerationSettings();

    // Check banned words
    if (settings.banned_words_enabled) {
      const bannedWordResult = await this.checkBannedWords(lowerMessage);
      if (bannedWordResult.shouldModerate) {
        return bannedWordResult;
      }
    }

    // Check unauthorized links
    if (settings.allowed_links_enabled) {
      const linkResult = this.checkLinks(message);
      if (linkResult.shouldModerate) {
        return linkResult;
      }
    }

    // Check spam (repeated messages)
    // const spamResult = this.checkSpam(message, username);
    // if (spamResult.shouldModerate) {
    //   return spamResult;
    // }

    return { shouldModerate: false };
  }

  async checkBannedWords(message) {
    if (!this.database) {
      return { shouldModerate: false };
    }

    try {
      const bannedWords = await this.database.getBannedWords();

      for (const bannedWord of bannedWords) {
        if (message.includes(bannedWord.word.toLowerCase())) {
          return {
            shouldModerate: true,
            reason: this.translator.t("moderation.bannedWord", {
              word: bannedWord.word,
            }),
            duration: bannedWord.duration || 300,
            action: bannedWord.action || "timeout",
            type: "banned_word",
          };
        }
      }
    } catch (error) {
      console.error("Error checking banned words:", error);
    }

    return { shouldModerate: false };
  }

  checkLinks(message) {
    // Regex to detect URLs
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = message.match(urlRegex);

    if (urls) {
      for (const url of urls) {
        try {
          const domain = this.extractDomain(url);
          if (!this.allowedLinks.has(domain.toLowerCase())) {
            return {
              shouldModerate: true,
              reason: this.translator.t("moderation.unauthorizedLink", {
                domain: domain,
              }),
              action: "timeout",
              duration: 600, // 10 minutes
              type: "unauthorized_link",
            };
          }
        } catch (error) {
          // If we can't extract the domain, we consider it suspicious
          return {
            shouldModerate: true,
            reason: this.translator.t("moderation.suspiciousLink"),
            duration: 300,
            type: "suspicious_link",
          };
        }
      }
    }

    return { shouldModerate: false };
  }

  extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace("www.", "");
    } catch (error) {
      // Fallback for malformed URLs
      const match = url.match(/https?:\/\/(?:www\.)?([^\/\s]+)/);
      return match ? match[1] : url;
    }
  }

  checkSpam(message, username) {
    // Simple spam detection system
    // In production, you might want a more sophisticated system

    // Check repeated characters (e.g., "aaaaaaa")
    const repeatedChars = /(.)\1{4,}/;
    if (repeatedChars.test(message)) {
      return {
        shouldModerate: true,
        reason: this.translator.t("moderation.spamRepeated"),
        duration: 300,
        type: "spam",
      };
    }

    // Check repeated words (e.g., "hello hello hello")
    const words = message.split(" ");
    const wordCount = {};
    for (const word of words) {
      wordCount[word] = (wordCount[word] || 0) + 1;
      if (wordCount[word] > 3) {
        return {
          shouldModerate: true,
          reason: this.translator.t("moderation.spamWords"),
          duration: 300,
          type: "spam",
        };
      }
    }

    return { shouldModerate: false };
  }

  async addBannedWord(
    word,
    action = "timeout",
    duration = 300,
    addedBy = "system"
  ) {
    if (!this.database) {
      throw new Error(
        this.translator.t("moderation.manager.databaseNotInitialized")
      );
    }

    try {
      await this.database.addBannedWord(word, action, duration, addedBy);
      this.bannedWords.add(word.toLowerCase());
      return this.translator.t("moderation.wordAdded", { word: word });
    } catch (error) {
      console.error(
        this.translator.t("moderation.manager.errorAddingWord"),
        error
      );
      throw error;
    }
  }

  async updateBannedWord(word, action, duration) {
    if (!this.database) {
      throw new Error(
        this.translator.t("moderation.manager.databaseNotInitialized")
      );
    }

    try {
      await this.database.run(
        "UPDATE banned_words SET action = ?, duration = ? WHERE word = ?",
        [action, duration, word]
      );
      console.log(
        this.translator.t("moderation.manager.wordUpdatedLog", {
          word: word,
          action: action,
          duration: duration,
        })
      );
      return this.translator.t("moderation.wordUpdated", { word: word });
    } catch (error) {
      console.error(
        this.translator.t("moderation.manager.errorUpdatingWord"),
        error
      );
      throw error;
    }
  }

  async removeBannedWord(word) {
    if (!this.database) {
      throw new Error(
        this.translator.t("moderation.manager.databaseNotInitialized")
      );
    }

    try {
      await this.database.removeBannedWord(word);
      this.bannedWords.delete(word.toLowerCase());
      return this.translator.t("moderation.wordRemoved", { word: word });
    } catch (error) {
      console.error(
        this.translator.t("moderation.manager.errorRemovingWord"),
        error
      );
      throw error;
    }
  }

  async addAllowedLink(domain, addedBy) {
    if (!this.database) {
      throw new Error(
        this.translator.t("moderation.manager.databaseNotInitialized")
      );
    }

    try {
      await this.database.addAllowedLink(domain, addedBy);
      this.allowedLinks.add(domain.toLowerCase());
      return this.translator.t("moderation.linkAdded", { domain: domain });
    } catch (error) {
      console.error(
        this.translator.t("moderation.manager.errorAddingLink"),
        error
      );
      throw error;
    }
  }

  async removeAllowedLink(domain) {
    if (!this.database) {
      throw new Error(
        this.translator.t("moderation.manager.databaseNotInitialized")
      );
    }

    try {
      await this.database.removeAllowedLink(domain);
      this.allowedLinks.delete(domain.toLowerCase());
      return this.translator.t("moderation.linkRemoved", { domain: domain });
    } catch (error) {
      console.error(
        this.translator.t("moderation.manager.errorRemovingLink"),
        error
      );
      throw error;
    }
  }

  getBannedWords() {
    return Array.from(this.bannedWords);
  }

  getAllowedLinks() {
    return Array.from(this.allowedLinks);
  }
}

module.exports = ModerationManager;
