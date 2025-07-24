const WebSocket = require("ws");
const crypto = require("crypto");
const axios = require("axios");

class EventSubManager {
  constructor(bot) {
    this.bot = bot;
    this.ws = null;
    this.clientId = process.env.TWITCH_CLIENT_ID;
    this.clientSecret = process.env.TWITCH_CLIENT_SECRET;
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
    this.broadcasterId = null;
    this.sessionId = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.pingInterval = null;
    this.subscriptions = new Map();

    // Load token from the same file as TwitchApiManager
    this.loadToken();
  }

  loadToken() {
    try {
      const fs = require("fs");
      const path = require("path");
      const tokenFile = path.join(
        __dirname,
        "..",
        "..",
        "data",
        "twitch_token.json"
      );

      if (fs.existsSync(tokenFile)) {
        const tokenData = JSON.parse(fs.readFileSync(tokenFile, "utf8"));
        this.accessToken = tokenData.accessToken;
        this.refreshToken = tokenData.refreshToken;
        this.tokenExpiry = tokenData.expiry;
      }
    } catch (error) {
      console.error("Error loading token:", error.message);
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

      // Save token to file
      const fs = require("fs");
      const path = require("path");
      const tokenFile = path.join(
        __dirname,
        "..",
        "..",
        "data",
        "twitch_token.json"
      );
      const tokenData = {
        accessToken: this.accessToken,
        refreshToken: this.refreshToken,
        expiry: this.tokenExpiry,
      };

      const dataDir = path.dirname(tokenFile);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      fs.writeFileSync(tokenFile, JSON.stringify(tokenData, null, 2));

      return this.accessToken;
    } catch (error) {
      console.error("Error refreshing Twitch access token:", error.message);
      throw new Error("Failed to refresh access token");
    }
  }

