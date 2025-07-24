const axios = require("axios");
const fs = require("fs");
const path = require("path");

class TwitchApiManager {
  constructor() {
    this.clientId = process.env.TWITCH_CLIENT_ID;
    this.clientSecret = process.env.TWITCH_CLIENT_SECRET;
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
    this.tokenFile = path.join(
      __dirname,
      "..",
      "..",
      "data",
      "twitch_token.json"
    );
    this.broadcasterId = null;
    this.moderatorId = null;

    // Load existing token if available
    this.loadToken();
  }

  loadToken() {
    try {
      if (fs.existsSync(this.tokenFile)) {
        const tokenData = JSON.parse(fs.readFileSync(this.tokenFile, "utf8"));
        this.accessToken = tokenData.accessToken;
        this.refreshToken = tokenData.refreshToken;
        this.tokenExpiry = tokenData.expiry;
      }
    } catch (error) {
      console.error("Error loading token:", error.message);
    }
  }

  saveToken() {
    try {
      const tokenData = {
        accessToken: this.accessToken,
        refreshToken: this.refreshToken,
        expiry: this.tokenExpiry,
      };

      // Ensure data directory exists
      const dataDir = path.dirname(this.tokenFile);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      fs.writeFileSync(this.tokenFile, JSON.stringify(tokenData, null, 2));
    } catch (error) {
      console.error("Error saving token:", error.message);
    }
  }

  async getAccessToken() {
    // Check if we have a valid token
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    // Try to refresh the token if we have a refresh token
    if (this.refreshToken) {
      try {
        await this.refreshAccessToken();
        return this.accessToken;
      } catch (error) {
        // Don't spam console with refresh errors
      }
    }

    throw new Error(
      "No valid access token available. Please authenticate through the web interface first."
    );
  }

  async refreshAccessToken() {
    try {
      const response = await axios.post(
        "https://id.twitch.tv/oauth2/token",
        null,
        {
          params: {
            client_id: this.clientId,
            client_secret: this.clientSecret,
            grant_type: "refresh_token",
            refresh_token: this.refreshToken,
          },
        }
      );

      this.accessToken = response.data.access_token;
      this.refreshToken = response.data.refresh_token;
      this.tokenExpiry = Date.now() + response.data.expires_in * 1000;

      this.saveToken();
      return this.accessToken;
    } catch (error) {
      console.error("Error refreshing Twitch access token:", error.message);
      throw new Error("Failed to refresh access token");
    }
  }

