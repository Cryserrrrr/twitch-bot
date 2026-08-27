"use strict";

const logger = require("../core/logger").child("recurring");

/**
 * Timed announcements.
 *
 * Timers only run while the stream is live, and the live flag now comes from
 * EventSub instead of an OBS call issued on every chat message.
 */
class RecurringMessageManager {
  constructor({ database, send }) {
    this.database = database;
    this.send = send;
    this.messages = [];
    this.timers = new Map();
    this.live = false;
  }

  async load() {
    try {
      this.messages = await this.database.getRecurringMessages();
    } catch (error) {
      logger.error("Could not load recurring messages", error);
      this.messages = [];
    }
    this.restartTimers();
    return this.messages;
  }

  getMessages() {
    return this.messages;
  }

  setLive(live) {
    if (this.live === live) return;
    this.live = live;
    this.restartTimers();
    logger.debug(`Recurring messages ${live ? "started" : "paused"}`);
  }

  restartTimers() {
    this.stopTimers();
    if (!this.live) return;

    for (const message of this.messages) {
      if (message.enabled) this.startTimer(message);
    }
  }

  startTimer(message) {
    const intervalMs = Math.max(Number(message.interval_minutes) || 5, 1) * 60000;

    const timer = setInterval(async () => {
      if (!this.live) return;
      try {
        await this.send(message.message);
        await this.database.markRecurringMessageSent(message.id);
      } catch (error) {
        logger.error(`Could not send recurring message ${message.id}`, error);
      }
    }, intervalMs);

    this.timers.set(message.id, timer);
  }

  stopTimers() {
    for (const timer of this.timers.values()) clearInterval(timer);
    this.timers.clear();
  }

  async add(message, intervalMinutes, name = null) {
    await this.database.addRecurringMessage(message, intervalMinutes, name);
    return this.load();
  }

  async update(id, message, intervalMinutes, enabled) {
    await this.database.updateRecurringMessage(
      id,
      message,
      intervalMinutes,
      enabled
    );
    return this.load();
  }

  async remove(id) {
    await this.database.deleteRecurringMessage(id);
    return this.load();
  }

  stop() {
    this.stopTimers();
  }
}

module.exports = RecurringMessageManager;
