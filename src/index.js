require("dotenv").config();
const tmi = require("tmi.js");
const Database = require("./database/database");
const CommandManager = require("./commands/commandManager");
const ModerationManager = require("./moderation/moderationManager");
const RecurringMessageManager = require("./moderation/recurringMessageManager");
const SpotifyManager = require("./integrations/spotifyManager");
const ApexManager = require("./integrations/apexManager");
const OBSManager = require("./integrations/obsManager");
const TwitchApiManager = require("./integrations/twitchApiManager");
const EventSubManager = require("./integrations/eventSubManager");

const WebServer = require("./web/webServer");
const EventManager = require("./events/eventManager");
const Translator = require("./utils/translator");

class TwitchBot {
  constructor() {
    this.client = null;
    this.database = null;
    this.commandManager = null;
    this.moderationManager = null;
    this.spotifyManager = null;
    this.apexManager = null;
    this.obsManager = null;
    this.twitchApiManager = null;
    this.eventSubManager = null;

    this.webServer = null;
    this.eventManager = null;
    this.translator = new Translator();

    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  async initialize() {
    try {
      // Initialize database
      this.database = new Database();
      await this.database.initialize();

      // Initialize managers
      this.commandManager = new CommandManager(this.database, this.translator);
      this.moderationManager = new ModerationManager();
      await this.moderationManager.setDatabase(this.database);

      this.recurringMessageManager = new RecurringMessageManager();
      await this.recurringMessageManager.setDatabase(this.database);
      this.recurringMessageManager.setMessageCallback(async (message) => {
        if (this.isConnected && this.client) {
          await this.client.say(`#${process.env.TWITCH_CHANNEL}`, message);
        }
      });

      this.spotifyManager = new SpotifyManager();
      await this.spotifyManager.initialize();

      // Generate Spotify authorization URL if no refresh token
      if (!process.env.SPOTIFY_REFRESH_TOKEN) {
        console.log("Spotify refresh token not found");
      }

      this.apexManager = new ApexManager();
      this.obsManager = new OBSManager();
      await this.obsManager.connect();

      this.eventManager = new EventManager(this.database);

      // Initialize Twitch API manager
      this.twitchApiManager = new TwitchApiManager(this);

      // Initialize EventSub manager
      this.eventSubManager = new EventSubManager(this);

      // Pass TwitchApiManager to command manager
      this.commandManager.twitchCommands.setTwitchApiManager(
        this.twitchApiManager
      );

      // Make twitchCommands accessible from bot
      this.twitchCommands = this.commandManager.twitchCommands;

      // Initialize web server
      this.webServer = new WebServer(this);

      // Setup Twitch client
      this.setupTwitchClient();

      // Initialize Twitch API and EventSub in background
      this.initializeTwitchServices();

      console.log("✅ Bot initialized successfully!");
      console.log(`🌐 Web interface is up and running`);
      console.log(
        "🔗 Please login via the web interface to enable EventSub and API features"
      );
    } catch (error) {
      console.error("❌ Error during initialization:", error);
      process.exit(1);
    }
  }

  setupTwitchClient() {
    const options = {
      options: {
        debug: process.env.NODE_ENV === "development",
      },
      connection: {
        reconnect: true,
        secure: true,
      },
      identity: {
        username: process.env.TWITCH_USERNAME,
        password: process.env.TWITCH_OAUTH,
      },
      channels: [process.env.TWITCH_CHANNEL],
    };

    this.client = new tmi.Client(options);

    // Connection events
    this.client.on("connecting", () => {
      // Connecting silently
    });

    this.client.on("connected", (addr, port) => {
      console.log(`✅ Connected to Twitch Chat (${addr}:${port})`);
      this.isConnected = true;
      this.reconnectAttempts = 0;
    });

    this.client.on("disconnected", (reason) => {
      console.log(`❌ Disconnected from Twitch Chat: ${reason}`);
      this.isConnected = false;
      this.handleReconnect();
    });

    // Chat events only - all other events are handled by EventSub
    this.client.on("message", (channel, tags, message, self) => {
      if (self) return; // Ignore bot's own messages

      // Debug log
      if (process.env.NODE_ENV === "development") {
        console.log(`💬 [${channel}] ${tags.username}: ${message}`);
      }

      this.handleMessage(channel, tags, message);
    });
  }

  async handleMessage(channel, tags, message) {
    const username = tags.username;

    try {
      // Check stream status and update recurring messages
      await this.checkStreamStatus();

      // Moderation
      const moderationResult = await this.moderationManager.checkMessage(
        message,
        tags
      );
      if (moderationResult.shouldModerate) {
        console.log(
          `[${channel}] Executing moderation: ${moderationResult.action} ${username} - ${moderationResult.reason}`
        );

        try {
          // Handle different moderation actions
          switch (moderationResult.action) {
            case "delete":
              // Delete the message using a very short timeout
              if (this.twitchApiManager.broadcasterId) {
                await this.twitchApiManager.deleteUserMessage(username);
              }
              break;

            case "timeout":
              if (this.twitchApiManager.broadcasterId) {
                const userInfo = await this.twitchApiManager.getUserInfo(
                  username
                );
                await this.twitchApiManager.timeoutUser(
                  userInfo.id,
                  moderationResult.duration,
                  moderationResult.reason
                );
              }
              break;

            case "ban":
              if (this.twitchApiManager.broadcasterId) {
                const userInfo = await this.twitchApiManager.getUserInfo(
                  username
                );
                await this.twitchApiManager.banUser(
                  userInfo.id,
                  moderationResult.reason
                );
              }
              break;

            default:
              console.log(
                `[${channel}] Unknown moderation action: ${moderationResult.action}`
              );
              break;
          }
        } catch (moderationError) {
          console.error(
            `[${channel}] Error executing moderation for ${username}:`,
            moderationError
          );
        }
        return;
      }

      // Check if it's a command
      const botPrefix = process.env.BOT_PREFIX || "!";
      if (message.startsWith(botPrefix)) {
        if (process.env.NODE_ENV === "development") {
          console.log(`🤖 Command detected: ${message}`);
        }
        await this.commandManager.handleCommand(channel, tags, message, this);
      }
    } catch (error) {
      console.error("Error processing message:", error);
    }
  }

  async checkStreamStatus() {
    try {
      if (this.obsManager && this.obsManager.isConnected()) {
        const streamingStatus = await this.obsManager.getStreamingStatus();
        const isStreamActive = streamingStatus.streaming;
        this.recurringMessageManager.setStreamStatus(isStreamActive);
      }
    } catch (error) {
      console.error("Error checking stream status:", error);
    }
  }

  async handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

      console.log(
        `🔄 Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms...`
      );

      setTimeout(async () => {
        try {
          await this.client.connect();
        } catch (error) {
          console.error("Error during reconnection:", error);
          this.handleReconnect();
        }
      }, delay);
    } else {
      console.error("❌ Maximum reconnection attempts reached");
      process.exit(1);
    }
  }

  async start() {
    try {
      await this.initialize();
      await this.client.connect();
      await this.webServer.start();

      console.log("🎉 Twitch Bot started successfully!");
    } catch (error) {
      console.error("❌ Error during startup:", error);
      process.exit(1);
    }
  }

  async initializeTwitchServices() {
    // Initialize Twitch API and EventSub in background
    setTimeout(async () => {
      try {
        console.log("🔄 Initializing Twitch API and EventSub...");
        console.log("⏳ Waiting for authentication via web interface...");

        // Initialize Twitch API
        const apiReady = await this.twitchApiManager.initializeWhenReady();
        if (apiReady) {
          // Update moderators list in database
          await this.twitchApiManager.updateModeratorsList();

          // Initialize EventSub
          await this.eventSubManager.initializeWhenReady();
          console.log("✅ Twitch API and EventSub initialized successfully!");
        } else {
          console.log(
            "⚠️  Twitch API initialization timed out. You can still use chat features."
          );
        }
      } catch (error) {
        console.error("❌ Error initializing Twitch services:", error);
      }
    }, 2000); // Wait 2 seconds before starting
  }

  async stop() {
    if (this.client) {
      await this.client.disconnect();
    }

    if (this.eventSubManager) {
      await this.eventSubManager.disconnect();
    }

    if (this.webServer) {
      await this.webServer.stop();
    }

    if (this.database) {
      await this.database.close();
    }

    console.log("✅ Bot stopped properly");
    process.exit(0);
  }
}

// Handle shutdown signals
process.on("SIGINT", async () => {
  await bot.stop();
});

process.on("SIGTERM", async () => {
  await bot.stop();
});

// Start the bot
const bot = new TwitchBot();
bot.start().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
