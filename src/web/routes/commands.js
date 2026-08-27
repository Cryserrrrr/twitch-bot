"use strict";

const express = require("express");

const { route } = require("../middleware");

const PERMISSIONS = ["everyone", "subscriber", "vip", "moderator", "broadcaster"];

module.exports = function commandRoutes(bot) {
  const router = express.Router();

  router.get(
    "/commands",
    route(async (req, res) => {
      res.json(await bot.commandManager.listAll());
    })
  );

  router.post(
    "/commands",
    route(async (req, res) => {
      const name = String(req.body?.name || "").trim().replace(/^!/, "").toLowerCase();
      const content = String(req.body?.content || "").trim();

      if (!name || !content) {
        return res.status(400).json({ error: "name_and_content_required" });
      }

      if (!/^[a-z0-9_-]{1,25}$/.test(name)) {
        return res.status(400).json({ error: "invalid_name" });
      }

      if (bot.commandManager.commands.has(name)) {
        return res.status(409).json({ error: "reserved_name" });
      }

      const permission = PERMISSIONS.includes(req.body?.permission)
        ? req.body.permission
        : "everyone";

      await bot.database.addCommand(name, content, req.user.login, {
        permission,
        cooldownSeconds: Number(req.body?.cooldownSeconds) || 0,
      });

      res.status(201).json({ ok: true });
    })
  );

  router.patch(
    "/commands/:name",
    route(async (req, res) => {
      const fields = {};
      if (req.body?.content !== undefined) fields.content = String(req.body.content);
      if (req.body?.enabled !== undefined) fields.enabled = req.body.enabled ? 1 : 0;
      if (req.body?.cooldownSeconds !== undefined) {
        fields.cooldown_seconds = Number(req.body.cooldownSeconds) || 0;
      }
      if (PERMISSIONS.includes(req.body?.permission)) {
        fields.permission = req.body.permission;
      }

      const result = await bot.database.updateCommand(req.params.name, fields);
      if (!result.changes) return res.status(404).json({ error: "not_found" });

      res.json({ ok: true });
    })
  );

  router.delete(
    "/commands/:name",
    route(async (req, res) => {
      const result = await bot.database.deleteCommand(req.params.name);
      if (!result.changes) return res.status(404).json({ error: "not_found" });
      res.json({ ok: true });
    })
  );

  return router;
};
