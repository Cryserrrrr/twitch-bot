const axios = require("axios");
const fs = require("fs");
const path = require("path");

class TwitchCommands {
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
        console.error("Error refreshing token:", error.message);
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
      console.error("Error getting user ID:", error.message);
      throw new Error("Failed to get user information");
    }
  }

  async changeStreamTitle(userId, newTitle) {
    try {
      const token = await this.getAccessToken();
      const response = await axios.patch(
        `https://api.twitch.tv/helix/channels?broadcaster_id=${userId}`,
        {
          title: newTitle,
        },
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

  async changeStreamCategory(userId, categoryName) {
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
        `https://api.twitch.tv/helix/channels?broadcaster_id=${userId}`,
        {
          game_id: categoryId,
        },
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

  async changeTitle(username, newTitle) {
    try {
      const userId = await this.getUserId(username);
      const success = await this.changeStreamTitle(userId, newTitle);

      if (success) {
        return `Stream title changed to: "${newTitle}"`;
      } else {
        throw new Error("Failed to change stream title");
      }
    } catch (error) {
      throw error;
    }
  }

  async changeCategory(username, categoryName) {
    try {
      const userId = await this.getUserId(username);
      const result = await this.changeStreamCategory(userId, categoryName);

      if (result.success) {
        return result.categoryName;
      } else {
        throw new Error("Failed to change stream category");
      }
    } catch (error) {
      throw error;
    }
  }

  // New methods to work with the TwitchApiManager
  setTwitchApiManager(apiManager) {
    this.apiManager = apiManager;
  }

  async changeTitleWithApi(newTitle) {
    try {
      if (!this.apiManager) {
        throw new Error("TwitchApiManager not available");
      }

      const success = await this.apiManager.changeStreamTitle(newTitle);

      if (success) {
        return `Stream title changed to: "${newTitle}"`;
      } else {
        throw new Error("Failed to change stream title");
      }
    } catch (error) {
      throw error;
    }
  }

  async changeCategoryWithApi(categoryName) {
    try {
      if (!this.apiManager) {
        throw new Error("TwitchApiManager not available");
      }

      const result = await this.apiManager.changeStreamCategory(categoryName);

      if (result.success) {
        return result.categoryName;
      } else {
        throw new Error("Failed to change stream category");
      }
    } catch (error) {
      throw error;
    }
  }
}

module.exports = TwitchCommands;
