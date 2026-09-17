"use strict";

const { EventEmitter } = require("events");

/**
 * In-memory view of the settings table.
 *
 * Behaviour toggles used to be read from the database on every single chat
 * message. They are cached here and only written through, so a message costs
 * no query and the dashboard still applies changes instantly.
 */
class Settings extends EventEmitter {
  constructor(database) {
    super();
    this.database = database;
    this.values = {};
  }

  async load() {
    this.values = await this.database.getSettings();
    return this.values;
  }

  get(key, fallback = undefined) {
    return this.values[key] !== undefined ? this.values[key] : fallback;
  }

  all() {
    return { ...this.values };
  }

  /** Same as all() without secrets, for anything sent to the dashboard. */
  public(hidden = []) {
    const values = this.all();
    for (const key of hidden) delete values[key];
    return values;
  }

  async update(patch) {
    this.values = await this.database.updateSettings(patch);
    this.emit("change", this.values);
    return this.values;
  }
}

module.exports = Settings;
