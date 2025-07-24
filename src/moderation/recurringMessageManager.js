const Translator = require("../utils/translator");

class RecurringMessageManager {
  constructor() {
    this.database = null;
    this.timers = new Map();
    this.isStreamActive = false;
    this.translator = new Translator();
  }

  async setDatabase(database) {
    this.database = database;
    await this.loadRecurringMessages();
  }

  async loadRecurringMessages() {
    if (!this.database) {
      throw new Error(
        this.translator.t("moderation.manager.databaseNotInitialized")
      );
    }

    try {
      const messages = await this.database.getRecurringMessages();
      this.messages = messages;
    } catch (error) {
      console.error(this.translator.t("recurring.errorLoadingMessages"), error);
      this.messages = [];
    }
  }

  setStreamStatus(isActive) {
    this.isStreamActive = isActive;
    if (isActive) {
      this.startAllTimers();
    } else {
      this.stopAllTimers();
    }
  }

  startAllTimers() {
    if (!this.isStreamActive) return;

    this.messages.forEach((message) => {
      if (message.enabled) {
        this.startTimer(message);
      }
    });
  }

  stopAllTimers() {
    this.timers.forEach((timer) => {
      clearInterval(timer);
    });
    this.timers.clear();
  }

  startTimer(message) {
    if (this.timers.has(message.id)) {
      clearInterval(this.timers.get(message.id));
    }

    const timer = setInterval(async () => {
      if (this.isStreamActive && this.onMessageCallback) {
        await this.onMessageCallback(message.message);
        await this.database.updateLastSent(message.id);
      }
    }, message.interval_minutes * 60 * 1000);

    this.timers.set(message.id, timer);
  }

  stopTimer(messageId) {
    if (this.timers.has(messageId)) {
      clearInterval(this.timers.get(messageId));
      this.timers.delete(messageId);
    }
  }

  async addMessage(message, intervalMinutes) {
    if (!this.database) {
      throw new Error(
        this.translator.t("moderation.manager.databaseNotInitialized")
      );
    }

    try {
      const result = await this.database.addRecurringMessage(
        message,
        intervalMinutes
      );
      const newMessage = {
        id: result.id,
        message,
        interval_minutes: intervalMinutes,
        enabled: 1,
        created_at: new Date().toISOString(),
      };

      this.messages.push(newMessage);

      if (this.isStreamActive && newMessage.enabled) {
        this.startTimer(newMessage);
      }

      return this.translator.t("recurring.messageAdded");
    } catch (error) {
      console.error(this.translator.t("recurring.errorAddingMessage"), error);
      throw error;
    }
  }

  async updateMessage(id, message, intervalMinutes, enabled) {
    if (!this.database) {
      throw new Error(
        this.translator.t("moderation.manager.databaseNotInitialized")
      );
    }

    try {
      await this.database.updateRecurringMessage(
        id,
        message,
        intervalMinutes,
        enabled
      );

      const messageIndex = this.messages.findIndex((m) => m.id === id);
      if (messageIndex !== -1) {
        this.messages[messageIndex] = {
          ...this.messages[messageIndex],
          message,
          interval_minutes: intervalMinutes,
          enabled: enabled ? 1 : 0,
        };

        if (enabled && this.isStreamActive) {
          this.startTimer(this.messages[messageIndex]);
        } else {
          this.stopTimer(id);
        }
      }

      return this.translator.t("recurring.messageUpdated");
    } catch (error) {
      console.error(this.translator.t("recurring.errorUpdatingMessage"), error);
      throw error;
    }
  }

  async deleteMessage(id) {
    if (!this.database) {
      throw new Error(
        this.translator.t("moderation.manager.databaseNotInitialized")
      );
    }

    try {
      await this.database.deleteRecurringMessage(id);
      this.messages = this.messages.filter((m) => m.id !== id);
      this.stopTimer(id);

      return this.translator.t("recurring.messageDeleted");
    } catch (error) {
      console.error(this.translator.t("recurring.errorDeletingMessage"), error);
      throw error;
    }
  }

  getMessages() {
    return this.messages;
  }

  setMessageCallback(callback) {
    this.onMessageCallback = callback;
  }
}

module.exports = RecurringMessageManager;
