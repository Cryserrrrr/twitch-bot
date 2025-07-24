const FunCommands = require("./funCommands");
const SpotifyCommands = require("./spotifyCommands");
const ApexCommands = require("./apexCommands");
const OBSCommands = require("./obsCommands");
const TwitchCommands = require("./twitchCommands");

class CommandManager {
  constructor(database, translator) {
    this.database = database;
    this.translator = translator;
    this.funCommands = new FunCommands();
    this.spotifyCommands = new SpotifyCommands();
    this.apexCommands = new ApexCommands();
    this.obsCommands = new OBSCommands();
    this.twitchCommands = new TwitchCommands();
  }

  async handleCommand(channel, tags, message, bot) {
    const args = message.slice(1).trim().split(" ");
    const commandName = args[0].toLowerCase();
    const argsList = args.slice(1);
    const username = tags.username;
    const isModerator =
      tags.mod || tags.username === process.env.TWITCH_CHANNEL;

    try {
      // Custom command management (moderators only)
      if (commandName === "addcom" && isModerator) {
        await this.handleAddCommand(channel, argsList, username, bot);
        return;
      }

      if (commandName === "delcom" && isModerator) {
        await this.handleDeleteCommand(channel, argsList, username, bot);
        return;
      }

      // Check custom commands first
      const customCommand = await this.database.getCommand(commandName);
      if (customCommand) {
        await this.executeCustomCommand(channel, customCommand, bot);
        await this.database.incrementCommandUsage(commandName);
        return;
      }

      // Built-in commands
      await this.executeBuiltInCommand(
        channel,
        tags,
        commandName,
        argsList,
        bot
      );
    } catch (error) {
      console.error("Error executing command:", error);
      await bot.client.say(
        channel,
        `@${username} ${this.translator.t("bot.commandError")}`
      );
    }
  }

  async handleAddCommand(channel, args, username, bot) {
    if (args.length < 2) {
      await bot.client.say(
        channel,
        `@${username} ${this.translator.t("commands.addcom.usage")}`
      );
      return;
    }

    let commandName = args[0].toLowerCase();
    const content = args.slice(1).join(" ");

    // Remove ! from command name if present
    if (commandName.startsWith("!")) {
      commandName = commandName.slice(1);
    }

    try {
      await this.database.addCommand(commandName, content, username);
      await bot.client.say(
        channel,
        `@${username} ${this.translator.t("commands.addcom.success", {
          name: commandName,
        })}`
      );
    } catch (error) {
      await bot.client.say(
        channel,
        `@${username} ${this.translator.t("commands.addcom.error")}`
      );
    }
  }

  async handleDeleteCommand(channel, args, username, bot) {
    if (args.length < 1) {
      await bot.client.say(
        channel,
        `@${username} ${this.translator.t("commands.delcom.usage")}`
      );
      return;
    }

    let commandName = args[0].toLowerCase();

    // Remove ! from command name if present
    if (commandName.startsWith("!")) {
      commandName = commandName.slice(1);
    }

    try {
      const result = await this.database.deleteCommand(commandName);
      if (result.changes > 0) {
        await bot.client.say(
          channel,
          `@${username} ${this.translator.t("commands.delcom.success", {
            name: commandName,
          })}`
        );
      } else {
        await bot.client.say(
          channel,
          `@${username} ${this.translator.t("commands.delcom.notFound", {
            name: commandName,
          })}`
        );
      }
    } catch (error) {
      await bot.client.say(
        channel,
        `@${username} ${this.translator.t("commands.delcom.error")}`
      );
    }
  }

  async executeCustomCommand(channel, command, bot) {
    try {
      await bot.client.say(channel, command.content);
    } catch (error) {
      console.error("Error executing custom command:", error);
    }
  }

