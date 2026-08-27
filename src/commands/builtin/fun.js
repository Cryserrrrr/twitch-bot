"use strict";

module.exports = [
  {
    name: "ping",
    permission: "everyone",
    cooldown: 5,
    async run({ reply, t }) {
      await reply(t("commands.ping.result"));
    },
  },
  {
    name: "dice",
    aliases: ["de", "roll"],
    permission: "everyone",
    cooldown: 3,
    async run({ reply, t, username }) {
      const result = Math.floor(Math.random() * 100) + 1;
      await reply(t("commands.dice.result", { username, result }));
    },
  },
  {
    name: "flip",
    aliases: ["pileouface"],
    permission: "everyone",
    cooldown: 3,
    async run({ reply, t, username }) {
      const side = Math.random() < 0.5 ? t("commands.flip.heads") : t("commands.flip.tails");
      await reply(t("commands.flip.result", { username, result: side }));
    },
  },
];
