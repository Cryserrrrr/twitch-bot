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
    // Use current working directory instead of __dirname for better compatibility with Coolify
    this.envPath = path.join(process.cwd(), ".env");
    this.envExamplePath = path.join(process.cwd(), "env.example");

    // Debug logs
    console.log("🔍 Debug info:");
    console.log(`Current working directory: ${process.cwd()}`);
    console.log(`__dirname: ${__dirname}`);
    console.log(`Env file path: ${this.envPath}`);
    console.log(`Env example path: ${this.envExamplePath}`);
  }

  async start() {
    // Vérifier si .env existe déjà
    if (fs.existsSync(this.envPath)) {
      const answer = await this.question(
        "The .env file already exists. Do you want to replace it? (y/N): "
      );
      if (answer.toLowerCase() !== "y") {
        process.exit(0);
      }
    }

    const config = {};

    // Set default language to English
    config.LANGUAGE = "en";

    // Web Configuration (required for callbacks)
    config.WEB_URL =
      (await this.question(
        "Web interface URL (default: https://127.0.0.1): "
      )) || "https://127.0.0.1";

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
      console.log("3. Add your redirect URI to Redirect URIs");
      console.log("4. Copy Client ID and Client Secret\n");

      config.TWITCH_CLIENT_ID = await this.question("Twitch Client ID: ");
      config.TWITCH_CLIENT_SECRET = await this.question(
        "Twitch Client Secret: "
      );

      // Ask for Twitch redirect URI separately
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
      console.log("3. Add your redirect URI to Redirect URIs");
      console.log("4. Copy Client ID and Client Secret\n");
      config.SPOTIFY_CLIENT_ID = await this.question("Spotify Client ID: ");
      config.SPOTIFY_CLIENT_SECRET = await this.question(
        "Spotify Client Secret: "
      );

      // Ask for Spotify redirect URI separately
      config.SPOTIFY_REDIRECT_URI =
        (await this.question(
          "Spotify Redirect URI (default: https://127.0.0.1:3000/callback/spotify): "
        )) || "https://127.0.0.1:3000/callback/spotify";

      const getToken = await this.question(
        "Do you want to get the refresh token now? (y/N): "
      );
      if (getToken.toLowerCase() === "y") {
        const isRemoteServer = await this.question(
          "Are you running this on a remote server (no GUI)? (y/N): "
        );
        config.SPOTIFY_REFRESH_TOKEN = await this.getSpotifyToken(
          config.SPOTIFY_CLIENT_ID,
          config.SPOTIFY_CLIENT_SECRET,
          config.SPOTIFY_REDIRECT_URI,
          isRemoteServer.toLowerCase() === "y"
        );
      }
    }

    // OBS Configuration (optional)
    const useOBS = await this.question("Do you want to configure OBS? (y/N): ");

    if (useOBS.toLowerCase() === "y") {
      config.OBS_HOST =
        (await this.question("OBS Host (default: localhost): ")) || "localhost";
      config.OBS_PORT =
        (await this.question("OBS Port (default: 4455): ")) || "4455";
      config.OBS_PASSWORD = await this.question("OBS Password (optional): ");
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

    config.NODE_ENV =
      (await this.question("Node environment (default: development): ")) ||
      "development";

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

  async getSpotifyToken(
    clientId,
    clientSecret,
    redirectUri,
    isRemoteServer = false
  ) {
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

        // Close the server after 3 seconds
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

    // Start the server
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
          console.error("❌ Error starting server:", error.message);
        }
      });

    if (isRemoteServer) {
      console.log("\n🌐 Remote server mode - Web interface not available");
      console.log("📋 Please copy and paste this URL in your browser:");
      console.log(`🔗 ${authUrl}`);
      console.log(
        "\n📝 Once authorized, copy the authorization code from the redirect URL"
      );
      console.log(
        "💡 The redirect URL will look like: https://127.0.0.1:3000/callback/spotify?code=XXXXX"
      );

      const manualCode = await this.question(
        "\nSpotify authorization code (from redirect URL): "
      );
      if (manualCode) {
        authCode = manualCode;
      }
    } else {
      // Open browser automatically only in local mode
      await open(authUrl);
    }

    // Wait for the authorization code to be received
    return new Promise((resolve) => {
      const checkAuthCode = setInterval(() => {
        if (authCode) {
          clearInterval(checkAuthCode);

          // Close the server
          if (server) {
            server.close(() => {
              // Server closed silently
            });
          }

          // Exchange the code for a token
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

      // Timeout after 5 minutes (only if not in remote server mode)
      if (!isRemoteServer) {
        setTimeout(() => {
          if (!authCode) {
            clearInterval(checkAuthCode);
            if (server) {
              server.close();
            }
            resolve("");
          }
        }, 300000); // 5 minutes
      }
    });
  }

  async generateEnvFile(config) {
    console.log("📝 Generating .env file...");
    console.log(`📁 Target path: ${this.envPath}`);

    let envContent = "# Configuration generated automatically\n\n";

    // Add all variables
    for (const [key, value] of Object.entries(config)) {
      if (value !== undefined && value !== "") {
        envContent += `${key}=${value}\n`;
      }
    }

    console.log("📄 Generated content:");
    console.log(envContent);

    try {
      // Write the file
      fs.writeFileSync(this.envPath, envContent);
      console.log("✅ .env file written successfully");

      // Verify the file was created
      if (fs.existsSync(this.envPath)) {
        console.log("✅ .env file exists after writing");
        const stats = fs.statSync(this.envPath);
        console.log(`📊 File size: ${stats.size} bytes`);
      } else {
        console.log("❌ .env file does not exist after writing");
      }
    } catch (error) {
      console.error("❌ Error writing .env file:", error);
      throw error;
    }
  }

  async createDirectories(config) {
    const dirs = [path.join(process.cwd(), "data")];

    console.log("📁 Creating directories...");
    for (const dir of dirs) {
      console.log(`📂 Creating directory: ${dir}`);
      if (!fs.existsSync(dir)) {
        try {
          fs.mkdirSync(dir, { recursive: true });
          console.log(`✅ Directory created: ${dir}`);
        } catch (error) {
          console.error(`❌ Error creating directory ${dir}:`, error);
        }
      } else {
        console.log(`✅ Directory already exists: ${dir}`);
      }
    }
  }
}

// Start the wizard
const wizard = new SetupWizard();
wizard.start().catch((error) => {
  console.error("❌ Configuration error:", error);
  process.exit(1);
});
