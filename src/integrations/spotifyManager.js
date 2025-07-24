const SpotifyWebApi = require("spotify-web-api-node");
const Translator = require("../utils/translator");

class SpotifyManager {
  constructor() {
    this.spotifyApi = new SpotifyWebApi({
      clientId: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
      redirectUri: process.env.SPOTIFY_REDIRECT_URI,
    });

    this.isAuthenticated = false;
    this.currentTrack = null;
    this.lastUpdate = 0;
    this.updateInterval = null;
    this.translator = new Translator();
  }

  async initialize() {
    try {
      if (process.env.SPOTIFY_REFRESH_TOKEN) {
        // Set refresh token before using it
        this.spotifyApi.setRefreshToken(process.env.SPOTIFY_REFRESH_TOKEN);
        await this.refreshAccessToken();
        this.startTrackUpdate();
      } else {
        console.log(this.translator.t("spotify.tokenNotConfigured"));
      }
    } catch (error) {
      console.error(this.translator.t("spotify.errorInitialization"), error);
    }
  }

  async refreshAccessToken() {
    try {
      const data = await this.spotifyApi.refreshAccessToken();
      this.spotifyApi.setAccessToken(data.body["access_token"]);
      this.isAuthenticated = true;

      // Schedule next refresh (1 hour)
      setTimeout(() => {
        this.refreshAccessToken();
      }, 3500000); // 58 minutes
    } catch (error) {
      console.error(this.translator.t("spotify.errorRefreshingToken"), error);
      this.isAuthenticated = false;
    }
  }

  async getCurrentSong() {
    if (!this.isAuthenticated) {
      return this.translator.t("spotify.notConnected");
    }

    try {
      const response = await this.spotifyApi.getMyCurrentPlayingTrack();

      if (!response.body.item) {
        return this.translator.t("spotify.noMusicPlaying");
      }

      const track = response.body.item;
      const artists = track.artists.map((artist) => artist.name).join(", ");

      this.currentTrack = {
        name: track.name,
        artists: artists,
        album: track.album.name,
        url: track.external_urls.spotify,
        duration: track.duration_ms,
        progress: response.body.progress_ms,
      };

      return this.translator.t("spotify.currentSong", {
        song: track.name,
        artists: artists,
        album: track.album.name,
      });
    } catch (error) {
      console.error(this.translator.t("spotify.errorRetrievingSong"), error);
      return this.translator.t("spotify.errorRetrievingSongMessage");
    }
  }

  async requestSong(spotifyUrl, username) {
    if (!this.isAuthenticated) {
      return this.translator.t("spotify.notConnected");
    }

    try {
      // Extract track ID from Spotify URL
      const trackId = this.extractTrackId(spotifyUrl);
      if (!trackId) {
        return this.translator.t("spotify.invalidUrl");
      }

      // Get track information
      const trackInfo = await this.spotifyApi.getTrack(trackId);
      const track = trackInfo.body;
      const artists = track.artists.map((artist) => artist.name).join(", ");

      // Add to queue
      try {
        await this.spotifyApi.addToQueue(`spotify:track:${trackId}`);
        return this.translator.t("spotify.songAddedToQueue", {
          song: track.name,
          artists: artists,
          username: username,
        });
      } catch (queueError) {
        console.error(
          this.translator.t("spotify.errorAddingToQueue"),
          queueError
        );
        return this.translator.t("spotify.unableToAddToQueue", {
          song: track.name,
          artists: artists,
        });
      }
    } catch (error) {
      console.error(this.translator.t("spotify.errorRequestingSong"), error);
      return this.translator.t("spotify.errorRequestingSongMessage");
    }
  }

  extractTrackId(spotifyUrl) {
    // Support for different Spotify URL formats
    const patterns = [
      /spotify\.com\/intl-[a-z]{2}\/track\/([a-zA-Z0-9]+)/,
      /spotify\.com\/track\/([a-zA-Z0-9]+)/,
      /spotify:track:([a-zA-Z0-9]+)/,
    ];

    for (const pattern of patterns) {
      const match = spotifyUrl.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  async searchTrack(query) {
    if (!this.isAuthenticated) {
      return null;
    }

    try {
      const response = await this.spotifyApi.searchTracks(query, { limit: 1 });

      if (response.body.tracks.items.length > 0) {
        return response.body.tracks.items[0];
      }

      return null;
    } catch (error) {
      console.error(this.translator.t("spotify.errorSearchingTrack"), error);
      return null;
    }
  }

  startTrackUpdate() {
    // Update current song every 30 seconds
    this.updateInterval = setInterval(async () => {
      if (this.isAuthenticated) {
        await this.getCurrentSong();
      }
    }, 30000);
  }

  stopTrackUpdate() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  getCurrentTrackInfo() {
    return this.currentTrack;
  }

  // Method to generate authorization link (for initial configuration)
  getAuthorizationUrl() {
    const scopes = [
      "user-read-currently-playing",
      "user-read-playback-state",
      "user-modify-playback-state",
      "user-read-private",
    ];

    // Use custom redirect URI
    const redirectUri =
      process.env.SPOTIFY_REDIRECT_URI ||
      "https://127.0.0.1:3000/callback/spotify";
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${
      process.env.SPOTIFY_CLIENT_ID
    }&response_type=code&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&scope=${encodeURIComponent(scopes.join(" "))}`;

    return authUrl;
  }

  // Method to exchange authorization code for token
  async handleAuthorizationCode(code) {
    try {
      const data = await this.spotifyApi.authorizationCodeGrant(code);

      this.spotifyApi.setAccessToken(data.body["access_token"]);
      this.spotifyApi.setRefreshToken(data.body["refresh_token"]);

      this.isAuthenticated = true;

      return {
        accessToken: data.body["access_token"],
        refreshToken: data.body["refresh_token"],
        expiresIn: data.body["expires_in"],
      };
    } catch (error) {
      console.error(
        this.translator.t("spotify.errorExchangingAuthCode"),
        error
      );
      throw error;
    }
  }

  // Method to check connection status
  isConnected() {
    return this.isAuthenticated;
  }

  // Method to cleanup resources
  cleanup() {
    this.stopTrackUpdate();
    this.isAuthenticated = false;
  }
}

module.exports = SpotifyManager;
