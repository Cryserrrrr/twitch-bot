"use strict";

const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3");

const config = require("../core/config");
const logger = require("../core/logger").child("database");

const DEFAULT_ALLOWED_LINKS = [
  "twitch.tv",
  "youtube.com",
  "youtu.be",
  "open.spotify.com",
  "discord.gg",
  "clips.twitch.tv",
];

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS commands (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT UNIQUE NOT NULL,
     content TEXT NOT NULL,
     created_by TEXT NOT NULL,
     created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
     usage_count INTEGER DEFAULT 0
   )`,
  `CREATE TABLE IF NOT EXISTS banned_words (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     word TEXT UNIQUE NOT NULL,
     action TEXT DEFAULT 'timeout',
     duration INTEGER DEFAULT 300,
     added_by TEXT NOT NULL,
     added_at DATETIME DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE TABLE IF NOT EXISTS allowed_links (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     domain TEXT UNIQUE NOT NULL,
     added_by TEXT NOT NULL,
     added_at DATETIME DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE TABLE IF NOT EXISTS recurring_messages (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     message TEXT NOT NULL,
     interval_minutes INTEGER NOT NULL,
     enabled INTEGER DEFAULT 1,
     last_sent DATETIME,
     created_at DATETIME DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE TABLE IF NOT EXISTS moderators (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     user_id TEXT UNIQUE NOT NULL,
     username TEXT NOT NULL,
     display_name TEXT NOT NULL,
     added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
     updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
   )`,
  // Generic key/value store, so behaviour toggles no longer require a restart.
  `CREATE TABLE IF NOT EXISTS settings (
     key TEXT PRIMARY KEY,
     value TEXT NOT NULL,
     updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
   )`,
  // Activity log powering the dashboard charts and feed.
  `CREATE TABLE IF NOT EXISTS events (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     type TEXT NOT NULL,
     username TEXT,
     data TEXT,
     created_at DATETIME DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS idx_events_created_at ON events (created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_events_type ON events (type)`,
];

/** Columns added after the first release, applied to existing databases. */
const MIGRATIONS = [
  ["commands", "enabled", "INTEGER DEFAULT 1"],
  ["commands", "cooldown_seconds", "INTEGER DEFAULT 0"],
  ["commands", "permission", "TEXT DEFAULT 'everyone'"],
  ["commands", "updated_at", "DATETIME"],
  ["recurring_messages", "name", "TEXT"],
];

const DEFAULT_SETTINGS = {
  bannedWordsEnabled: "true",
  allowedLinksEnabled: "true",
  capsFilterEnabled: "false",
  announceFollows: "true",
  announceSubs: "true",
  announceRaids: "true",
  announceCheers: "true",
};

class Database {
  constructor() {
    this.db = null;
    this.path = config.databasePath;
  }

  async initialize() {
    fs.mkdirSync(path.dirname(this.path), { recursive: true });

    await new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.path, (error) =>
        error ? reject(error) : resolve()
      );
    });

    await this.run("PRAGMA journal_mode = WAL");
    await this.run("PRAGMA foreign_keys = ON");

    for (const statement of SCHEMA) await this.run(statement);
    await this.migrate();
    await this.seed();

    logger.info("Database ready");
  }

  async migrate() {
    for (const [table, column, definition] of MIGRATIONS) {
      const columns = await this.all(`PRAGMA table_info(${table})`);
      if (columns.some((entry) => entry.name === column)) continue;
      await this.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      logger.debug(`Added column ${table}.${column}`);
    }
  }

  async seed() {
    const { count } = await this.get("SELECT COUNT(*) AS count FROM allowed_links");
    if (count === 0) {
      for (const domain of DEFAULT_ALLOWED_LINKS) {
        await this.run(
          "INSERT OR IGNORE INTO allowed_links (domain, added_by) VALUES (?, 'system')",
          [domain]
        );
      }
    }

    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      await this.run(
        "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
        [key, value]
      );
    }

    await this.importLegacyModerationSettings();
  }

  /**
   * The first version kept two moderation toggles in their own table.
   * Their values are carried over once, then the table is left alone.
   */
  async importLegacyModerationSettings() {
    const legacyTable = await this.get(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'moderation_settings'"
    );
    if (!legacyTable) return;

    const imported = await this.get(
      "SELECT value FROM settings WHERE key = 'legacyModerationImported'"
    );
    if (imported) return;

    const row = await this.get(
      "SELECT * FROM moderation_settings ORDER BY id DESC LIMIT 1"
    );
    if (row) {
      await this.updateSettings({
        bannedWordsEnabled: Boolean(row.banned_words_enabled),
        allowedLinksEnabled: Boolean(row.allowed_links_enabled),
      });
    }

    await this.updateSettings({ legacyModerationImported: true });
  }

  // Promise wrappers ---------------------------------------------------------

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function callback(error) {
        if (error) reject(error);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (error, row) =>
        error ? reject(error) : resolve(row)
      );
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (error, rows) =>
        error ? reject(error) : resolve(rows || [])
      );
    });
  }

  // Commands -----------------------------------------------------------------

  getCommands() {
    return this.all("SELECT * FROM commands ORDER BY name COLLATE NOCASE");
  }

  getCommand(name) {
    return this.get("SELECT * FROM commands WHERE name = ?", [
      String(name).toLowerCase(),
    ]);
  }

  addCommand(name, content, createdBy, options = {}) {
    return this.run(
      `INSERT INTO commands (name, content, created_by, permission, cooldown_seconds, enabled)
       VALUES (?, ?, ?, ?, ?, 1)
       ON CONFLICT(name) DO UPDATE SET
         content = excluded.content,
         permission = excluded.permission,
         cooldown_seconds = excluded.cooldown_seconds,
         updated_at = CURRENT_TIMESTAMP`,
      [
        String(name).toLowerCase(),
        content,
        createdBy,
        options.permission || "everyone",
        options.cooldownSeconds ?? 0,
      ]
    );
  }

  updateCommand(name, fields) {
    const allowed = ["content", "enabled", "cooldown_seconds", "permission"];
    const entries = Object.entries(fields).filter(([key]) =>
      allowed.includes(key)
    );
    if (!entries.length) return Promise.resolve({ changes: 0 });

    const assignments = entries.map(([key]) => `${key} = ?`).join(", ");
    const values = entries.map(([, value]) =>
      typeof value === "boolean" ? Number(value) : value
    );

    return this.run(
      `UPDATE commands SET ${assignments}, updated_at = CURRENT_TIMESTAMP WHERE name = ?`,
      [...values, String(name).toLowerCase()]
    );
  }

  deleteCommand(name) {
    return this.run("DELETE FROM commands WHERE name = ?", [
      String(name).toLowerCase(),
    ]);
  }

  incrementCommandUsage(name) {
    return this.run(
      "UPDATE commands SET usage_count = usage_count + 1 WHERE name = ?",
      [String(name).toLowerCase()]
    );
  }

  // Moderation ---------------------------------------------------------------

  getBannedWords() {
    return this.all("SELECT * FROM banned_words ORDER BY word COLLATE NOCASE");
  }

  addBannedWord(word, action = "timeout", duration = 300, addedBy = "system") {
    return this.run(
      `INSERT INTO banned_words (word, action, duration, added_by)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(word) DO UPDATE SET action = excluded.action, duration = excluded.duration`,
      [String(word).toLowerCase(), action, duration, addedBy]
    );
  }

  removeBannedWord(word) {
    return this.run("DELETE FROM banned_words WHERE word = ?", [
      String(word).toLowerCase(),
    ]);
  }

  getAllowedLinks() {
    return this.all("SELECT * FROM allowed_links ORDER BY domain COLLATE NOCASE");
  }

  addAllowedLink(domain, addedBy) {
    return this.run(
      "INSERT OR IGNORE INTO allowed_links (domain, added_by) VALUES (?, ?)",
      [String(domain).toLowerCase(), addedBy]
    );
  }

  removeAllowedLink(domain) {
    return this.run("DELETE FROM allowed_links WHERE domain = ?", [
      String(domain).toLowerCase(),
    ]);
  }

  // Recurring messages -------------------------------------------------------

  getRecurringMessages() {
    return this.all("SELECT * FROM recurring_messages ORDER BY id");
  }

  addRecurringMessage(message, intervalMinutes, name = null) {
    return this.run(
      "INSERT INTO recurring_messages (message, interval_minutes, name) VALUES (?, ?, ?)",
      [message, intervalMinutes, name]
    );
  }

  updateRecurringMessage(id, message, intervalMinutes, enabled) {
    return this.run(
      `UPDATE recurring_messages
       SET message = ?, interval_minutes = ?, enabled = ?
       WHERE id = ?`,
      [message, intervalMinutes, enabled ? 1 : 0, id]
    );
  }

  deleteRecurringMessage(id) {
    return this.run("DELETE FROM recurring_messages WHERE id = ?", [id]);
  }

  markRecurringMessageSent(id) {
    return this.run(
      "UPDATE recurring_messages SET last_sent = CURRENT_TIMESTAMP WHERE id = ?",
      [id]
    );
  }

  // Moderators ---------------------------------------------------------------

  getModerators() {
    return this.all("SELECT * FROM moderators ORDER BY username COLLATE NOCASE");
  }

  isModerator(userId) {
    return this.get("SELECT 1 FROM moderators WHERE user_id = ?", [
      String(userId),
    ]).then(Boolean);
  }

  /** Replaces the whole list in one transaction so it never ends up empty. */
  async replaceModerators(moderators) {
    await this.run("BEGIN TRANSACTION");
    try {
      await this.run("DELETE FROM moderators");
      for (const mod of moderators) {
        await this.run(
          `INSERT OR REPLACE INTO moderators (user_id, username, display_name, updated_at)
           VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
          [mod.user_id, mod.user_login, mod.user_name]
        );
      }
      await this.run("COMMIT");
    } catch (error) {
      await this.run("ROLLBACK");
      throw error;
    }
  }

  // Settings -----------------------------------------------------------------

  async getSettings() {
    const rows = await this.all("SELECT key, value FROM settings");
    const settings = {};
    for (const row of rows) {
      settings[row.key] =
        row.value === "true" ? true : row.value === "false" ? false : row.value;
    }
    return settings;
  }

  async updateSettings(patch) {
    for (const [key, value] of Object.entries(patch)) {
      await this.run(
        `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
        [key, String(value)]
      );
    }
    return this.getSettings();
  }

  // Activity -----------------------------------------------------------------

  recordEvent(type, username = null, data = null) {
    return this.run(
      "INSERT INTO events (type, username, data) VALUES (?, ?, ?)",
      [type, username, data ? JSON.stringify(data) : null]
    );
  }

  getRecentEvents(limit = 50, types = null) {
    if (types?.length) {
      const placeholders = types.map(() => "?").join(", ");
      return this.all(
        `SELECT * FROM events WHERE type IN (${placeholders})
         ORDER BY id DESC LIMIT ?`,
        [...types, limit]
      );
    }
    return this.all("SELECT * FROM events ORDER BY id DESC LIMIT ?", [limit]);
  }

  /** Per-day counts for the last N days, used by the dashboard charts. */
  getEventCountsByDay(days = 14) {
    return this.all(
      `SELECT date(created_at, 'localtime') AS day, type, COUNT(*) AS count
       FROM events
       WHERE created_at >= datetime('now', ?)
       GROUP BY day, type
       ORDER BY day`,
      [`-${days} days`]
    );
  }

  getEventTotals(sinceDays = 30) {
    return this.all(
      `SELECT type, COUNT(*) AS count
       FROM events
       WHERE created_at >= datetime('now', ?)
       GROUP BY type`,
      [`-${sinceDays} days`]
    );
  }

  getTopChatters(limit = 10, sinceDays = 30) {
    return this.all(
      `SELECT username, COUNT(*) AS count
       FROM events
       WHERE type = 'message' AND username IS NOT NULL
         AND created_at >= datetime('now', ?)
       GROUP BY username
       ORDER BY count DESC
       LIMIT ?`,
      [`-${sinceDays} days`, limit]
    );
  }

  /** Keeps the activity log from growing without bound. */
  pruneEvents(keepDays = 90) {
    return this.run("DELETE FROM events WHERE created_at < datetime('now', ?)", [
      `-${keepDays} days`,
    ]);
  }

  close() {
    return new Promise((resolve) => {
      if (!this.db) return resolve();
      this.db.close(() => resolve());
    });
  }
}

module.exports = Database;
