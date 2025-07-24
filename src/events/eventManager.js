const Translator = require("../utils/translator");

class EventManager {
  constructor(database) {
    this.database = database;
    this.translator = new Translator();
  }

  // Subscription messages
  subMessages = [
    "Thank you {username} for subscribing! 💜",
    "Wow {username}, thank you for subscribing! 🎉",
    "Thank you {username} for supporting the channel! 💖",
    "Amazing {username}! Thank you for subscribing! 🚀",
    "Thank you {username}, you are fantastic! ✨",
  ];

  // Resubscription messages
  resubMessages = [
    "Thank you {username} for resubscribing! 💜",
    "Wow {username}, {months} already! Thank you! 🎉",
    "Thank you {username} for {months} of support! 💖",
    "Amazing {username}! {months} of loyalty! 🚀",
    "Thank you {username}, {months} already! ✨",
  ];

  // Gift subscription messages
  giftSubMessages = [
    "Thank you {username} for gifting a sub to {recipient}! 💜",
    "Wow {username}, thank you for gifting a sub to {recipient}! 🎉",
    "Thank you {username} for this gift to {recipient}! 💖",
    "Amazing {username}! Thank you for gifting a sub to {recipient}! 🚀",
    "Thank you {username}, you are generous with {recipient}! ✨",
  ];

  // Bits messages
  bitMessages = [
    "Thank you {username} for {amount} bits! 💜",
    "Wow {username}, {amount} bits! Thank you! 🎉",
    "Thank you {username} for this donation of {amount} bits! 💖",
    "Amazing {username}! {amount} bits! 🚀",
    "Thank you {username}, {amount} bits! ✨",
  ];

  // Raid messages
  raidMessages = [
    "Thank you {username} for raiding with {viewers} viewers! 💜",
    "Wow {username}, raid of {viewers} viewers! Thank you! 🎉",
    "Thank you {username} for this raid of {viewers} viewers! 💖",
    "Amazing {username}! Raid of {viewers} viewers! 🚀",
    "Thank you {username}, {viewers} viewers! ✨",
  ];

  // Follow messages
  followMessages = [
    "Thank you {username} for following! Welcome to the family! 💜",
    "Wow {username}, thank you for following! 🎉",
    "Thank you {username} for following me! 💖",
    "Amazing {username}! Thank you for following! 🚀",
    "Thank you {username}, welcome! ✨",
  ];

  async handleSubscription(username, method, message) {
    try {
      let responseMessage = this.getRandomMessage(this.subMessages, {
        username,
      });

      // Add custom message if provided
      if (message && message.trim()) {
        responseMessage += ` Message: "${message}"`;
      }

      return responseMessage;
    } catch (error) {
      console.error(this.translator.t("events.errorProcessingSub"), error);
      return this.translator.t("events.defaultSubMessage", {
        username: username,
      });
    }
  }

  async handleResub(username, months, message) {
    try {
      let responseMessage = this.getRandomMessage(this.resubMessages, {
        username,
        months: this.formatMonths(months),
      });

      // Add custom message if provided
      if (message && message.trim()) {
        responseMessage += ` Message: "${message}"`;
      }

      return responseMessage;
    } catch (error) {
      console.error(this.translator.t("events.errorProcessingResub"), error);
      return this.translator.t("events.defaultResubMessage", {
        username: username,
      });
    }
  }

  async handleSubGift(username, recipient) {
    try {
      const responseMessage = this.getRandomMessage(this.giftSubMessages, {
        username,
        recipient,
      });

      return responseMessage;
    } catch (error) {
      console.error(this.translator.t("events.errorProcessingGiftSub"), error);
      return this.translator.t("events.defaultGiftSubMessage", {
        username: username,
        recipient: recipient,
      });
    }
  }

  async handleBits(username, amount, message) {
    try {
      let responseMessage = this.getRandomMessage(this.bitMessages, {
        username,
        amount,
      });

      // Add custom message if provided
      if (message && message.trim()) {
        responseMessage += ` Message: "${message}"`;
      }

      return responseMessage;
    } catch (error) {
      console.error(this.translator.t("events.errorProcessingBits"), error);
      return this.translator.t("events.defaultBitsMessage", {
        username: username,
        amount: amount,
      });
    }
  }

  async handleRaid(username, viewers) {
    try {
      const responseMessage = this.getRandomMessage(this.raidMessages, {
        username,
        viewers,
      });

      return responseMessage;
    } catch (error) {
      console.error(this.translator.t("events.errorProcessingRaid"), error);
      return this.translator.t("events.defaultRaidMessage", {
        username: username,
        viewers: viewers,
      });
    }
  }

  async handleFollow(username) {
    try {
      const responseMessage = this.getRandomMessage(this.followMessages, {
        username,
      });

      return responseMessage;
    } catch (error) {
      console.error(this.translator.t("events.errorProcessingFollow"), error);
      return this.translator.t("events.defaultFollowMessage", {
        username: username,
      });
    }
  }

  getRandomMessage(messages, variables = {}) {
    const randomIndex = Math.floor(Math.random() * messages.length);
    let message = messages[randomIndex];

    // Replace variables in the message
    for (const [key, value] of Object.entries(variables)) {
      message = message.replace(new RegExp(`{${key}}`, "g"), value);
    }

    return message;
  }

  formatMonths(months) {
    if (months === 1) {
      return this.translator.t("events.oneMonth");
    } else {
      return this.translator.t("events.multipleMonths", { months: months });
    }
  }

  // Method to add custom messages
  addWelcomeMessage(message) {
    this.welcomeMessages.push(message);
  }

  addSubMessage(message) {
    this.subMessages.push(message);
  }

  addResubMessage(message) {
    this.resubMessages.push(message);
  }

  addGiftSubMessage(message) {
    this.giftSubMessages.push(message);
  }

  // Method to cleanup old greeted users (optional)
  async cleanupOldGreetedUsers(daysOld = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      // This method would require a database modification
      // to add an index on the date and a cleanup method
    } catch (error) {
      console.error(
        this.translator.t("events.errorCleaningGreetedUsers"),
        error
      );
    }
  }
}

module.exports = EventManager;
