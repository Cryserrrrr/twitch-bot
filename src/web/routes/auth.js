"use strict";

const express = require("express");
const axios = require("axios");

const config = require("../../core/config");
const logger = require("../../core/logger").child("web:auth");
const tokenManager = require("../../auth/twitchTokenManager");
const session = require("../session");
const { authenticate, route } = require("../middleware");

const SIGNIN_SCOPES = ["user:read:email"];

/**
 * Two distinct OAuth flows share this callback:
 *
 *  - "signin" lets the broadcaster or a moderator open the dashboard. It asks
 *    for a single scope and never touches the bot credentials.
 *  - "bot" grants the full scope set and stores the token the bot runs on.
 *    It is only accepted for the channel owner.
 *
 * Keeping them apart means a moderator signing in cannot overwrite the token
 * the bot uses to speak in chat.
 */
function resolveRedirect(page = "") {
  return `${config.publicUrl}/${page}`;
}

function htmlRedirect(res, url, message) {
  res.set("Content-Type", "text/html; charset=utf-8").send(
    `<!doctype html><html lang="fr"><head><meta charset="utf-8">
     <title>${message}</title>
     <meta http-equiv="refresh" content="1;url=${url}">
     <style>body{font-family:system-ui,sans-serif;background:#0b0b12;color:#e7e7f0;
     display:grid;place-items:center;height:100vh;margin:0}</style></head>
     <body><p>${message}</p></body></html>`
  );
}

module.exports = function authRoutes(bot) {
  const router = express.Router();

  async function resolveRole(user) {
    if (user.login.toLowerCase() === config.bot.channel) return "broadcaster";
    if (await bot.database.isModerator(user.id)) return "moderator";
    return null;
  }

  router.get("/auth/config", (req, res) => {
    res.json({
      authEnabled: config.web.authEnabled,
      configured: Boolean(config.twitch.clientId && config.twitch.clientSecret),
      channel: config.bot.channel,
      botConnected: tokenManager.isReady(),
      botAccount: tokenManager.user?.login || null,
    });
  });

  router.get("/auth/login", (req, res) => {
    const mode = req.query.mode === "bot" ? "bot" : "signin";
    const state = session.createState({ mode });

    if (mode === "bot") {
      return res.json({ url: tokenManager.getAuthorizationUrl(state) });
    }

    const params = new URLSearchParams({
      client_id: config.twitch.clientId,
      redirect_uri: config.twitch.redirectUri,
      response_type: "code",
      scope: SIGNIN_SCOPES.join(" "),
      state,
    });

    res.json({ url: `https://id.twitch.tv/oauth2/authorize?${params}` });
  });

  router.get("/auth/me", authenticate, (req, res) => {
    res.json({ user: req.user });
  });

  router.post("/auth/twitch/disconnect", authenticate, route(async (req, res) => {
    if (req.user.role !== "broadcaster") {
      return res.status(403).json({ error: "insufficient_permissions" });
    }
    await tokenManager.disconnect();
    await bot.chat.stop();
    res.json({ ok: true });
  }));

  /** Shared OAuth callback for both flows. */
  const callback = route(async (req, res) => {
    const { code, error, state } = req.query;

    if (error) {
      logger.warn(`Twitch authorization refused: ${error}`);
      return htmlRedirect(res, resolveRedirect(), "Autorisation refusée");
    }

    const parsed = session.verifyState(state);
    if (!code || !parsed) {
      return htmlRedirect(res, resolveRedirect(), "Requête invalide");
    }

    if (parsed.mode === "bot") {
      const user = await tokenManager.exchangeCode(code);

      if (user.login.toLowerCase() !== config.bot.channel) {
        await tokenManager.disconnect();
        logger.warn(
          `Refused bot credentials from ${user.login}, expected ${config.bot.channel}`
        );
        return htmlRedirect(res, resolveRedirect(), "Mauvais compte Twitch");
      }

      const token = session.create({
        id: user.id,
        login: user.login,
        displayName: user.display_name,
        avatar: user.profile_image_url,
        role: "broadcaster",
      });

      return htmlRedirect(
        res,
        `${resolveRedirect()}#/auth?token=${token}`,
        "Compte connecté, redirection…"
      );
    }

    // Sign-in flow: exchange the code without touching the bot token.
    const { data: grant } = await axios.post(
      "https://id.twitch.tv/oauth2/token",
      null,
      {
        params: {
          client_id: config.twitch.clientId,
          client_secret: config.twitch.clientSecret,
          code,
          grant_type: "authorization_code",
          redirect_uri: config.twitch.redirectUri,
        },
        timeout: 10000,
      }
    );

    const { data: users } = await axios.get("https://api.twitch.tv/helix/users", {
      headers: {
        Authorization: `Bearer ${grant.access_token}`,
        "Client-Id": config.twitch.clientId,
      },
      timeout: 10000,
    });

    const user = users.data?.[0];
    if (!user) return htmlRedirect(res, resolveRedirect(), "Compte introuvable");

    const role = await resolveRole(user);
    if (!role) {
      logger.warn(`Dashboard access denied for ${user.login}`);
      return htmlRedirect(
        res,
        `${resolveRedirect()}#/auth?denied=1`,
        "Accès refusé"
      );
    }

    const token = session.create({
      id: user.id,
      login: user.login,
      displayName: user.display_name,
      avatar: user.profile_image_url,
      role,
    });

    logger.info(`Dashboard sign-in: ${user.login} (${role})`);
    return htmlRedirect(
      res,
      `${resolveRedirect()}#/auth?token=${token}`,
      "Connexion réussie, redirection…"
    );
  });

  return { router, callback };
};
