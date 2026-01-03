# Discord Messages Scheduler

A Discord bot that automatically sends scheduled messages by reading from a Google Sheet. The bot polls the sheet at regular intervals and sends messages to specified Discord channels when their scheduled time arrives.

## Features

- 📅 Schedule Discord messages with specific date and time
- 📊 Manage message queue through Google Sheets
- ⏰ Automatic polling and sending based on configured timezone
- ✅ Track sent messages with timestamps
- 🔄 Configurable polling interval
- 🌍 Timezone-aware scheduling

## Prerequisites

- Node.js (v14 or higher)
- A Discord bot token
- A Google Cloud Platform project with Sheets API enabled
- A Google Service Account with access to your Google Sheet

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd discord-messages-scheduler
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```env
DISCORD_BOT_TOKEN=your_discord_bot_token
GOOGLE_SHEET_ID=your_google_sheet_id
GOOGLE_SERVICE_ACCOUNT_JSON=./service-account.json
SHEET_TAB_NAME=Queue
TIMEZONE=America/Toronto
POLL_SECONDS=60
```

4. Place your Google Service Account JSON file in the project root (or path specified in `.env`)

## Google Sheet Setup

Create a Google Sheet with the following columns (case-insensitive):

| send_at | channel_id | message | sent | sent_at |
|---------|------------|---------|------|---------|
| 2026-01-05 14:30 | 123456789012345678 | Hello, World! | FALSE | |
| 2026-01-06 10:00 | 123456789012345678 | Scheduled message | FALSE | |

### Column Descriptions

- **send_at**: Schedule time in format `YYYY-MM-DD HH:mm` (uses timezone from `.env`)
- **channel_id**: Discord channel ID where the message will be sent
- **message**: The message content to send
- **sent**: Boolean flag (TRUE/FALSE) - automatically updated when message is sent
- **sent_at**: Timestamp when the message was sent - automatically filled

## Discord Bot Setup

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application and add a bot
3. Copy the bot token and add it to your `.env` file
4. Enable the required bot intents (Guilds)
5. Invite the bot to your server with appropriate permissions (Send Messages, Read Channels)

## Usage

Start the bot:
```bash
node index.js
```

The bot will:
1. Connect to Discord
2. Begin polling the Google Sheet every `POLL_SECONDS` seconds
3. Send messages when their scheduled time arrives
4. Mark messages as sent and record the timestamp

## Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DISCORD_BOT_TOKEN` | Your Discord bot token | - | ✅ |
| `GOOGLE_SHEET_ID` | Google Sheet ID from the URL | - | ✅ |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Path to service account JSON | - | ✅ |
| `SHEET_TAB_NAME` | Name of the sheet tab | `Queue` | ❌ |
| `TIMEZONE` | Timezone for scheduling | `America/Toronto` | ❌ |
| `POLL_SECONDS` | Polling interval in seconds | `60` | ❌ |

## How It Works

1. The bot connects to Discord and starts a polling loop
2. Every `POLL_SECONDS`, it reads all rows from the Google Sheet
3. For each row where:
   - `sent` is not TRUE
   - `send_at` time has passed
   - All required fields are filled
4. The bot sends the message to the specified Discord channel
5. Updates the row with `sent=TRUE` and records the current time in `sent_at`

## Dependencies

- **discord.js**: Discord API wrapper
- **googleapis**: Google Sheets API client
- **luxon**: Date/time handling with timezone support
- **dotenv**: Environment variable management

## Error Handling

The bot includes error handling for:
- Invalid date formats in `send_at`
- Missing or invalid channel IDs
- Missing Google Service Account file
- API failures (logs errors without crashing)

## Notes

- Messages are only sent once (tracked via the `sent` column)
- The bot uses the timezone specified in the `.env` file for all time comparisons
- Make sure your Google Service Account has edit permissions on the sheet
- The bot needs appropriate Discord permissions to send messages in the target channels

## License

ISC