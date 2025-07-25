const fetch = require("node-fetch");
const Translator = require("../utils/translator");

class ApexManager {
  constructor() {
    this.baseUrl = "https://api.mozambiquehe.re";
    this.platform = process.env.APEX_PLATFORM || "PC";
    this.username = process.env.APEX_USERNAME || "";
    this.apiKey = process.env.APEX_API_KEY || "";
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    this.translator = new Translator();
  }

  getPlatformCode() {
    switch (this.platform.toLowerCase()) {
      case "xbox":
      case "x1":
      case "xbl":
        return "X1";
      case "ps4":
      case "ps5":
      case "playstation":
      case "psn":
        return "PS4";
      case "pc":
      case "origin":
      case "steam":
        return "PC";
      default:
        return "PC"; // PC by default
    }
  }

  async makeApiRequest(username) {
    const platformCode = this.getPlatformCode();
    const headers = {
      "User-Agent": "TwitchBot/1.0",
    };

    if (!this.apiKey || this.apiKey.trim() === "") {
      throw new Error(this.translator.t("apex.apiKeyRequired"));
    }

    const response = await fetch(
      `${this.baseUrl}/bridge?auth=${this.apiKey}&player=${encodeURIComponent(
        username
      )}&platform=${platformCode}`,
      { headers }
    );

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(this.translator.t("apex.playerNotFound"));
      }
      if (response.status === 401) {
        throw new Error(this.translator.t("apex.invalidApiKey"));
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.Error) {
      throw new Error(data.Error);
    }

    return data;
  }

  async getRank() {
    if (!this.username) {
      return this.translator.t("web.apex.usernameNotConfigured");
    }
    try {
      const cacheKey = `rank_${this.username}_${this.platform}`;
      const cached = this.getCachedData(cacheKey);
      if (cached) {
        return cached;
      }

      const data = await this.makeApiRequest(this.username);

      const stats = data?.global;
      if (!stats || !stats.rank) {
        return this.translator.t("web.apex.noRankData");
      }

      const rank = stats.rank.rankName + " " + stats.rank.rankDiv;

      const result = rank;

      this.setCachedData(cacheKey, result);
      return result;
    } catch (error) {
      console.error(this.translator.t("web.apex.errorGettingRank"), error);
      return error.message;
    }
  }

  getCachedData(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  setCachedData(key, data) {
    this.cache.set(key, {
      data: data,
      timestamp: Date.now(),
    });
  }

  clearCache() {
    this.cache.clear();
  }

  // Method to get statistics for a specific legend
  async getLegendStats(legendName) {
    if (!this.username) {
      return this.translator.t("web.apex.usernameNotConfigured");
    }

    try {
      const data = await this.getDetailedStats();
      if (!data || !data.data?.segments) {
        return this.translator.t("web.apex.noLegendData");
      }

      const legend = data.legends?.all?.[legendName.toLowerCase()];
      if (!legend) {
        return this.translator.t("web.apex.legendNotFound", {
          legend: legendName,
        });
      }

      const stats = legend.Stats;
      const kills = stats["Kills"] || 0;
      const damage = stats["Damage"] || 0;
      const wins = stats["Wins"] || 0;
      const gamesPlayed = stats["Games Played"] || 0;
      const deaths = stats["Deaths"] || 0;

      const kdRatio =
        deaths > 0
          ? (kills / deaths).toFixed(2)
          : kills > 0
          ? kills.toFixed(2)
          : "0.00";
      const winRate =
        gamesPlayed > 0 ? ((wins / gamesPlayed) * 100).toFixed(1) : "0.0";

      return this.translator.t("web.apex.legendStats", {
        legend: legendName,
        kills: kills.toLocaleString(),
        kd: kdRatio,
        damage: damage.toLocaleString(),
        wins: wins,
        winRate: winRate,
      });
    } catch (error) {
      console.error(
        this.translator.t("web.apex.errorGettingLegendStats"),
        error
      );
      return this.translator.t("web.apex.errorGettingLegendStatsMessage");
    }
  }

  // Method to get season statistics
  async getSeasonStats() {
    if (!this.username) {
      return this.translator.t("web.apex.usernameNotConfigured");
    }

    try {
      const cacheKey = `season_${this.username}_${this.platform}`;
      const cached = this.getCachedData(cacheKey);
      if (cached) {
        return cached;
      }

      const data = await this.makeApiRequest(this.username);

      // Mozambique API doesn't separate season stats, we use global stats
      const stats = data.stats?.global;
      if (!stats) {
        return this.translator.t("web.apex.noSeasonData");
      }

      const level = stats.level || "N/A";
      const kills = stats.kills || 0;
      const damage = stats.damage || 0;
      const wins = stats.wins || 0;
      const gamesPlayed = stats.gamesPlayed || 0;
      const deaths = stats.deaths || 0;

      const kdRatio =
        deaths > 0
          ? (kills / deaths).toFixed(2)
          : kills > 0
          ? kills.toFixed(2)
          : "0.00";
      const winRate =
        gamesPlayed > 0 ? ((wins / gamesPlayed) * 100).toFixed(1) : "0.0";

      const result = this.translator.t("web.apex.seasonStats", {
        level: level,
        kills: kills.toLocaleString(),
        kd: kdRatio,
        damage: damage.toLocaleString(),
        wins: wins,
        winRate: winRate,
      });

      this.setCachedData(cacheKey, result);
      return result;
    } catch (error) {
      console.error(
        this.translator.t("web.apex.errorGettingSeasonStats"),
        error
      );
      return error.message;
    }
  }

  // Method to check if the API is available
  async checkApiStatus() {
    try {
      // Test with a known player to verify the API
      const headers = {
        "User-Agent": "TwitchBot/1.0",
      };

      if (!this.apiKey || this.apiKey.trim() === "") {
        return {
          status: "error",
          message: this.translator.t("web.apex.apiKeyRequired"),
          data: null,
        };
      }

      const response = await fetch(
        `${this.baseUrl}/bridge?auth=${this.apiKey}&player=aceu&platform=PC`,
        { headers }
      );

      if (response.ok) {
        return {
          status: "online",
          message: this.translator.t("web.apex.apiAvailable"),
          data: null,
        };
      } else {
        return {
          status: "error",
          message: this.translator.t("web.apex.apiUnavailable", {
            status: response.status,
            statusText: response.statusText,
          }),
          data: null,
        };
      }
    } catch (error) {
      return {
        status: "error",
        message: this.translator.t("web.apex.apiConnectionError"),
        data: null,
      };
    }
  }
}

module.exports = ApexManager;
