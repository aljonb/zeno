# Quick Start Guide

Get the RSS bot system up and running in 5 minutes!

## Step 1: Database Setup (5 minutes)

Open your Supabase SQL Editor and run these three scripts in order:

### A. Create Bot Profiles

```sql
-- Copy and paste: scripts/create-bot-profiles.sql
```

This creates 5 bot accounts: uspolitics, globalpolitics, mmanews, technews, worldnews

### B. Create RSS Tracking Table

```sql
-- Copy and paste: scripts/create-rss-bots-table.sql
```

This creates the deduplication tracking system.

### C. Verify

```sql
SELECT user_id, username, full_name FROM profiles WHERE user_id LIKE 'bot_%';
```

You should see 5 bot profiles.

## Step 2: Install Dependencies (1 minute)

```bash
cd bots
npm install
```

## Step 3: Configure Environment (2 minutes)

```bash
cp env.example .env
nano .env  # or use your favorite editor
```

Add these three required values:

```bash
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
OPENAI_API_KEY=sk-...
```

**Important**: Use your SUPABASE SERVICE ROLE KEY (not the anon key)!

Find them here:
- Supabase Dashboard → Settings → API
- OpenAI Platform → API Keys

## Step 4: Test Run (1 minute)

Test in dry run mode (won't create posts):

```bash
DRY_RUN=true npm run test
```

You should see:
- ✅ Environment validated
- ✅ Bot profiles verified
- RSS items fetched
- Summaries generated
- 🏃 DRY RUN: No posts actually created

## Step 5: Go Live! (1 second)

Start the bot system:

```bash
npm start
```

That's it! The bots will now:
- Post every 10-15 minutes
- Fetch news from RSS feeds
- Generate AI summaries
- Automatically post to your feed

Press `Ctrl+C` to stop.

## Quick Commands

```bash
# Start scheduled bots (runs continuously)
npm start

# Run all bots once and exit
npm run run

# Run specific bot
node index.js bot tech-news-bot

# Test without posting
DRY_RUN=true npm run test

# Help
node index.js help
```

## Verify It's Working

Check your feed in the app or query Supabase:

```sql
SELECT user_name, content, created_at 
FROM posts 
WHERE user_id LIKE 'bot_%'
ORDER BY created_at DESC 
LIMIT 10;
```

## Troubleshooting

**"Bot profile not found"**
→ Run `scripts/create-bot-profiles.sql` in Supabase

**"SUPABASE_SERVICE_KEY is required"**
→ Make sure you used the SERVICE ROLE key, not anon key

**"No items fetched"**
→ Normal if RSS feeds don't have news in the last hour
→ Wait 10-15 minutes for next scheduled run

**"OpenAI API error"**
→ Check your API key and credits at platform.openai.com

## Next Steps

- **Customize**: Edit `config/bot-feeds.js` to add/remove RSS feeds
- **Monitor**: Check the console logs for detailed activity
- **Deploy**: See README.md for production deployment options

For detailed documentation, see [README.md](README.md)

