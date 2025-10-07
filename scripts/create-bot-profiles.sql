-- ============================================
-- Bot Profiles Setup for RSS Bot System
-- ============================================
-- Run this in your Supabase SQL Editor:
-- Dashboard -> SQL Editor -> New Query -> Paste and Run
--
-- This creates bot profiles directly in Supabase without needing Clerk accounts
-- Bots use user_id format: bot_<botname> (e.g., bot_uspolitics)

-- Step 1: Insert bot profiles
INSERT INTO profiles (
  user_id,
  email,
  full_name,
  username,
  avatar_url,
  bio,
  verified,
  created_at,
  updated_at
) VALUES
  -- US Politics Bot
  (
    'bot_uspolitics',
    'uspolitics@bato.bot',
    'US Politics Bot',
    'uspolitics',
    'https://api.dicebear.com/7.x/icons/svg?seed=uspolitics&backgroundColor=1e40af',
    '🇺🇸 Bringing you the latest US political news from trusted sources',
    true,
    NOW(),
    NOW()
  ),
  -- Global Politics Bot
  (
    'bot_globalpolitics',
    'globalpolitics@bato.bot',
    'Global Politics Bot',
    'globalpolitics',
    'https://api.dicebear.com/7.x/icons/svg?seed=globalpolitics&backgroundColor=059669',
    '🌍 Global political news and international affairs from around the world',
    true,
    NOW(),
    NOW()
  ),
  -- MMA News Bot
  (
    'bot_mmanews',
    'mmanews@bato.bot',
    'MMA News Bot',
    'mmanews',
    'https://api.dicebear.com/7.x/icons/svg?seed=mmanews&backgroundColor=dc2626',
    '🥊 Your source for MMA, UFC, and combat sports news',
    true,
    NOW(),
    NOW()
  ),
  -- Tech News Bot
  (
    'bot_technews',
    'technews@bato.bot',
    'Tech News Bot',
    'technews',
    'https://api.dicebear.com/7.x/icons/svg?seed=technews&backgroundColor=7c3aed',
    '💻 Latest technology news, gadgets, and innovation updates',
    true,
    NOW(),
    NOW()
  ),
  -- World News Bot
  (
    'bot_worldnews',
    'worldnews@bato.bot',
    'World News Bot',
    'worldnews',
    'https://api.dicebear.com/7.x/icons/svg?seed=worldnews&backgroundColor=0891b2',
    '📰 Breaking news and stories from around the globe',
    true,
    NOW(),
    NOW()
  )
ON CONFLICT (user_id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  username = EXCLUDED.username,
  avatar_url = EXCLUDED.avatar_url,
  bio = EXCLUDED.bio,
  verified = EXCLUDED.verified,
  updated_at = NOW();

-- Step 2: Verify bot profiles were created
SELECT 
  user_id,
  username,
  full_name,
  email,
  verified,
  created_at
FROM profiles
WHERE user_id LIKE 'bot_%'
ORDER BY username;

-- ============================================
-- NOTES:
-- ============================================
-- 1. Bot user_ids use format: bot_<botname> (e.g., bot_uspolitics)
-- 2. All bots are marked as verified (verified = true)
-- 3. Email addresses use @bato.bot domain (not real emails, just identifiers)
-- 4. ON CONFLICT ensures you can re-run this script safely
-- 5. Bots can post but cannot log in (no Clerk accounts)
-- 6. These profiles work with your existing posts table and triggers

