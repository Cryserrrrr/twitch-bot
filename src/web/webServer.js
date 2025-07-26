const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");
const https = require("https");
const fs = require("fs");
const TwitchAuth = require("./twitchAuth");

class WebServer {
  constructor(bot) {
    this.bot = bot;
    this.app = express();
    this.server = null;
    this.port = process.env.WEB_PORT || 3000;
    this.webUrl = process.env.WEB_URL || "https://127.0.0.1";
    this.protocol = "http"; // Will be updated to https if SSL is used
    this.twitchAuth = new TwitchAuth(bot);

    // Store authenticated users (in production, use a proper session store)
    this.authenticatedUsers = new Map();

    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    // Security
    this.app.use(
      helmet({
        contentSecurityPolicy: false, // Disabled for development
      })
    );

    // CORS
    this.app.use(cors());

    // JSON parsing
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Static files
    this.app.use(express.static(path.join(__dirname, "public")));
  }

  setupRoutes() {
    // Translations API endpoint
    this.app.get("/api/translations", (req, res) => {
      res.json(
        this.bot.translator.translations[this.bot.translator.getLanguage()]
      );
    });

    // Authentication routes
    this.setupAuthRoutes();

    // Main route
    this.app.get("/", (req, res) => {
      res.sendFile(path.join(__dirname, "public", "index.html"));
    });

    // API Routes (protected)
    this.setupApiRoutes();

    // 404 error handling
    this.app.use("*", (req, res) => {
      res.status(404).json({ error: "Route not found" });
    });
  }