  setTokens(accessToken, refreshToken, expiresIn) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.tokenExpiry = Date.now() + expiresIn * 1000;
    this.saveToken();
  }

  async getUserId(username) {
    try {
      const token = await this.getAccessToken();
      const response = await axios.get(
        `https://api.twitch.tv/helix/users?login=${username}`,
        {
          headers: {
            "Client-ID": this.clientId,
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.data.length === 0) {
        throw new Error("User not found");
      }

      return response.data.data[0].id;
    } catch (error) {
      // Don't spam console with user ID errors
      throw new Error("Failed to get user information");
    }
  }

  async initializeIds() {
    try {
      // Get broadcaster ID
      this.broadcasterId = await this.getUserId(process.env.TWITCH_CHANNEL);

      // Get moderator ID (bot account)
      this.moderatorId = await this.getUserId(process.env.TWITCH_USERNAME);

      console.log(
        `✅ Twitch API initialized - Broadcaster: ${this.broadcasterId}, Moderator: ${this.moderatorId}`
      );
      return true;
    } catch (error) {
      // Don't spam the console with the same message
      return false;
    }
  }

  async initializeWhenReady() {
    let attempts = 0;
    const maxAttempts = 60; // 60 secondes max
    let lastTokenCheck = 0;

    while (attempts < maxAttempts) {
      try {
        // Check if token file has been updated
        const tokenFile = path.join(
          __dirname,
          "..",
          "..",
          "data",
          "twitch_token.json"
        );
        if (fs.existsSync(tokenFile)) {
          const stats = fs.statSync(tokenFile);
          if (stats.mtime.getTime() > lastTokenCheck) {
            // Token file was updated, reload it
            this.loadToken();
            lastTokenCheck = stats.mtime.getTime();
            console.log("🔄 Token file updated, reloading...");
          }
        }

        const success = await this.initializeIds();
        if (success) {
          return true;
        }
      } catch (error) {
        // Continue trying
      }

      attempts++;
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds
    }

    console.error("❌ Failed to initialize Twitch API after 60 seconds");
    return false;
  }

  // Stream Management
  async changeStreamTitle(newTitle) {
    try {
      const token = await this.getAccessToken();
      const response = await axios.patch(
        `https://api.twitch.tv/helix/channels?broadcaster_id=${this.broadcasterId}`,
        { title: newTitle },
        {
          headers: {
            "Client-ID": this.clientId,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      return response.status === 204;
    } catch (error) {
      console.error("Error changing stream title:", error.message);
      throw new Error("Failed to change stream title");
    }
  }

  async changeStreamCategory(categoryName) {
    try {
      const token = await this.getAccessToken();

      // First, search for the category
      const searchResponse = await axios.get(
        `https://api.twitch.tv/helix/search/categories?query=${encodeURIComponent(
          categoryName
        )}`,
        {
          headers: {
            "Client-ID": this.clientId,
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (searchResponse.data.data.length === 0) {
        throw new Error("Category not found");
      }

      const categoryId = searchResponse.data.data[0].id;
      const categoryNameFound = searchResponse.data.data[0].name;

      // Update the stream category
      const response = await axios.patch(
        `https://api.twitch.tv/helix/channels?broadcaster_id=${this.broadcasterId}`,
        { game_id: categoryId },
        {
          headers: {
            "Client-ID": this.clientId,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      return {
        success: response.status === 204,
        categoryName: categoryNameFound,
      };
    } catch (error) {
      console.error("Error changing stream category:", error.message);
      throw new Error("Failed to change stream category");
    }
  }

  async getStreamInfo() {
    try {
      const token = await this.getAccessToken();
      const response = await axios.get(
        `https://api.twitch.tv/helix/streams?user_id=${this.broadcasterId}`,
        {
          headers: {
            "Client-ID": this.clientId,
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return response.data.data[0] || null;
    } catch (error) {
      console.error("Error getting stream info:", error.message);
      throw new Error("Failed to get stream information");
    }
  }

  // Moderation
  async timeoutUser(userId, duration, reason = "") {
    try {
      const token = await this.getAccessToken();
      const response = await axios.post(
        `https://api.twitch.tv/helix/moderation/bans?broadcaster_id=${this.broadcasterId}&moderator_id=${this.moderatorId}`,
        {
          data: {
            user_id: userId,
            duration: duration,
            reason: reason,
          },
        },
        {
          headers: {
            "Client-ID": this.clientId,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      return response.status === 200;
    } catch (error) {
      console.error("Error timing out user:", error.message);
      throw new Error("Failed to timeout user");
    }
  }

  async banUser(userId, reason = "") {
    try {
      const token = await this.getAccessToken();
      const response = await axios.post(
        `https://api.twitch.tv/helix/moderation/bans?broadcaster_id=${this.broadcasterId}&moderator_id=${this.moderatorId}`,
        {
          data: {
            user_id: userId,
            reason: reason,
          },
        },
        {
          headers: {
            "Client-ID": this.clientId,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      return response.status === 200;
    } catch (error) {
      console.error("Error banning user:", error.message);
      throw new Error("Failed to ban user");
    }
  }

  async unbanUser(userId) {
    try {
      const token = await this.getAccessToken();
      const response = await axios.delete(
        `https://api.twitch.tv/helix/moderation/bans?broadcaster_id=${this.broadcasterId}&moderator_id=${this.moderatorId}&user_id=${userId}`,
        {
          headers: {
            "Client-ID": this.clientId,
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return response.status === 204;
    } catch (error) {
      console.error("Error unbanning user:", error.message);
      throw new Error("Failed to unban user");
    }
  }

  async deleteMessage(messageId) {
    try {
      const token = await this.getAccessToken();
      const response = await axios.delete(
        `https://api.twitch.tv/helix/moderation/chat?broadcaster_id=${this.broadcasterId}&moderator_id=${this.moderatorId}&message_id=${messageId}`,
        {
          headers: {
            "Client-ID": this.clientId,
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return response.status === 204;
    } catch (error) {
      console.error("Error deleting message:", error.message);
      throw new Error("Failed to delete message");
    }
  }

  async deleteUserMessage(username) {
    try {
      // Get user ID first
      const userInfo = await this.getUserInfo(username);
      const token = await this.getAccessToken();

      // Use a very short timeout to effectively "delete" the message
      // This is the closest we can get to message deletion with Twitch API
      const response = await axios.post(
        `https://api.twitch.tv/helix/moderation/bans?broadcaster_id=${this.broadcasterId}&moderator_id=${this.moderatorId}`,
        {
          data: {
            user_id: userInfo.id,
            duration: 1, // 1 second timeout to hide the message
            reason: "Message deletion",
          },
        },
        {
          headers: {
            "Client-ID": this.clientId,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      return response.status === 200;
    } catch (error) {
      console.error("Error deleting user message:", error.message);
      throw new Error("Failed to delete user message");
    }
  }

  // Channel Information
  async getChannelInfo() {
    try {
      const token = await this.getAccessToken();
      const response = await axios.get(
        `https://api.twitch.tv/helix/channels?broadcaster_id=${this.broadcasterId}`,
        {
          headers: {
            "Client-ID": this.clientId,
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return response.data.data[0];
    } catch (error) {
      console.error("Error getting channel info:", error.message);
      throw new Error("Failed to get channel information");
    }
  }

  async getFollowers(first = 100) {
    try {
      const token = await this.getAccessToken();
      const response = await axios.get(
        `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${this.broadcasterId}&first=${first}`,
        {
          headers: {
            "Client-ID": this.clientId,
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return response.data.data;
    } catch (error) {
      console.error("Error getting followers:", error.message);
      throw new Error("Failed to get followers");
    }
  }

  async getSubscribers(first = 100) {
    try {
      const token = await this.getAccessToken();
      const response = await axios.get(
        `https://api.twitch.tv/helix/subscriptions?broadcaster_id=${this.broadcasterId}&first=${first}`,
        {
          headers: {
            "Client-ID": this.clientId,
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return response.data.data;
    } catch (error) {
      console.error("Error getting subscribers:", error.message);
      throw new Error("Failed to get subscribers");
    }
  }

  // User Information
  async getUserInfo(username) {
    try {
      const token = await this.getAccessToken();
      const response = await axios.get(
        `https://api.twitch.tv/helix/users?login=${username}`,
        {
          headers: {
            "Client-ID": this.clientId,
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return response.data.data[0];
    } catch (error) {
      console.error("Error getting user info:", error.message);
      throw new Error("Failed to get user information");
    }
  }

  async checkUserModerator(userId) {
    try {
      const token = await this.getAccessToken();
      const response = await axios.get(
        `https://api.twitch.tv/helix/moderation/moderators?broadcaster_id=${this.broadcasterId}&user_id=${userId}`,
        {
          headers: {
            "Client-ID": this.clientId,
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return response.data.data.length > 0;
    } catch (error) {
      console.error("Error checking moderator status:", error.message);
      return false;
    }
  }

  async checkUserVIP(userId) {
    try {
      const token = await this.getAccessToken();
      const response = await axios.get(
        `https://api.twitch.tv/helix/channels/vips?broadcaster_id=${this.broadcasterId}&user_id=${userId}`,
        {
          headers: {
            "Client-ID": this.clientId,
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return response.data.data.length > 0;
    } catch (error) {
      console.error("Error checking VIP status:", error.message);
      return false;
    }
  }
}

module.exports = TwitchApiManager;
