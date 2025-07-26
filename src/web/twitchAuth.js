const axios = require("axios");

class TwitchAuth {
  constructor(bot = null) {
    this.bot = bot;
    this.clientId = process.env.TWITCH_CLIENT_ID;
    this.clientSecret = process.env.TWITCH_CLIENT_SECRET;
    this.redirectUri =
      process.env.TWITCH_REDIRECT_URI ||
      "https://127.0.0.1:3000/callback/twitch";
    this.channel = process.env.TWITCH_CHANNEL;

    // Essential scopes for EventSub and Twitch API
    this.scopes = [
      "user:read:email",
      "user:read:follows",
      "moderation:read",
      "channel:manage:moderators",
      "channel:manage:broadcast",
      "channel:read:subscriptions",
      "channel:read:redemptions",
      "bits:read",
      "channel:read:cheers",
      "channel:read:hype_train",
      "channel:read:polls",
      "channel:read:predictions",
      "channel:read:redemptions",
      "channel:read:ads",
      "channel:read:editors",
      "moderator:read:followers",
      "moderator:read:chatters",
      "moderator:manage:chat_messages",
      "moderator:manage:banned_users",
    ];
  }

  // Generate Twitch authorization URL
  getAuthUrl() {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: "code",
      scope: this.scopes.join(" "),
    });

    return `https://id.twitch.tv/oauth2/authorize?${params.toString()}`;
  }

  // Exchange authorization code for access token
  async exchangeCodeForToken(code) {
    try {
      const response = await axios.post("https://id.twitch.tv/oauth2/token", {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code: code,
        grant_type: "authorization_code",
        redirect_uri: this.redirectUri,
      });

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresIn: response.data.expires_in,
      };
    } catch (error) {
      console.error(
        "Error during code exchange:",
        error.response?.data || error.message
      );
      throw new Error("Unable to exchange authorization code");
    }
  }

  // Get user information
  async getUserInfo(accessToken) {
    try {
      const response = await axios.get("https://api.twitch.tv/helix/users", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Client-Id": this.clientId,
        },
      });

      return response.data.data[0];
    } catch (error) {
      console.error(
        "Error retrieving user information:",
        error.response?.data || error.message
      );
      throw new Error("Unable to retrieve user information");
    }
  }

  // Check if user is moderator of the channel
  async checkModeratorStatus(accessToken, userId) {
    try {
      // First, get the channel ID
      const channelResponse = await axios.get(
        `https://api.twitch.tv/helix/users?login=${this.channel}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Client-Id": this.clientId,
          },
        }
      );

      if (!channelResponse.data.data.length) {
        throw new Error("Channel not found");
      }

      const channelId = channelResponse.data.data[0].id;

      // Check if user is the broadcaster (channel owner)
      const isBroadcaster = channelId === userId;

      // If it's the broadcaster, they automatically have all permissions
      if (isBroadcaster) {
        return {
          isModerator: true,
          isBroadcaster: true,
          channelId,
          userId,
        };
      }

      // Check if user is a moderator using database
      let isModerator = false;

      if (this.bot && this.bot.database) {
        try {
          isModerator = await this.bot.database.isModerator(userId);
        } catch (dbError) {
          console.error(
            "Error checking moderator in database:",
            dbError.message
          );
          isModerator = false;
        }
      } else {
        // Fallback to API check if database is not available
        if (this.bot && this.bot.twitchApiManager) {
          try {
            isModerator = await this.bot.twitchApiManager.checkUserModerator(
              userId
            );
          } catch (modError) {
            console.error("Error using twitchApiManager:", modError.message);
            isModerator = false;
          }
        }
      }

      return {
        isModerator,
        isBroadcaster,
        channelId,
        userId,
      };
    } catch (error) {
      console.error(
        "Error checking moderator status:",
        error.response?.data || error.message
      );

      // In case of error, we consider user doesn't have permissions
      return {
        isModerator: false,
        isBroadcaster: false,
        channelId: null,
        userId,
      };
    }
  }

  // Complete authentication
  async authenticate(code) {
    try {
      // Exchange code for token
      const tokens = await this.exchangeCodeForToken(code);

      // Get user information
      const userInfo = await this.getUserInfo(tokens.accessToken);

      // Check moderator status
      const modStatus = await this.checkModeratorStatus(
        tokens.accessToken,
        userInfo.id
      );

      // Also check if user is an editor
      let isEditor = false;
      try {
        const editorsResponse = await axios.get(
          `https://api.twitch.tv/helix/channels/editors?broadcaster_id=${modStatus.channelId}`,
          {
            headers: {
              Authorization: `Bearer ${tokens.accessToken}`,
              "Client-Id": this.clientId,
            },
          }
        );

        const editors = editorsResponse.data.data;
        isEditor = editors.some((editor) => editor.user_id === userInfo.id);
      } catch (editorError) {
        // If we can't access editors, we consider they're not an editor
        isEditor = false;
      }

      return {
        success: true,
        user: {
          id: userInfo.id,
          login: userInfo.login,
          displayName: userInfo.display_name,
          profileImageUrl: userInfo.profile_image_url,
        },
        permissions: {
          isModerator: modStatus.isModerator,
          isBroadcaster: modStatus.isBroadcaster,
          isEditor: isEditor,
          canAccess:
            modStatus.isModerator || modStatus.isBroadcaster || isEditor,
        },
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Check if authentication is configured
  isConfigured() {
    return !!(this.clientId && this.clientSecret && this.channel);
  }
}

module.exports = TwitchAuth;