  async initialize(broadcasterId) {
    this.broadcasterId = broadcasterId;
    await this.connect();
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
            console.log("🔄 EventSub: Token file updated, reloading...");
          }
        }

        // Wait for TwitchApiManager to be ready
        if (this.bot.twitchApiManager.broadcasterId) {
          this.broadcasterId = this.bot.twitchApiManager.broadcasterId;
          await this.connect();
          return true;
        }
      } catch (error) {
        // Continue trying
      }

      attempts++;
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds
    }

    console.error("❌ Failed to initialize EventSub after 60 seconds");
    return false;
  }

  async connect() {
    try {
      const token = await this.getAccessToken();

      // Get EventSub WebSocket URL
      const response = await axios.get(
        "https://api.twitch.tv/helix/eventsub/subscriptions",
        {
          headers: {
            "Client-ID": this.clientId,
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // Connect to EventSub WebSocket
      this.ws = new WebSocket("wss://eventsub.wss.twitch.tv/ws");

      this.ws.on("open", () => {
        console.log("✅ Connected to Twitch EventSub WebSocket");
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.setupPingInterval();
      });

      this.ws.on("message", (data) => {
        this.handleMessage(JSON.parse(data.toString()));
      });

      this.ws.on("close", () => {
        console.log("❌ Disconnected from Twitch EventSub WebSocket");
        this.isConnected = false;
        this.clearPingInterval();
        this.handleReconnect();
      });

      this.ws.on("error", (error) => {
        console.error("❌ EventSub WebSocket error:", error);
      });
    } catch (error) {
      console.error("❌ Error connecting to EventSub:", error.message);
      throw error;
    }
  }

  setupPingInterval() {
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "ping" }));
      }
    }, 30000); // Send ping every 30 seconds
  }

  clearPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  async handleMessage(message) {
    try {
      switch (message.metadata.message_type) {
        case "session_welcome":
          this.sessionId = message.payload.session.id;
          console.log(`✅ EventSub session established: ${this.sessionId}`);
          await this.createSubscriptions();
          break;

        case "session_keepalive":
          // Keep-alive message, no action needed
          break;

        case "notification":
          await this.handleEvent(message.payload);
          break;

        case "session_reconnect":
          console.log("🔄 EventSub session reconnect requested");
          await this.reconnect();
          break;

        case "revocation":
          console.log(
            "❌ EventSub subscription revoked:",
            message.payload.subscription.id
          );
          this.subscriptions.delete(message.payload.subscription.id);
          break;

        default:
          console.log(
            "📨 Unknown EventSub message type:",
            message.metadata.message_type
          );
      }
    } catch (error) {
      console.error("❌ Error handling EventSub message:", error);
    }
  }

  async createSubscriptions() {
    try {
      const token = await this.getAccessToken();

      // Create subscriptions for different event types
      const subscriptions = [
        {
          type: "channel.follow",
          version: "2",
          condition: {
            broadcaster_user_id: this.broadcasterId,
            moderator_user_id: this.broadcasterId,
          },
          transport: { method: "websocket", session_id: this.sessionId },
        },
        {
          type: "channel.subscribe",
          version: "1",
          condition: { broadcaster_user_id: this.broadcasterId },
          transport: { method: "websocket", session_id: this.sessionId },
        },
        {
          type: "channel.subscription.message",
          version: "1",
          condition: { broadcaster_user_id: this.broadcasterId },
          transport: { method: "websocket", session_id: this.sessionId },
        },
        {
          type: "channel.subscription.gift",
          version: "1",
          condition: { broadcaster_user_id: this.broadcasterId },
          transport: { method: "websocket", session_id: this.sessionId },
        },
        {
          type: "channel.cheer",
          version: "1",
          condition: { broadcaster_user_id: this.broadcasterId },
          transport: { method: "websocket", session_id: this.sessionId },
        },
        {
          type: "channel.raid",
          version: "1",
          condition: { to_broadcaster_user_id: this.broadcasterId },
          transport: { method: "websocket", session_id: this.sessionId },
        },
      ];

      for (const subscription of subscriptions) {
        try {
          const response = await axios.post(
            "https://api.twitch.tv/helix/eventsub/subscriptions",
            subscription,
            {
              headers: {
                "Client-ID": this.clientId,
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
            }
          );

          if (response.data.data && response.data.data.length > 0) {
            const sub = response.data.data[0];
            this.subscriptions.set(sub.id, sub);
            console.log(`✅ Created EventSub subscription: ${sub.type}`);
          }
        } catch (error) {
          console.error(
            `❌ Error creating subscription ${subscription.type}:`,
            error.message
          );
        }
      }
    } catch (error) {
      console.error("❌ Error creating EventSub subscriptions:", error.message);
    }
  }

  async handleEvent(payload) {
    try {
      const event = payload.event;
      const subscription = payload.subscription;

      switch (subscription.type) {
        case "channel.follow":
          await this.handleFollow(event);
          break;

        case "channel.subscribe":
          await this.handleSubscribe(event);
          break;

        case "channel.subscription.message":
          await this.handleResub(event);
          break;

        case "channel.subscription.gift":
          await this.handleGiftSub(event);
          break;

        case "channel.cheer":
          await this.handleCheer(event);
          break;

        case "channel.raid":
          await this.handleRaid(event);
          break;

        case "channel.channel_points_custom_reward_redemption.add":
          await this.handleChannelPoints(event);
          break;

        default:
          console.log("📨 Unknown event type:", subscription.type);
      }
    } catch (error) {
      console.error("❌ Error handling event:", error);
    }
  }

  async handleFollow(event) {
    try {
      const username = event.user_name;
      const message = await this.bot.eventManager.handleFollow(username);

      if (this.bot.isConnected && this.bot.client) {
        await this.bot.client.say(`#${process.env.TWITCH_CHANNEL}`, message);
      }

      console.log(`👋 New follower: ${username}`);
    } catch (error) {
      console.error("❌ Error handling follow event:", error);
    }
  }

  async handleSubscribe(event) {
    try {
      const username = event.user_name;
      const message = await this.bot.eventManager.handleSubscription(
        username,
        event.sub_tier,
        event.message
      );

      if (this.bot.isConnected && this.bot.client) {
        await this.bot.client.say(`#${process.env.TWITCH_CHANNEL}`, message);
      }

      console.log(`💜 New subscriber: ${username}`);
    } catch (error) {
      console.error("❌ Error handling subscribe event:", error);
    }
  }

  async handleResub(event) {
    try {
      const username = event.user_name;
      const months = event.cumulative_months;
      const message = await this.bot.eventManager.handleResub(
        username,
        months,
        event.message
      );

      if (this.bot.isConnected && this.bot.client) {
        await this.bot.client.say(`#${process.env.TWITCH_CHANNEL}`, message);
      }

      console.log(`💜 Resub: ${username} (${months} months)`);
    } catch (error) {
      console.error("❌ Error handling resub event:", error);
    }
  }

  async handleGiftSub(event) {
    try {
      const username = event.user_name;
      const recipient = event.is_anonymous ? "Anonymous" : event.user_name;
      const message = await this.bot.eventManager.handleSubGift(
        username,
        recipient
      );

      if (this.bot.isConnected && this.bot.client) {
        await this.bot.client.say(`#${process.env.TWITCH_CHANNEL}`, message);
      }

      console.log(`🎁 Gift sub from ${username} to ${recipient}`);
    } catch (error) {
      console.error("❌ Error handling gift sub event:", error);
    }
  }

  async handleCheer(event) {
    try {
      const username = event.user_name;
      const bits = event.bits;
      const message = await this.bot.eventManager.handleBits(
        username,
        bits,
        event.message
      );

      if (this.bot.isConnected && this.bot.client) {
        await this.bot.client.say(`#${process.env.TWITCH_CHANNEL}`, message);
      }

      console.log(`💎 Cheer from ${username}: ${bits} bits`);
    } catch (error) {
      console.error("❌ Error handling cheer event:", error);
    }
  }

  async handleRaid(event) {
    try {
      const username = event.from_broadcaster_user_name;
      const viewers = event.viewers;
      const message = await this.bot.eventManager.handleRaid(username, viewers);

      if (this.bot.isConnected && this.bot.client) {
        await this.bot.client.say(`#${process.env.TWITCH_CHANNEL}`, message);
      }

      console.log(`🚀 Raid from ${username} with ${viewers} viewers`);
    } catch (error) {
      console.error("❌ Error handling raid event:", error);
    }
  }

  async handleChannelPoints(event) {
    try {
      const username = event.user_name;
      const reward = event.reward.title;
      const cost = event.reward.cost;

      console.log(
        `🎯 Channel points redemption: ${username} redeemed "${reward}" for ${cost} points`
      );

      // You can add custom logic here for channel points redemptions
      // For example, trigger specific actions based on the reward
    } catch (error) {
      console.error("❌ Error handling channel points event:", error);
    }
  }

  async handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

      console.log(
        `🔄 EventSub reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms...`
      );

      setTimeout(async () => {
        try {
          await this.connect();
        } catch (error) {
          console.error("❌ Error during EventSub reconnect:", error);
          this.handleReconnect();
        }
      }, delay);
    } else {
      console.error("❌ Maximum EventSub reconnect attempts reached");
    }
  }

  async reconnect() {
    if (this.ws) {
      this.ws.close();
    }
    await this.connect();
  }

  async disconnect() {
    this.clearPingInterval();

    if (this.ws) {
      this.ws.close();
    }

    this.isConnected = false;
    console.log("✅ EventSub disconnected");
  }

  isConnected() {
    return this.isConnected;
  }
}

module.exports = EventSubManager;
