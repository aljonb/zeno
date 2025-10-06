# 🔍 Semantic Search Setup Guide

This guide walks you through setting up AI-powered semantic search for your Bato posts.

## 📋 Prerequisites

- ✅ OpenAI API account ([Sign up here](https://platform.openai.com/signup))
- ✅ Supabase project with posts table
- ✅ Node.js installed

## 🚀 Setup Steps

### 1. Create Environment Variables

Create a `.env.local` file in your project root:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here
```

**Get your keys:**
- OpenAI: https://platform.openai.com/api-keys
- Supabase: Dashboard → Settings → API

### 2. Set Up Supabase Database

Run the SQL script in your Supabase SQL Editor:

1. Go to Supabase Dashboard → SQL Editor
2. Open `scripts/setup-pgvector.sql`
3. Copy the entire content
4. Paste and click "Run"

This will:
- ✅ Enable pgvector extension
- ✅ Add `embedding` column to posts table
- ✅ Create similarity search index
- ✅ Create `match_posts()` function

### 3. Generate Embeddings for Existing Posts

Run the embeddings generation script:

```bash
node scripts/generate-embeddings.js
```

This will:
- Generate embeddings for all 100 posts
- Cost: ~$0.002 (one-time)
- Time: ~30-60 seconds

Expected output:
```
🚀 Starting embedding generation...
📊 Found 100 posts without embeddings
...
✅ Successfully processed: 100/100
💰 Estimated cost: ~$0.0020
```

### 4. Start Your Development Server

```bash
npm run dev
```

### 5. Test Semantic Search

1. Navigate to `/for-you` page
2. Try these example searches:
   - "show me posts about renewable energy"
   - "tech and programming content"
   - "food and cooking posts"
   - "outdoor adventures and nature"

## 💰 Cost Breakdown

### One-Time Setup:
- Generate 100 post embeddings: **$0.002**

### Ongoing Usage:
- Each search query: **$0.00002** (with caching, ~80% fewer)
- 100 searches/day: **$0.60/month**
- 1,000 searches/day: **$6/month**

**Cost Optimization:**
- ✅ In-memory caching (saves 80-90% of costs)
- ✅ Only generate embeddings once per post
- ✅ Cached queries have $0 cost

## 🔧 How It Works

### 1. Embedding Generation (One-Time)
```
Post: "Renewable energy innovations..."
  ↓ OpenAI API
Embedding: [0.023, -0.145, 0.892, ... 1536 numbers]
  ↓ Store in Supabase
```

### 2. Search Time (Every Query)
```
User Query: "solar power posts"
  ↓ Check cache first
  ↓ If not cached, OpenAI API
Query Embedding: [0.019, -0.143, ...]
  ↓ Supabase pgvector search
  ↓ Calculate cosine similarity
Results: Posts ranked by relevance
```

## 📊 Monitoring

### Check Cache Statistics
```bash
curl http://localhost:3000/api/search-posts
```

Response:
```json
{
  "cache_size": 45,
  "cache_max_size": 1000,
  "cache_usage_percent": "4.5"
}
```

### Verify Embeddings
```sql
-- Run in Supabase SQL Editor
SELECT 
  COUNT(*) as total_posts,
  COUNT(embedding) as posts_with_embeddings,
  COUNT(*) - COUNT(embedding) as missing_embeddings
FROM posts;
```

## 🐛 Troubleshooting

### "OPENAI_API_KEY not found"
- Ensure `.env.local` exists in project root
- Restart your dev server after creating `.env.local`

### "match_posts function does not exist"
- Run `scripts/setup-pgvector.sql` in Supabase SQL Editor
- Ensure pgvector extension is enabled

### "No results found" for valid queries
- Check if embeddings are generated: `SELECT COUNT(embedding) FROM posts`
- Run `node scripts/generate-embeddings.js` if embeddings are missing
- Try lowering the threshold in search (0.3 instead of 0.5)

### Search is slow
- Ensure the index is created: Check `scripts/setup-pgvector.sql` step 3
- Verify in Supabase: Dashboard → Database → Indexes

## 🎯 Best Practices

### For Users:
- ✅ Use natural language: "show me posts about..."
- ✅ Be specific: "renewable energy" > "energy"
- ✅ Try synonyms if no results

### For Developers:
- ✅ Generate embeddings for new posts automatically
- ✅ Monitor cache hit rate
- ✅ Consider Redis for production caching
- ✅ Adjust similarity threshold based on results

## 🔄 Auto-Generate Embeddings for New Posts

To automatically generate embeddings when posts are created, update your post creation logic:

```typescript
// In app/post/page.tsx (after successful post creation)
const { data: post } = await supabase
  .from('posts')
  .insert(postData)
  .select()
  .single();

// Generate embedding
const response = await fetch('/api/generate-embedding', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ postId: post.id, content: post.content })
});
```

## 📚 Additional Resources

- [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings)
- [Supabase pgvector Documentation](https://supabase.com/docs/guides/ai/vector-columns)
- [Vector Similarity Explained](https://www.pinecone.io/learn/vector-similarity/)

## 🎉 Success!

You now have AI-powered semantic search! Users can find posts using natural language, understanding meaning rather than just keywords.

Example:
- Query: "sustainable energy"
- Matches: "renewable energy", "solar panels", "wind turbines", "clean power"
  
Even though the exact words don't match! 🚀

