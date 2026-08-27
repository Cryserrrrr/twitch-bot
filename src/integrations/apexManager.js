"use strict";

const axios = require("axios");

const config = require("../core/config");
const logger = require("../core/logger").child("apex");

const BASE_URL = "https://api.mozambiquehe.re";
const CACHE_TTL_MS = 5 * 60 * 1000;

const PLATFORM_CODES = {
  pc: "PC",
  origin: "PC",
  steam: "PC",
  xbox: "X1",
  x1: "X1",
  xbl: "X1",
  ps4: "PS4",
  ps5: "PS4",
  psn: "PS4",
  playstation: "PS4",
};

/** Apex Legends stats through the Mozambique API. */
class ApexManager {
  constructor() {
    this.enabled = config.apex.enabled;
    this.cache = new Map();
  }

  getPlatformCode() {
    return PLATFORM_CODES[config.apex.platform.toLowerCase()] || "PC";
  }

  getStatus() {
    return {
      enabled: this.enabled,
      username: config.apex.username,
      platform: this.getPlatformCode(),
    };
  }

  getCached(key) {
    const entry = this.cache.get(key);
    if (entry && Date.now() - entry.time < CACHE_TTL_MS) return entry.value;
    return null;
  }

  setCached(key, value) {
    this.cache.set(key, { value, time: Date.now() });
  }

  async fetchPlayer(username = config.apex.username) {
    if (!this.enabled) throw new Error("Apex integration is not configured");

    const { data } = await axios.get(`${BASE_URL}/bridge`, {
      params: {
        auth: config.apex.apiKey,
        player: username,
        platform: this.getPlatformCode(),
      },
      headers: { "User-Agent": "twitch-bot" },
      timeout: 10000,
    });

    if (data.Error) throw new Error(data.Error);
    return data;
  }

  /** Returns { rankName, rankDiv, rankScore } or null when unavailable. */
  async getRank(username = config.apex.username) {
    const cacheKey = `rank:${username}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const data = await this.fetchPlayer(username);
      const rank = data?.global?.rank;
      if (!rank) return null;

      const result = {
        name: data.global.name,
        level: data.global.level,
        rankName: rank.rankName,
        rankDiv: rank.rankDiv,
        rankScore: rank.rankScore,
        rankImg: rank.rankImg,
      };

      this.setCached(cacheKey, result);
      return result;
    } catch (error) {
      logger.warn(`Could not read the Apex rank of ${username}`, error);
      return null;
    }
  }

  async checkApiStatus() {
    if (!this.enabled) {
      return { status: "disabled", message: "Apex integration is not configured" };
    }

    try {
      await this.fetchPlayer(config.apex.username);
      return { status: "online", message: "Mozambique API reachable" };
    } catch (error) {
      const code = error.response?.status;
      if (code === 401) return { status: "error", message: "Invalid API key" };
      if (code === 404) return { status: "error", message: "Player not found" };
      return { status: "error", message: "Mozambique API unreachable" };
    }
  }
}

module.exports = ApexManager;
