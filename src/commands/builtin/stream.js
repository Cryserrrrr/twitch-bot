"use strict";

const config = require("../../core/config");

function formatDuration(ms) {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h${String(minutes).padStart(2, "0")}` : `${minutes}min`;
}

module.exports = [
  {
    name: "uptime",
    permission: "everyone",
    cooldown: 15,
    async run({ bot, reply, t }) {
      if (!bot.twitchApiManager.isReady()) {
        await reply(t("bot.apiNotReady"));
        return;
      }

      const stream = await bot.twitchApiManager.getStreamInfo();
      if (!stream) {
        await reply(t("commands.uptime.offline"));
        return;
      }

      const elapsed = Date.now() - new Date(stream.started_at).getTime();
      await reply(t("commands.uptime.result", { uptime: formatDuration(elapsed) }));
    },
  },
  {
    name: "title",
    permission: "moderator",
    usage: `${config.bot.prefix}title <new title>`,
    async run({ bot, args, reply, t }) {
      if (!bot.twitchApiManager.isReady()) {
        await reply(t("bot.apiNotReady"));
        return;
      }

      if (!args.length) {
        const channel = await bot.twitchApiManager.getChannelInfo();
        await reply(t("commands.title.current", { title: channel?.title || "-" }));
        return;
      }

      const title = args.join(" ");
      await bot.twitchApiManager.changeStreamTitle(title);
      await reply(t("commands.title.success", { title }));
    },
  },
  {
    name: "category",
    aliases: ["game", "jeu"],
    permission: "moderator",
    usage: `${config.bot.prefix}category <name>`,
    async run({ bot, args, reply, t }) {
      if (!bot.twitchApiManager.isReady()) {
        await reply(t("bot.apiNotReady"));
        return;
      }

      if (!args.length) {
        const channel = await bot.twitchApiManager.getChannelInfo();
        await reply(
          t("commands.category.current", { category: channel?.game_name || "-" })
        );
        return;
      }

      try {
        const result = await bot.twitchApiManager.changeStreamCategory(args.join(" "));
        await reply(t("commands.category.success", { category: result.categoryName }));
      } catch {
        await reply(t("commands.category.notFound", { category: args.join(" ") }));
      }
    },
  },
  {
    name: "commercial",
    aliases: ["pub"],
    permission: "moderator",
    usage: `${config.bot.prefix}commercial [30|60|90|120|150|180]`,
    async run({ bot, args, reply, t }) {
      const length = args[0] ? parseInt(args[0], 10) : 30;

      if (!Number.isFinite(length) || length < 30 || length > 180) {
        await reply(t("commands.commercial.invalidLength"));
        return;
      }

      try {
        await bot.twitchApiManager.startCommercial(length);
        await reply(t("commands.commercial.success", { length }));
      } catch {
        await reply(t("commands.commercial.error"));
      }
    },
  },
  {
    name: "snooze",
    permission: "moderator",
    async run({ bot, reply, t }) {
      try {
        await bot.twitchApiManager.snoozeNextAd();
        await reply(t("commands.snooze.success"));
      } catch {
        await reply(t("commands.snooze.error"));
      }
    },
  },
];
