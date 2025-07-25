#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const SpotifyWebApi = require("spotify-web-api-node");
const express = require("express");
const open = require("open");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

class SetupWizard {
  constructor() {
    this.envPath = path.join(__dirname, "../.env");
    this.envExamplePath = path.join(__dirname, "../env.example");
  }

  async start() {
    // Vérifier si .env existe déjà
    if (fs.existsSync(this.envPath)) {
      const answer = await this.question(
        "Le fichier .env existe déjà. Voulez-vous le remplacer ? (y/N): "
      );
      if (answer.toLowerCase() !== "y") {
        process.exit(0);
      }
    }

    const config = {};

    // Set default language to English
    config.LANGUAGE = "en";

    // Twitch Configuration (required)
    config.TWITCH_USERNAME = await this.question("Twitch Username: ");
    config.TWITCH_CHANNEL = await this.question("Twitch Channel Name: ");

    console.log("\nTo get your Twitch OAuth token:");
    console.log("1. Go to https://twitchapps.com/tmi");
    console.log("2. Connect with your Twitch account");
    console.log("3. Copy the generated token\n");

    config.TWITCH_OAUTH = await this.question(
      "Twitch OAuth Token (starts with oauth:): "
    );

    // Twitch Auth Configuration (optional)
    const useTwitchAuth = await this.question(
      "Do you want to configure Twitch web authentication? (y/N): "
    );

    if (useTwitchAuth.toLowerCase() === "y") {
      console.log("\nTo get your Twitch Auth credentials:");
      console.log("1. Go to https://dev.twitch.tv/console");
      console.log("2. Create a new application");
      console.log("3. Add /callback/twitch to Redirect URIs (localhost:3000)");
      console.log("4. Copy Client ID and Client Secret\n");

      config.TWITCH_CLIENT_ID = await this.question("Twitch Client ID: ");
      config.TWITCH_CLIENT_SECRET = await this.question(
        "Twitch Client Secret: "
      );
      config.TWITCH_REDIRECT_URI =
        (await this.question(
          "Twitch Redirect URI (default: https://127.0.0.1:3000/callback/twitch): "
        )) || "https://127.0.0.1:3000/callback/twitch";
      config.WEB_AUTH_ENABLED = "true";
    }

    // Spotify Configuration (optional)
    const useSpotify = await this.question(
      "Do you want to configure Spotify? (y/N): "
    );

    if (useSpotify.toLowerCase() === "y") {
      console.log("\nTo get your Spotify credentials:");
      console.log("1. Go to https://developer.spotify.com/dashboard");
      console.log("2. Create a new application");
      console.log("3. Add /callback/spotify to Redirect URIs (localhost:3000)");
      console.log("4. Copy Client ID and Client Secret\n");
      config.SPOTIFY_CLIENT_ID = await this.question("Spotify Client ID: ");
      config.SPOTIFY_CLIENT_SECRET = await this.question(
        "Spotify Client Secret: "
      );
      config.SPOTIFY_REDIRECT_URI =
        (await this.question(
          "Spotify Redirect URI (default: https://127.0.0.1:3000/callback/spotify): "
        )) || "https://127.0.0.1:3000/callback/spotify";

      const getToken = await this.question(
        "Do you want to get the refresh token now? (y/N): "
      );
      if (getToken.toLowerCase() === "y") {
        config.SPOTIFY_REFRESH_TOKEN = await this.getSpotifyToken(
          config.SPOTIFY_CLIENT_ID,
          config.SPOTIFY_CLIENT_SECRET,
          config.SPOTIFY_REDIRECT_URI
        );
      }
    }

    // Configuration OBS (optionnel)
    const useOBS = await this.question("Voulez-vous configurer OBS ? (y/N): ");

    if (useOBS.toLowerCase() === "y") {
      config.OBS_HOST =
        (await this.question("Hôte OBS (défaut: localhost): ")) || "localhost";
      config.OBS_PORT =
        (await this.question("Port OBS (défaut: 4455): ")) || "4455";
      config.OBS_PASSWORD = await this.question(
        "Mot de passe OBS (optionnel): "
      );
    }

    // Apex Legends Configuration (optional)
    const useApex = await this.question(
      "Do you want to configure Apex Legends? (y/N): "
    );

    if (useApex.toLowerCase() === "y") {
      console.log("\nAvailable platforms:");
      console.log("PC = PC (Origin/Steam)");
      console.log("X1 = Xbox");
      console.log("PS4 = PlayStation 4/5");

      config.APEX_PLATFORM =
        (await this.question("Platform (PC/X1/PS4, default: PC): ")) || "PC";
      config.APEX_USERNAME = await this.question("Apex Legends Username: ");
      console.log("\nNote: Mozambique API requires a free API key.");
      console.log("Get your key at: https://apexlegendsapi.com/");
      console.log(
        "⚠️  Make sure to use the Mozambique API key, not the Tracker.gg one"
      );
      config.APEX_API_KEY = await this.question(
        "Mozambique API Key (required): "
      );
    }

    // Bot Configuration
    config.BOT_PREFIX =
      (await this.question("Command prefix (default: !): ")) || "!";

    config.WEB_PORT =
      (await this.question("Web interface port (default: 3000): ")) || "3000";

    config.LANGUAGE =
      (await this.question("Language (default: en) available: en, fr: ")) ||
      "en";

    // Generate .env file
    await this.generateEnvFile(config);

    // Create necessary directories
    await this.createDirectories(config);

    console.log("✅ Configuration completed!");

    rl.close();
  }

