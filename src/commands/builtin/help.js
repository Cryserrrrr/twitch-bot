"use strict";

const config = require("../../core/config");

module.exports = [
  {
    name: "help",
    aliases: ["aide", "commands"],
    permission: "everyone",
    cooldown: 10,
    async run({ bot, reply, t, level, levels }) {
      const { builtin, custom } = await bot.commandManager.listAll();

      const visible = builtin
        .filter((command) => level >= levels[command.permission])
        .map((command) => command.name);

      const customNames = custom
        .filter((command) => command.enabled !== 0)
        .filter((command) => level >= levels[command.permission || "everyone"])
        .map((command) => command.name);

      const all = [...visible, ...customNames]
        .map((name) => `${config.bot.prefix}${name}`)
        .join(" ");

      await reply(t("commands.help.result", { commands: all }));
    },
  },
];
