"use strict";

const config = require("../../core/config");

module.exports = [
  {
    name: "song",
    aliases: ["musique", "nowplaying"],
    permission: "everyone",
    cooldown: 5,
    async run({ bot, reply, t }) {
      const spotify = bot.spotifyManager;

      if (!spotify.isConnected()) {
        await reply(t("commands.song.notConnected"));
        return;
      }

      const track = await spotify.fetchCurrentTrack();
      if (!track) {
        await reply(t("commands.song.nothingPlaying"));
        return;
      }

      await reply(
        t("commands.song.result", {
          song: track.name,
          artists: track.artists,
          url: track.url || "",
        })
      );
    },
  },
  {
    name: "request",
    aliases: ["sr", "songrequest"],
    permission: "everyone",
    cooldown: 15,
    usage: `${config.bot.prefix}request <lien Spotify | titre>`,
    async run({ bot, reply, t, args }) {
      if (!args.length) {
        await reply(t("commands.request.usage"));
        return;
      }

      const result = await bot.spotifyManager.requestSong(args.join(" "));

      if (result.ok) {
        await reply(
          t("commands.request.success", {
            song: result.track.name,
            artists: result.track.artists,
          })
        );
        return;
      }

      const reasons = {
        not_connected: "commands.request.notConnected",
        not_found: "commands.request.notFound",
        no_device: "commands.request.noDevice",
      };
      await reply(t(reasons[result.reason] || "commands.request.error"));
    },
  },
];
