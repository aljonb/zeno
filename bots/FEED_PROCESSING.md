# RSS Feed Processing - Individual Feed Processing

## Overview

The bot system now processes each RSS feed **separately** instead of combining all feeds into one pool. This ensures **balanced representation** from all sources and prevents one busy feed from dominating all post slots.

## How It Works

### Before (Combined Processing)
```
Bot has 3 feeds:
  - Feed A: 20 recent items
  - Feed B: 8 recent items  
  - Feed C: 2 recent items

All items combined → Sorted by date → Top 5 selected
Result: Could be all 5 from Feed A (if it's the busiest)
```

### After (Separate Processing) ✅
```
Bot has 3 feeds:
  - Feed A: Top 2 items selected
  - Feed B: Top 2 items selected
  - Feed C: Top 2 items selected

Total: Up to 6 posts (capped at MAX_POSTS_PER_RUN = 5)
Result: Each feed gets equal representation
```

## Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# Maximum posts per individual RSS feed (default: 2)
MAX_POSTS_PER_FEED=2

# Process each RSS feed separately (default: true)
# Set to 'false' to use the old combined approach
PROCESS_FEEDS_SEPARATELY=true
```

### How Posts Are Selected

**With `PROCESS_FEEDS_SEPARATELY=true` (default):**

1. **Fetch each feed separately** (still concurrent)
2. For each feed:
   - Filter by date (last 60 minutes by default)
   - Remove already-processed items (deduplication)
   - Sort by date (newest first)
   - **Take top `MAX_POSTS_PER_FEED` items** (default: 2)
3. Combine selected items from all feeds
4. Apply overall limit `MAX_POSTS_PER_RUN` (default: 5)
5. Generate summaries and create posts

**Example with 3 feeds:**
- Feed 1: 2 posts
- Feed 2: 2 posts  
- Feed 3: 2 posts
- Total: 6 posts → capped at 5 posts (MAX_POSTS_PER_RUN)

**With `PROCESS_FEEDS_SEPARATELY=false`:**

Uses the old behavior:
1. Fetch all feeds
2. Combine all items into one pool
3. Sort by date (newest first)
4. Take top `MAX_POSTS_PER_RUN` items (could all be from one feed)

## Benefits

✅ **Balanced Coverage**: Each RSS source gets representation  
✅ **Prevents Dominance**: Busy feeds won't take all slots  
✅ **Better Diversity**: More varied content from different sources  
✅ **Still Respects Recency**: Newest items from each feed are prioritized  
✅ **Configurable**: Can toggle back to combined mode if needed

## Example Output

When running with separate feed processing:

```
📡 Step 2: Fetching RSS feeds separately (last 60 minutes)...

🔍 Processing feed: https://www.mmafighting.com/rss/current
   Found 12 recent items
   ✅ Found 8 new items
   ⚠️  Limiting to 2 items from this feed

🔍 Processing feed: https://rss.app/feeds/qwxrKwMR5B8oYq7k.xml
   Found 5 recent items
   ✅ Found 3 new items
   ⚠️  Limiting to 2 items from this feed

📊 Total items to process: 4 (from 2 feeds)

📊 Run Summary:
   Bot: MMA News Bot
   Status: ✅ Success
   Feeds Processed: 2
   Items Fetched: 17
   New Items: 11
   Posts Created: 4
```

## When to Use Each Mode

### Use Separate Processing (default) when:
- You want balanced coverage from all sources
- Your feeds have varying activity levels
- You want to prevent one source from dominating
- You have high-quality curated feeds

### Use Combined Processing when:
- You only care about the absolute newest items
- All your feeds have similar activity levels
- You want simpler, faster processing
- You're okay with one feed potentially dominating

## Adjusting the Configuration

### More posts per feed:
```bash
MAX_POSTS_PER_FEED=3  # Up to 3 posts from each feed
```

### More total posts:
```bash
MAX_POSTS_PER_RUN=10  # Up to 10 posts total per bot run
```

### Back to combined mode:
```bash
PROCESS_FEEDS_SEPARATELY=false
```

## Technical Details

### New Functions Added

**`rss-fetcher.js`:**
- `fetchFeedsSeparately()` - Fetches multiple feeds, keeps them separated
- `fetchItemsForBotSeparately()` - Bot-level wrapper for separate fetching

**`bot-runner.js`:**
- Updated `runBot()` with conditional logic for separate/combined processing
- Added `feedsProcessed` to results tracking

### Files Modified

1. `bots/lib/rss-fetcher.js` - Added separate feed fetching functions
2. `bots/lib/bot-runner.js` - Updated processing logic
3. `bots/index.js` - Added new configuration options
4. `bots/env.example` - Documented new environment variables

## Migration

No migration needed! The feature is **enabled by default** but fully backward compatible.

To keep the old behavior:
```bash
PROCESS_FEEDS_SEPARATELY=false
```

