class SpotifyCommands {
  constructor() {
    // This class will be used by the CommandManager
    // The actual commands are handled directly in the CommandManager
  }

  // Utility methods for Spotify commands
  async getCurrentSong(spotifyManager) {
    return await spotifyManager.getCurrentSong();
  }

  async requestSong(spotifyManager, spotifyUrl, username) {
    return await spotifyManager.requestSong(spotifyUrl, username);
  }
}

module.exports = SpotifyCommands;
