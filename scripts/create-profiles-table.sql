-- ============================================
-- User Profiles Table Setup for Bato
-- ============================================
-- Run this in your Supabase SQL Editor:
-- Dashboard -> SQL Editor -> New Query -> Paste and Run

-- Step 1: Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Clerk User ID (unique identifier from Clerk)
  user_id text UNIQUE NOT NULL,
  
  -- Basic Info (synced from Clerk)
  email text NOT NULL,
  full_name text,
  username text UNIQUE, -- Twitter-style @username
  avatar_url text,
  
  -- Profile Info (editable by user)
  bio text,
  location text,
  website text,
  banner_url text, -- Profile banner/cover image
  
  -- Additional Twitter-like fields
  verified boolean DEFAULT false,
  
  -- Counts (updated via triggers/functions)
  posts_count integer DEFAULT 0,
  followers_count integer DEFAULT 0,
  following_count integer DEFAULT 0,
  
  -- Timestamps
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  last_seen_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Step 2: Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS profiles_user_id_idx ON profiles(user_id);
CREATE INDEX IF NOT EXISTS profiles_username_idx ON profiles(username);
CREATE INDEX IF NOT EXISTS profiles_email_idx ON profiles(email);
CREATE INDEX IF NOT EXISTS profiles_created_at_idx ON profiles(created_at DESC);

-- Step 3: Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Step 4: Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Step 5: Create function to update posts_count
CREATE OR REPLACE FUNCTION update_profile_posts_count()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE profiles 
    SET posts_count = posts_count + 1 
    WHERE user_id = NEW.user_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE profiles 
    SET posts_count = GREATEST(0, posts_count - 1)
    WHERE user_id = OLD.user_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create trigger to auto-update posts_count when posts are created/deleted
DROP TRIGGER IF EXISTS update_posts_count_trigger ON posts;
CREATE TRIGGER update_posts_count_trigger
  AFTER INSERT OR DELETE ON posts
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_posts_count();

-- Step 7: Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Step 8: Create RLS policies
-- Allow everyone to read profiles (public data)
CREATE POLICY "Profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

-- Allow users to insert their own profile
CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (true); -- Will be controlled by application logic

-- Allow users to update their own profile
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (true) -- Will be controlled by application logic
  WITH CHECK (true);

-- Step 9: Grant necessary permissions
GRANT ALL ON profiles TO anon, authenticated;
GRANT EXECUTE ON FUNCTION update_updated_at_column TO anon, authenticated;
GRANT EXECUTE ON FUNCTION update_profile_posts_count TO anon, authenticated;

-- Step 10: Verification queries (optional - run after setup)
-- Check if table was created successfully
-- SELECT COUNT(*) as profile_count FROM profiles;

-- Check indexes
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'profiles';

-- ============================================
-- NOTES:
-- ============================================
-- 1. After creating this table, you'll need to sync existing users from Clerk
-- 2. New users should be auto-created via the sync-user API endpoint
-- 3. The username should be auto-generated from Clerk data or user input
-- 4. Posts table already exists, so the trigger will work immediately