  setupAuthRoutes() {
    // Check if Twitch auth is configured
    this.app.get("/api/auth/status", (req, res) => {
      res.json({
        configured: this.twitchAuth.isConfigured(),
        enabled: process.env.WEB_AUTH_ENABLED === "true",
      });
    });

    // Get Twitch auth URL
    this.app.get("/api/auth/twitch", (req, res) => {
      if (!this.twitchAuth.isConfigured()) {
        return res
          .status(400)
          .json({ error: "Twitch authentication not configured" });
      }

      const authUrl = this.twitchAuth.getAuthUrl();
      res.json({ authUrl });
    });

    // Twitch auth callback (support both old and new URLs)
    this.app.get(["/auth/callback", "/callback/twitch"], async (req, res) => {
      const { code, error } = req.query;

      if (error) {
        const t = this.bot.translator.t.bind(this.bot.translator);
        return res.send(`
          <html>
            <head><title>${t("web.callback.twitch.errorTitle")}</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h1 style="color: #ff4444;">❌ ${t(
                "web.callback.twitch.errorTitle"
              )}</h1>
              <p>${t("web.callback.twitch.errorMessage", { error })}</p>
              <p><a href="/" style="color: #9146ff;">${t(
                "web.callback.twitch.returnToInterface"
              )}</a></p>
            </body>
          </html>
        `);
      }

      if (!code) {
        const t = this.bot.translator.t.bind(this.bot.translator);
        return res.send(`
          <html>
            <head><title>${t("web.callback.twitch.errorTitle")}</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h1 style="color: #ff4444;">❌ ${t(
                "web.callback.twitch.missingCode"
              )}</h1>
              <p>${t("web.callback.twitch.noCodeReceived")}</p>
              <p><a href="/" style="color: #9146ff;">${t(
                "web.callback.twitch.returnToInterface"
              )}</a></p>
            </body>
          </html>
        `);
      }

      try {
        const authResult = await this.twitchAuth.authenticate(code);

        // Save tokens to TwitchApiManager if authentication is successful
        if (authResult.success && authResult.tokens) {
          // Save to TwitchApiManager
          if (this.bot.twitchApiManager) {
            this.bot.twitchApiManager.setTokens(
              authResult.tokens.accessToken,
              authResult.tokens.refreshToken,
              authResult.tokens.expiresIn
            );
          }
        }

        if (authResult.success) {
          // Store user session
          const sessionId = this.generateSessionId();
          this.authenticatedUsers.set(sessionId, {
            user: authResult.user,
            permissions: authResult.permissions,
            tokens: authResult.tokens,
            twitchUsername:
              authResult.user?.login || authResult.user?.display_name,
            expiresAt: Date.now() + authResult.tokens.expiresIn * 1000,
          });

          if (authResult.permissions.canAccess) {
            const t = this.bot.translator.t.bind(this.bot.translator);
            res.send(`
              <html>
                <head><title>${t(
                  "web.callback.twitch.successTitle"
                )}</title></head>
                <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                  <div style="background: rgba(255,255,255,0.1); padding: 30px; border-radius: 15px; backdrop-filter: blur(10px);">
                    <h1>✅ ${t("web.callback.twitch.successTitle")} !</h1>
                    <p>${t("web.callback.twitch.welcomeMessage", {
                      username: authResult.user.displayName,
                    })}</p>
                    <p>${t("web.callback.twitch.accessGranted")}</p>
                    <div style="margin-top: 30px;">
                      <a href="/" style="background: #9146ff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">${t(
                        "web.callback.twitch.accessInterface"
                      )}</a>
                    </div>
                    <script>
                      // Store session ID in localStorage
                      localStorage.setItem('twitch_session', '${sessionId}');
                      localStorage.setItem('twitch_user', JSON.stringify(${JSON.stringify(
                        authResult.user
                      )}));
                      localStorage.setItem('twitch_permissions', JSON.stringify(${JSON.stringify(
                        authResult.permissions
                      )}));
                    </script>
                  </div>
                </body>
              </html>
            `);
          } else {
            const t = this.bot.translator.t.bind(this.bot.translator);
            res.send(`
              <html>
                <head><title>${t(
                  "web.callback.twitch.accessDeniedTitle"
                )}</title></head>
                <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                  <h1 style="color: #ff4444;">❌ ${t(
                    "web.callback.twitch.accessDeniedTitle"
                  )}</h1>
                  <p>${t("web.callback.twitch.accessDenied")}</p>
                  <p><a href="/" style="color: #9146ff;">${t(
                    "web.callback.twitch.returnToInterface"
                  )}</a></p>
                </body>
              </html>
            `);
          }
        } else {
          const t = this.bot.translator.t.bind(this.bot.translator);
          res.send(`
            <html>
              <head><title>${t(
                "web.callback.twitch.authErrorTitle"
              )}</title></head>
              <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: #ff4444;">❌ ${t(
                  "web.callback.twitch.authErrorTitle"
                )}</h1>
                <p>${t("web.callback.twitch.errorMessage", {
                  error: authResult.error,
                })}</p>
                <p><a href="/" style="color: #9146ff;">${t(
                  "web.callback.twitch.returnToInterface"
                )}</a></p>
              </body>
            </html>
          `);
        }
      } catch (error) {
        res.send(`
          <html>
            <head><title>Authentication Error</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h1 style="color: #ff4444;">❌ Authentication Error</h1>
              <p>An error occurred during authentication.</p>
              <p><a href="/" style="color: #9146ff;">Return to interface</a></p>
            </body>
          </html>
        `);
      }
    });

    // Logout
    this.app.post("/api/auth/logout", (req, res) => {
      const sessionId = req.headers["x-session-id"];
      if (sessionId) {
        this.authenticatedUsers.delete(sessionId);
      }
      res.json({ success: true });
    });

    // Check session
    this.app.get("/api/auth/session", (req, res) => {
      const sessionId = req.headers["x-session-id"];
      if (!sessionId) {
        return res.status(401).json({ error: "No session" });
      }

      const session = this.authenticatedUsers.get(sessionId);
      if (!session) {
        return res.status(401).json({ error: "Invalid session" });
      }

      // Check if session is expired
      if (Date.now() > session.expiresAt) {
        this.authenticatedUsers.delete(sessionId);
        return res.status(401).json({ error: "Session expired" });
      }

      res.json({
        user: session.user,
        permissions: session.permissions,
      });
    });
  }

