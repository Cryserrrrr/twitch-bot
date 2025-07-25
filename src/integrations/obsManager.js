const OBSWebSocket = require("obs-websocket-js").default;
const fs = require("fs");
const path = require("path");
const Translator = require("../utils/translator");

class OBSManager {
  constructor() {
    // Check if OBS environment variables are defined
    this.enabled = this.checkOBSConfig();

    if (!this.enabled) {
      return;
    }

    this.obs = new OBSWebSocket();
    this.connected = false;
    this.mediaSources = new Map();
    this.translator = new Translator();

    this.setupEventHandlers();
  }

  checkOBSConfig() {
    const requiredVars = ["OBS_HOST", "OBS_PORT", "OBS_PASSWORD"];
    const missingVars = requiredVars.filter((varName) => !process.env[varName]);

    if (missingVars.length > 0) {
      return false;
    }

    return true;
  }

  setupEventHandlers() {
    if (!this.enabled) return;

    this.obs.on("ConnectionOpened", () => {
      // Connection opened silently
    });

    this.obs.on("ConnectionClosed", () => {
      this.connected = false;
    });

    this.obs.on("ConnectionError", (error) => {
      console.error("❌ OBS connection error:", error);
      this.connected = false;
    });

    this.obs.on("Identified", () => {
      this.connected = true;
    });
  }

  async connect() {
    if (!this.enabled) {
      return false;
    }

    try {
      const host = process.env.OBS_HOST || "localhost";
      const port = parseInt(process.env.OBS_PORT) || 4455;
      const password = process.env.OBS_PASSWORD || "";

      await this.obs.connect(`ws://${host}:${port}`, password);

      // Load existing media sources
      await this.loadMediaSources();

      return true;
    } catch (error) {
      console.error("❌ Error connecting to OBS:", error);
      return false;
    }
  }

  async disconnect() {
    if (!this.enabled) return;

    try {
      await this.obs.disconnect();
      this.connected = false;
    } catch (error) {
      console.error("❌ Error disconnecting from OBS:", error);
    }
  }

  async loadMediaSources() {
    if (!this.enabled) return;

    try {
      const response = await this.obs.call("GetSceneList");
      const scenes = response.scenes;

      for (const scene of scenes) {
        const sceneItems = await this.obs.call("GetSceneItemList", {
          sceneName: scene.sceneName,
        });

        for (const item of sceneItems.sceneItems) {
          if (item.sourceKind === "ffmpeg_source") {
            this.mediaSources.set(item.sourceName, {
              sceneName: scene.sceneName,
              sourceName: item.sourceName,
            });
          }
        }
      }

      console.log(`📁 ${this.mediaSources.size} media sources found in OBS`);
    } catch (error) {
      console.error(
        this.translator.t("web.obs.errorLoadingMediaSources"),
        error
      );
    }
  }

  async getScenes() {
    if (!this.enabled || !this.connected) {
      return [];
    }

    try {
      const response = await this.obs.call("GetSceneList");
      return response.scenes.map((scene) => scene.sceneName);
    } catch (error) {
      console.error(this.translator.t("web.obs.errorRetrievingScenes"), error);
      return [];
    }
  }

  async getSources() {
    if (!this.enabled || !this.connected) {
      return [];
    }

    try {
      const response = await this.obs.call("GetInputList");
      return response.inputs.map((input) => ({
        name: input.inputName,
        kind: input.inputKind,
      }));
    } catch (error) {
      console.error(this.translator.t("web.obs.errorRetrievingSources"), error);
      return [];
    }
  }

  async getStreamingStatus() {
    if (!this.enabled || !this.connected) {
      return { streaming: false, recording: false };
    }

    try {
      const response = await this.obs.call("GetStreamStatus");
      return {
        streaming: response.outputActive,
        recording: false, // To implement if needed
      };
    } catch (error) {
      console.error(
        this.translator.t("web.obs.errorRetrievingStreamStatus"),
        error
      );
      return { streaming: false, recording: false };
    }
  }

  async startStream() {
    if (!this.enabled) {
      return this.translator.t("web.obs.integrationDisabled");
    }

    if (!this.connected) {
      return this.translator.t("web.obs.notConnected");
    }

    try {
      await this.obs.call("StartStream");
      return this.translator.t("web.obs.streamStarted");
    } catch (error) {
      console.error(this.translator.t("web.obs.errorStartingStream"), error);
      return this.translator.t("web.obs.errorStartingStreamMessage");
    }
  }

  async stopStream() {
    if (!this.enabled) {
      return this.translator.t("web.obs.integrationDisabled");
    }

    if (!this.connected) {
      return this.translator.t("web.obs.notConnected");
    }

    try {
      await this.obs.call("StopStream");
      return this.translator.t("web.obs.streamStopped");
    } catch (error) {
      console.error(this.translator.t("web.obs.errorStoppingStream"), error);
      return this.translator.t("web.obs.errorStoppingStreamMessage");
    }
  }

  async switchScene(sceneName) {
    if (!this.enabled) {
      return this.translator.t("web.obs.integrationDisabled");
    }

    if (!this.connected) {
      return this.translator.t("web.obs.notConnected");
    }

    try {
      await this.obs.call("SetCurrentProgramScene", { sceneName });
      return this.translator.t("web.obs.sceneChanged", { scene: sceneName });
    } catch (error) {
      console.error(this.translator.t("web.obs.errorChangingScene"), error);
      return this.translator.t("web.obs.errorChangingSceneMessage");
    }
  }

  async toggleSource(sourceName, sceneName = "Scene") {
    if (!this.enabled) {
      return this.translator.t("web.obs.integrationDisabled");
    }

    if (!this.connected) {
      return this.translator.t("web.obs.notConnected");
    }

    try {
      const sceneItems = await this.obs.call("GetSceneItemList", { sceneName });
      const item = sceneItems.sceneItems.find(
        (item) => item.sourceName === sourceName
      );

      if (!item) {
        return this.translator.t("web.obs.sourceNotFound", {
          source: sourceName,
          scene: sceneName,
        });
      }

      await this.obs.call("SetSceneItemEnabled", {
        sceneName,
        sceneItemId: item.sceneItemId,
        sceneItemEnabled: !item.sceneItemEnabled,
      });

      return this.translator.t("web.obs.sourceToggled", {
        source: sourceName,
        status: item.sceneItemEnabled ? "disabled" : "enabled",
      });
    } catch (error) {
      console.error(this.translator.t("web.obs.errorTogglingSource"), error);
      return this.translator.t("web.obs.errorTogglingSourceMessage");
    }
  }

  isConnected() {
    return this.enabled && this.connected;
  }

  // Method to check integration status
  getStatus() {
    return {
      enabled: this.enabled,
      connected: this.connected,
    };
  }
}

module.exports = OBSManager;
