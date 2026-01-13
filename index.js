require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');
const { google } = require('googleapis');
const { DateTime } = require('luxon');
const fs = require('fs');

const {
    DISCORD_BOT_TOKEN,
    GOOGLE_SHEET_ID,
    GOOGLE_SERVICE_ACCOUNT_JSON,
    SHEET_TAB_NAME="Queue",
    TIMEZONE= "America/Toronto",
    POLL_SECONDS='60',
} = process.env;

// ------------ Google Sheets Setup ------------
function getGoogleAuth() {
  // Prefer JSON from env (For Heroku). Fallback to file for local dev.
  const jsonFromEnv = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

  if (jsonFromEnv) {
    const creds = JSON.parse(jsonFromEnv);
    return new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
  }

  const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!keyFile || !fs.existsSync(keyFile)) {
    throw new Error(
      `No GOOGLE_SERVICE_ACCOUNT_KEY env var set and JSON file not found at: ${keyFile}`
    );
  }

  return new google.auth.GoogleAuth({
    keyFile,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}


async function getSheetsClient() {
    const auth = await getGoogleAuth().getClient();
    return google.sheets({ version: 'v4', auth });
}


// ------------ Discord Bot Setup ------------
const client = new Client({
    intents: [GatewayIntentBits.Guilds],
});

function normalizeBool(v) {
    if ( typeof v === "boolean") return v;
    if (!v) return false;
    const s = String(v).trim().toLowerCase();
    return ['1', 'true', 'yes', 'on'].includes(s);
}

function parseSendAt(sendAtRaw) {
    // Expecting "YYYY-MM-DD HH:mm" in TIMEZONE
    const dt = DateTime.fromFormat(String(sendAtRaw).trim(), 'yyyy-MM-dd HH:mm', { zone: TIMEZONE });

    return dt.isValid ? dt : null;
}

async function pollAndSend() {
    const now = DateTime.now().setZone(TIMEZONE);

    const sheets = await getSheetsClient();

    // Read all rows from the queue sheet
    const range = `${SHEET_TAB_NAME}!A:F`;
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: GOOGLE_SHEET_ID,
        range,
    });

    const rows = res.data.values || [];

    if (rows.length < 2 ) return; // No data

    const header = rows[0].map(h => String(h).trim().toLowerCase());
    const idx = {
        sendAt: header.indexOf('send_at'),
        channelId: header.indexOf('channel_id'),
        message: header.indexOf('message'),
        sent: header.indexOf('sent'),
        sentAt: header.indexOf('sent_at'),
    };

    // Basic header validation
    for (const [k, v] of Object.entries(idx)) {
        if (v === -1) {
            throw new Error(`Missing required column "${k}" in sheet header`);
        }
    }

    // Process each row (starting from row 2)
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];

        const sendAtRaw = row[idx.sendAt];
        const channelId = row[idx.channelId];
        const message = row[idx.message];
        const sentRaw = row[idx.sent];

        const alreadSent = normalizeBool(sentRaw);
        if (alreadSent) continue; // Skip already sent

        if (!sendAtRaw || !channelId || !message) continue; // Incomplete row

        const sendAt = parseSendAt(sendAtRaw);

        if (!sendAt) {
            console.warn(`Invalid send_at format in row ${i + 1}: "${sendAtRaw}"`);
            continue;
        }

        if (sendAt <= now) {
            // Time to send the message
            try {
                const channel = await client.channels.fetch(String(channelId).trim());
                if (!channel || !channel.isTextBased()) {
                    console.log(`Row ${i + 1}: Invalid or non-text channel ID "${channelId}"`);
                    continue;   
                }
                await channel.send(String(message));

                // Mark as sent
                const sentAtStr = now.toFormat('yyyy-MM-dd HH:mm');
                const updateRange = `${SHEET_TAB_NAME}!D${i + 1}:E${i + 1}`;
                
                await sheets.spreadsheets.values.update({
                spreadsheetId: GOOGLE_SHEET_ID,
                range: updateRange,
                valueInputOption: "USER_ENTERED",
                requestBody: { values: [["TRUE", sentAtStr]] },
                });

                console.log(`Row ${i + 1}: Message sent to channel ${channelId}`);
                console.log(`Row ${i + 1}: Marked as TRUE and sent at ${sentAtStr}`);
            } catch (err) {
                console.log(`Row ${i + 1}: Error sending message to channel ${channelId}:`, err.message);
            }
        }
    }
}

// ------------ Main Execution ------------
client.once('clientReady', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    console.log(`Polling every ${POLL_SECONDS} seconds...`);

    // Poll immediately, then at intervals
    await pollAndSend();
    setInterval(() => {
        pollAndSend().catch(err => console.error('Error in pollAndSend:', err));
    }, Number(POLL_SECONDS) * 1000);
});

client.login(DISCORD_BOT_TOKEN).catch(err => {
    console.error('Failed to login to Discord:', err);
    process.exit(1);
});