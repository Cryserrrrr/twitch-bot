"use strict";

const fs = require("fs");
const path = require("path");

const config = require("../core/config");
const logger = require("../core/logger").child("commands");

const LEVELS = { everyone: 0, subscriber: 1, vip: 2, moderator: 3, broadcaster: 4 };

/**
 * Command dispatcher.
 *
 * Built-in commands are plain modules dropped in commands/builtin, each
 * declaring its own name, permission and cooldown. That replaces the single
 * six-hundred-line if/else chain the previous version used, where adding a
 * command meant editing the middle of the dispatcher.
 */
class CommandManager {
  constructor(bot) {
    this.bot = bot;
    this.commands = new Map(); // name or alias -> definition
    this.cooldowns = new Map(); // `${command}:${user}` -> timestamp
    this.loadBuiltins();
  }

  loadBuiltins() {
    const dir = path.join(__dirname, "builtin");
    const files = fs.readdirSync(dir).filter((file) => file.endsWith(".js"));

    for (const file of files) {
      const exported = require(path.join(dir, file));
      const definitions = Array.isArray(exported) ? exported : [exported];

      for (const definition of definitions) {
        this.register(definition);
      }
    }

    logger.debug(`Loaded ${this.listBuiltins().length} built-in commands`);
  }

  register(definition) {
    const names = [definition.name, ...(definition.aliases || [])];
    for (const name of names) {
      this.commands.set(name.toLowerCase(), definition);
    }
  }

  listBuiltins() {
    return [...new Set(this.commands.values())];
  }

  /** Highest permission level the author holds. */
  getUserLevel(tags) {
    if (tags.badges?.broadcaster || tags.username === config.bot.channel) {
      return LEVELS.broadcaster;
    }
    if (tags.mod) return LEVELS.moderator;
    if (tags.vip) return LEVELS.vip;
    if (tags.subscriber) return LEVELS.subscriber;
    return LEVELS.everyone;
  }

  isOnCooldown(name, username, seconds) {
    if (!seconds) return false;
    const key = `${name}:${username}`;
    const last = this.cooldowns.get(key) || 0;
    if (Date.now() - last < seconds * 1000) return true;
    this.cooldowns.set(key, Date.now());
    return false;
  }

  /**
   * Handles a chat line. Returns true when it was a command, so the caller can
   * skip the rest of its pipeline.
   */
  async handle({ tags, message }) {
    const prefix = config.bot.prefix;
    if (!message.startsWith(prefix)) return false;

    const [rawName, ...args] = message.slice(prefix.length).trim().split(/\s+/);
    if (!rawName) return false;

    const name = rawName.toLowerCase();
    const username = tags.username;
    const level = this.getUserLevel(tags);

    const context = {
      bot: this.bot,
      tags,
      username,
      args,
      level,
      levels: LEVELS,
      t: this.bot.translator.t.bind(this.bot.translator),
      say: (text) => this.bot.chat.say(text),
      reply: (text) => this.bot.chat.reply(tags, text),
    };

    const builtin = this.commands.get(name);
    if (builtin) {
      return this.runBuiltin(builtin, context, name);
    }

    return this.runCustom(name, context);
  }

  async runBuiltin(definition, context, name) {
    const required = LEVELS[definition.permission || "everyone"];
    if (context.level < required) {
      logger.debug(`${context.username} lacks permission for ${name}`);
      return true;
    }

    if (
      this.isOnCooldown(definition.name, context.username, definition.cooldown)
    ) {
      return true;
    }

    try {
      await definition.run(context);
      this.bot.database
        .recordEvent("command", context.username, { command: definition.name })
        .catch(() => {});
    } catch (error) {
      logger.error(`Command ${definition.name} failed`, error);
      await context.reply(context.t("bot.commandError"));
    }

    return true;
  }

  async runCustom(name, context) {
    const command = await this.bot.database.getCommand(name);
    if (!command || command.enabled === 0) return false;

    const required = LEVELS[command.permission || "everyone"];
    if (context.level < required) return true;

    if (this.isOnCooldown(name, context.username, command.cooldown_seconds)) {
      return true;
    }

    const text = command.content
      .replace(/\{user\}/gi, context.username)
      .replace(/\{channel\}/gi, config.bot.channel)
      .replace(/\{count\}/gi, String((command.usage_count || 0) + 1));

    await context.say(text);
    await this.bot.database.incrementCommandUsage(name);
    this.bot.database
      .recordEvent("command", context.username, { command: name })
      .catch(() => {});

    return true;
  }

  /** Command list exposed to the dashboard and to !help. */
  async listAll() {
    const custom = await this.bot.database.getCommands();
    const builtin = this.listBuiltins().map((definition) => ({
      name: definition.name,
      aliases: definition.aliases || [],
      permission: definition.permission || "everyone",
      cooldown: definition.cooldown || 0,
      description: this.bot.translator.t(
        `commands.${definition.name}.description`
      ),
      usage: definition.usage || `${config.bot.prefix}${definition.name}`,
    }));

    return { builtin, custom };
  }
}

module.exports = CommandManager;
module.exports.LEVELS = LEVELS;
