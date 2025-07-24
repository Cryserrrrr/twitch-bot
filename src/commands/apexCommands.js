class ApexCommands {
  constructor() {
    // This class will be used by the CommandManager
    // The actual commands are handled directly in the CommandManager
  }

  // Utility methods for Apex commands
  async getRank(apexManager) {
    return await apexManager.getRank();
  }
}

module.exports = ApexCommands;
