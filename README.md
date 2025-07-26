# 🤖 Complete Twitch Bot

A modern Twitch bot with Spotify, Apex Legends, OBS integrations and web management interface.

## ✨ Features

- ✅ **Core**: Auto Twitch connection, reconnection, OAuth, custom commands, SQLite, multi-language
- ✅ **Moderation**: Banned words, link blocking, spam protection, manual commands, web interface
- ✅ **Spotify**: Current song display, song requests, auto OAuth refresh
- ✅ **Apex Legends**: Rank display, multi-platform support, Mozambique API
- ✅ **OBS**: WebSocket connection, web interface control
- ✅ **Fun**: Welcome messages, auto thanks, gift subs/raids, dice/flip commands
- ✅ **Web Interface**: Modern UI, real-time management, secure auth, moderator auth

## 🚀 Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Automated setup (Recommended)

```bash
npm run setup
```

### 3. Get tokens

- **Twitch**: [https://antiscuff.com/oauth/](https://antiscuff.com/oauth/)
- **Spotify** (optional): [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
- **Apex** (optional): [mozambiquehe.re](https://mozambiquehe.re)

### 4. Start the bot

```bash
npm start
```

### 5. Access web interface (localhost)

```
https://127.0.0.1:3000 (HTTPS) or http://127.0.0.1:3000 (HTTP)
```

## 🌍 Languages

- 🇺🇸 **English** (default)
- 🇫🇷 **French**

Configure in `.env`: `LANGUAGE=en` or `LANGUAGE=fr`

## 📋 Commands

### Fun

- `!dice` - Roll D100
- `!flip` - Heads/tails

### Spotify

- `!song` - Current song
- `!request <link>` - Add to playlist

### Apex

- `!apexrank` - Current rank

### Moderation (mods only)

- `!addcom <name> <content>` - Add command
- `!delcom <name>` - Delete command
- `!timeout <user> <seconds> [reason]` - Timeout user
- `!ban <user> [reason]` - Ban user
- `!unban <user>` - Unban user

## 🛠️ HTTPS Setup (Optional)

Install mkcert for local HTTPS:

**Windows:**

```bash
choco install mkcert
```

**macOS:**

```bash
brew install mkcert
```

**Linux:**

```bash
sudo apt install libnss3-tools
wget -O mkcert https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-linux-amd64
chmod +x mkcert && sudo mv mkcert /usr/local/bin/
```

Then generate certificates:

```bash
mkcert -install
mkcert 127.0.0.1
```

## 🐛 Troubleshooting

### Common issues:

1. **Bot won't connect**: Check Twitch OAuth token
2. **Spotify not working**: Verify refresh token
3. **OBS not responding**: Check obs-websocket installation
4. **Database corrupted**: Delete `data/bot.db` and restart
5. **HTTPS issues**: Reinstall mkcert certificates

## 📁 Project Structure

```
src/
├── index.js              # Main entry
├── commands/             # All bot commands
├── moderation/           # Moderation system
├── integrations/         # Spotify, Apex, OBS
├── web/                  # Web interface
├── config/               # Configuration
├── locales/              # Translations
└── utils/                # Utilities
```

## 🔒 Security

- Environment variables for tokens
- Permission validation
- SQL injection protection
- Security headers
- CORS configured

## 📞 Support

- GitHub issues
- [Discord](https://discord.gg/w7xDNMBtNG)

## 🚧 Still need to test

- Recurent messages
- Auto thanks
- Ads management

---

**Happy streaming! 🎮🎧**
