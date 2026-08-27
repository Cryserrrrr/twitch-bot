"use strict";

module.exports = [
  {
    name: "apexrank",
    aliases: ["rank", "apex"],
    permission: "everyone",
    cooldown: 15,
    async run({ bot, reply, t, args }) {
      const apex = bot.apexManager;

      if (!apex.enabled) {
        await reply(t("commands.apexrank.disabled"));
        return;
      }

      const target = args[0] || undefined;
      const rank = await apex.getRank(target);

      if (!rank) {
        await reply(t("commands.apexrank.notFound"));
        return;
      }

      await reply(
        t("commands.apexrank.result", {
          player: rank.name,
          rank: `${rank.rankName} ${rank.rankDiv}`.trim(),
          score: rank.rankScore,
        })
      );
    },
  },
];
