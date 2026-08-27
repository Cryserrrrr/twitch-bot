"use strict";

const express = require("express");

const { route } = require("../middleware");

const ACTIONS = ["delete", "timeout", "ban"];

module.exports = function moderationRoutes(bot) {
  const router = express.Router();

  router.get(
    "/moderation/banned-words",
    route(async (req, res) => {
      res.json(await bot.database.getBannedWords());
    })
  );

  router.post(
    "/moderation/banned-words",
    route(async (req, res) => {
      const word = String(req.body?.word || "").trim().toLowerCase();
      if (!word) return res.status(400).json({ error: "word_required" });

      const action = ACTIONS.includes(req.body?.action) ? req.body.action : "timeout";
      const duration = Number(req.body?.duration) || 300;

      await bot.moderationManager.addBannedWord(word, action, duration, req.user.login);
      res.status(201).json({ ok: true });
    })
  );

  router.patch(
    "/moderation/banned-words/:word",
    route(async (req, res) => {
      const word = decodeURIComponent(req.params.word).toLowerCase();
      const action = ACTIONS.includes(req.body?.action) ? req.body.action : "timeout";
      const duration = Number(req.body?.duration) || 300;

      await bot.moderationManager.addBannedWord(word, action, duration, req.user.login);
      res.json({ ok: true });
    })
  );

  router.delete(
    "/moderation/banned-words/:word",
    route(async (req, res) => {
      await bot.moderationManager.removeBannedWord(
        decodeURIComponent(req.params.word)
      );
      res.json({ ok: true });
    })
  );

  router.get(
    "/moderation/allowed-links",
    route(async (req, res) => {
      res.json(await bot.database.getAllowedLinks());
    })
  );

  router.post(
    "/moderation/allowed-links",
    route(async (req, res) => {
      const raw = String(req.body?.domain || "").trim().toLowerCase();
      if (!raw) return res.status(400).json({ error: "domain_required" });

      // Accept a full URL as well as a bare domain.
      const domain = raw
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .split("/")[0];

      await bot.moderationManager.addAllowedLink(domain, req.user.login);
      res.status(201).json({ ok: true });
    })
  );

  router.delete(
    "/moderation/allowed-links/:domain",
    route(async (req, res) => {
      await bot.moderationManager.removeAllowedLink(
        decodeURIComponent(req.params.domain)
      );
      res.json({ ok: true });
    })
  );

  router.get(
    "/moderators",
    route(async (req, res) => {
      res.json(await bot.database.getModerators());
    })
  );

  router.post(
    "/moderators/refresh",
    route(async (req, res) => {
      if (!bot.twitchApiManager.isReady()) {
        return res.status(409).json({ error: "twitch_api_not_ready" });
      }

      const moderators = await bot.twitchApiManager.updateModeratorsList();
      res.json({ ok: true, count: moderators.length });
    })
  );

  return router;
};
