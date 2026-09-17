"use strict";

const express = require("express");

const config = require("../../core/config");
const rootLogger = require("../../core/logger");
const Translator = require("../../utils/translator");
const DiscordManager = require("../../integrations/discordManager");
const { route, requireRole } = require("../middleware");

/**
 * SQLite groups on the local date, so the buckets are built from local dates
 * too - going through toISOString() would shift the labels by a day.
 */
function localDayKey(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Turns the per-day/per-type rows into one series per day for the charts. */
function buildSeries(rows, days) {
  const byDay = new Map();

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    const key = localDayKey(date);
    byDay.set(key, { day: key, message: 0, follow: 0, subscription: 0, command: 0, moderation: 0 });
  }

  for (const row of rows) {
    const bucket = byDay.get(row.day);
    if (!bucket) continue;
    const type = row.type === "resub" || row.type === "subgift" ? "subscription" : row.type;
    if (bucket[type] !== undefined) bucket[type] += row.count;
  }

  return [...byDay.values()];
}

module.exports = function systemRoutes(bot, realtime) {
  const router = express.Router();

  router.get("/status", (req, res) => {
    res.json(bot.getStatus());
  });

  router.get(
    "/overview",
    route(async (req, res) => {
      const days = Math.min(parseInt(req.query.days, 10) || 14, 90);

      const [counts, totals, topChatters, recentEvents] = await Promise.all([
        bot.database.getEventCountsByDay(days),
        bot.database.getEventTotals(days),
        bot.database.getTopChatters(8, days),
        bot.database.getRecentEvents(25),
      ]);

      const totalsByType = Object.fromEntries(
        totals.map((row) => [row.type, row.count])
      );

      let channel = null;
      let stream = null;
      let followers = null;

      if (bot.twitchApiManager.isReady()) {
        const results = await Promise.allSettled([
          bot.twitchApiManager.getChannelInfo(),
          bot.twitchApiManager.getStreamInfo(),
          bot.twitchApiManager.getFollowerCount(),
        ]);
        channel = results[0].status === "fulfilled" ? results[0].value : null;
        stream = results[1].status === "fulfilled" ? results[1].value : null;
        followers = results[2].status === "fulfilled" ? results[2].value : null;
      }

      res.json({
        status: bot.getStatus(),
        totals: totalsByType,
        series: buildSeries(counts, days),
        topChatters,
        recentEvents: recentEvents.map((event) => ({
          ...event,
          data: event.data ? JSON.parse(event.data) : null,
        })),
        channel,
        stream,
        followers,
      });
    })
  );

  router.get("/logs", (req, res) => {
    const level = req.query.level;
    const history = rootLogger.getHistory();
    res.json(level ? history.filter((entry) => entry.level === level) : history);
  });

  router.get("/chat/history", (req, res) => {
    res.json(realtime.getChatBuffer());
  });

  router.post(
    "/chat/say",
    route(async (req, res) => {
      const message = String(req.body?.message || "").trim();
      if (!message) return res.status(400).json({ error: "message_required" });

      const sent = await bot.chat.say(message);
      if (!sent) return res.status(409).json({ error: "chat_offline" });

      res.json({ ok: true });
    })
  );

  router.get(
    "/settings",
    route(async (req, res) => {
      res.json({
        settings: bot.settings.public(DiscordManager.SECRET_KEYS),
        language: bot.translator.getLanguage(),
        languages: Translator.available(),
        channel: config.bot.channel,
        prefix: config.bot.prefix,
      });
    })
  );

  router.patch(
    "/settings",
    requireRole("broadcaster"),
    route(async (req, res) => {
      const { language, ...patch } = req.body || {};

      // Discord keys go through /integrations/discord, which validates them.
      for (const key of Object.keys(patch)) {
        if (key.startsWith("discord")) delete patch[key];
      }

      if (language) bot.translator.setLanguage(language);
      if (Object.keys(patch).length) await bot.settings.update(patch);

      res.json({
        settings: bot.settings.public(DiscordManager.SECRET_KEYS),
        language: bot.translator.getLanguage(),
      });
    })
  );

  router.get(
    "/events",
    route(async (req, res) => {
      const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
      const types = req.query.types ? String(req.query.types).split(",") : null;
      const events = await bot.database.getRecentEvents(limit, types);

      res.json(
        events.map((event) => ({
          ...event,
          data: event.data ? JSON.parse(event.data) : null,
        }))
      );
    })
  );

  return router;
};
