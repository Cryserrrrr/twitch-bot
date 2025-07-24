# 🤖 Complete Twitch Bot

A modern and comprehensive Twitch bot with Spotify, Apex Legends, OBS integrations and web management interface.

## ✨ Features

### 🧠 Core Features

- ✅ Automatic Twitch connection with tmi.js
- ✅ Automatic reconnection handling
- ✅ Secure OAuth authentication
- ✅ Customizable commands (!addcom, !delcom)
- ✅ SQLite data persistence
- ✅ Multi-language support (English, French)

### 🤖 Automatic Moderation

- ✅ Banned words detection and timeout/delete actions
- ✅ Unauthorized links blocking
- ✅ Spam protection
- ✅ Moderators and VIP exclusion
- ✅ Manual moderation commands (!timeout, !ban, !unban)
- ✅ Web interface for moderation management

### 🎶 Spotify Integration

- ✅ Current song display (!song)
- ✅ Song request to queue (!request)
- ✅ Automatic OAuth authentication
- ✅ Automatic token refresh
- ✅ Web interface integration

### 🕹️ Apex Legends Integration

- ✅ Current rank display (!apexrank)
- ✅ Multi-platform support (PC, X1, PS4)
- ✅ Mozambique API (free, API key required)
- ✅ Smart caching for performance optimization

### 🎥 OBS Connection

- ✅ Connection via obs-websocket
- ✅ Web interface for OBS control
- ✅ Multiple audio format support

### 🧩 Reactivity & Interactivity

- ✅ Welcome messages for new viewers
- ✅ Automatic thanks for subs/resubs
- ✅ Gift subs and raids handling
- ✅ Customizable messages

### 🎲 Fun Commands

- ✅ !dice - Roll a D100
- ✅ !flip - Heads or tails

### 🖥️ Web Interface

- ✅ Modern and responsive interface
- ✅ Real-time command management
- ✅ Points and moderation control
- ✅ Automatic recurring messages
- ✅ Integrated OBS control
- ✅ Secure authentication system

## 🚀 Installation

### Prerequisites

- Node.js 16+
- npm or yarn
- Twitch account with OAuth token
- (Optional) Spotify Developer account
- (Optional) OBS Studio with obs-websocket

### 🌍 Multi-language Support

The bot supports multiple languages:

- 🇺🇸 **English** (default language)
- 🇫🇷 **French**

The language can be configured in the `.env` file by modifying the `LANGUAGE=en` or `LANGUAGE=fr` variable.

### Local HTTPS Configuration (Recommended)

To use the web interface with HTTPS locally (necessary for some integrations), you need to configure mkcert:

#### Installing mkcert

**Windows:**

```bash
# With Chocolatey
choco install mkcert

# With Scoop
scoop install mkcert

# Or download from https://github.com/FiloSottile/mkcert/releases
```

**macOS:**

```bash
# With Homebrew
brew install mkcert

# Or with MacPorts
sudo port install mkcert
```

**Linux (Ubuntu/Debian):**

```bash
sudo apt install libnss3-tools
wget -O mkcert https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-linux-amd64
chmod +x mkcert
sudo mv mkcert /usr/local/bin/
```

**Linux (CentOS/RHEL/Fedora):**

```bash
sudo yum install nss-tools
# Then download and install mkcert as above
```

#### Certificate Configuration

Once mkcert is installed, run these commands in the project directory:

```bash
# Install local certificate authority
mkcert -install

# Generate certificates for localhost
mkcert 127.0.0.1
```

The bot will automatically detect these certificates and use HTTPS instead of HTTP.

### 1. Clone the project

```bash
git clone <your-repo>
cd twitch-bot
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configuration

#### 🎯 Automated setup (Recommended)

The bot has a fully automated configuration system:

```bash
npm run setup
```

#### Manual configuration (Alternative)

If you prefer to configure manually, use the .env.example file

### 4. Get tokens

#### Twitch OAuth Token

1. Go to [https://antiscuff.com/oauth/](https://antiscuff.com/oauth/)
2. Login with your Twitch account
3. Copy the generated token to `TWITCH_OAUTH`

#### Spotify Token (Optional)

1. Create an application on [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Add `http://127.0.0.1:3000/callback` to Redirect URIs
3. Copy Client ID and Client Secret
4. Use the setup script to get the refresh token

#### Apex Legends Token (Optional)

