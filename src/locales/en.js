"use strict";

/**
 * Messages the bot posts in Twitch chat.
 * Arrays are picked from at random so announcements do not repeat verbatim.
 */
module.exports = {
  bot: {
    commandError: "something went wrong while running that command.",
    apiNotReady:
      "the Twitch API is not ready yet, reconnect the account from the dashboard.",
  },

  commands: {
    ping: {
      description: "Check that the bot responds",
      result: "pong.",
    },
    dice: {
      description: "Roll a 100-sided die",
      result: "you rolled {result} out of 100.",
    },
    flip: {
      description: "Heads or tails",
      result: "{result}.",
      heads: "heads",
      tails: "tails",
    },
    help: {
      description: "List the available commands",
      result: "available commands: {commands}",
    },
    song: {
      description: "Show the current track",
      result: "now playing: {song} - {artists} {url}",
      notConnected: "Spotify is not connected.",
      nothingPlaying: "nothing is playing right now.",
    },
    request: {
      description: "Add a track to the queue",
      usage: "usage: !request <Spotify link or title>",
      success: "{song} - {artists} added to the queue.",
      notConnected: "Spotify is not connected.",
      notFound: "no track found for that search.",
      noDevice: "no active Spotify device, start playback first.",
      error: "could not add that track.",
    },
    apexrank: {
      description: "Show the Apex Legends rank",
      result: "{player} is {rank} ({score} RP).",
      notFound: "could not read the rank.",
      disabled: "the Apex integration is not configured.",
    },
    uptime: {
      description: "How long the stream has been live",
      result: "live for {uptime}.",
      offline: "the stream is offline.",
    },
    title: {
      description: "Show or change the stream title",
      current: "current title: {title}",
      success: "title changed: {title}",
    },
    category: {
      description: "Show or change the stream category",
      current: "current category: {category}",
      success: "category changed: {category}",
      notFound: 'category "{category}" not found.',
    },
    commercial: {
      description: "Run an ad break",
      invalidLength: "invalid length, pick between 30 and 180 seconds.",
      success: "{length} second ad break started.",
      error: "could not start the ad break.",
    },
    snooze: {
      description: "Push back the next ad break",
      success: "next ad break pushed back.",
      error: "could not snooze the next ad break.",
    },
    timeout: {
      description: "Time a viewer out",
      usage: "usage: !timeout <user> <seconds> [reason]",
      invalidDuration: "invalid duration (1 to 1209600 seconds).",
    },
    ban: {
      description: "Ban a viewer",
      usage: "usage: !ban <user> [reason]",
    },
    unban: {
      description: "Unban a viewer",
      usage: "usage: !unban <user>",
      success: "{username} has been unbanned.",
    },
    delete: {
      description: "Delete a viewer's last message",
      usage: "usage: !delete <user>",
      noMessage: "no recent message from {username}.",
    },
    moderation: {
      userNotFound: "user {username} not found.",
    },
    addcom: {
      description: "Add a custom command",
      usage: "usage: !addcom <name> <text>",
      success: "command !{name} added.",
      reserved: "!{name} is a built-in command, pick another name.",
    },
    editcom: {
      description: "Edit a custom command",
      usage: "usage: !editcom <name> <text>",
      success: "command !{name} updated.",
      notFound: "command !{name} not found.",
    },
    delcom: {
      description: "Delete a custom command",
      usage: "usage: !delcom <name>",
      success: "command !{name} deleted.",
      notFound: "command !{name} not found.",
    },
  },

  events: {
    follow: [
      "Thanks for the follow {username}, welcome!",
      "Welcome {username}, thanks for following!",
      "{username} just followed, welcome aboard!",
    ],
    subscription: [
      "Thanks for the sub {username}!",
      "{username} just subscribed, thank you!",
      "Thanks for the support {username}!",
    ],
    resub: [
      "Thanks {username} for {months} of support!",
      "{months} already, thank you {username}!",
      "Thanks {username}, {months} of loyalty!",
    ],
    subgift: [
      "Thanks {username} for the gifted sub!",
      "{username} gifted a sub, thank you!",
    ],
    subgiftMultiple: [
      "Thanks {username} for the {total} gifted subs!",
      "{username} gifted {total} subs, very generous!",
    ],
    cheer: [
      "Thanks {username} for the {bits} bits!",
      "{bits} bits from {username}, thank you!",
    ],
    raid: [
      "Thanks {username} for the raid with {viewers} viewers, welcome everyone!",
      "Raid from {username} with {viewers} viewers, welcome!",
    ],
    month: "{months} month",
    months: "{months} months",
  },

  moderation: {
    bannedWord: "banned word: {word}",
    unauthorizedLink: "link not allowed: {domain}",
    caps: "message in all caps",
    manualReason: "manual action by {moderator}",
  },
};