  setupApiRoutes() {
    // Public routes (no auth required)
    this.app.get("/api/status", (req, res) => {
      res.json({
        connected: this.bot.isConnected,
        channel: process.env.TWITCH_CHANNEL,
        uptime: process.uptime(),
        version: "1.0.0",
      });
    });

    // Apply auth middleware to all other API routes
    this.app.use("/api", (req, res, next) => {
      // Skip auth for public routes
      if (
        req.path === "/status" ||
        req.path.startsWith("/auth/") ||
        req.path === "/commands"
      ) {
        return next();
      }

      this.requireAuth(req, res, next);
    });

    // Commands
    this.app.get("/api/commands", async (req, res) => {
      try {
        const commands = await this.bot.database.getAllCommands();
        res.json(commands);
      } catch (error) {
        console.error("Error getting commands:", error);
        res.status(500).json({ error: "Error retrieving commands" });
      }
    });

    this.app.post("/api/commands", async (req, res) => {
      try {
        const { name, content, createdBy } = req.body;
        const actualCreatedBy =
          req.session?.twitchUsername ||
          req.session?.user?.login ||
          req.session?.user?.display_name ||
          createdBy ||
          "web-interface";
        await this.bot.database.addCommand(name, content, actualCreatedBy);
        res.json({ success: true, message: "Command added successfully" });
      } catch (error) {
        res.status(500).json({ error: "Error adding command" });
      }
    });

    this.app.put("/api/commands/:name", async (req, res) => {
      try {
        const name = decodeURIComponent(req.params.name);
        const { content, updatedBy } = req.body;
        await this.bot.database.updateCommand(name, content, updatedBy);
        res.json({
          success: true,
          message: "Command updated successfully",
        });
      } catch (error) {
        console.error("Error updating command:", error);
        res.status(500).json({ error: "Error updating command" });
      }
    });

    this.app.delete("/api/commands/:name", async (req, res) => {
      try {
        const name = decodeURIComponent(req.params.name);
        await this.bot.database.deleteCommand(name);
        res.json({ success: true, message: "Command deleted successfully" });
      } catch (error) {
        console.error("Error deleting command:", error);
        res.status(500).json({ error: "Error deleting command" });
      }
    });

    // Moderation
    this.app.get("/api/moderation/banned-words", async (req, res) => {
      try {
        const bannedWords = await this.bot.database.getBannedWords();
        res.json(bannedWords);
      } catch (error) {
        res.status(500).json({ error: "Error retrieving banned words" });
      }
    });

    this.app.post("/api/moderation/banned-words", async (req, res) => {
      try {
        const { word, action, duration } = req.body;
        const addedBy =
          req.session?.twitchUsername ||
          req.session?.user?.login ||
          req.session?.user?.display_name ||
          "web-interface";
        await this.bot.moderationManager.addBannedWord(
          word,
          action,
          duration,
          addedBy
        );
        // Reload moderation data to ensure consistency
        await this.bot.moderationManager.loadModerationData();
        res.json({ success: true, message: "Banned word added successfully" });
      } catch (error) {
        res.status(500).json({ error: "Error adding banned word" });
      }
    });

    this.app.put("/api/moderation/banned-words/:word", async (req, res) => {
      try {
        const word = decodeURIComponent(req.params.word);
        const { action, duration } = req.body;
        await this.bot.moderationManager.updateBannedWord(
          word,
          action,
          duration
        );
        // Reload moderation data to ensure consistency
        await this.bot.moderationManager.loadModerationData();
        res.json({
          success: true,
          message: "Banned word updated successfully",
        });
      } catch (error) {
        console.error("Error updating banned word:", error);
        res.status(500).json({ error: "Error updating banned word" });
      }
    });

    this.app.delete("/api/moderation/banned-words/:word", async (req, res) => {
      try {
        const word = decodeURIComponent(req.params.word);
        await this.bot.moderationManager.removeBannedWord(word);
        // Reload moderation data to ensure consistency
        await this.bot.moderationManager.loadModerationData();
        res.json({
          success: true,
          message: "Banned word deleted successfully",
        });
      } catch (error) {
        console.error("Error deleting banned word:", error);
        res.status(500).json({ error: "Error deleting banned word" });
      }
    });

    this.app.get("/api/moderation/allowed-links", async (req, res) => {
      try {
        const allowedLinks = await this.bot.database.getAllowedLinks();
        res.json(allowedLinks);
      } catch (error) {
        res.status(500).json({
          error: "Error retrieving allowed links",
        });
      }
    });

    this.app.post("/api/moderation/allowed-links", async (req, res) => {
      try {
        const { domain, addedBy } = req.body;
        const actualAddedBy =
          req.session?.twitchUsername ||
          req.session?.user?.login ||
          req.session?.user?.display_name ||
          addedBy ||
          "web-interface";
        const result = await this.bot.moderationManager.addAllowedLink(
          domain,
          actualAddedBy
        );
        // Reload moderation data to ensure consistency
        await this.bot.moderationManager.loadModerationData();
        res.json({ success: true, message: result });
      } catch (error) {
        console.error("Error adding allowed link:", error);
        res.status(500).json({
          error: "Error adding allowed link",
          details: error.message,
        });
      }
    });

    this.app.delete(
      "/api/moderation/allowed-links/:domain",
      async (req, res) => {
        try {
          const domain = decodeURIComponent(req.params.domain);
          const result = await this.bot.moderationManager.removeAllowedLink(
            domain
          );
          // Reload moderation data to ensure consistency
          await this.bot.moderationManager.loadModerationData();
          res.json({ success: true, message: result });
        } catch (error) {
          console.error("Error deleting allowed link:", error);
          res.status(500).json({
            error: "Error deleting allowed link",
          });
        }
      }
    );

    // Moderation settings
    this.app.get("/api/moderation/settings", async (req, res) => {
      try {
        const settings = await this.bot.database.getModerationSettings();
        res.json(settings);
      } catch (error) {
        res.status(500).json({
          error: "Error retrieving moderation settings",
        });
      }
    });

    this.app.put("/api/moderation/settings", async (req, res) => {
      try {
        const { bannedWordsEnabled, allowedLinksEnabled } = req.body;
        await this.bot.database.updateModerationSettings(
          bannedWordsEnabled,
          allowedLinksEnabled
        );
        res.json({
          success: true,
          message: "Moderation settings updated successfully",
        });
      } catch (error) {
        console.error("Error updating moderation settings:", error);
        res.status(500).json({
          error: "Error updating moderation settings",
        });
      }
    });

    // Moderators management
    this.app.post("/api/moderators/refresh", async (req, res) => {
      try {
        if (!this.bot.twitchCommands) {
          return res.status(500).json({
            error: "Twitch commands not available",
          });
        }

        const result = await this.bot.twitchCommands.refreshModeratorsList();
        res.json(result);
      } catch (error) {
        console.error("Error refreshing moderators list:", error);
        res.status(500).json({
          error: "Error refreshing moderators list",
          details: error.message,
        });
      }
    });

    this.app.get("/api/moderators", async (req, res) => {
      try {
        const moderators = await this.bot.database.getModerators();
        res.json(moderators);
      } catch (error) {
        console.error("Error getting moderators:", error);
        res.status(500).json({
          error: "Error getting moderators list",
        });
      }
    });

    // Spotify
    this.app.get("/api/spotify/current-song", async (req, res) => {
      try {
        const currentTrack = this.bot.spotifyManager.getCurrentTrackInfo();
        res.json(currentTrack);
      } catch (error) {
        res.status(500).json({
          error: "Error retrieving current song",
        });
      }
    });

    this.app.get("/api/spotify/status", (req, res) => {
      res.json({
        connected: this.bot.spotifyManager.isConnected(),
        playlistInfo: null, // To implement if needed
      });
    });

    // Spotify Authorization
    this.app.get("/api/spotify/auth-url", (req, res) => {
      try {
        const SpotifyWebApi = require("spotify-web-api-node");
        const spotifyApi = new SpotifyWebApi({
          clientId: process.env.SPOTIFY_CLIENT_ID,
          clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
          redirectUri: process.env.SPOTIFY_REDIRECT_URI,
        });

        const scopes = [
          "user-read-currently-playing",
          "user-read-playback-state",
          "user-modify-playback-state",
          "user-read-private",
        ];

        const authUrl = spotifyApi.createAuthorizeURL(scopes);
        res.json({ authUrl });
      } catch (error) {
        console.error("Error generating Spotify auth URL:", error);
        res.status(500).json({ error: "Error generating authorization URL" });
      }
    });

    // OBS
    this.app.get("/api/obs/status", (req, res) => {
      res.json({
        connected: this.bot.obsManager.isConnected(),
        scenes: [], // To implement if needed
        sources: [], // To implement if needed
      });
    });

    // Apex Legends
    this.app.get("/api/apex/status", async (req, res) => {
      try {
        const status = await this.bot.apexManager.checkApiStatus();
        res.json(status);
      } catch (error) {
        res.status(500).json({ error: "Error checking Apex status" });
      }
    });

    // Bot actions
    this.app.post("/api/bot/say", async (req, res) => {
      try {
        const { message } = req.body;
        if (this.bot.isConnected && this.bot.client) {
          await this.bot.client.say(`#${process.env.TWITCH_CHANNEL}`, message);
          res.json({ success: true, message: "Message sent" });
        } else {
          res.status(400).json({ error: "Bot not connected" });
        }
      } catch (error) {
        res.status(500).json({ error: "Error sending message" });
      }
    });

    // Configuration
    this.app.get("/api/config", (req, res) => {
      res.json({
        channel: process.env.TWITCH_CHANNEL,
        prefix: process.env.BOT_PREFIX,
      });
    });

    // Recurring messages
    this.app.get("/api/recurring-messages", async (req, res) => {
      try {
        const messages = this.bot.recurringMessageManager.getMessages();
        res.json(messages);
      } catch (error) {
        res.status(500).json({
          error: "Error retrieving recurring messages",
        });
      }
    });

    this.app.post("/api/recurring-messages", async (req, res) => {
      try {
        const { message, intervalMinutes } = req.body;
        const result = await this.bot.recurringMessageManager.addMessage(
          message,
          intervalMinutes
        );
        res.json({ success: true, message: result });
      } catch (error) {
        res.status(500).json({ error: "Error adding recurring message" });
      }
    });

    this.app.put("/api/recurring-messages/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const { message, intervalMinutes, enabled } = req.body;
        const result = await this.bot.recurringMessageManager.updateMessage(
          id,
          message,
          intervalMinutes,
          enabled
        );
        res.json({ success: true, message: result });
      } catch (error) {
        res.status(500).json({
          error: "Error updating recurring message",
        });
      }
    });

    this.app.delete("/api/recurring-messages/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const result = await this.bot.recurringMessageManager.deleteMessage(id);
        res.json({ success: true, message: result });
      } catch (error) {
        res.status(500).json({
          error: "Error deleting recurring message",
        });
      }
    });

    // Commercial/Ads Management
    this.app.get("/api/ads/status", async (req, res) => {
      try {
        const commercialStatus =
          await this.bot.twitchApiManager.getCommercialStatus();
        const adSchedule = await this.bot.twitchApiManager.getAdSchedule();
        const adBreakSchedule =
          await this.bot.twitchApiManager.getAdBreakSchedule();

        res.json({
          commercial: commercialStatus,
          adSchedule: adSchedule,
          adBreakSchedule: adBreakSchedule,
        });
      } catch (error) {
        console.error("Error getting ads status:", error);
        res.status(500).json({ error: "Error retrieving ads status" });
      }
    });

    this.app.post("/api/ads/commercial", async (req, res) => {
      try {
        const { length = 30 } = req.body;
        const result = await this.bot.twitchApiManager.startCommercial(length);
        res.json(result);
      } catch (error) {
        console.error("Error starting commercial:", error);
        res.status(500).json({ error: "Error starting commercial" });
      }
    });

    this.app.post("/api/ads/snooze", async (req, res) => {
      try {
        const result = await this.bot.twitchApiManager.snoozeNextAd();
        res.json(result);
      } catch (error) {
        console.error("Error snoozing next ad:", error);
        res.status(500).json({ error: "Error snoozing next ad" });
      }
    });

    // Spotify callback
    this.app.get("/callback/spotify", async (req, res) => {
      const { code, error } = req.query;

      if (error) {
        const t = this.bot.translator.t.bind(this.bot.translator);
        res.send(`
          <html>
            <head><title>${t("web.callback.spotify.errorTitle")}</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h1 style="color: #ff4444;">❌ ${t(
                "web.callback.spotify.authErrorTitle"
              )}</h1>
              <p>${t("web.callback.spotify.errorMessage", { error })}</p>
              <p><a href="/" style="color: #1db954;">${t(
                "web.callback.spotify.returnToInterface"
              )}</a></p>
            </body>
          </html>
        `);
        return;
      }

      if (code) {
        try {
          // Exchange the authorization code for a refresh token
          const SpotifyWebApi = require("spotify-web-api-node");
          const spotifyApi = new SpotifyWebApi({
            clientId: process.env.SPOTIFY_CLIENT_ID,
            clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
            redirectUri: process.env.SPOTIFY_REDIRECT_URI,
          });

          const data = await spotifyApi.authorizationCodeGrant(code);
          const refreshToken = data.body["refresh_token"];

          // Add the refresh token to the .env file
          const fs = require("fs");
          const path = require("path");
          const envPath = path.join(process.cwd(), ".env");

          let envContent = "";
          if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, "utf8");
          }

          // Check if SPOTIFY_REFRESH_TOKEN already exists
          if (envContent.includes("SPOTIFY_REFRESH_TOKEN=")) {
            // Update existing token
            envContent = envContent.replace(
              /SPOTIFY_REFRESH_TOKEN=.*/g,
              `SPOTIFY_REFRESH_TOKEN=${refreshToken}`
            );
          } else {
            // Add new token
            envContent += `\nSPOTIFY_REFRESH_TOKEN=${refreshToken}`;
          }

          // Write back to .env file
          fs.writeFileSync(envPath, envContent);

          const t = this.bot.translator.t.bind(this.bot.translator);
          res.send(`
            <html>
              <head><title>${t(
                "web.callback.spotify.successTitle"
              )}</title></head>
              <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                <div style="background: rgba(255,255,255,0.1); padding: 30px; border-radius: 15px; backdrop-filter: blur(10px);">
                  <h1>🎵 ${t("web.callback.spotify.successTitle")} !</h1>
                  <p>${t("web.callback.spotify.autoSuccessMessage")}</p>
                  
                  <!-- Warning for external .env management -->
                  <div style="background: rgba(255, 193, 7, 0.2); border: 1px solid #ffc107; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <div style="display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 10px;">
                      <span style="color: #ffc107; font-size: 18px;">⚠️</span>
                      <strong style="color: #ffc107;">${t(
                        "web.callback.spotify.externalEnvWarning"
                      )}</strong>
                    </div>
                    <p style="margin: 0; font-size: 14px; color: #fff; text-align: center;">${t(
                      "web.callback.spotify.externalEnvMessage"
                    )}</p>
                  </div>
                  
                  <div style="background: rgba(0,0,0,0.3); padding: 20px; border-radius: 10px; margin: 20px 0; word-break: break-all;">
                    <strong>${t(
                      "web.callback.spotify.refreshTokenLabel"
                    )}</strong><br>
                    <code style="font-size: 12px; background: rgba(255,255,255,0.1); padding: 10px; border-radius: 5px; display: block; margin: 10px 0; word-break: break-all;">${refreshToken}</code>
                    <button onclick="copyToClipboard('${refreshToken}')" style="background: #1db954; color: white; border: none; padding: 8px 16px; border-radius: 5px; cursor: pointer; font-size: 12px; margin-top: 10px;">
                      📋 ${t("web.callback.spotify.copyToken")}
                    </button>
                  </div>
                  
                  <p><strong>${t(
                    "web.callback.spotify.restartRequired"
                  )}</strong></p>
                  <div style="margin-top: 30px;">
                    <a href="/" style="background: #1db954; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">${t(
                      "web.callback.spotify.returnToInterface"
                    )}</a>
                  </div>
                </div>
                
                <script>
                  function copyToClipboard(text) {
                    navigator.clipboard.writeText(text).then(() => {
                      const button = event.target;
                      const originalText = button.innerHTML;
                      button.innerHTML = '✅ ${t(
                        "web.callback.spotify.tokenCopied"
                      )}';
                      button.style.background = '#28a745';
                      setTimeout(() => {
                        button.innerHTML = originalText;
                        button.style.background = '#1db954';
                      }, 2000);
                    }).catch(() => {
                      // Fallback for older browsers
                      const textArea = document.createElement('textarea');
                      textArea.value = text;
                      document.body.appendChild(textArea);
                      textArea.select();
                      document.execCommand('copy');
                      document.body.removeChild(textArea);
                      
                      const button = event.target;
                      const originalText = button.innerHTML;
                      button.innerHTML = '✅ ${t(
                        "web.callback.spotify.tokenCopied"
                      )}';
                      button.style.background = '#28a745';
                      setTimeout(() => {
                        button.innerHTML = originalText;
                        button.style.background = '#1db954';
                      }, 2000);
                    });
                  }
                </script>
              </body>
            </html>
          `);
        } catch (error) {
          console.error("Error exchanging Spotify code:", error);
          const t = this.bot.translator.t.bind(this.bot.translator);
          res.send(`
            <html>
              <head><title>${t(
                "web.callback.spotify.errorTitle"
              )}</title></head>
              <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: #ff4444;">❌ ${t(
                  "web.callback.spotify.exchangeError"
                )}</h1>
                <p>${t("web.callback.spotify.exchangeErrorMessage")}</p>
                <p><a href="/" style="color: #1db954;">${t(
                  "web.callback.spotify.returnToInterface"
                )}</a></p>
              </body>
            </html>
          `);
        }
      } else {
        const t = this.bot.translator.t.bind(this.bot.translator);
        res.send(`
          <html>
            <head><title>${t("web.callback.spotify.errorTitle")}</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h1 style="color: #ff4444;">❌ ${t(
                "web.callback.spotify.missingCode"
              )}</h1>
              <p>${t("web.callback.spotify.noCodeReceived")}</p>
              <p><a href="/" style="color: #1db954;">${t(
                "web.callback.spotify.returnToInterface"
              )}</a></p>
            </body>
          </html>
          `);
      }
    });
  }

  async start() {
    return new Promise((resolve, reject) => {
      try {
        // Parse the web URL to get host and protocol
        const url = new URL(this.webUrl);
        const host = url.hostname;
        const port = url.port || this.port;

        // Check if SSL certificates exist
        const certPath = "./127.0.0.1.pem";
        const keyPath = "./127.0.0.1-key.pem";

        if (
          (fs.existsSync(certPath) && fs.existsSync(keyPath)) ||
          process.env.NODE_ENV === "development"
        ) {
          // Use HTTPS with SSL certificates
          const options = {
            cert: fs.readFileSync(certPath),
            key: fs.readFileSync(keyPath),
          };

          this.server = https.createServer(options, this.app);
          this.protocol = "https";
          this.server.listen(port, host, () => {
            console.log(`🌐 Interface available: ${this.webUrl}:${port}`);
            resolve();
          });
        } else {
          // Fallback to HTTP if certificates don't exist
          this.server = this.app.listen(port, host, () => {
            console.log(`🌐 Interface available: http://${host}:${port}`);
            resolve();
          });
        }

        this.server.on("error", (error) => {
          console.error("❌ Error starting web server:", error);
          reject(error);
        });
      } catch (error) {
        console.error("❌ Error reading SSL certificates:", error);
        reject(error);
      }
    });
  }

  async stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  // Authentication middleware
  requireAuth(req, res, next) {
    // Skip auth if disabled
    if (process.env.WEB_AUTH_ENABLED !== "true") {
      return next();
    }

    const sessionId = req.headers["x-session-id"];
    if (!sessionId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const session = this.authenticatedUsers.get(sessionId);
    if (!session) {
      return res.status(401).json({ error: "Invalid session" });
    }

    // Check if session is expired
    if (Date.now() > session.expiresAt) {
      this.authenticatedUsers.delete(sessionId);
      return res.status(401).json({ error: "Session expired" });
    }

    // Add user info to request
    req.session = session;
    req.user = session.user;
    req.permissions = session.permissions;
    next();
  }

  // Generate session ID
  generateSessionId() {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }

  // Cleanup expired sessions (run periodically)
  cleanupExpiredSessions() {
    const now = Date.now();
    for (const [sessionId, session] of this.authenticatedUsers.entries()) {
      if (now > session.expiresAt) {
        this.authenticatedUsers.delete(sessionId);
      }
    }
  }

  // Get base URL with correct protocol
  getBaseUrl() {
    return `${this.protocol}://${new URL(this.webUrl).hostname}:${this.port}`;
  }
}

module.exports = WebServer;
