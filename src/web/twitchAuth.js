const axios = require("axios");

class TwitchAuth {
  constructor() {
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

      // Simplified approach: if user can get a token with moderation scopes,
      // and they're not the broadcaster, we consider they have moderation permissions
      // This approach is more permissive but avoids API issues
      let isModerator = false;

      try {
        // Try to access a simple moderation endpoint
        await axios.get(
          `https://api.twitch.tv/helix/moderation/moderators?broadcaster_id=${channelId}&first=1`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Client-Id": this.clientId,
            },
          }
        );

        // If we get here, user has access to moderation endpoints
        // We consider them a moderator or have equivalent permissions
        isModerator = true;
      } catch (modError) {
        // If we get a 403 error, user is not a moderator
        if (modError.response?.status === 403) {
          isModerator = false;
        } else {
          // For other errors, try an alternative approach
          try {
            // Try to access the editors endpoint
            const editorsResponse = await axios.get(
              `https://api.twitch.tv/helix/channels/editors?broadcaster_id=${channelId}`,
              {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  "Client-Id": this.clientId,
                },
              }
            );

            const editors = editorsResponse.data.data;
            isModerator = editors.some((editor) => editor.user_id === userId);
          } catch (editorError) {
            // If we can't access editors either, user doesn't have permissions
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
