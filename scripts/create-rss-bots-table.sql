-- ============================================
-- RSS Bot System Database Setup (FIXED)
-- ============================================
-- Run this in your Supabase SQL Editor:
-- Dashboard -> SQL Editor -> New Query -> Paste and Run

-- Step 1: Create processed_rss_items table for deduplication
CREATE TABLE IF NOT EXISTS processed_rss_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- RSS item identifiers
  rss_url text NOT NULL,
  item_guid text NOT NULL,
  item_link text NOT NULL,
  item_title text,
  
  -- Bot that processed this item
  bot_id text NOT NULL,
  bot_username text NOT NULL,
  
  -- Tracking
  processed_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  -- Metadata
  created_post_id uuid, -- Reference to the created post
  
  -- Unique constraint to prevent duplicate processing
  UNIQUE(item_guid, bot_id),
  UNIQUE(item_link, bot_id)
);

-- Step 2: Create indexes for fast deduplication lookups
CREATE INDEX IF NOT EXISTS processed_rss_items_guid_idx ON processed_rss_items(item_guid);
CREATE INDEX IF NOT EXISTS processed_rss_items_link_idx ON processed_rss_items(item_link);
CREATE INDEX IF NOT EXISTS processed_rss_items_bot_id_idx ON processed_rss_items(bot_id);
CREATE INDEX IF NOT EXISTS processed_rss_items_processed_at_idx ON processed_rss_items(processed_at DESC);

-- Step 3: Create function to cleanup old processed items (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_processed_items()
RETURNS void AS $$
BEGIN
  DELETE FROM processed_rss_items
  WHERE processed_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Step 4: Grant necessary permissions FIRST (before enabling RLS)
GRANT ALL ON processed_rss_items TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_processed_items TO anon, authenticated, service_role;

-- Step 5: DON'T enable RLS for this table
-- The service role key will access this table directly
-- No RLS needed since only the bot system uses this table

-- Alternative: If you want RLS enabled, use this instead:
-- ALTER TABLE processed_rss_items ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow service role full access"
--   ON processed_rss_items FOR ALL
--   TO service_role
--   USING (true) WITH CHECK (true);

-- Step 6: Verification queries (optional - run after setup)
-- Check if table was created successfully
-- SELECT COUNT(*) as processed_items_count FROM processed_rss_items;

-- Check indexes
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'processed_rss_items';

-- ============================================
-- NOTES:
-- ============================================
-- 1. This table prevents duplicate posts from the same RSS items
-- 2. RLS is disabled - only the bot system (via service key) accesses this table
-- 3. Old records should be cleaned up periodically (cleanup function provided)
-- 4. The bot system will automatically run cleanup on startup
-- 5. Each bot tracks its own processed items independently
-- 6. The UNIQUE constraints ensure no duplicate processing per bot