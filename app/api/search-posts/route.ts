import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/utils/supabase/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
});

// In-memory cache to reduce API costs
// In production, consider using Redis or another caching solution
const embeddingCache = new Map<string, number[]>();
const CACHE_MAX_SIZE = 1000;

interface SearchRequest {
  query: string;
  limit?: number;
  threshold?: number;
}

interface SearchResponse {
  posts: any[];
  cached: boolean;
  similarity_scores?: number[];
}

/**
 * POST /api/search-posts
 * Performs semantic search on posts using OpenAI embeddings
 */
export async function POST(request: NextRequest) {
  try {
    const body: SearchRequest = await request.json();
    const { query, limit = 50, threshold = 0.5 } = body;

    // Validate input
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Query is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    if (limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: 'Limit must be between 1 and 100' },
        { status: 400 }
      );
    }

    // Check cache first
    const cacheKey = query.toLowerCase().trim();
    let queryEmbedding = embeddingCache.get(cacheKey);
    let cached = false;

    if (!queryEmbedding) {
      // Generate embedding using OpenAI
      console.log('🔍 Generating embedding for query:', query);
      
      const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: query,
      });

      queryEmbedding = embeddingResponse.data[0].embedding;

      // Cache the embedding (with size limit)
      if (embeddingCache.size >= CACHE_MAX_SIZE) {
        // Remove oldest entry (first in Map)
        const firstKey = embeddingCache.keys().next().value as string;
        embeddingCache.delete(firstKey);
      }
      embeddingCache.set(cacheKey, queryEmbedding);
      console.log('💾 Cached embedding for future queries');
    } else {
      cached = true;
      console.log('⚡ Using cached embedding');
    }

    // Perform vector similarity search in Supabase
    const supabase = await createClient();
    const { data: posts, error } = await supabase.rpc('match_posts', {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: limit
    });

    if (error) {
      console.error('Error searching posts:', error);
      return NextResponse.json(
        { error: 'Failed to search posts', details: error.message },
        { status: 500 }
      );
    }

    // Log results
    console.log(`✅ Found ${posts?.length || 0} matching posts`);

    return NextResponse.json({
      posts: posts || [],
      cached,
      count: posts?.length || 0
    } as SearchResponse);

  } catch (error) {
    console.error('Search API error:', error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/search-posts
 * Returns cache statistics (useful for monitoring)
 */
export async function GET() {
  return NextResponse.json({
    cache_size: embeddingCache.size,
    cache_max_size: CACHE_MAX_SIZE,
    cache_usage_percent: ((embeddingCache.size / CACHE_MAX_SIZE) * 100).toFixed(1)
  });
}

