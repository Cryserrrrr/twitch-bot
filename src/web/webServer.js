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
    this.protocol = "http"; // Will be updated to https if SSL is used
    this.twitchAuth = new TwitchAuth();

    // Store authenticated users (in production, use a proper session store)
    this.authenticatedUsers = new Map();

    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    // Sécurité
    this.app.use(
      helmet({
        contentSecurityPolicy: false, // Désactivé pour le développement
      })
    );

    // CORS
    this.app.use(cors());

    // Parsing JSON
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Fichiers statiques
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

    // Route principale
    this.app.get("/", (req, res) => {
      res.sendFile(path.join(__dirname, "public", "index.html"));
    });

    // API Routes (protected)
    this.setupApiRoutes();

    // Gestion des erreurs 404
    this.app.use("*", (req, res) => {
      res.status(404).json({ error: "Route non trouvée" });
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

        // Save tokens to TwitchCommands and TwitchApiManager if authentication is successful
        if (authResult.success && authResult.tokens) {
          this.bot.commandManager.twitchCommands.setTokens(
            authResult.tokens.accessToken,
            authResult.tokens.refreshToken,
            authResult.tokens.expiresIn
          );

          // Also save to TwitchApiManager
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
            <head><title>Erreur d'authentification</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h1 style="color: #ff4444;">❌ Erreur d'authentification</h1>
              <p>Une erreur est survenue lors de l'authentification.</p>
              <p><a href="/" style="color: #9146ff;">Retour à l'interface</a></p>
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

    // Commandes
    this.app.get("/api/commands", async (req, res) => {
      try {
        const commands = await this.bot.database.getAllCommands();
        res.json(commands);
      } catch (error) {
        console.error("Error getting commands:", error);
        res
          .status(500)
          .json({ error: "Erreur lors de la récupération des commandes" });
      }
    });

    this.app.post("/api/commands", async (req, res) => {
      try {
        const { name, content, createdBy } = req.body;
        console.log("🔍 Session debug (commands):", {
          session: req.session,
          twitchUsername: req.session?.twitchUsername,
          user: req.session?.user,
        });
        const actualCreatedBy =
          req.session?.twitchUsername ||
          req.session?.user?.login ||
          req.session?.user?.display_name ||
          createdBy ||
          "web-interface";
        console.log("👤 Using createdBy:", actualCreatedBy);
        await this.bot.database.addCommand(name, content, actualCreatedBy);
        res.json({ success: true, message: "Commande ajoutée avec succès" });
      } catch (error) {
        res
          .status(500)
          .json({ error: "Erreur lors de l'ajout de la commande" });
      }
    });

    this.app.put("/api/commands/:name", async (req, res) => {
      try {
        const name = decodeURIComponent(req.params.name);
        const { content, updatedBy } = req.body;
        await this.bot.database.updateCommand(name, content, updatedBy);
        res.json({
          success: true,
          message: "Commande mise à jour avec succès",
        });
      } catch (error) {
        console.error("Error updating command:", error);
        res
          .status(500)
          .json({ error: "Erreur lors de la mise à jour de la commande" });
      }
    });

    this.app.delete("/api/commands/:name", async (req, res) => {
      try {
        const name = decodeURIComponent(req.params.name);
        await this.bot.database.deleteCommand(name);
        res.json({ success: true, message: "Commande supprimée avec succès" });
      } catch (error) {
        console.error("Error deleting command:", error);
        res
          .status(500)
          .json({ error: "Erreur lors de la suppression de la commande" });
      }
    });

    // Modération
    this.app.get("/api/moderation/banned-words", async (req, res) => {
      try {
        const bannedWords = await this.bot.database.getBannedWords();
        res.json(bannedWords);
      } catch (error) {
        res
          .status(500)
          .json({ error: "Erreur lors de la récupération des mots interdits" });
      }
    });

    this.app.post("/api/moderation/banned-words", async (req, res) => {
      try {
        const { word, action, duration } = req.body;
        console.log("🔍 Session debug:", {
          session: req.session,
          twitchUsername: req.session?.twitchUsername,
          user: req.session?.user,
        });
        const addedBy =
          req.session?.twitchUsername ||
          req.session?.user?.login ||
          req.session?.user?.display_name ||
          "web-interface";
        console.log("👤 Using addedBy:", addedBy);
        await this.bot.moderationManager.addBannedWord(
          word,
          action,
          duration,
          addedBy
        );
        // Reload moderation data to ensure consistency
        await this.bot.moderationManager.loadModerationData();
        res.json({ success: true, message: "Mot interdit ajouté avec succès" });
      } catch (error) {
        res
          .status(500)
          .json({ error: "Erreur lors de l'ajout du mot interdit" });
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
          message: "Mot interdit mis à jour avec succès",
        });
      } catch (error) {
        console.error("Error updating banned word:", error);
        res
          .status(500)
          .json({ error: "Erreur lors de la mise à jour du mot interdit" });
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
          message: "Mot interdit supprimé avec succès",
        });
      } catch (error) {
        console.error("Error deleting banned word:", error);
        res
          .status(500)
          .json({ error: "Erreur lors de la suppression du mot interdit" });
      }
    });

    this.app.get("/api/moderation/allowed-links", async (req, res) => {
      try {
        const allowedLinks = await this.bot.database.getAllowedLinks();
        res.json(allowedLinks);
      } catch (error) {
        res.status(500).json({
          error: "Erreur lors de la récupération des liens autorisés",
        });
      }
    });

    this.app.post("/api/moderation/allowed-links", async (req, res) => {
      try {
        const { domain, addedBy } = req.body;
        console.log("🔍 Session debug (links):", {
          session: req.session,
          twitchUsername: req.session?.twitchUsername,
          user: req.session?.user,
        });
        const actualAddedBy =
          req.session?.twitchUsername ||
          req.session?.user?.login ||
          req.session?.user?.display_name ||
          addedBy ||
          "web-interface";
        console.log("👤 Using addedBy:", actualAddedBy);
        const result = await this.bot.moderationManager.addAllowedLink(
          domain,
          actualAddedBy
        );
        // Reload moderation data to ensure consistency
        await this.bot.moderationManager.loadModerationData();
        res.json({ success: true, message: result });
      } catch (error) {
        console.error("Erreur lors de l'ajout du lien autorisé:", error);
        res.status(500).json({
          error: "Erreur lors de l'ajout du lien autorisé",
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
            error: "Erreur lors de la suppression du lien autorisé",
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
          error: "Erreur lors de la récupération des paramètres de modération",
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
        res.json({ success: true, message: "Paramètres mis à jour" });
      } catch (error) {
        res.status(500).json({
          error: "Erreur lors de la mise à jour des paramètres",
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
          error: "Erreur lors de la récupération de la chanson actuelle",
        });
      }
    });

    this.app.get("/api/spotify/status", (req, res) => {
      res.json({
        connected: this.bot.spotifyManager.isConnected(),
        playlistInfo: null, // À implémenter si nécessaire
      });
    });

    // OBS
    this.app.get("/api/obs/status", (req, res) => {
      res.json({
        connected: this.bot.obsManager.isConnected(),
        scenes: [], // À implémenter si nécessaire
        sources: [], // À implémenter si nécessaire
      });
    });

    // Apex Legends
    this.app.get("/api/apex/status", async (req, res) => {
      try {
        const status = await this.bot.apexManager.checkApiStatus();
        res.json(status);
      } catch (error) {
        res
          .status(500)
          .json({ error: "Erreur lors de la vérification du statut Apex" });
      }
    });

    // Actions du bot
    this.app.post("/api/bot/say", async (req, res) => {
      try {
        const { message } = req.body;
        if (this.bot.isConnected && this.bot.client) {
          await this.bot.client.say(`#${process.env.TWITCH_CHANNEL}`, message);
          res.json({ success: true, message: "Message envoyé" });
        } else {
          res.status(400).json({ error: "Bot non connecté" });
        }
      } catch (error) {
        res.status(500).json({ error: "Erreur lors de l'envoi du message" });
      }
    });

    // Configuration
    this.app.get("/api/config", (req, res) => {
      res.json({
        channel: process.env.TWITCH_CHANNEL,
        prefix: process.env.BOT_PREFIX,
      });
    });

    // Messages récurrents
    this.app.get("/api/recurring-messages", async (req, res) => {
      try {
        const messages = this.bot.recurringMessageManager.getMessages();
        res.json(messages);
      } catch (error) {
        res.status(500).json({
          error: "Erreur lors de la récupération des messages récurrents",
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
        res
          .status(500)
          .json({ error: "Erreur lors de l'ajout du message récurrent" });
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
          error: "Erreur lors de la mise à jour du message récurrent",
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
          error: "Erreur lors de la suppression du message récurrent",
        });
      }
    });

    // Callback Spotify
    this.app.get("/callback/spotify", (req, res) => {
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
        const t = this.bot.translator.t.bind(this.bot.translator);
        res.send(`
          <html>
            <head><title>${t(
              "web.callback.spotify.successTitle"
            )}</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px; background: linear-gradient(135deg, #1db954, #191414); color: white;">
              <div style="background: rgba(255,255,255,0.1); padding: 30px; border-radius: 15px; backdrop-filter: blur(10px);">
                <h1>🎵 ${t("web.callback.spotify.successTitle")} !</h1>
                <p>${t("web.callback.spotify.successMessage")}</p>
                <div style="background: rgba(0,0,0,0.3); padding: 20px; border-radius: 10px; margin: 20px 0; word-break: break-all;">
                  <strong>${t(
                    "web.callback.spotify.authorizationCode"
                  )}</strong><br>
                  <code style="font-size: 12px;">${code}</code>
                </div>
                <p><strong>${t("web.callback.spotify.copyCode")}</strong></p>
                <p style="font-size: 14px; opacity: 0.8;">${t(
                  "web.callback.spotify.setupInstructions"
                )}</p>
                <div style="margin-top: 30px;">
                  <a href="/" style="background: #1db954; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">${t(
                    "web.callback.spotify.returnToInterface"
                  )}</a>
                </div>
              </div>
            </body>
          </html>
        `);
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
        // Check if SSL certificates exist
        const certPath = "./127.0.0.1.pem";
        const keyPath = "./127.0.0.1-key.pem";

        if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
          // Use HTTPS with SSL certificates
          const options = {
            cert: fs.readFileSync(certPath),
            key: fs.readFileSync(keyPath),
          };

          this.server = https.createServer(options, this.app);
          this.protocol = "https";
          this.server.listen(this.port, "127.0.0.1", () => {
            console.log(
              `🌐 Interface available: https://127.0.0.1:${this.port}`
            );
            resolve();
          });
        } else {
          // Fallback to HTTP if certificates don't exist
          this.server = this.app.listen(this.port, "127.0.0.1", () => {
            console.log(
              `🌐 Interface available: http://127.0.0.1:${this.port}`
            );
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
    return `${this.protocol}://127.0.0.1:${this.port}`;
  }
}

module.exports = WebServer;
