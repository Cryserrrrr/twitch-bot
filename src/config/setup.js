const fs = require("fs");
const path = require("path");
const readline = require("readline");
const SpotifyWebApi = require("spotify-web-api-node");
const express = require("express");
const open = require("open");

class ConfigSetup {
  constructor() {
    this.envPath = path.join(process.cwd(), ".env");
    this.envExamplePath = path.join(process.cwd(), "env.example");
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  async start() {
    // Check if .env exists
    const envExists = fs.existsSync(this.envPath);
    let currentConfig = {};

    if (envExists) {
      currentConfig = this.loadCurrentConfig();
    }

    // Web Configuration (required for callbacks)
    if (!currentConfig.WEB_URL) {
      console.log("\n🌐 Web Configuration (required for callbacks)");
      console.log("=============================================");
      currentConfig.WEB_URL = await this.questionWithDefault(
        "Web interface URL (default: https://127.0.0.1)",
        currentConfig.WEB_URL || "https://127.0.0.1"
      );
    }

    // Main menu
    await this.showMainMenu(currentConfig);
  }

  loadCurrentConfig() {
    const config = {};
    if (fs.existsSync(this.envPath)) {
      const content = fs.readFileSync(this.envPath, "utf8");
      const lines = content.split("\n");

      lines.forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          const [key, ...valueParts] = trimmed.split("=");
          if (key && valueParts.length > 0) {
            config[key.trim()] = valueParts.join("=").trim();
          }
        }
      });
    }
    return config;
  }

  async showMainMenu(currentConfig) {
    while (true) {
      console.log("\n📋 MAIN MENU");
      console.log("=============");
      console.log("1. 🔐 Twitch Configuration");
      console.log("2. 🎵 Spotify Configuration");
      console.log("3. 🎮 Apex Legends Configuration");
      console.log("4. 🎬 OBS Configuration");
      console.log("5. 🌐 Web Configuration");
      console.log("6. 💾 Save and quit");
      console.log("7. ❌ Quit without saving");

      const choice = await this.question("\nChoose an option (1-7): ");

      switch (choice) {
        case "1":
          await this.configureTwitch(currentConfig);
          break;
        case "2":
          await this.configureSpotify(currentConfig);
          break;
        case "3":
          await this.configureApex(currentConfig);
          break;
        case "4":
          await this.configureOBS(currentConfig);
          break;
        case "5":
          await this.configureWeb(currentConfig);
          break;
        case "6":
          await this.saveConfig(currentConfig);
          return;
        case "7":
          this.rl.close();
          return;
        default:
          console.log("\n❌ Invalid option. Please choose 1-7.");
      }
    }
  }

  async configureTwitch(config) {
    config.TWITCH_USERNAME = await this.questionWithDefault(
      "Twitch bot username",
      config.TWITCH_USERNAME || ""
    );

    config.TWITCH_OAUTH = await this.questionWithDefault(
      "Twitch OAuth token (oauth:...)",
      config.TWITCH_OAUTH || ""
    );

    config.TWITCH_CHANNEL = await this.questionWithDefault(
      "Twitch channel name",
      config.TWITCH_CHANNEL || ""
    );

    // Twitch Auth Configuration (for web interface)
    console.log("\n🔐 Twitch Auth Configuration (Web Interface)");
    console.log("=============================================");

    const useTwitchAuth = await this.question(
      "Do you want to configure Twitch web authentication? (y/N): "
    );

    if (useTwitchAuth.toLowerCase() === "y") {
      console.log("\n📋 Instructions to get your Twitch Auth credentials:");
      console.log("1. Go to https://dev.twitch.tv/console");
      console.log("2. Create a new application");
      console.log("3. Add your redirect URI to Redirect URIs");
      console.log("4. Copy Client ID and Client Secret\n");

      config.TWITCH_CLIENT_ID = await this.questionWithDefault(
        "Twitch Client ID",
        config.TWITCH_CLIENT_ID || ""
      );

      config.TWITCH_CLIENT_SECRET = await this.questionWithDefault(
        "Twitch Client Secret",
        config.TWITCH_CLIENT_SECRET || ""
      );

      // Ask for Twitch redirect URI separately
      config.TWITCH_REDIRECT_URI = await this.questionWithDefault(
        "Twitch Redirect URI (default: https://127.0.0.1:3000/callback/twitch)",
        config.TWITCH_REDIRECT_URI || "https://127.0.0.1:3000/callback/twitch"
      );

      config.WEB_AUTH_ENABLED = "true";
    } else {
      // Clear Twitch Auth settings if user doesn't want to use it
      delete config.TWITCH_CLIENT_ID;
      delete config.TWITCH_CLIENT_SECRET;
      delete config.TWITCH_REDIRECT_URI;
      config.WEB_AUTH_ENABLED = "false";
    }
  }

  async configureSpotify(config) {
    config.SPOTIFY_CLIENT_ID = await this.questionWithDefault(
      "Spotify Client ID",
      config.SPOTIFY_CLIENT_ID || ""
    );

    config.SPOTIFY_CLIENT_SECRET = await this.questionWithDefault(
      "Spotify Client Secret",
      config.SPOTIFY_CLIENT_SECRET || ""
    );

    // Ask for Spotify redirect URI separately
    config.SPOTIFY_REDIRECT_URI = await this.questionWithDefault(
      "Spotify Redirect URI (default: https://127.0.0.1:3000/callback/spotify)",
      config.SPOTIFY_REDIRECT_URI || "https://127.0.0.1:3000/callback/spotify"
    );

    // Refresh token management
    if (config.SPOTIFY_CLIENT_ID && config.SPOTIFY_CLIENT_SECRET) {
      console.log("\n🔄 Refresh Token Management:");
      console.log("1. Keep current token");
      console.log("2. Get new token automatically");
      console.log("3. Enter token manually");

      const tokenChoice = await this.question("\nChoose an option (1-3): ");

      switch (tokenChoice) {
        case "1":
          // Keep current token
          break;
        case "2":
          // Get new token automatically
          console.log("\n🔐 Getting Spotify token automatically...");
          config.SPOTIFY_REFRESH_TOKEN = await this.getSpotifyToken(
            config.SPOTIFY_CLIENT_ID,
            config.SPOTIFY_CLIENT_SECRET,
            config.SPOTIFY_REDIRECT_URI
          );
          break;
        case "3":
          // Enter token manually
          config.SPOTIFY_REFRESH_TOKEN = await this.questionWithDefault(
            "Spotify Refresh Token",
            config.SPOTIFY_REFRESH_TOKEN || ""
          );
          break;
        default:
          console.log("❌ Invalid option. Current token will be kept.");
      }
    } else {
      console.log(
        "\n⚠️ Client ID and Client Secret required to get a refresh token."
      );
      config.SPOTIFY_REFRESH_TOKEN = await this.questionWithDefault(
        "Spotify Refresh Token (optional)",
        config.SPOTIFY_REFRESH_TOKEN || ""
      );
    }
  }

  async configureApex(config) {
    console.log("\nAvailable platforms:");
    console.log("PC = PC (Origin/Steam)");
    console.log("X1 = Xbox");
    console.log("PS4 = PlayStation 4/5");

    config.APEX_PLATFORM = await this.questionWithDefault(
      "Platform (PC/X1/PS4, default: PC)",
      config.APEX_PLATFORM || "PC"
    );

    config.APEX_USERNAME = await this.questionWithDefault(
      "Apex Legends Username",
      config.APEX_USERNAME || ""
    );

    console.log("\nNote: Mozambique API requires a free API key.");
    console.log("Get your key at: https://apexlegendsapi.com/");
    console.log(
      "⚠️ Make sure to use the Mozambique API key, not the Tracker.gg one"
    );

    config.APEX_API_KEY = await this.questionWithDefault(
      "Mozambique API Key (required)",
      config.APEX_API_KEY || ""
    );
  }

  async configureOBS(config) {
    config.OBS_HOST = await this.questionWithDefault(
      "OBS Host (default: localhost)",
      config.OBS_HOST || "localhost"
    );

    config.OBS_PORT = await this.questionWithDefault(
      "OBS Port (default: 4455)",
      config.OBS_PORT || "4455"
    );

    config.OBS_PASSWORD = await this.questionWithDefault(
      "OBS Password (optional)",
      config.OBS_PASSWORD || ""
    );
  }

  async configureWeb(config) {
    config.WEB_URL = await this.questionWithDefault(
      "Web interface URL (default: https://127.0.0.1)",
      config.WEB_URL || "https://127.0.0.1"
    );

    config.WEB_PORT = await this.questionWithDefault(
      "Web server port (default: 3000)",
      config.WEB_PORT || "3000"
    );

    config.NODE_ENV = await this.questionWithDefault(
      "Environment (development/production, default: development)",
      config.NODE_ENV || "development"
    );

    config.LANGUAGE = await this.questionWithDefault(
      "Language (default: en) available: en, fr",
      config.LANGUAGE || "en"
    );
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

    // Create a temporary Express server to capture the authorization code
    const app = express();
    let authCode = null;
    let server = null;

    // Route to capture Spotify callback
    app.get("/callback/spotify", (req, res) => {
      const { code, error } = req.query;

      if (error) {
        res.send(`
          <html>
            <head><title>Spotify Error</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px; background: linear-gradient(135deg, #ff4444, #191414); color: white;">
              <div style="background: rgba(255,255,255,0.1); padding: 30px; border-radius: 15px; backdrop-filter: blur(10px);">
                <h1>❌ Spotify Authorization Error</h1>
                <p>Error: ${error}</p>
                <p>Close this window and try again.</p>
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
            <head><title>Spotify Authorization</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px; background: linear-gradient(135deg, #1db954, #191414); color: white;">
              <div style="background: rgba(255,255,255,0.1); padding: 30px; border-radius: 15px; backdrop-filter: blur(10px);">
                <h1>🎵 Spotify Authorization Successful!</h1>
                <p>Your authorization code has been retrieved successfully.</p>
                <div style="background: rgba(0,0,0,0.3); padding: 20px; border-radius: 10px; margin: 20px 0; word-break: break-all;">
                  <strong>Authorization Code:</strong><br>
                  <code style="font-size: 12px;">${code}</code>
                </div>
                <p><strong>You can close this window. The process will end automatically.</strong></p>
                <p style="font-size: 14px; opacity: 0.8;">The server will close automatically in a few seconds...</p>
              </div>
            </body>
          </html>
        `);

        // Close server after 3 seconds
        setTimeout(() => {
          if (server) {
            server.close();
          }
        }, 3000);
      } else {
        res.send(`
          <html>
            <head><title>Spotify Error</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px; background: linear-gradient(135deg, #ff4444, #191414); color: white;">
              <div style="background: rgba(255,255,255,0.1); padding: 30px; border-radius: 15px; backdrop-filter: blur(10px);">
                <h1>❌ Missing Authorization Code</h1>
                <p>No authorization code was received.</p>
                <p>Close this window and try again.</p>
              </div>
            </body>
          </html>
        `);
      }
    });

    // Start server
    const port = 3000;
    server = app
      .listen(port, "127.0.0.1", () => {
        // Server started silently
      })
      .on("error", (error) => {
        if (error.code === "EADDRINUSE") {
          server = app.listen(3001, "127.0.0.1", () => {
            // Server started on port 3001 silently
          });
        } else {
          console.error("❌ Error starting server:", error.message);
        }
      });

    // Open browser automatically
    try {
      await open(authUrl);
    } catch (error) {
      console.log("⚠️ Unable to open browser automatically.");
      console.log("Copy this URL manually to your browser:");
      console.log(authUrl);
    }

    // Wait for authorization code to be received
    return new Promise((resolve) => {
      const checkAuthCode = setInterval(() => {
        if (authCode) {
          clearInterval(checkAuthCode);

          // Close server
          if (server) {
            server.close(() => {
              // Server closed silently
            });
          }

          // Exchange code for token
          spotifyApi
            .authorizationCodeGrant(authCode)
            .then((data) => {
              resolve(data.body["refresh_token"]);
            })
            .catch((error) => {
              console.error("❌ Error getting Spotify token:", error.message);
              resolve("");
            });
        }
      }, 1000);

      // Timeout after 5 minutes
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

  async questionWithDefault(question, defaultValue) {
    const displayValue = defaultValue ? `[${defaultValue}]` : "[vide]";
    const answer = await this.question(`${question} ${displayValue}: `);
    return answer.trim() || defaultValue;
  }

  async question(prompt) {
    return new Promise((resolve) => {
      this.rl.question(prompt, (answer) => {
        resolve(answer);
      });
    });
  }

  async saveConfig(config) {
    // Create .env file content
    let envContent = "# Twitch Bot Configuration\n";
    envContent += "# Generated automatically by the configuration script\n\n";

    // Add sections with comments
    envContent += "# === TWITCH CONFIGURATION ===\n";
    envContent += `TWITCH_USERNAME=${config.TWITCH_USERNAME || ""}\n`;
    envContent += `TWITCH_OAUTH=${config.TWITCH_OAUTH || ""}\n`;
    envContent += `TWITCH_CHANNEL=${config.TWITCH_CHANNEL || ""}\n`;
    envContent += `TWITCH_CLIENT_ID=${config.TWITCH_CLIENT_ID || ""}\n`;
    envContent += `TWITCH_CLIENT_SECRET=${config.TWITCH_CLIENT_SECRET || ""}\n`;
    envContent += `TWITCH_REDIRECT_URI=${config.TWITCH_REDIRECT_URI || ""}\n`;
    envContent += `WEB_AUTH_ENABLED=${config.WEB_AUTH_ENABLED || "false"}\n\n`;

    envContent += "# === SPOTIFY CONFIGURATION ===\n";
    envContent += `SPOTIFY_CLIENT_ID=${config.SPOTIFY_CLIENT_ID || ""}\n`;
    envContent += `SPOTIFY_CLIENT_SECRET=${
      config.SPOTIFY_CLIENT_SECRET || ""
    }\n`;
    envContent += `SPOTIFY_REDIRECT_URI=${config.SPOTIFY_REDIRECT_URI || ""}\n`;
    envContent += `SPOTIFY_REFRESH_TOKEN=${
      config.SPOTIFY_REFRESH_TOKEN || ""
    }\n\n`;

    envContent += "# === APEX LEGENDS CONFIGURATION ===\n";
    envContent += `APEX_PLATFORM=${config.APEX_PLATFORM || "PC"}\n`;
    envContent += `APEX_USERNAME=${config.APEX_USERNAME || ""}\n`;
    envContent += `APEX_API_KEY=${config.APEX_API_KEY || ""}\n\n`;

    envContent += "# === OBS CONFIGURATION ===\n";
    envContent += `OBS_HOST=${config.OBS_HOST || "localhost"}\n`;
    envContent += `OBS_PORT=${config.OBS_PORT || "4455"}\n`;
    envContent += `OBS_PASSWORD=${config.OBS_PASSWORD || ""}\n\n`;

    envContent += "# === WEB CONFIGURATION ===\n";
    envContent += `WEB_URL=${config.WEB_URL || "https://127.0.0.1"}\n`;
    envContent += `WEB_PORT=${config.WEB_PORT || "3000"}\n`;
    envContent += `NODE_ENV=${config.NODE_ENV || "development"}\n\n`;

    // Save the file
    try {
      fs.writeFileSync(this.envPath, envContent);
      console.log("✅ Configuration saved to .env");
    } catch (error) {
      console.error("❌ Error during save:", error.message);
    }

    this.rl.close();
  }
}

// Export the class
module.exports = ConfigSetup;

// If the script is executed directly
if (require.main === module) {
  const setup = new ConfigSetup();
  setup.start().catch(console.error);
}
