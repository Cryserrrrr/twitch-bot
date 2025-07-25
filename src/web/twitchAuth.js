const axios = require("axios");

class TwitchAuth {
  constructor() {
    this.clientId = process.env.TWITCH_CLIENT_ID;
    this.clientSecret = process.env.TWITCH_CLIENT_SECRET;
    this.redirectUri =
      process.env.TWITCH_REDIRECT_URI ||
      "https://127.0.0.1:3000/callback/twitch";
    this.channel = process.env.TWITCH_CHANNEL;

    // Scopes essentiels pour EventSub et API Twitch
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

  // Générer l'URL d'autorisation Twitch
  getAuthUrl() {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: "code",
      scope: this.scopes.join(" "),
    });

    return `https://id.twitch.tv/oauth2/authorize?${params.toString()}`;
  }

  // Échanger le code d'autorisation contre un token d'accès
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
        "Erreur lors de l'échange du code:",
        error.response?.data || error.message
      );
      throw new Error("Impossible d'échanger le code d'autorisation");
    }
  }

  // Obtenir les informations de l'utilisateur
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
        "Erreur lors de la récupération des infos utilisateur:",
        error.response?.data || error.message
      );
      throw new Error("Impossible de récupérer les informations utilisateur");
    }
  }

  // Vérifier si l'utilisateur est modérateur du canal
  async checkModeratorStatus(accessToken, userId) {
    try {
      // D'abord, obtenir l'ID du canal
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
        throw new Error("Canal non trouvé");
      }

      const channelId = channelResponse.data.data[0].id;

      // Vérifier si l'utilisateur est le broadcaster (propriétaire du canal)
      const isBroadcaster = channelId === userId;

      // Pour les modérateurs, on utilise une approche différente
      // On vérifie si l'utilisateur peut accéder aux endpoints de modération
      let isModerator = false;

      try {
        // Essayer d'accéder à un endpoint de modération
        const modsResponse = await axios.get(
          `https://api.twitch.tv/helix/moderation/moderators?broadcaster_id=${channelId}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Client-Id": this.clientId,
            },
          }
        );

        // Si on arrive ici, l'utilisateur a accès aux endpoints de modération
        const moderators = modsResponse.data.data;
        isModerator = moderators.some((mod) => mod.user_id === userId);
      } catch (modError) {
        // Si on a une erreur 403, l'utilisateur n'est pas modérateur
        if (modError.response?.status === 403) {
          isModerator = false;
        } else {
          // Pour d'autres erreurs, on considère que l'utilisateur n'est pas modérateur
          isModerator = false;
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
        "Erreur lors de la vérification du statut modérateur:",
        error.response?.data || error.message
      );

      // En cas d'erreur, on considère que l'utilisateur n'a pas les permissions
      return {
        isModerator: false,
        isBroadcaster: false,
        channelId: null,
        userId,
      };
    }
  }

  // Authentification complète
  async authenticate(code) {
    try {
      // Échanger le code contre un token
      const tokens = await this.exchangeCodeForToken(code);

      // Obtenir les informations utilisateur
      const userInfo = await this.getUserInfo(tokens.accessToken);

      // Vérifier le statut modérateur
      const modStatus = await this.checkModeratorStatus(
        tokens.accessToken,
        userInfo.id
      );

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
          canAccess: modStatus.isModerator || modStatus.isBroadcaster,
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

  // Vérifier si l'authentification est configurée
  isConfigured() {
    return !!(this.clientId && this.clientSecret && this.channel);
  }
}

module.exports = TwitchAuth;
