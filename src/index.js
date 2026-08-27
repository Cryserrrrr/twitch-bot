"use strict";

require("dotenv").config();

const config = require("./core/config");
const logger = require("./core/logger");
const Bot = require("./core/bot");
const WebServer = require("./web/server");
const OverlayServer = require("./web/overlayServer");

logger.setLevel(config.logLevel);

const log = logger.child("startup");

async function main() {
  const missing = config.validate();
  if (missing.length) {
    log.error(`Missing configuration: ${missing.join(", ")}`);
    log.error("Copy env.example to .env and fill it in, then start again");
    process.exit(1);
  }

  const bot = new Bot();
  await bot.initialize();

  // Browser sources should keep rendering across a bot restart, so the overlay
  // listener is up before anything that can fail.
  const overlays = new OverlayServer(bot);
  bot.overlayServer = overlays;
  const overlayUrl = await overlays.start();

  // The dashboard comes up before any Twitch call: when the token is dead the
  // only way to fix it is to sign in there, so it must never wait on the bot.
  const web = new WebServer(bot);
  await web.start();

  await bot.launch();

  const status = bot.getStatus();
  logger.banner("Twitch bot", [
    `Channel      #${status.channel}`,
    `Dashboard    ${config.publicUrl}`,
    `Overlays     ${overlayUrl}`,
    `Twitch       ${describeTwitch(status)}`,
    `Chat         ${status.chat.connected ? "connected" : "offline"}`,
    `EventSub     ${status.eventsub.connected ? `${status.eventsub.subscriptions.length} events` : "offline"}`,
    `Spotify      ${describeState(status.spotify)}`,
    `OBS          ${describeState(status.obs)}`,
    `Apex         ${status.apex.enabled ? "configured" : "disabled"}`,
  ]);

  setupShutdown(bot, web, overlays);
}

function describeTwitch(status) {
  if (status.twitch.state === "ready") {
    return `connected as ${status.twitch.user?.login || "unknown"}`;
  }
  if (status.twitch.state === "invalid") return "token expired, sign in again";
  return "not connected, sign in from the dashboard";
}

function describeState(integration) {
  if (!integration.enabled) return "disabled";
  return integration.connected ? "connected" : "offline";
}

function setupShutdown(bot, web, overlays) {
  let stopping = false;

  const shutdown = async (signal) => {
    if (stopping) return;
    stopping = true;

    log.info(`Received ${signal}, shutting down`);
    try {
      await Promise.race([
        Promise.all([bot.stop(), web.stop(), overlays.stop()]),
        new Promise((resolve) => setTimeout(resolve, 5000)),
      ]);
    } catch (error) {
      log.error("Shutdown did not complete cleanly", error);
    }
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  // A rejected promise somewhere in an integration should not take the bot
  // down; it is logged and the process keeps serving the rest.
  process.on("unhandledRejection", (reason) => {
    log.error("Unhandled promise rejection", reason);
  });

  process.on("uncaughtException", (error) => {
    log.error("Uncaught exception", error);
  });
}

main().catch((error) => {
  log.error("Startup failed", error);
  process.exit(1);
});
