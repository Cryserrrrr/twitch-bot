"use strict";

const config = require("../../core/config");

function normalizeName(raw) {
  return String(raw || "")
    .replace(new RegExp(`^\\${config.bot.prefix}`), "")
    .toLowerCase();
}

module.exports = [
  {
    name: "addcom",
    aliases: ["addcommand"],
    permission: "moderator",
    usage: `${config.bot.prefix}addcom <name> <text>`,
    async run({ bot, args, reply, t, username }) {
      if (args.length < 2) {
        await reply(t("commands.addcom.usage"));
        return;
      }

      const name = normalizeName(args[0]);
      if (bot.commandManager.commands.has(name)) {
        await reply(t("commands.addcom.reserved", { name }));
        return;
      }

      await bot.database.addCommand(name, args.slice(1).join(" "), username);
      await reply(t("commands.addcom.success", { name }));
    },
  },
  {
    name: "editcom",
    permission: "moderator",
    usage: `${config.bot.prefix}editcom <name> <text>`,
    async run({ bot, args, reply, t }) {
      if (args.length < 2) {
        await reply(t("commands.editcom.usage"));
        return;
      }

      const name = normalizeName(args[0]);
      const result = await bot.database.updateCommand(name, {
        content: args.slice(1).join(" "),
      });

      await reply(
        result.changes > 0
          ? t("commands.editcom.success", { name })
          : t("commands.editcom.notFound", { name })
      );
    },
  },
  {
    name: "delcom",
    aliases: ["removecom"],
    permission: "moderator",
    usage: `${config.bot.prefix}delcom <name>`,
    async run({ bot, args, reply, t }) {
      if (!args.length) {
        await reply(t("commands.delcom.usage"));
        return;
      }

      const name = normalizeName(args[0]);
      const result = await bot.database.deleteCommand(name);

      await reply(
        result.changes > 0
          ? t("commands.delcom.success", { name })
          : t("commands.delcom.notFound", { name })
      );
    },
  },
];
