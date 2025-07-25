module.exports = {
  // Bot messages
  bot: {
    connected: "Connected to Twitch",
    disconnected: "Disconnected from Twitch",
    commandError: "An error occurred while executing the command",
    unknownCommand: "Unknown command. Type !help to see available commands",
    ping: "Pong! 🏓",
    help: "Available commands: !ping, !dice, !flip, !song, !request, !apexrank",
    moderatorCommands:
      " | Moderator: !addcom, !delcom, !title, !category, !timeout, !ban, !unban, !delete, !commercial, !snooze",
    streamerCommands: " | Streamer: !sound",
    customCommands: " | Custom commands:",
    nextSteps: "Next steps:",
    startBot: "You can now start the bot with: npm start",
  },

  // Commands
  commands: {
    addcom: {
      usage: "Usage: !addcom name content",
      success: "Command !{name} added successfully!",
      error: "Error adding command",
    },
    delcom: {
      usage: "Usage: !delcom name",
      success: "Command !{name} deleted successfully!",
      notFound: "Command !{name} not found",
      error: "Error deleting command",
    },
    editcom: {
      usage: "Usage: !editcom name new_content",
      success: "Command !{name} edited successfully!",
      notFound: "Command !{name} not found",
      error: "Error editing command",
    },
    dice: {
      result: "🎲 {username} rolled a {result}",
    },
    flip: {
      result: "🪙 {username} flipped {result}",
    },
    song: {
      current: "🎵 Currently playing: {song}",
      notPlaying: "No song currently playing",
    },
    request: {
      success: "Song '{song}' added to the queue!",
      error: "Error adding song to queue",
    },
    apexrank: {
      result: "🏆 {username} {result}",
    },
    title: {
      success: 'Stream title changed to: "{title}"',
      error:
        "Failed to change stream title. Please authenticate through the web interface first.",
      usage: "Usage: !title new_stream_title (Moderators only)",
    },
    category: {
      success: 'Stream category changed to: "{category}"',
      error:
        "Failed to change stream category. Please authenticate through the web interface first.",
      usage: "Usage: !category category_name (Moderators only)",
    },
    timeout: {
      usage:
        "Usage: !timeout <username> <duration_in_seconds> [reason] (Moderators only)",
      success: "Timeout executed: {username} for {duration} seconds - {reason}",
      error: "Error executing timeout for {username}: {error}",
      invalidDuration:
        "Invalid duration. Please provide a positive number of seconds.",
    },
    ban: {
      usage: "Usage: !ban <username> [reason] (Moderators only)",
      success: "Ban executed: {username} - {reason}",
      error: "Error executing ban for {username}: {error}",
    },
    unban: {
      usage: "Usage: !unban <username> (Moderators only)",
      success: "Unban executed: {username}",
      error: "Error executing unban for {username}: {error}",
    },
    delete: {
      usage: "Usage: !delete <username> (Moderators only)",
      success: "Message deleted for {username}",
      error: "Error deleting message for {username}: {error}",
    },
    commercial: {
      usage: "Usage: !commercial [length] (Moderators only, 30-180 seconds)",
      success: "Commercial started successfully for {length} seconds",
      error:
        "Failed to start commercial. Please authenticate through the web interface first.",
      invalidLength:
        "Invalid length. Please provide a number between 30 and 180 seconds.",
    },
    snooze: {
      usage: "Usage: !snooze (Moderators only)",
      success: "Next ad has been snoozed successfully",
      error:
        "Failed to snooze next ad. Please authenticate through the web interface first.",
    },
  },

  // Events
  events: {
    welcome: [
      "Welcome {username} to the chat! 👋",
      "Hey {username}, glad to see you here! 🎉",
      "Welcome {username}! Hope you enjoy the stream! ✨",
    ],
    subscription: [
      "Thank you {username} for subscribing! 🎉",
      "Welcome to the family {username}! 💜",
      "Amazing! {username} just subscribed! 🚀",
    ],
    resub: [
      "Thank you {username} for resubscribing for {months} month(s)! 🎉",
      "Welcome back {username}! {months} month(s) of support! 💜",
      "Incredible! {username} resubscribed for {months} month(s)! 🚀",
    ],
    giftSub: [
      "Thank you {username} for gifting a sub to {recipient}! 🎁",
      "Amazing gift from {username} to {recipient}! 🎉",
      "What a generous gift! {username} gifted to {recipient}! 💜",
    ],
    bits: [
      "Thank you {username} for {amount} bits! 💎",
      "Amazing! {username} just cheered {amount} bits! 🎉",
      "Incredible support! {username} donated {amount} bits! 💎",
    ],
    raid: [
      "Thank you {username} for raiding with {viewers} viewers! 🚀",
      "Amazing raid from {username} with {viewers} viewers! 🎉",
      "Welcome raiders! {username} brought {viewers} viewers! 🚀",
    ],
    follow: [
      "Thank you {username} for the follow! 💜",
      "Welcome {username}! Thanks for the follow! 🎉",
      "Amazing! {username} just followed! ✨",
    ],
    // Error messages for event processing
    errorProcessingSub: "Error processing subscription",
    errorProcessingResub: "Error processing resubscription",
    errorProcessingGiftSub: "Error processing gift subscription",
    errorProcessingBits: "Error processing bits",
    errorProcessingRaid: "Error processing raid",
    errorProcessingFollow: "Error processing follow",
    errorCleaningGreetedUsers: "Error cleaning greeted users",
    // Default fallback messages
    defaultSubMessage: "Thank you {username} for subscribing! 💜",
    defaultResubMessage: "Thank you {username} for resubscribing! 💜",
    defaultGiftSubMessage:
      "Thank you {username} for gifting a sub to {recipient}! 💜",
    defaultBitsMessage: "Thank you {username} for {amount} bits! 💜",
    defaultRaidMessage:
      "Thank you {username} for raiding with {viewers} viewers! 💜",
    defaultFollowMessage: "Thank you {username} for following! 💜",
    // Month formatting
    oneMonth: "1 month",
    multipleMonths: "{months} months",
  },

  // Moderation
  moderation: {
    bannedWord: "Banned word detected: {word}",
    unauthorizedLink: "Unauthorized link: {domain}",
    suspiciousLink: "Suspicious link detected",
    spamRepeated: "Spam detected (repeated characters)",
    spamWords: "Spam detected (repeated words)",
    timeout: "You have been timed out for {duration} seconds",
    banned: "You have been banned",
    wordAdded: "Banned word '{word}' added successfully",
    wordRemoved: "Banned word '{word}' removed successfully",
    wordUpdated: "Banned word '{word}' updated successfully",
    linkAdded: "Allowed link '{domain}' added successfully",
    linkRemoved: "Allowed link '{domain}' removed successfully",
    linkUpdated: "Allowed link '{domain}' updated successfully",
    // Messages for moderation manager
    manager: {
      databaseNotInitialized: "Database not initialized",
      errorLoadingData: "Error loading moderation data",
      errorAddingWord: "Error adding banned word",
      errorUpdatingWord: "Error updating banned word",
      errorRemovingWord: "Error removing banned word",
      errorAddingLink: "Error adding allowed link",
      errorRemovingLink: "Error removing allowed link",
      wordUpdatedLog: "✏️ Banned word updated: {word} ({action}, {duration}s)",
    },
  },

  // Web interface
  web: {
    title: "Twitch Bot - Management Interface",
    auth: {
      title: "Twitch Authentication",
      description:
        "Connect with your Twitch account to access the administration interface",
      login: "Sign in with Twitch",
      logout: "Logout",
      note: "Only moderators and the broadcaster can access this interface",
      checking: "Checking authentication...",
      required: "Login required to access the interface",
      notConfigured: "Twitch authentication is not configured",
      serverError:
        "Unable to connect to server. Check that the bot is running.",
      authError: "Error checking authentication",
      loginRequired: "Login required to access interface",
      connecting: "Connecting...",
      checkError: "Error checking authentication",
      loginError: "Error connecting to Twitch",
    },
    common: {
      edit: "Edit",
      delete: "Delete",
      add: "Add",
      refresh: "Refresh",
      actions: "Actions",
    },
    tabs: {
      dashboard: "Dashboard",
      commands: "Commands",
      moderation: "Moderation",
      recurring: "Recurring Messages",
      integrations: "Integrations",
      ads: "Ads Management",
    },
    dashboard: {
      botInfo: "Bot Information",
      channel: "Channel",
      uptime: "Uptime",
      version: "Version",
      sendMessage: "Send a message",
      send: "Send",
      status: {
        connected: "Connected",
        disconnected: "Disconnected",
        connecting: "Connecting...",
      },
    },
    commands: {
      title: "Custom Commands",
      addCommand: "Add a command",
      commandName: "Command name:",
      commandContent: "Command content:",
      command: "Command",
      content: "Content",
      usage: "Usage",
      existingCommands: "Existing commands",
      add: "Add",
      delete: "Delete",
      actions: "Actions",
      success: "Command added successfully!",
      deleted: "Command deleted successfully!",
      confirmDelete: "Are you sure you want to delete the command !{name}?",
      addSuccess: "Command added successfully!",
      editPrompt: "Edit content for command !{name}:",
      editTitle: "Edit Command",
      editSuccess: "Command updated successfully!",
      editError: "Error updating command",
      nameAndContentRequired: "Command name and content are required",
      deleteSuccess: "Command deleted successfully!",
      deleteConfirm: "Are you sure you want to delete the command !{name}?",
      commandNotFound: "Command '{name}' not found",
      commandExists: "A command with this name already exists",
      invalidCommandName: "Invalid command name",
    },
    moderation: {
      bannedWords: "Banned words",
      bannedWordsList: "Banned words list",
      allowedLinks: "Allowed links",
      allowedLinksList: "Allowed links list",
      addBannedWord: "Add Banned Word",
      addAllowedLink: "Add Allowed Link",
      word: "Word",
      domain: "Domain",
      action: "Action",
      duration: "Duration",
      durationSeconds: "Duration (seconds)",
      addedBy: "Added by",
      addedDate: "Added date",
      allowedDomain: "Allowed domain:",
      bannedWord: "Banned word",
      actions: "Actions",
      timeout: "Timeout",
      delete: "Delete",
      success: "Added successfully!",
      deleted: "Deleted successfully!",
      confirmDelete: "Are you sure you want to delete '{item}'?",
      bannedWordAddSuccess: "Banned word added successfully!",
      bannedWordDeleteSuccess: "Banned word deleted successfully!",
      bannedWordDeleteConfirm:
        'Are you sure you want to delete the banned word "{word}"?',
      allowedLinkAddSuccess: "Allowed link added successfully!",
      allowedLinkAddError: "Error adding allowed link",
      allowedLinkDeleteSuccess: "Allowed link deleted successfully!",
      allowedLinkDeleteConfirm:
        'Are you sure you want to delete the allowed link "{domain}"?',
      editActionPrompt: "Enter new action (timeout/delete):",
      editDurationPrompt: "Enter new duration (seconds):",
      invalidDuration: "Invalid duration. Please enter a positive number.",
      editBannedWordTitle: "Edit Banned Word",
      editBannedWordSuccess: "Banned word updated successfully!",
      editBannedWordError: "Error updating banned word",
      wordAndDurationRequired: "Word and duration are required",
      wordNotFound: "Banned word '{word}' not found",
      wordExists: "This banned word already exists",
      invalidWord: "Invalid word",
      invalidAction: "Invalid action (timeout or delete only)",
      durationTooShort: "Duration must be at least 1 second",
      durationTooLong: "Duration cannot exceed 86400 seconds (24h)",
      enabled: "Enabled",
      bannedWordsEnabled: "Banned words moderation enabled",
      bannedWordsDisabled: "Banned words moderation disabled",
      allowedLinksEnabled: "Allowed links moderation enabled",
      allowedLinksDisabled: "Allowed links moderation disabled",
      settingsError: "Error updating moderation settings",
    },
    recurring: {
      title: "Recurring Messages",
      addMessage: "Add a recurring message",
      message: "Message:",
      interval: "Interval (minutes):",
      add: "Add",
      activeMessages: "Active recurring messages",
      status: "Status",
      lastSent: "Last sent",
      actions: "Actions",
      active: "Active",
      inactive: "Inactive",
      edit: "Edit",
      delete: "Delete",
      success: "Recurring message added successfully!",
      updated: "Recurring message updated successfully!",
      deleted: "Recurring message deleted successfully!",
      confirmDelete: "Are you sure you want to delete this recurring message?",
      addSuccess: "Recurring message added successfully!",
      deleteSuccess: "Recurring message deleted successfully!",
      updateSuccess: "Recurring message updated successfully!",
      toggleSuccess: "Recurring message {status} successfully!",
      deleteConfirm: "Are you sure you want to delete this recurring message?",
      editMessage: "New message:",
      editInterval: "New interval (minutes):",
      enabled: "enabled",
      disabled: "disabled",
      never: "Never",
      messageRequired: "Message is required",
      intervalRequired: "Interval is required",
      intervalTooShort: "Interval must be at least 1 minute",
      intervalTooLong: "Interval cannot exceed 1440 minutes (24h)",
      messageNotFound: "Recurring message not found",
      messageExists: "This recurring message already exists",
      // Manager error messages
      errorLoadingMessages: "Error loading recurring messages",
      errorAddingMessage: "Error adding recurring message",
      errorUpdatingMessage: "Error updating recurring message",
      errorDeletingMessage: "Error deleting recurring message",
      messageAdded: "Recurring message added successfully",
      messageUpdated: "Recurring message updated successfully",
      messageDeleted: "Recurring message deleted successfully",
    },
    integrations: {
      spotify: "Spotify",
      obs: "OBS",
      apex: "Apex Legends",
      status: "Status:",
      api: "API:",
      player: "Player:",
      refresh: "Refresh",
      currentSong: "Current song:",
      noSong: "No song currently playing",
      configured: "Configured in .env",
      spotifyAuth: {
        title: "Spotify Authorization",
        step1: "Get authorization URL and open it in your browser",
        step2:
          "After authorization, copy the authorization code from the redirect URL",
        step3: "Paste the authorization code below to get your refresh token",
        autoStep1: "Click the button below to get the authorization URL",
        autoStep2:
          "After authorization, your refresh token will be automatically added to your .env file",
        autoNote:
          "The process is now fully automated - no manual copying required!",
        getAuthUrl: "Get Authorization URL",
        openInBrowser: "Open in Browser",
        getRefreshToken: "Get Refresh Token",
        copyToken: "Copy",
        authCodePlaceholder: "Paste authorization code here...",
        refreshTokenLabel: "Refresh Token:",
        redirectUrlNote: "The redirect URL will look like:",
        redirectUrlExample:
          "https://127.0.0.1:3000/callback/spotify?code=XXXXX",
        authUrlGenerated: "Authorization URL generated successfully!",
        authPageOpened: "Authorization page opened in new tab",
        tokenGenerated:
          "Authorization successful! Copy the refresh token to your .env file.",
        tokenCopied: "Refresh token copied to clipboard!",
        errors: {
          generateUrl: "Error generating authorization URL",
          exchangeCode: "Error exchanging authorization code",
          noAuthCode: "Please enter the authorization code",
          noTokenToCopy: "No refresh token to copy",
          generateUrlFirst: "Please generate the authorization URL first",
        },
      },
    },
    common: {
      add: "Add",
      edit: "Edit",
      delete: "Delete",
      save: "Save",
      cancel: "Cancel",
      refresh: "Refresh",
      actions: "Actions",
      confirmDelete: "Confirm Delete",
    },
    status: {
      connected: "Connected",
      disconnected: "Disconnected",
    },
    spotify: {
      noSong: "No song currently playing",
      // Configuration and connection messages
      tokenNotConfigured:
        "⚠️ Spotify token not configured. Spotify commands will not work.",
      notConnected:
        "Spotify not connected. Configure your token in the .env file",
      // Music status messages
      noMusicPlaying: "No music playing right now! The DJ is taking a break 😴",
      currentSong: "🎵 {song} - {artists} | Album: {album}",
      // Song request messages
      invalidUrl: "Invalid Spotify URL. Use a Spotify song link.",
      songAddedToQueue:
        '✅ "{song}" by {artists} added to queue by {username}!',
      unableToAddToQueue:
        '❌ Unable to add "{song}" by {artists} to queue. Spotify is not playing.',
      // Error messages
      errorInitialization: "❌ Error during Spotify initialization",
      errorRefreshingToken: "Error refreshing Spotify token",
      errorRetrievingSong: "Error retrieving current song",
      errorRetrievingSongMessage: "Error retrieving current song",
      errorRequestingSong: "Error requesting song",
      errorRequestingSongMessage:
        "Error requesting song. Check that the URL is valid.",
      errorAddingToQueue: "Error adding to queue",
      errorSearchingTrack: "Error searching for track",
      errorExchangingAuthCode: "Error exchanging authorization code",
    },
    apex: {
      available: "Available",
      unavailable: "Unavailable",
      configured: "Configured in .env",
      // API and configuration messages
      apiKeyRequired:
        "Mozambique API key required. Configure APEX_API_KEY in your .env file",
      playerNotFound: "Player not found. Check username and platform.",
      invalidApiKey: "Invalid Mozambique API key. Check your API key.",
      usernameNotConfigured: "Apex username not configured in .env file",
      // Data messages
      noRankData: "No rank data available",
      noLegendData: "No legend data available",
      noSeasonData: "No season data available",
      legendNotFound: "Legend '{legend}' not found",
      // Stats messages
      rank: "Rank: {rank}",
      legendStats:
        "{legend}: Kills: {kills} | K/D: {kd} | Damage: {damage} | Wins: {wins} ({winRate}%)",
      seasonStats:
        "Current Season | Level: {level} | Kills: {kills} | K/D: {kd} | Damage: {damage} | Wins: {wins} ({winRate}%)",
      // Error messages
      errorGettingRank: "Error getting Apex rank",
      errorGettingLegendStats: "Error getting legend stats",
      errorGettingLegendStatsMessage: "Error getting legend statistics.",
      errorGettingSeasonStats: "Error getting season stats",
      // API status messages
      apiAvailable: "Mozambique API available",
      apiUnavailable: "API unavailable: {status} - {statusText}",
      apiConnectionError: "Unable to contact Mozambique API or invalid API key",
    },
    obs: {
      available: "Available",
      unavailable: "Unavailable",
      configured: "Configured in .env",
      // Integration status messages
      integrationDisabled:
        "OBS integration is disabled - missing environment variables",
      notConnected: "OBS not connected",
      // Stream control messages
      streamStarted: "Stream started successfully",
      streamStopped: "Stream stopped successfully",
      // Scene control messages
      sceneChanged: "Scene changed to '{scene}'",
      // Source control messages
      sourceNotFound: "Source '{source}' not found in scene '{scene}'",
      sourceToggled: "Source '{source}' {status}",
      // Error messages
      errorLoadingMediaSources: "Error loading media sources",
      errorRetrievingScenes: "Error retrieving scenes",
      errorRetrievingSources: "Error retrieving sources",
      errorRetrievingStreamStatus: "Error retrieving streaming status",
      errorStartingStream: "Error starting stream",
      errorStartingStreamMessage: "Error starting stream",
      errorStoppingStream: "Error stopping stream",
      errorStoppingStreamMessage: "Error stopping stream",
      errorChangingScene: "Error changing scene",
      errorChangingSceneMessage: "Error changing scene",
      errorTogglingSource: "Error toggling source",
      errorTogglingSourceMessage: "Error toggling source",
    },
    bot: {
      messageSent: "Message sent!",
    },
    errors: {
      serverCommunication: "Error communicating with server",
      databaseError: "Database error",
      validationError: "Validation error",
      authenticationError: "Authentication error",
      permissionError: "Permission denied",
      notFound: "Resource not found",
      internalError: "Internal server error",
      networkError: "Network error",
      timeoutError: "Request timeout",
    },
    database: {
      errorOpening: "Error opening database",
      errorInsertingDefaultData: "Error inserting default data",
    },
    notifications: {
      error: "Error communicating with server",
      success: "Operation completed successfully",
      info: "Information",
      warning: "Warning",
      loading: "Loading...",
      saving: "Saving...",
      deleting: "Deleting...",
      updating: "Updating...",
      refreshing: "Refreshing...",
    },
    callback: {
      twitch: {
        errorTitle: "Twitch Authentication Error",
        successTitle: "Twitch Authentication Successful",
        accessDeniedTitle: "Access Denied",
        authErrorTitle: "Authentication Error",
        errorMessage: "Error: {error}",
        missingCode: "Authorization code missing",
        noCodeReceived: "No authorization code was received.",
        welcomeMessage: "Welcome, {username}!",
        accessGranted: "You have access to the administration interface.",
        accessDenied:
          "Sorry, you must be a moderator or broadcaster to access this interface.",
        returnToInterface: "Return to interface",
        accessInterface: "Access interface",
      },
      spotify: {
        errorTitle: "Spotify Error",
        successTitle: "Spotify Authorization Successful",
        authErrorTitle: "Spotify Authorization Error",
        errorMessage: "Error: {error}",
        missingCode: "Authorization code missing",
        noCodeReceived: "No authorization code was received.",
        successMessage:
          "Your authorization code has been retrieved successfully.",
        authorizationCode: "Authorization code:",
        copyCode:
          "Copy this code and paste it in your terminal where the setup script is waiting.",
        setupInstructions:
          "If the setup script is no longer running, restart it with: npm run setup",
        returnToInterface: "Return to interface",
        // New automatic callback messages
        autoSuccessMessage:
          "Your Spotify refresh token has been automatically added to your .env file!",
        refreshTokenAdded: "Refresh token added to .env:",
        refreshTokenLabel: "Refresh Token:",
        copyToken: "Copy Token",
        tokenCopied: "Copied!",
        restartRequired:
          "Please restart the bot for the changes to take effect.",
        exchangeError: "Token Exchange Error",
        exchangeErrorMessage:
          "Failed to exchange authorization code for refresh token. Please try again.",
        externalEnvWarning: "External Environment Management",
        externalEnvMessage:
          "If your .env file is managed externally (e.g., Coolify, Docker, or remote server with environment variables), you need to manually add this refresh token to your environment configuration.",
      },
    },
    ads: {
      status: "Ads Status",
      controls: "Ads Controls",
      history: "Ads History",
      commercialLength: "Commercial Length (seconds)",
      startCommercial: "Start Commercial",
      snoozeNextAd: "Snooze Next Ad",
      refreshStatus: "Refresh Status",
      commercialActive: "Commercial Active",
      noActiveCommercial: "No Active Commercial",
      nextAdIn: "Next ad in {minutes} minutes",
      noScheduledAds: "No Scheduled Ads",
      nextBreakIn: "Next break in {minutes} minutes",
      noScheduledBreaks: "No Scheduled Ad Breaks",
      commercialStarted:
        "Commercial started successfully for {seconds} seconds",
      commercialFailed: "Failed to start commercial",
      adSnoozed: "Next ad has been snoozed successfully",
      adSnoozeFailed: "Failed to snooze next ad",
      noRecentActivity: "No recent activity",
    },
  },

  // Setup
  setup: {
    title: "Twitch Bot Setup",
    welcome: "Welcome to the Twitch Bot setup!",
    language: "Language",
    selectLanguage: "Select your preferred language:",
    twitch: {
      title: "Twitch Configuration",
      description: "Configure your Twitch bot credentials",
      username: "Twitch Username",
      oauth: "OAuth Token",
      channel: "Channel Name",
      instructions:
        "1. Go to https://twitchapps.com/tmi/\n2. Generate your OAuth token\n3. Copy the token (starts with oauth:)",
    },
    spotify: {
      title: "Spotify Configuration",
      description: "Configure Spotify integration (optional)",
      clientId: "Client ID",
      clientSecret: "Client Secret",
      redirectUri: "Redirect URI",
      instructions:
        "1. Go to https://developer.spotify.com/dashboard\n2. Create a new application\n3. Add /callback/spotify to Redirect URIs (localhost:3000)",
    },
    apex: {
      title: "Apex Legends Configuration",
      description: "Configure Apex Legends API (optional)",
      apiKey: "API Key",
      playerName: "Player Name",
      platform: "Platform",
      instructions:
        "1. Go to https://apexlegendsapi.com/\n2. Get your API key\n3. Enter your player name and platform",
    },
    obs: {
      title: "OBS Configuration",
      description: "Configure OBS WebSocket connection (optional)",
      host: "Host",
      port: "Port",
      password: "Password",
      instructions:
        "1. Enable WebSocket in OBS (Tools > WebSocket Server Settings)\n2. Configure password if needed",
    },
    web: {
      title: "Web Interface Configuration",
      description: "Configure the web management interface",
      port: "Port",
      authEnabled: "Enable authentication",
      instructions: "Configure the web interface port and authentication",
    },
    complete: "Setup completed successfully!",
    startBot: "You can now start the bot with: npm start",
  },
};
