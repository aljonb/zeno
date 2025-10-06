-- ============================================
-- Supabase pgvector Setup for Semantic Search
-- ============================================
-- Run this in your Supabase SQL Editor:
-- Dashboard -> SQL Editor -> New Query -> Paste and Run

-- Step 1: Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 2: Add embedding column to posts table
-- Using 1536 dimensions for OpenAI text-embedding-3-small model
ALTER TABLE posts ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Step 3: Create index for fast similarity search
-- This significantly speeds up vector searches
CREATE INDEX IF NOT EXISTS posts_embedding_idx 
ON posts 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Step 4: Create function for similarity search
CREATE OR REPLACE FUNCTION match_posts (
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  content text,
  user_id text,
  user_name text,
  user_email text,
  user_avatar text,
  image_urls text[],
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    posts.id,
    posts.content,
    posts.user_id,
    posts.user_name,
    posts.user_email,
    posts.user_avatar,
    posts.image_urls,
    posts.created_at,
    posts.updated_at,
    1 - (posts.embedding <=> query_embedding) as similarity
  FROM posts
  WHERE 
    posts.embedding IS NOT NULL
    AND 1 - (posts.embedding <=> query_embedding) > match_threshold
  ORDER BY posts.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Step 5: Grant necessary permissions (if needed)
-- Uncomment if you have permission issues
-- GRANT EXECUTE ON FUNCTION match_posts TO anon, authenticated;

-- Verification query (optional - run after setup)
-- SELECT COUNT(*) as total_posts, 
--        COUNT(embedding) as posts_with_embeddings 
-- FROM posts;

