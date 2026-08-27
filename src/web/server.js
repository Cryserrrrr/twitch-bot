"use strict";

const fs = require("fs");
const http = require("http");
const https = require("https");
const path = require("path");

const express = require("express");
const helmet = require("helmet");

const config = require("../core/config");
const logger = require("../core/logger").child("web");
const Realtime = require("./realtime");
const { authenticate, errorHandler } = require("./middleware");

const authRoutes = require("./routes/auth");
const systemRoutes = require("./routes/system");
const commandRoutes = require("./routes/commands");
const moderationRoutes = require("./routes/moderation");
const recurringRoutes = require("./routes/recurring");
const integrationRoutes = require("./routes/integrations");
const streamRoutes = require("./routes/stream");
const overlayRoutes = require("./routes/overlays");

const PLACEHOLDER = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>Dashboard non compilé</title>
<style>body{font-family:system-ui,sans-serif;background:#0b0b12;color:#e7e7f0;
display:grid;place-items:center;height:100vh;margin:0;text-align:center}
code{background:#1a1a24;padding:2px 6px;border-radius:4px}</style></head>
<body><div><h1>Dashboard non compilé</h1>
<p>Lance <code>npm run build</code> à la racine du bot, puis recharge cette page.</p>
</div></body></html>`;

/**
 * HTTP layer: REST API, OAuth callbacks, WebSocket feed and the compiled
 * dashboard. Everything under /api requires a signed session except the few
 * endpoints the login screen needs before one exists.
 */
class WebServer {
  constructor(bot) {
    this.bot = bot;
    this.app = express();
    this.server = null;
    this.realtime = new Realtime(bot);
    this.protocol = "http";

    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.disable("x-powered-by");

    // Behind Coolify, Traefik or any other terminating proxy.
    if (config.isProxied) this.app.set("trust proxy", 1);

    // The overlay pages are also served here, key-gated exactly as on the
    // dedicated listener, so the dashboard can frame them without tripping the
    // mixed-content rule. Mounted before helmet on purpose: an overlay is one
    // self-contained file with inline style and script, which the dashboard
    // content security policy would refuse to run.
    this.app.use("/overlay", (req, res) => {
      if (!this.bot.overlayServer) {
        res.status(503).end();
        return;
      }
      this.bot.overlayServer.handleRequest(req, res);
    });

    this.app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "ws:", "wss:"],
            fontSrc: ["'self'", "data:"],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
          },
        },
        // The dashboard loads Twitch and Spotify artwork from their CDNs.
        crossOriginEmbedderPolicy: false,
        crossOriginResourcePolicy: { policy: "cross-origin" },
      })
    );

    this.app.use(express.json({ limit: "100kb" }));
  }

  setupRoutes() {
    const api = express.Router();
    const auth = authRoutes(this.bot);
    const integrations = integrationRoutes(this.bot);

    // Public endpoints ------------------------------------------------------
    api.get("/health", (req, res) => {
      res.json({ ok: true, uptime: process.uptime() });
    });
    api.use(auth.router);

    // Everything past this point needs a session --------------------------
    api.use(authenticate);
    api.use(systemRoutes(this.bot, this.realtime));
    api.use(commandRoutes(this.bot));
    api.use(moderationRoutes(this.bot));
    api.use(recurringRoutes(this.bot));
    api.use(integrations.router);
    api.use(streamRoutes(this.bot));
    api.use(overlayRoutes(this.bot));

    api.use((req, res) => res.status(404).json({ error: "not_found" }));

    this.app.use("/api", api);

    // OAuth callbacks are hit by the provider, not by the dashboard.
    this.app.get(["/callback/twitch", "/auth/callback"], auth.callback);
    this.app.get("/callback/spotify", integrations.spotifyCallback);

    this.app.use(errorHandler);
    this.setupStatic();
  }

  setupStatic() {
    const dir = config.web.dashboardDir;
    const indexFile = path.join(dir, "index.html");

    if (!fs.existsSync(indexFile)) {
      logger.warn("Dashboard build not found, serving the placeholder page");
      this.app.use((req, res) => res.status(200).send(PLACEHOLDER));
      return;
    }

    this.app.use(
      express.static(dir, {
        index: false,
        setHeaders: (res, filePath) => {
          // Hashed asset filenames can be cached hard; index.html cannot.
          if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          }
        },
      })
    );

    // Single page app: every unknown path renders the shell.
    this.app.use((req, res) => res.sendFile(indexFile));
  }

  createServer() {
    const { tlsCert, tlsKey } = config.web;

    if (fs.existsSync(tlsCert) && fs.existsSync(tlsKey)) {
      this.protocol = "https";
      return https.createServer(
        { cert: fs.readFileSync(tlsCert), key: fs.readFileSync(tlsKey) },
        this.app
      );
    }

    // Serving plain HTTP is correct behind a proxy that terminates TLS; on its
    // own it is a problem, because Twitch refuses a non-HTTPS OAuth redirect.
    if (config.isProxied) {
      logger.info("Serving HTTP behind the reverse proxy");
    } else {
      logger.warn(
        "TLS certificates not found, falling back to HTTP - the Twitch login will not work"
      );
    }

    return http.createServer(this.app);
  }

  async start() {
    this.server = this.createServer();
    this.realtime.attach(this.server);

    await new Promise((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(config.web.port, config.web.host, resolve);
    });

    const url = `${this.protocol}://${config.web.host}:${config.web.port}`;
    logger.info(`Dashboard available at ${url}`);
    return url;
  }

  async stop() {
    this.realtime.close();
    if (!this.server) return;
    await new Promise((resolve) => this.server.close(resolve));
  }
}

module.exports = WebServer;
