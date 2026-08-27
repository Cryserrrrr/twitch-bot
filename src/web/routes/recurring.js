"use strict";

const express = require("express");

const { route } = require("../middleware");

const MIN_INTERVAL = 1;
const MAX_INTERVAL = 720;

module.exports = function recurringRoutes(bot) {
  const router = express.Router();

  router.get("/recurring-messages", (req, res) => {
    res.json({
      messages: bot.recurringMessages.getMessages(),
      live: bot.live,
    });
  });

  router.post(
    "/recurring-messages",
    route(async (req, res) => {
      const message = String(req.body?.message || "").trim();
      const interval = Number(req.body?.intervalMinutes);

      if (!message) return res.status(400).json({ error: "message_required" });
      if (!Number.isFinite(interval) || interval < MIN_INTERVAL || interval > MAX_INTERVAL) {
        return res.status(400).json({ error: "invalid_interval" });
      }

      const messages = await bot.recurringMessages.add(
        message,
        interval,
        req.body?.name || null
      );
      res.status(201).json({ messages });
    })
  );

  router.patch(
    "/recurring-messages/:id",
    route(async (req, res) => {
      const id = Number(req.params.id);
      const existing = bot.recurringMessages
        .getMessages()
        .find((entry) => entry.id === id);

      if (!existing) return res.status(404).json({ error: "not_found" });

      const message = req.body?.message ?? existing.message;
      const interval = Number(req.body?.intervalMinutes ?? existing.interval_minutes);
      const enabled = req.body?.enabled ?? Boolean(existing.enabled);

      if (!Number.isFinite(interval) || interval < MIN_INTERVAL || interval > MAX_INTERVAL) {
        return res.status(400).json({ error: "invalid_interval" });
      }

      const messages = await bot.recurringMessages.update(
        id,
        message,
        interval,
        enabled
      );
      res.json({ messages });
    })
  );

  router.delete(
    "/recurring-messages/:id",
    route(async (req, res) => {
      const messages = await bot.recurringMessages.remove(Number(req.params.id));
      res.json({ messages });
    })
  );

  return router;
};
