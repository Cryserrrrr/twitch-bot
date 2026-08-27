"use strict";

const express = require("express");

const logger = require("../../core/logger").child("web:integrations");
const { route, requireRole } = require("../middleware");

module.exports = function integrationRoutes(bot) {
  const router = express.Router();

  router.get(
    "/integrations",
    route(async (req, res) => {
      res.json({
        spotify: bot.spotifyManager.getStatus(),
        obs: {
          ...bot.obsManager.getStatus(),
          scenes: await bot.obsManager.getScenes(),
        },
        apex: bot.apexManager.getStatus(),
      });
    })
  );

  // Spotify -----------------------------------------------------------------

  router.get("/integrations/spotify", (req, res) => {
    res.json(bot.spotifyManager.getStatus());
  });

  router.get(
    "/integrations/spotify/authorize",
    requireRole("broadcaster"),
    (req, res) => {
      res.json({ url: bot.spotifyManager.getAuthorizationUrl() });
    }
  );

  router.post(
    "/integrations/spotify/disconnect",
    requireRole("broadcaster"),
    (req, res) => {
      bot.spotifyManager.disconnect();
      res.json({ ok: true });
    }
  );

  router.post(
    "/integrations/spotify/request",
    route(async (req, res) => {
      const query = String(req.body?.query || "").trim();
      if (!query) return res.status(400).json({ error: "query_required" });

      const result = await bot.spotifyManager.requestSong(query);
      if (!result.ok) return res.status(409).json({ error: result.reason });
      res.json(result);
    })
  );

  // OBS ---------------------------------------------------------------------

  router.get(
    "/integrations/obs",
    route(async (req, res) => {
      res.json({
        ...bot.obsManager.getStatus(),
        scenes: await bot.obsManager.getScenes(),
        stream: await bot.obsManager.getStreamingStatus(),
      });
    })
  );

  router.post(
    "/integrations/obs/scene",
    route(async (req, res) => {
      const scene = String(req.body?.scene || "").trim();
      if (!scene) return res.status(400).json({ error: "scene_required" });

      await bot.obsManager.switchScene(scene);
      res.json({ ok: true });
    })
  );

  router.post(
    "/integrations/obs/stream",
    requireRole("broadcaster"),
    route(async (req, res) => {
      await bot.obsManager.setStreaming(Boolean(req.body?.active));
      res.json({ ok: true });
    })
  );

  router.post(
    "/integrations/obs/reconnect",
    requireRole("broadcaster"),
    route(async (req, res) => {
      const connected = await bot.obsManager.connect();
      res.json({ connected });
    })
  );

  // Apex --------------------------------------------------------------------

  router.get(
    "/integrations/apex",
    route(async (req, res) => {
      const [status, rank] = await Promise.all([
        bot.apexManager.checkApiStatus(),
        bot.apexManager.enabled ? bot.apexManager.getRank() : null,
      ]);
      res.json({ ...bot.apexManager.getStatus(), api: status, rank });
    })
  );

  /** Spotify OAuth callback; mounted outside the authenticated API prefix. */
  const spotifyCallback = route(async (req, res) => {
    const { code, error } = req.query;

    if (error || !code) {
      logger.warn(`Spotify authorization refused: ${error || "missing code"}`);
      return res.redirect("/");
    }

    await bot.spotifyManager.handleAuthorizationCode(code);
    res.redirect("/#/integrations");
  });

  return { router, spotifyCallback };
};
