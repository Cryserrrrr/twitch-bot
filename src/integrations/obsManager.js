"use strict";

const { EventEmitter } = require("events");
const OBSWebSocket = require("obs-websocket-js").default;

const config = require("../core/config");
const logger = require("../core/logger").child("obs");

const MAX_RECONNECT_DELAY = 120000;

/**
 * OBS Studio control over obs-websocket.
 *
 * OBS is usually offline while the bot boots, so a failed connection is a debug
 * detail, not an error, and the manager keeps retrying quietly in the
 * background instead of printing a stack trace on every attempt.
 */
class OBSManager extends EventEmitter {
  constructor() {
    super();
    this.enabled = config.obs.enabled;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.stopped = false;
    this.currentScene = null;
    this.streaming = false;

    if (!this.enabled) return;

    this.obs = new OBSWebSocket();
    this.bindEvents();
  }

  isConnected() {
    return this.enabled && this.connected;
  }

  getStatus() {
    return {
      enabled: this.enabled,
      connected: this.connected,
      streaming: this.streaming,
      currentScene: this.currentScene,
    };
  }

  bindEvents() {
    this.obs.on("ConnectionClosed", () => {
      const wasConnected = this.connected;
      this.connected = false;
      if (wasConnected) {
        logger.warn("OBS connection lost");
        this.emit("disconnected");
      }
      this.scheduleReconnect();
    });

    this.obs.on("Identified", () => {
      this.connected = true;
      this.reconnectAttempts = 0;
      logger.info(`Connected to OBS at ${config.obs.host}:${config.obs.port}`);
      this.emit("connected");
      this.refreshState().catch(() => {});
    });

    this.obs.on("CurrentProgramSceneChanged", ({ sceneName }) => {
      this.currentScene = sceneName;
      this.emit("scene", sceneName);
    });

    this.obs.on("StreamStateChanged", ({ outputActive }) => {
      this.streaming = outputActive;
      this.emit("streaming", outputActive);
    });

    // obs-websocket-js emits this on every failed attempt; keep it quiet.
    this.obs.on("ConnectionError", (error) => {
      logger.debug("OBS connection error", error);
    });
  }

  async connect() {
    if (!this.enabled || this.stopped) return false;
    this.clearReconnectTimer();

    try {
      await this.obs.connect(
        `ws://${config.obs.host}:${config.obs.port}`,
        config.obs.password
      );
      return true;
    } catch (error) {
      if (this.reconnectAttempts === 0) {
        logger.info(
          `OBS is unreachable at ${config.obs.host}:${config.obs.port}, retrying in the background`
        );
      }
      this.scheduleReconnect();
      return false;
    }
  }

  scheduleReconnect() {
    if (this.stopped || this.reconnectTimer || !this.enabled) return;

    this.reconnectAttempts += 1;
    const delay = Math.min(
      5000 * 2 ** Math.min(this.reconnectAttempts - 1, 5),
      MAX_RECONNECT_DELAY
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  async refreshState() {
    if (!this.isConnected()) return;

    try {
      const [scene, stream] = await Promise.all([
        this.obs.call("GetCurrentProgramScene"),
        this.obs.call("GetStreamStatus"),
      ]);
      this.currentScene = scene.currentProgramSceneName;
      this.streaming = stream.outputActive;
    } catch (error) {
      logger.debug("Could not read the OBS state", error);
    }
  }

  async getScenes() {
    if (!this.isConnected()) return [];

    try {
      const { scenes, currentProgramSceneName } = await this.obs.call(
        "GetSceneList"
      );
      this.currentScene = currentProgramSceneName;
      return scenes.map((scene) => scene.sceneName).reverse();
    } catch (error) {
      logger.warn("Could not list OBS scenes", error);
      return [];
    }
  }

  async getStreamingStatus() {
    if (!this.isConnected()) return { streaming: false, recording: false };

    try {
      const [stream, record] = await Promise.all([
        this.obs.call("GetStreamStatus"),
        this.obs.call("GetRecordStatus"),
      ]);
      this.streaming = stream.outputActive;
      return {
        streaming: stream.outputActive,
        recording: record.outputActive,
        duration: stream.outputDuration,
      };
    } catch (error) {
      logger.debug("Could not read the OBS stream status", error);
      return { streaming: false, recording: false };
    }
  }

  async switchScene(sceneName) {
    if (!this.isConnected()) throw new Error("OBS is not connected");
    await this.obs.call("SetCurrentProgramScene", { sceneName });
    this.currentScene = sceneName;
    return true;
  }

  async setStreaming(active) {
    if (!this.isConnected()) throw new Error("OBS is not connected");
    await this.obs.call(active ? "StartStream" : "StopStream");
    return true;
  }

  async stop() {
    this.stopped = true;
    this.clearReconnectTimer();
    if (this.enabled && this.connected) {
      try {
        await this.obs.disconnect();
      } catch {
        // Already closed.
      }
    }
    this.connected = false;
  }
}

module.exports = OBSManager;