  async executeBuiltInCommand(channel, tags, commandName, args, bot) {
    const username = tags.username;
    const isModerator =
      tags.mod || tags.username === process.env.TWITCH_CHANNEL;
    const isStreamer = tags.username === process.env.TWITCH_CHANNEL;

    try {
      // Fun commands
      if (commandName === "dice") {
        const result = await this.funCommands.dice();
        await bot.client.say(
          channel,
          `@${username} ${this.translator.t("commands.dice.result", {
            username,
            result,
          })}`
        );
        return;
      }

      if (commandName === "flip") {
        const result = await this.funCommands.flip();
        await bot.client.say(
          channel,
          `@${username} ${this.translator.t("commands.flip.result", {
            username,
            result,
          })}`
        );
        return;
      }

      // Spotify commands
      if (commandName === "song") {
        const result = await this.spotifyCommands.getCurrentSong(
          bot.spotifyManager
        );
        await bot.client.say(
          channel,
          `@${username} ${this.translator.t("commands.song.current", {
            song: result,
          })}`
        );
        return;
      }

      if (commandName === "request") {
        const spotifyUrl = args[0];
        if (!spotifyUrl) {
          await bot.client.say(
            channel,
            `@${username} Usage: !request spotify_link`
          );
          return;
        }
        const result = await this.spotifyCommands.requestSong(
          bot.spotifyManager,
          spotifyUrl,
          username
        );
        await bot.client.say(channel, `${result}`);
        return;
      }

      // Apex Legends commands
      if (commandName === "apexrank") {
        const result = await this.apexCommands.getRank(bot.apexManager);
        await bot.client.say(
          channel,
          `@${username} ${this.translator.t("commands.apexrank.result", {
            username,
            result,
          })}`
        );
        return;
      }

      // Ping command
      if (commandName === "ping") {
        const startTime = Date.now();
        await bot.client.say(
          channel,
          `@${username} ${this.translator.t("bot.ping")}`
        );
        const endTime = Date.now();
        const latency = endTime - startTime;
        return;
      }

      // Help command
      if (commandName === "help") {
        const helpMessage = await this.getHelpMessage(isModerator, isStreamer);
        await bot.client.say(channel, `@${username} ${helpMessage}`);
        return;
      }

      // Moderation commands (moderators and streamer only)
      if (commandName === "timeout" && isModerator) {
        if (args.length < 2) {
          await bot.client.say(
            channel,
            `@${username} ${this.translator.t("commands.timeout.usage")}`
          );
          return;
        }
        const targetUsername = args[0];
        const duration = parseInt(args[1]);
        const reason = args.slice(2).join(" ") || "Manual timeout by moderator";

        if (isNaN(duration) || duration <= 0) {
          await bot.client.say(
            channel,
            `@${username} ${this.translator.t(
              "commands.timeout.invalidDuration"
            )}`
          );
          return;
        }

        try {
          await bot.client.say(
            channel,
            `/timeout ${targetUsername} ${duration} ${reason}`
          );
          await bot.client.say(
            channel,
            `@${username} ${this.translator.t("commands.timeout.success", {
              username: targetUsername,
              duration: duration,
              reason: reason,
            })}`
          );
        } catch (error) {
          console.error(
            `[${channel}] Error executing manual timeout for ${targetUsername}:`,
            error
          );
          await bot.client.say(
            channel,
            `@${username} ${this.translator.t("commands.timeout.error", {
              username: targetUsername,
              error: error.message,
            })}`
          );
        }
        return;
      }

      if (commandName === "ban" && isModerator) {
        if (args.length < 1) {
          await bot.client.say(
            channel,
            `@${username} ${this.translator.t("commands.ban.usage")}`
          );
          return;
        }
        const targetUsername = args[0];
        const reason = args.slice(1).join(" ") || "Manual ban by moderator";

        try {
          // Check if Twitch API is ready
          if (!bot.twitchApiManager.broadcasterId) {
            await bot.client.say(
              channel,
              `@${username} Twitch API not ready yet. Please authenticate via the web interface first.`
            );
            return;
          }

          // Use Twitch API for ban instead of tmi.js
          const userInfo = await bot.twitchApiManager.getUserInfo(
            targetUsername
          );
          await bot.twitchApiManager.banUser(userInfo.id, reason);
          await bot.client.say(
            channel,
            `@${username} ${this.translator.t("commands.ban.success", {
              username: targetUsername,
              reason: reason,
            })}`
          );
        } catch (error) {
          console.error(
            `[${channel}] Error executing manual ban for ${targetUsername}:`,
            error
          );
          await bot.client.say(
            channel,
            `@${username} ${this.translator.t("commands.ban.error", {
              username: targetUsername,
              error: error.message,
            })}`
          );
        }
        return;
      }

      if (commandName === "unban" && isModerator) {
        if (args.length < 1) {
          await bot.client.say(
            channel,
            `@${username} ${this.translator.t("commands.unban.usage")}`
          );
          return;
        }
        const targetUsername = args[0];

        try {
          // Use Twitch API for unban instead of tmi.js
          const userInfo = await bot.twitchApiManager.getUserInfo(
            targetUsername
          );
          await bot.twitchApiManager.unbanUser(userInfo.id);
          await bot.client.say(
            channel,
            `@${username} ${this.translator.t("commands.unban.success", {
              username: targetUsername,
            })}`
          );
        } catch (error) {
          console.error(
            `[${channel}] Error executing manual unban for ${targetUsername}:`,
            error
          );
          await bot.client.say(
            channel,
            `@${username} ${this.translator.t("commands.unban.error", {
              username: targetUsername,
              error: error.message,
            })}`
          );
        }
        return;
      }

      // Twitch stream management commands (moderators and streamer only)
      if (commandName === "title" && isModerator) {
        if (args.length === 0) {
          await bot.client.say(
            channel,
            `@${username} ${this.translator.t("commands.title.usage")}`
          );
          return;
        }
        const newTitle = args.join(" ");
        try {
          // Use Twitch API for title change
          const result = await bot.twitchApiManager.changeStreamTitle(newTitle);
          await bot.client.say(
            channel,
            `@${username} ${this.translator.t("commands.title.success", {
              title: newTitle,
            })}`
          );
        } catch (error) {
          await bot.client.say(
            channel,
            `@${username} ${this.translator.t("commands.title.error")}`
          );
        }
        return;
      }

      if (commandName === "category" && isModerator) {
        if (args.length === 0) {
          await bot.client.say(
            channel,
            `@${username} ${this.translator.t("commands.category.usage")}`
          );
          return;
        }
        const categoryName = args.join(" ");
        try {
          // Use Twitch API for category change
          const result = await bot.twitchApiManager.changeStreamCategory(
            categoryName
          );
          await bot.client.say(
            channel,
            `@${username} ${this.translator.t("commands.category.success", {
              category: result.categoryName,
            })}`
          );
        } catch (error) {
          await bot.client.say(
            channel,
            `@${username} ${this.translator.t("commands.category.error")}`
          );
        }
        return;
      }

      // Unknown command
      await bot.client.say(
        channel,
        `@${username} ${this.translator.t("bot.unknownCommand")}`
      );
    } catch (error) {
      console.error("Error executing built-in command:", error);
      await bot.client.say(
        channel,
        `@${username} ${this.translator.t("bot.commandError")}`
      );
    }
  }

  async getHelpMessage(isModerator, isStreamer) {
    let help = this.translator.t("bot.help");

    // Custom commands
    const customCommands = await this.database.getAllCommands();
    if (customCommands.length > 0) {
      help += this.translator.t("bot.customCommands");
      customCommands.forEach((command) => {
        help += ` ${command.name},`;
      });
    }

    if (isModerator) {
      help += this.translator.t("bot.moderatorCommands");
      help += " | Moderation: !timeout, !ban, !unban";
    }

    return help;
  }

  async getAllCommands() {
    const customCommands = await this.database.getAllCommands();
    const builtInCommands = [
      "ping",
      "dice",
      "flip",
      "song",
      "request",
      "apexrank",
      "help",
      "title",
      "category",
      "timeout",
      "ban",
      "unban",
    ];

    return {
      custom: customCommands,
      builtIn: builtInCommands,
    };
  }
}

module.exports = CommandManager;
