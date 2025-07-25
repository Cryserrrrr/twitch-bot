const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const Translator = require("../utils/translator");

class Database {
  constructor() {
    this.db = null;
    this.dbPath = path.join(__dirname, "../../data/bot.db");
    this.translator = new Translator();
  }

  async initialize() {
    return new Promise((resolve, reject) => {
      // Create data directory if it doesn't exist
      const fs = require("fs");
      const dataDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error(this.translator.t("database.errorOpening"), err);
          reject(err);
        } else {
          this.createTables().then(resolve).catch(reject);
        }
      });
    });
  }

  async createTables() {
    const tables = [
      // Custom commands table
      `CREATE TABLE IF NOT EXISTS commands (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                content TEXT NOT NULL,
                created_by TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                usage_count INTEGER DEFAULT 0
            )`,

      // Banned words table
      `CREATE TABLE IF NOT EXISTS banned_words (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                word TEXT UNIQUE NOT NULL,
                action TEXT DEFAULT 'timeout',
                duration INTEGER DEFAULT 300,
                added_by TEXT NOT NULL,
                added_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

      // Allowed links table
      `CREATE TABLE IF NOT EXISTS allowed_links (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                domain TEXT UNIQUE NOT NULL,
                added_by TEXT NOT NULL,
                added_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

      // Recurring messages table
      `CREATE TABLE IF NOT EXISTS recurring_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                message TEXT NOT NULL,
                interval_minutes INTEGER NOT NULL,
                enabled BOOLEAN DEFAULT 1,
                last_sent DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

      // Moderation settings table
      `CREATE TABLE IF NOT EXISTS moderation_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                banned_words_enabled BOOLEAN DEFAULT 1,
                allowed_links_enabled BOOLEAN DEFAULT 1,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
    ];

    for (const table of tables) {
      await this.run(table);
    }

    // Insert default data
    await this.insertDefaultData();
  }

  async insertDefaultData() {
    try {
      // Check if allowed_links table is empty
      const allowedLinksCount = await this.get(
        "SELECT COUNT(*) as count FROM allowed_links"
      );

      if (allowedLinksCount.count === 0) {
        console.log(this.translator.t("web.database.insertingDefaultLinks"));
        const defaultAllowedLinks = [
          "twitch.tv",
          "youtube.com",
          "open.spotify.com",
          "discord.gg",
        ];
        for (const domain of defaultAllowedLinks) {
          await this.run(
            "INSERT INTO allowed_links (domain, added_by) VALUES (?, ?)",
            [domain, "system"]
          );
        }
      }
    } catch (error) {
      console.error(
        this.translator.t("web.database.errorInsertingDefaultData"),
        error
      );
    }
  }

  async run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  async get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Specific methods for commands
  async addCommand(name, content, createdBy) {
    return this.run(
      "INSERT OR REPLACE INTO commands (name, content, created_by) VALUES (?, ?, ?)",
      [name, content, createdBy]
    );
  }

  async getCommand(name) {
    return this.get("SELECT * FROM commands WHERE name = ?", [name]);
  }

  async getAllCommands() {
    const commands = await this.all(
      "SELECT * FROM commands ORDER BY usage_count DESC"
    );
    return {
      custom: commands,
      builtin: [], // Built-in commands would go here if any
    };
  }

  async updateCommand(name, content, updatedBy) {
    return this.run("UPDATE commands SET content = ? WHERE name = ?", [
      content,
      name,
    ]);
  }

  async deleteCommand(name) {
    return this.run("DELETE FROM commands WHERE name = ?", [name]);
  }

  async incrementCommandUsage(name) {
    return this.run(
      "UPDATE commands SET usage_count = usage_count + 1 WHERE name = ?",
      [name]
    );
  }

  // Methods for moderation
  async getBannedWords() {
    return this.all("SELECT * FROM banned_words");
  }

  async addBannedWord(
    word,
    action = "timeout",
    duration = 300,
    addedBy = "system"
  ) {
    return this.run(
      "INSERT OR REPLACE INTO banned_words (word, action, duration, added_by) VALUES (?, ?, ?, ?)",
      [word, action, duration, addedBy]
    );
  }

  async removeBannedWord(word) {
    return this.run("DELETE FROM banned_words WHERE word = ?", [word]);
  }

  async getAllowedLinks() {
    return this.all("SELECT * FROM allowed_links");
  }

  async addAllowedLink(domain, addedBy) {
    return this.run(
      "INSERT OR REPLACE INTO allowed_links (domain, added_by) VALUES (?, ?)",
      [domain, addedBy]
    );
  }

  async removeAllowedLink(domain) {
    return this.run("DELETE FROM allowed_links WHERE domain = ?", [domain]);
  }

  // Methods for recurring messages
  async addRecurringMessage(message, intervalMinutes) {
    return this.run(
      "INSERT INTO recurring_messages (message, interval_minutes) VALUES (?, ?)",
      [message, intervalMinutes]
    );
  }

  async getRecurringMessages() {
    return this.all(
      "SELECT * FROM recurring_messages ORDER BY created_at DESC"
    );
  }

  async updateRecurringMessage(id, message, intervalMinutes, enabled) {
    return this.run(
      "UPDATE recurring_messages SET message = ?, interval_minutes = ?, enabled = ? WHERE id = ?",
      [message, intervalMinutes, enabled ? 1 : 0, id]
    );
  }

  async deleteRecurringMessage(id) {
    return this.run("DELETE FROM recurring_messages WHERE id = ?", [id]);
  }

  async updateLastSent(id) {
    return this.run(
      "UPDATE recurring_messages SET last_sent = CURRENT_TIMESTAMP WHERE id = ?",
      [id]
    );
  }

  // Moderation settings methods
  async getModerationSettings() {
    const settings = await this.get(
      "SELECT * FROM moderation_settings ORDER BY id DESC LIMIT 1"
    );
    if (!settings) {
      // Create default settings if none exist
      await this.run(
        "INSERT INTO moderation_settings (banned_words_enabled, allowed_links_enabled) VALUES (1, 1)"
      );
      return {
        banned_words_enabled: 1,
        allowed_links_enabled: 1,
      };
    }
    return settings;
  }

  async updateModerationSettings(bannedWordsEnabled, allowedLinksEnabled) {
    return this.run(
      "INSERT OR REPLACE INTO moderation_settings (id, banned_words_enabled, allowed_links_enabled, updated_at) VALUES (1, ?, ?, CURRENT_TIMESTAMP)",
      [bannedWordsEnabled ? 1 : 0, allowedLinksEnabled ? 1 : 0]
    );
  }

  async close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = Database;
