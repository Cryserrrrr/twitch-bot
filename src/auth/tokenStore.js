"use strict";

const fs = require("fs");
const path = require("path");

const config = require("../core/config");
const logger = require("../core/logger").child("tokens");

/**
 * Small JSON file store for OAuth credentials.
 * One file per provider under data/tokens so nothing sensitive ever lands
 * back in .env, which used to be rewritten at runtime.
 */
class TokenStore {
  constructor(name) {
    this.name = name;
    this.file = path.join(config.tokensDir, `${name}.json`);
  }

  read() {
    try {
      if (!fs.existsSync(this.file)) return null;
      const raw = fs.readFileSync(this.file, "utf8");
      return raw.trim() ? JSON.parse(raw) : null;
    } catch (error) {
      logger.warn(`Unable to read the ${this.name} token file`, error);
      return null;
    }
  }

  write(data) {
    try {
      fs.mkdirSync(config.tokensDir, { recursive: true });
      fs.writeFileSync(this.file, JSON.stringify(data, null, 2), {
        mode: 0o600,
      });
      return true;
    } catch (error) {
      logger.error(`Unable to save the ${this.name} token file`, error);
      return false;
    }
  }

  clear() {
    try {
      if (fs.existsSync(this.file)) fs.unlinkSync(this.file);
    } catch (error) {
      logger.warn(`Unable to delete the ${this.name} token file`, error);
    }
  }
}

module.exports = TokenStore;