  async question(prompt) {
    return new Promise((resolve) => {
      rl.question(prompt, (answer) => {
        resolve(answer.trim());
      });
    });
  }

  async getSpotifyToken(clientId, clientSecret, redirectUri) {
    const spotifyApi = new SpotifyWebApi({
      clientId: clientId,
      clientSecret: clientSecret,
      redirectUri: redirectUri,
    });

    const scopes = [
      "user-read-currently-playing",
      "user-read-playback-state",
      "user-modify-playback-state",
      "user-read-private",
    ];

    const authUrl = spotifyApi.createAuthorizeURL(scopes);

    // Créer un serveur Express temporaire pour capturer le code d'autorisation
    const app = express();
    let authCode = null;
    let server = null;

    // Route pour capturer le callback Spotify
    app.get("/callback/spotify", (req, res) => {
      const { code, error } = req.query;

      if (error) {
        res.send(`
          <html>
            <head><title>Erreur Spotify</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px; background: linear-gradient(135deg, #ff4444, #191414); color: white;">
              <div style="background: rgba(255,255,255,0.1); padding: 30px; border-radius: 15px; backdrop-filter: blur(10px);">
                <h1>❌ Erreur d'autorisation Spotify</h1>
                <p>Erreur: ${error}</p>
                <p>Fermez cette fenêtre et réessayez.</p>
              </div>
            </body>
          </html>
        `);
        return;
      }

      if (code) {
        authCode = code;
        res.send(`
          <html>
            <head><title>Autorisation Spotify</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px; background: linear-gradient(135deg, #1db954, #191414); color: white;">
              <div style="background: rgba(255,255,255,0.1); padding: 30px; border-radius: 15px; backdrop-filter: blur(10px);">
                <h1>🎵 Autorisation Spotify Réussie !</h1>
                <p>Votre code d'autorisation a été récupéré avec succès.</p>
                <div style="background: rgba(0,0,0,0.3); padding: 20px; border-radius: 10px; margin: 20px 0; word-break: break-all;">
                  <strong>Code d'autorisation :</strong><br>
                  <code style="font-size: 12px;">${code}</code>
                </div>
                <p><strong>Vous pouvez fermer cette fenêtre. Le processus se termine automatiquement.</strong></p>
                <p style="font-size: 14px; opacity: 0.8;">Le serveur se fermera automatiquement dans quelques secondes...</p>
              </div>
            </body>
          </html>
        `);

        // Fermer le serveur après 3 secondes
        setTimeout(() => {
          if (server) {
            server.close();
          }
        }, 3000);
      } else {
        res.send(`
          <html>
            <head><title>Erreur Spotify</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px; background: linear-gradient(135deg, #ff4444, #191414); color: white;">
              <div style="background: rgba(255,255,255,0.1); padding: 30px; border-radius: 15px; backdrop-filter: blur(10px);">
                <h1>❌ Code d'autorisation manquant</h1>
                <p>Aucun code d'autorisation n'a été reçu.</p>
                <p>Fermez cette fenêtre et réessayez.</p>
              </div>
            </body>
          </html>
        `);
      }
    });

    // Démarrer le serveur
    server = app
      .listen(3000, "127.0.0.1", () => {
        // Server started silently
      })
      .on("error", (error) => {
        if (error.code === "EADDRINUSE") {
          server = app.listen(3001, "127.0.0.1", () => {
            // Server started on port 3001 silently
          });
        } else {
          console.error(
            "❌ Erreur lors du démarrage du serveur:",
            error.message
          );
        }
      });

    // Ouvrir automatiquement le navigateur
    await open(authUrl);

    // Attendre que le code d'autorisation soit reçu
    return new Promise((resolve) => {
      const checkAuthCode = setInterval(() => {
        if (authCode) {
          clearInterval(checkAuthCode);

          // Fermer le serveur
          if (server) {
            server.close(() => {
              // Server closed silently
            });
          }

          // Échanger le code contre un token
          spotifyApi
            .authorizationCodeGrant(authCode)
            .then((data) => {
              resolve(data.body["refresh_token"]);
            })
            .catch((error) => {
              console.error(
                "❌ Erreur lors de l'obtention du token Spotify:",
                error.message
              );
              resolve("");
            });
        }
      }, 1000);

      // Timeout après 5 minutes
      setTimeout(() => {
        if (!authCode) {
          clearInterval(checkAuthCode);
          if (server) {
            server.close();
          }
          resolve("");
        }
      }, 300000); // 5 minutes
    });
  }

  async generateEnvFile(config) {
    let envContent = "# Configuration générée automatiquement\n\n";

    // Ajouter toutes les variables
    for (const [key, value] of Object.entries(config)) {
      if (value !== undefined && value !== "") {
        envContent += `${key}=${value}\n`;
      }
    }

    // Écrire le fichier
    fs.writeFileSync(this.envPath, envContent);
  }

  async createDirectories(config) {
    const dirs = [
      path.join(__dirname, "../data"),
      path.join(__dirname, "../sounds"),
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }
}

// Démarrer le wizard
const wizard = new SetupWizard();
wizard.start().catch((error) => {
  console.error("❌ Erreur lors de la configuration:", error);
  process.exit(1);
});
