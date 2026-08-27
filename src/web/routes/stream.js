"use strict";

const express = require("express");

const { route, requireRole } = require("../middleware");

function requireApi(bot) {
  return (req, res, next) => {
    if (!bot.twitchApiManager.isReady()) {
      return res.status(409).json({ error: "twitch_api_not_ready" });
    }
    return next();
  };
}

module.exports = function streamRoutes(bot) {
  const router = express.Router();
  const guard = requireApi(bot);

  router.get(
    "/stream",
    guard,
    route(async (req, res) => {
      const [channel, stream, followers, subscribers] = await Promise.allSettled([
        bot.twitchApiManager.getChannelInfo(),
        bot.twitchApiManager.getStreamInfo(),
        bot.twitchApiManager.getFollowerCount(),
        bot.twitchApiManager.getSubscriberCount(),
      ]);

      res.json({
        channel: channel.status === "fulfilled" ? channel.value : null,
        stream: stream.status === "fulfilled" ? stream.value : null,
        followers: followers.status === "fulfilled" ? followers.value : null,
        subscribers: subscribers.status === "fulfilled" ? subscribers.value : null,
      });
    })
  );

  router.patch(
    "/stream",
    guard,
    route(async (req, res) => {
      const updates = {};

      if (req.body?.title) {
        await bot.twitchApiManager.changeStreamTitle(String(req.body.title));
        updates.title = req.body.title;
      }

      if (req.body?.category) {
        const result = await bot.twitchApiManager.changeStreamCategory(
          String(req.body.category)
        );
        updates.category = result.categoryName;
      }

      res.json({ ok: true, updates });
    })
  );

  router.get(
    "/ads",
    guard,
    route(async (req, res) => {
      const schedule = await bot.twitchApiManager.getAdSchedule();
      res.json({ schedule });
    })
  );

  router.post(
    "/ads/commercial",
    guard,
    requireRole("broadcaster"),
    route(async (req, res) => {
      const length = Number(req.body?.length) || 30;
      if (length < 30 || length > 180) {
        return res.status(400).json({ error: "invalid_length" });
      }

      const result = await bot.twitchApiManager.startCommercial(length);
      res.json(result);
    })
  );

  router.post(
    "/ads/snooze",
    guard,
    requireRole("broadcaster"),
    route(async (req, res) => {
      res.json(await bot.twitchApiManager.snoozeNextAd());
    })
  );

  return router;
};
