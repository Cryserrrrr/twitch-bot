"use strict";

const config = require("../../core/config");

/** Resolves a @mention or plain login to a Twitch user, or replies and stops. */
async function resolveTarget({ bot, reply, t }, raw) {
  if (!bot.twitchApiManager.isReady()) {
    await reply(t("bot.apiNotReady"));
    return null;
  }

  const login = String(raw || "").replace(/^@/, "");
  if (!login) return null;

  try {
    return await bot.twitchApiManager.getUserInfo(login);
  } catch {
    await reply(t("commands.moderation.userNotFound", { username: login }));
    return null;
  }
}

module.exports = [
  {
    name: "timeout",
    aliases: ["to"],
    permission: "moderator",
    usage: `${config.bot.prefix}timeout <user> <seconds> [reason]`,
    async run(context) {
      const { args, reply, t, bot, username } = context;

      if (args.length < 2) {
        await reply(t("commands.timeout.usage"));
        return;
      }

      const duration = parseInt(args[1], 10);
      if (!Number.isFinite(duration) || duration < 1 || duration > 1209600) {
        await reply(t("commands.timeout.invalidDuration"));
        return;
      }

      const target = await resolveTarget(context, args[0]);
      if (!target) return;

      const reason = args.slice(2).join(" ") || t("moderation.manualReason", { moderator: username });
      await bot.twitchApiManager.timeoutUser(target.id, duration, reason);
      await bot.database.recordEvent("moderation", target.login, {
        action: "timeout",
        duration,
        by: username,
      });
    },
  },
  {
    name: "ban",
    permission: "moderator",
    usage: `${config.bot.prefix}ban <user> [reason]`,
    async run(context) {
      const { args, reply, t, bot, username } = context;

      if (!args.length) {
        await reply(t("commands.ban.usage"));
        return;
      }

      const target = await resolveTarget(context, args[0]);
      if (!target) return;

      const reason = args.slice(1).join(" ") || t("moderation.manualReason", { moderator: username });
      await bot.twitchApiManager.banUser(target.id, reason);
      await bot.database.recordEvent("moderation", target.login, {
        action: "ban",
        by: username,
      });
    },
  },
  {
    name: "unban",
    permission: "moderator",
    usage: `${config.bot.prefix}unban <user>`,
    async run(context) {
      const { args, reply, t, bot } = context;

      if (!args.length) {
        await reply(t("commands.unban.usage"));
        return;
      }

      const target = await resolveTarget(context, args[0]);
      if (!target) return;

      await bot.twitchApiManager.unbanUser(target.id);
      await reply(t("commands.unban.success", { username: target.login }));
    },
  },
  {
    name: "delete",
    aliases: ["del"],
    permission: "moderator",
    usage: `${config.bot.prefix}delete <user>`,
    async run(context) {
      const { args, reply, t, bot } = context;

      if (!args.length) {
        await reply(t("commands.delete.usage"));
        return;
      }

      const login = String(args[0]).replace(/^@/, "").toLowerCase();
      const last = bot.getLastMessage(login);

      if (!last) {
        await reply(t("commands.delete.noMessage", { username: login }));
        return;
      }

      // Deletes the exact message instead of timing the user out for a second.
      await bot.twitchApiManager.deleteMessage(last.id);
    },
  },
];
