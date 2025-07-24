class OBSCommands {
  constructor() {
    // This class will be used by the CommandManager
    // The actual commands are handled directly in the CommandManager
  }

  // Utility methods for OBS commands

  async switchScene(obsManager, sceneName) {
    return await obsManager.switchScene(sceneName);
  }

  async toggleSource(obsManager, sourceName, sceneName) {
    return await obsManager.toggleSource(sourceName, sceneName);
  }

  async startStream(obsManager) {
    return await obsManager.startStream();
  }

  async stopStream(obsManager) {
    return await obsManager.stopStream();
  }
}

module.exports = OBSCommands;
