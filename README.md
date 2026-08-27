# Twitch bot

Chat bot and web console for a single Twitch channel: custom commands, automatic
moderation, timed announcements, event alerts, plus Spotify, OBS Studio and Apex
Legends integrations.

```
src/          bot (Node.js, CommonJS)
dashboard/    web console (React, Vite, TypeScript, Tailwind)
data/         database and OAuth tokens - never commit this folder
```

## Requirements

- Node.js 18 or newer
- A Twitch application: <https://dev.twitch.tv/console/apps>
- `mkcert` for the local HTTPS certificate (Twitch refuses plain HTTP redirects)

## Install

```bash
npm run install:all     # bot + dashboard dependencies
cp env.example .env     # then fill it in
npm run build           # compiles the dashboard into dashboard/dist
npm start
```

Open <https://127.0.0.1:3000> and sign in with Twitch.

### HTTPS certificate

```bash
mkcert -install
mkcert 127.0.0.1
```

Run this from the bot folder: it produces `127.0.0.1.pem` and `127.0.0.1-key.pem`,
which the server picks up automatically. Without them the server falls back to
HTTP and the Twitch login will not work.

### Twitch application settings

In the developer console, set the OAuth Redirect URL to exactly:

```
https://127.0.0.1:3000/callback/twitch
```

## Authentication

There is no OAuth token to paste into `.env` any more. Two separate flows run
through the console:

- **Sign in** — the broadcaster or any channel moderator opens the console. Asks
  for a single read-only scope.
- **Connect the bot account** — grants the full scope set and stores the token
  the bot uses for chat, Helix and EventSub. Only accepted for the channel owner.

Tokens live in `data/tokens/` and are refreshed automatically. If Twitch rejects
a refresh (password change, access revoked), the console shows it and one click
reconnects the account.

## Commands

Every built-in command is a module in `src/commands/builtin/`. A module declares
its name, aliases, permission and cooldown, and the dispatcher wires it up at
startup:

```js
module.exports = {
  name: "shoutout",
  aliases: ["so"],
  permission: "moderator",
  cooldown: 5,
  async run({ args, reply, t, bot }) {
    await reply(`Go follow twitch.tv/${args[0]}`);
  },
};
```

Built-ins: `ping` `dice` `flip` `help` `song` `request` `apexrank` `uptime`
`title` `category` `commercial` `snooze` `timeout` `ban` `unban` `delete`
`addcom` `editcom` `delcom`.

Custom commands are managed from the console or with `!addcom`, and support the
`{user}`, `{channel}` and `{count}` placeholders.

## Moderation

Three filters, each toggled from the console: banned words (delete, timeout or
ban per word), a link allowlist, and an all-caps filter. Moderators, VIPs and
subscribers are never acted on. Deletions remove the exact message rather than
issuing a one-second timeout.

## Integrations

| Integration | Needs | Notes |
|---|---|---|
| Spotify | `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` | Connect it from the console; the refresh token is stored in `data/tokens/` |
| OBS Studio | `OBS_HOST`, `OBS_PASSWORD` | Tools > WebSocket Server Settings; the bot reconnects on its own |
| Apex Legends | `APEX_API_KEY`, `APEX_USERNAME` | <https://portal.mozambiquehe.re> |

Every integration is optional. A missing one is reported as disabled and the rest
keeps running.

## OBS overlays

The **Overlays** page of the console gives you a browser source URL for the
Spotify now-playing overlay. Copy it into OBS (Sources > Browser) and set the
source width and height to the dimensions the page shows.

Never stretch the source on the canvas: OBS renders a browser source at its
configured resolution and scaling it up enlarges a bitmap, which is what makes
an overlay look blurry. To change the size, move the **Size** slider — the page
re-renders at the new size and stays sharp — then copy the updated dimensions
onto the source.

Four styles — card, pill, bar, text only — plus accent colour, size, opacity,
alignment, and a choice between staying on screen permanently or revealing
itself for a few seconds on every track change. Changes apply live: the source
updates in OBS while you drag the sliders.

Overlays are served over plain HTTP on their own port (`OVERLAY_PORT`, default
3001) rather than through the dashboard. OBS's embedded browser regularly
refuses a self-signed certificate, and it cannot send an authentication header;
access is gated by a generated key in the URL instead, and the listener stays on
the loopback interface. Regenerating the key from the console invalidates the
old URL.

## Deploying with Coolify

The repository holds both the bot and the dashboard, and the `Dockerfile` at the
root builds the two together — no monorepo tooling required.

In Coolify, create an **Application** from this repository and pick the
**Dockerfile** build pack. Then:

**1. Environment variables.** Copy your `.env`, and add:

```
PUBLIC_URL=https://bot.your-domain.com
```

Leave `TWITCH_REDIRECT_URI` and `SPOTIFY_REDIRECT_URI` **empty**: they are
derived from `PUBLIC_URL`. A leftover `https://127.0.0.1:3000/...` value is the
most likely reason a deployed login fails.

**2. Persistent storage.** Mount a volume on `/app/data`. The SQLite database,
the OAuth tokens and the overlay key live there; without it every redeploy logs
the bot out and wipes its commands.

**3. Port.** Expose `3000`. Coolify terminates TLS, so the container serves
plain HTTP — that is expected and the bot says so in its logs. The overlays are
served from the same port under `/overlay`, so nothing else needs exposing.

**4. Redirect URLs.** Register `https://bot.your-domain.com/callback/twitch` on
the Twitch developer console, and the matching `/callback/spotify` on the
Spotify dashboard. Both must match character for character.

Once deployed, open the dashboard, connect the bot account, and reconnect
Spotify — tokens do not travel with the code.

### OBS will not work on a remote host

The OBS integration talks to obs-websocket on your own machine. A bot running on
a VPS cannot reach it, and exposing obs-websocket to the internet is not worth
the risk. Leave `OBS_HOST` empty in production: the integration reports itself
as disabled and everything else keeps running.

If you want OBS control, run the bot on the streaming machine instead. Chat,
moderation, commands, EventSub, Spotify and the overlays are all happy on a VPS.

## Development

```bash
npm run dev         # bot with reload on change
npm run dashboard   # dashboard on http://localhost:5173, proxying the bot API
```

Set `LOG_LEVEL=debug` in `.env` for verbose logs, including full stack traces,
and `BOT_CHAT_ENABLED=false` to run everything except the chat connection —
handy for working on an overlay, or for running a second instance alongside a
live one without the bot answering twice.

## Layout

```
src/
├── index.js            entry point and startup summary
├── core/               bot lifecycle, config, logger, settings cache
├── auth/               Twitch token manager and token files
├── chat/               IRC client with token-aware reconnection
├── commands/           dispatcher + builtin/ modules
├── moderation/         filters and timed announcements
├── integrations/       Helix, EventSub, Spotify, OBS, Apex
├── events/             event announcements
├── overlays/           OBS browser sources and their configuration
├── web/                HTTP server, REST routes, sessions, WebSocket feed
└── locales/            chat messages in French and English
```

## Troubleshooting

**`Login authentication failed`** — the account is not connected. Open the
console and use "Connect the bot account".

**Nothing happens on the OAuth redirect** — the redirect URL registered on Twitch
must match `TWITCH_REDIRECT_URI` character for character, HTTPS included.

**"Dashboard build not found"** — run `npm run build`.

**Moderation does nothing** — the Twitch API needs the bot account connected;
check the Twitch API line in the console sidebar.

## Licence

MIT