1. Go to [mozambiquehe.re](https://mozambiquehe.re)
2. Create an account and get an API key
3. Add the key to `APEX_API_KEY`

### 5. OBS Configuration (Optional)

1. Install [obs-websocket](https://github.com/obsproject/obs-websocket)
2. Enable WebSocket in OBS (Tools > WebSocket Server Settings)
3. Configure password if necessary

## 🎯 Usage

### Available scripts

```bash
# Automated configuration (recommended)
npm run setup

# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

### Local startup

```bash
npm start
```

### VPS startup

```bash
# Install PM2 for process management
npm install -g pm2

# Start the bot
pm2 start src/index.js --name "twitch-bot"

# Check status
pm2 status

# View logs
pm2 logs twitch-bot

# Restart
pm2 restart twitch-bot

# Stop
pm2 stop twitch-bot
```

### Web Interface

Once the bot is started, the web interface is available at:

```
# If HTTPS is configured (recommended)
https://127.0.0.1:3000

# Otherwise in HTTP
http://127.0.0.1:3000
```

## 📋 Available Commands

### Fun Commands

- `!dice` - Roll a 100-sided die
- `!flip` - Heads or tails

### Spotify Commands

- `!song` - Display currently playing song
- `!request <spotify_link>` - Add a song to the playlist

### Apex Legends Commands

- `!apexrank` - Display your current rank

### Moderation Commands (moderators only)

- `!addcom <name> <content>` - Add a custom command
- `!delcom <name>` - Delete a custom command
- `!title <title>` - Change stream title
- `!category <category>` - Change stream category
- `!timeout <username> <duration_in_seconds> [reason]` - Timeout a user
- `!ban <username> [reason]` - Ban a user
- `!unban <username>` - Unban a user

### Recurring Messages (streamer only)

- ✅ Automatic messages during stream
- ✅ Customizable interval (1-1440 minutes)
- ✅ Real-time activation/deactivation
- ✅ Web interface for management
- ✅ OBS status synchronization

## 🛠️ Project Structure

```
twitch-bot/
├── src/
│   ├── index.js              # Main entry point
│   ├── database/
│   │   └── database.js       # SQLite manager
│   ├── commands/
│   │   ├── commandManager.js # Command manager
│   │   ├── funCommands.js    # Fun commands
│   │   ├── spotifyCommands.js
│   │   ├── apexCommands.js
│   │   ├── obsCommands.js
│   │   └── twitchCommands.js
│   ├── moderation/
│   │   ├── moderationManager.js
│   │   └── recurringMessageManager.js
│   ├── integrations/
│   │   ├── spotifyManager.js
│   │   ├── apexManager.js
│   │   └── obsManager.js
│   ├── events/
│   │   └── eventManager.js
│   ├── config/
│   │   ├── setup.js
│   │   └── languages.js
│   ├── locales/
│   │   ├── en.js
│   │   └── fr.js
│   ├── utils/
│   │   └── translator.js
│   └── web/
│       ├── webServer.js
│       ├── twitchAuth.js
│       └── public/
│           ├── index.html
│           ├── styles.css
│           └── script.js
├── data/                     # SQLite database
├── sounds/                   # Audio files for OBS
├── package.json
├── env.example
└── README.md
```

## 🔧 Advanced Configuration

### Add a custom command

Via web interface or in chat:

```
!addcom hello Hello everyone! 👋
```

### Configure moderation

Via web interface, "Moderation" tab:

- Add banned words
- Configure allowed links
- Adjust timeout durations

## 🔒 Security

- Tokens stored in environment variables
- Permission validation (moderators/streamer)
- SQL injection protection
- Security headers with Helmet
- CORS configured
- Secure authentication system

## 🐛 Troubleshooting

### Bot won't connect

1. Check Twitch OAuth token
2. Ensure username is correct
3. Check error logs

### Spotify not working

1. Check Spotify credentials
2. Ensure refresh token is valid
3. Check application permissions

### OBS not responding

1. Verify obs-websocket is installed
2. Check connection settings
3. Verify password is correct

### Corrupted database

```bash
# Delete and recreate database
rm data/bot.db
npm start
```

### HTTPS issues

If the web interface doesn't work with HTTPS:

1. **Check if mkcert is installed:**

   ```bash
   mkcert --version
   ```

2. **Reinstall certificate authority:**

   ```bash
   mkcert -install
   ```

3. **Regenerate certificates:**

   ```bash
   mkcert 127.0.0.1
   ```

4. **Check if files are present:**

   ```bash
   ls -la 127.0.0.1*.pem
   ```

5. **If problem persists, use HTTP temporarily:**
   - Delete `127.0.0.1.pem` and `127.0.0.1-key.pem` files
   - Restart the bot

## 🤝 Contributing

Contributions are welcome! To contribute:

1. Fork the project
2. Create a branch for your feature
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📝 License

This project is under MIT license. See LICENSE file for details.

## 🙏 Acknowledgments

- [tmi.js](https://github.com/tmijs/tmi.js) - Twitch IRC client
- [obs-websocket-js](https://github.com/obsproject/obs-websocket-js) - OBS integration
- [spotify-web-api-node](https://github.com/thelinmichael/spotify-web-api-node) - Spotify API
- [mozambiquehe.re](https://mozambiquehe.re) - Apex Legends API

## 📞 Support

For any questions or issues:

- Open an issue on GitHub
- Check the documentation
- Verify error logs
- Join [Discord](https://discord.gg/w7xDNMBtNG)

---

**Happy streaming! 🎮🎧**
