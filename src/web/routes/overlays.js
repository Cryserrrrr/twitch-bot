"use strict";

const express = require("express");

const overlayConfig = require("../../overlays/config");
const { route, requireRole } = require("../middleware");

module.exports = function overlayRoutes(bot) {
  const router = express.Router();

  function currentConfig() {
    return overlayConfig.parse(bot.settings.get(overlayConfig.SETTING_KEY));
  }

  router.get("/overlays", (req, res) => {
    res.json({
      spotify: {
        url: bot.overlayServer.getSpotifyUrl(),
        config: currentConfig(),
      },
      options: {
        presets: overlayConfig.PRESETS,
        modes: overlayConfig.MODES,
        alignments: overlayConfig.ALIGNMENTS,
        progressColors: overlayConfig.PROGRESS_COLORS,
      },
    });
  });

  router.patch(
    "/overlays/spotify",
    requireRole("broadcaster"),
    route(async (req, res) => {
      // Merge onto the stored config so the dashboard can send one field.
      const next = overlayConfig.normalize({
        ...currentConfig(),
        ...(req.body || {}),
      });

      await bot.settings.update({
        [overlayConfig.SETTING_KEY]: JSON.stringify(next),
      });

      res.json({ config: next });
    })
  );

  router.post(
    "/overlays/spotify/key",
    requireRole("broadcaster"),
    route(async (req, res) => {
      await bot.overlayServer.regenerateKey();
      res.json({ url: bot.overlayServer.getSpotifyUrl() });
    })
  );

  return router;
};
