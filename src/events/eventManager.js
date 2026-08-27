"use strict";

const logger = require("../core/logger").child("events");

/**
 * Maps a channel event to the chat announcement the bot posts.
 *
 * Wording lives in the locale files rather than being hard-coded in English
 * inside the class, and each event type can be muted from the dashboard.
 */
const TOGGLES = {
  follow: "announceFollows",
  subscription: "announceSubs",
  resub: "announceSubs",
  subgift: "announceSubs",
  cheer: "announceCheers",
  raid: "announceRaids",
};

class EventManager {
  constructor({ translator, settings, database }) {
    this.translator = translator;
    this.settings = settings;
    this.database = database;
  }

  isEnabled(kind) {
    const toggle = TOGGLES[kind];
    if (!toggle) return true;
    return this.settings.get(toggle, true) !== false;
  }

  /** Returns the message to post, or null when the event type is muted. */
  buildMessage(kind, data = {}) {
    this.record(kind, data);

    if (!this.isEnabled(kind)) return null;

    try {
      switch (kind) {
        case "follow":
          return this.translator.t("events.follow", data);

        case "subscription":
          return this.translator.t("events.subscription", data);

        case "resub":
          return this.withUserMessage(
            this.translator.t("events.resub", {
              ...data,
              months: this.formatMonths(data.months),
            }),
            data.message
          );

        case "subgift":
          return this.translator.t(
            data.total > 1 ? "events.subgiftMultiple" : "events.subgift",
            data
          );

        case "cheer":
          return this.withUserMessage(
            this.translator.t("events.cheer", data),
            data.message
          );

        case "raid":
          return this.translator.t("events.raid", data);

        default:
          return null;
      }
    } catch (error) {
      logger.error(`Could not build the message for ${kind}`, error);
      return null;
    }
  }

  withUserMessage(announcement, userMessage) {
    const text = String(userMessage || "").trim();
    if (!text) return announcement;
    return `${announcement} "${text}"`;
  }

  formatMonths(months) {
    const count = Number(months) || 1;
    return this.translator.t(count > 1 ? "events.months" : "events.month", {
      months: count,
    });
  }

  record(kind, data) {
    this.database
      .recordEvent(kind, data.username || null, data)
      .catch((error) => logger.debug("Could not record the event", error));
  }
}

module.exports = EventManager;
