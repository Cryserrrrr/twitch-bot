"use strict";

const { WebSocketServer } = require("ws");

const config = require("../core/config");
const logger = require("../core/logger").child("realtime");
const rootLogger = require("../core/logger");
const session = require("./session");

const CHAT_BUFFER = 100;
const ACTIVITY_BUFFER = 50;
const STATUS_INTERVAL = 5000;

/**
 * Pushes chat, events, status and logs to the dashboard over a single socket.
 * The old interface polled a handful of REST endpoints on a timer; this keeps
 * the UI live without hammering the bot.
 */
class Realtime {
  constructor(bot) {
    this.bot = bot;
    this.wss = null;
    this.clients = new Set();
    this.chatBuffer = [];
    this.activityBuffer = [];
  }

  attach(server) {
    this.wss = new WebSocketServer({ noServer: true });

    server.on("upgrade", (request, socket, head) => {
      const url = new URL(request.url, "http://localhost");
      if (url.pathname !== "/ws") {
        socket.destroy();
        return;
      }

      const token = url.searchParams.get("token");
      const user = config.web.authEnabled
        ? session.verify(token)
        : { login: config.bot.channel, role: "broadcaster" };

      if (!user) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      this.wss.handleUpgrade(request, socket, head, (ws) => {
        this.register(ws, user);
      });
    });

    this.bindSources();
  }

  register(ws, user) {
    ws.user = user;
    ws.isAlive = true;
    this.clients.add(ws);

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("close", () => this.clients.delete(ws));
    ws.on("error", () => this.clients.delete(ws));

    // Give the freshly connected client the current picture straight away.
    this.sendTo(ws, "snapshot", {
      status: this.bot.getStatus(),
      chat: this.chatBuffer,
      activity: this.activityBuffer,
    });

    logger.debug(`Dashboard connected: ${user.login}`);
  }

  bindSources() {
    this.bot.on("chat", (message) => {
      this.chatBuffer.push(message);
      if (this.chatBuffer.length > CHAT_BUFFER) this.chatBuffer.shift();
      this.broadcast("chat", message);
    });

    this.bot.on("activity", (activity) => {
      this.activityBuffer.unshift(activity);
      if (this.activityBuffer.length > ACTIVITY_BUFFER) this.activityBuffer.pop();
      this.broadcast("activity", activity);
    });

    this.bot.on("status", () => {
      this.broadcast("status", this.bot.getStatus());
    });

    this.bot.on("track", (track) => this.broadcast("track", track));

    rootLogger.on("entry", (entry) => this.broadcast("log", entry));

    this.heartbeat = setInterval(() => {
      for (const client of this.clients) {
        if (!client.isAlive) {
          client.terminate();
          this.clients.delete(client);
          continue;
        }
        client.isAlive = false;
        client.ping();
      }
    }, 30000);

    // Safety net behind the event-driven updates: it keeps the service
    // indicators honest even if a subsystem changes state without notifying,
    // and it is what makes the uptime counter tick.
    this.statusTicker = setInterval(() => {
      if (this.clients.size) this.broadcast("status", this.bot.getStatus());
    }, STATUS_INTERVAL);
  }

  sendTo(ws, type, payload) {
    if (ws.readyState !== ws.OPEN) return;
    ws.send(JSON.stringify({ type, payload }));
  }

  broadcast(type, payload) {
    if (!this.clients.size) return;
    const frame = JSON.stringify({ type, payload });
    for (const client of this.clients) {
      if (client.readyState === client.OPEN) client.send(frame);
    }
  }

  getChatBuffer() {
    return this.chatBuffer;
  }

  close() {
    if (this.heartbeat) clearInterval(this.heartbeat);
    if (this.statusTicker) clearInterval(this.statusTicker);
    for (const client of this.clients) client.terminate();
    this.clients.clear();
    this.wss?.close();
  }
}

module.exports = Realtime;
