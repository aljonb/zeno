# RSS Bot System for Bato

Automated system that fetches news from RSS feeds, generates AI summaries using OpenAI, and posts to the Bato social network.

## Features

- **5 News Bots**: US Politics, Global Politics, MMA, Tech, and World News
- **Automatic Summarization**: Uses OpenAI to create engaging 200-280 character posts
- **Smart Deduplication**: Tracks processed items to prevent duplicate posts
- **Scheduled Posting**: Runs on configurable schedules (every 10-15 minutes per bot)
- **Rate Limiting**: Built-in delays to respect API limits
- **Dry Run Mode**: Test without actually creating posts
- **Graceful Shutdown**: Properly stops all jobs on exit

## System Architecture

```
RSS Feeds → Fetch → Deduplicate → Summarize (OpenAI) → Post → Mark Processed
                                                              ↓
                                                    Supabase Database
```

## Prerequisites

- Node.js 18+ installed
- Supabase account with project set up
- OpenAI API key
- Bot profiles created in Supabase

## Setup Instructions

### 1. Database Setup

Run these SQL scripts in your Supabase SQL Editor:

```bash
# Step 1: Create bot profiles table (if not exists)
# Run: scripts/create-profiles-table.sql

# Step 2: Create bot user accounts
# Run: scripts/create-bot-profiles.sql

# Step 3: Create RSS tracking table
# Run: scripts/create-rss-bots-table.sql
```

### 2. Install Dependencies

```bash
cd bots
npm install
```

### 3. Configure Environment Variables

```bash
# Copy the example environment file
cp env.example .env

# Edit .env and add your credentials
nano .env
```

Required variables:
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_KEY`: Service role key (NOT anon key)
- `OPENAI_API_KEY`: Your OpenAI API key

### 4. Verify Setup

Run a test to ensure everything is configured correctly:

```bash
# Dry run - won't create actual posts
DRY_RUN=true npm run test
```

## Usage

### Start the Bot System (Scheduled)

Run bots on their configured schedules:

```bash
npm start
```

This will:
- Schedule all 5 bots according to their cron expressions
- Run continuously until stopped (Ctrl+C)
- Post new content every 10-15 minutes per bot

### Run All Bots Once

Execute all bots immediately and exit:

```bash
npm run run
# or
node index.js now
```

### Run a Specific Bot

Run just one bot:

```bash
node index.js bot us-politics-bot
node index.js bot tech-news-bot
```

Available bot IDs:
- `us-politics-bot`
- `global-politics-bot`
- `mma-news-bot`
- `tech-news-bot`
- `world-news-bot`

### Help

```bash
node index.js help
```

## Configuration

### Bot Schedules

Edit `config/bot-feeds.js` to change posting schedules:

```javascript
schedule: '*/15 * * * *'  // Every 15 minutes
schedule: '*/10 * * * *'  // Every 10 minutes
schedule: '0 * * * *'     // Every hour
```

Cron format: `minute hour day month weekday`

### Environment Variables

See `env.example` for all available options:

- `FETCH_WINDOW_MINUTES` - How far back to look for RSS items (default: 60)
- `MAX_POSTS_PER_RUN` - Limit posts per bot run (default: 5)
- `OPENAI_MODEL` - AI model to use (default: gpt-4o-mini)
- `OPENAI_DELAY_MS` - Delay between API calls (default: 1000)
- `DRY_RUN` - Test mode, don't create posts (default: false)
- `LOG_LEVEL` - Logging verbosity (default: info)

### Adding New RSS Feeds

Edit `config/bot-feeds.js`:

```javascript
feeds: [
  'https://example.com/rss',
  'https://another-feed.com/rss.xml'
]
```

### Customizing Bot Personalities

Each bot has a custom OpenAI prompt. Edit in `config/bot-feeds.js`:

```javascript
summaryPrompt: 'You are a Tech news bot. Summarize this article...'
```

## Project Structure

```
bots/
├── index.js                 # Main entry point & scheduler
├── package.json             # Dependencies
├── env.example              # Environment template
├── config/
│   └── bot-feeds.js         # Bot configurations & RSS feeds
├── lib/
│   ├── rss-fetcher.js       # Fetch & parse RSS feeds
│   ├── deduplicator.js      # Track processed items
│   ├── summarizer.js        # OpenAI integration
│   ├── post-creator.js      # Create posts in Supabase
│   └── bot-runner.js        # Main orchestration logic
└── README.md                # This file
```

## Monitoring & Troubleshooting

### Check Bot Profiles

Verify bot profiles exist in Supabase:

```sql
SELECT user_id, username, full_name, email 
FROM profiles 
WHERE user_id LIKE 'bot_%';
```

### Check Processed Items

See what's been processed:

```sql
SELECT bot_username, COUNT(*) as processed_count
FROM processed_rss_items
GROUP BY bot_username;
```

### Check Recent Posts

View bot posts:

```sql
SELECT user_name, content, created_at
FROM posts
WHERE user_id LIKE 'bot_%'
ORDER BY created_at DESC
LIMIT 10;
```

### Manual Cleanup

Remove old processed items:

```sql
SELECT cleanup_old_processed_items();
```

### Common Issues

**"Bot profile not found"**
- Run `scripts/create-bot-profiles.sql` in Supabase SQL Editor

**"SUPABASE_SERVICE_KEY is required"**
- Make sure you're using the SERVICE ROLE key, not the anon key
- Find it in Supabase Dashboard → Settings → API

**"OpenAI API error"**
- Check your API key is valid
- Verify you have credits available
- Check rate limits

**"No items fetched"**
- RSS feeds may be temporarily down
- Check feed URLs are accessible
- Increase `FETCH_WINDOW_MINUTES` if needed

## Deployment

### Running as a Service (Linux)

Create a systemd service file:

```bash
sudo nano /etc/systemd/system/bato-bots.service
```

```ini
[Unit]
Description=Bato RSS Bot System
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/bato/bots
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable bato-bots
sudo systemctl start bato-bots
sudo systemctl status bato-bots
```

View logs:

```bash
sudo journalctl -u bato-bots -f
```

### Using PM2 (Process Manager)

```bash
npm install -g pm2

# Start
pm2 start index.js --name bato-bots

# View logs
pm2 logs bato-bots

# Monitor
pm2 monit

# Auto-start on boot
pm2 startup
pm2 save
```

### Docker (Optional)

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

CMD ["node", "index.js"]
```

Build and run:

```bash
docker build -t bato-bots .
docker run -d --name bato-bots --env-file .env bato-bots
```

## Testing

### Dry Run Mode

Test without creating posts:

```bash
DRY_RUN=true node index.js now
```

### Test Single Bot

```bash
node index.js bot tech-news-bot
```

### Verify RSS Feeds

Test feed fetching only (modify code temporarily to log items).

## Maintenance

### Update Dependencies

```bash
npm update
```

### Add New Bots

1. Add bot profile to `scripts/create-bot-profiles.sql`
2. Run the SQL in Supabase
3. Add bot config to `config/bot-feeds.js`
4. Restart the bot system

### Modify Schedules

1. Edit schedules in `config/bot-feeds.js`
2. Restart the bot system

## License

MIT

## Support

For issues or questions, check the project repository or contact the development team.

