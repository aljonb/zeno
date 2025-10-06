const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
require('dotenv').config({ path: '.env.local' });

// Initialize clients
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Configuration
const EMBEDDING_MODEL = 'text-embedding-3-small'; // Cost: $0.00002 per 1K tokens
const BATCH_SIZE = 10; // Process 10 posts at a time
const DELAY_MS = 100; // Small delay between batches to avoid rate limits

/**
 * Generate embedding for a single text using OpenAI
 */
async function generateEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text.substring(0, 8000), // Limit to ~8000 chars for safety
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error.message);
    throw error;
  }
}

/**
 * Update a post with its embedding
 */
async function updatePostEmbedding(postId, embedding) {
  const { error } = await supabase
    .from('posts')
    .update({ embedding })
    .eq('id', postId);

  if (error) {
    throw new Error(`Failed to update post ${postId}: ${error.message}`);
  }
}

/**
 * Main function to generate embeddings for all posts
 */
async function generateAllEmbeddings() {
  console.log('🚀 Starting embedding generation...\n');

  // Fetch all posts that don't have embeddings yet
  const { data: posts, error } = await supabase
    .from('posts')
    .select('id, content')
    .is('embedding', null); // Only posts without embeddings

  if (error) {
    console.error('❌ Error fetching posts:', error.message);
    return;
  }

  if (!posts || posts.length === 0) {
    console.log('✅ All posts already have embeddings!');
    return;
  }

  console.log(`📊 Found ${posts.length} posts without embeddings\n`);

  let processedCount = 0;
  let successCount = 0;
  let errorCount = 0;
  const startTime = Date.now();

  // Process posts in batches
  for (let i = 0; i < posts.length; i += BATCH_SIZE) {
    const batch = posts.slice(i, i + BATCH_SIZE);
    
    console.log(`\n📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(posts.length / BATCH_SIZE)}`);

    // Process batch concurrently
    await Promise.all(
      batch.map(async (post) => {
        try {
          // Generate embedding
          const embedding = await generateEmbedding(post.content);
          
          // Update post in database
          await updatePostEmbedding(post.id, embedding);
          
          processedCount++;
          successCount++;
          
          // Progress indicator
          const progress = ((processedCount / posts.length) * 100).toFixed(1);
          console.log(`  ✓ ${processedCount}/${posts.length} (${progress}%) - Post: ${post.id.substring(0, 8)}...`);
          
        } catch (error) {
          errorCount++;
          console.error(`  ✗ Failed for post ${post.id}: ${error.message}`);
        }
      })
    );

    // Small delay between batches
    if (i + BATCH_SIZE < posts.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  const estimatedCost = (posts.length * 0.00002).toFixed(4);

  console.log('\n' + '='.repeat(50));
  console.log('📈 SUMMARY');
  console.log('='.repeat(50));
  console.log(`✅ Successfully processed: ${successCount}/${posts.length}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`⏱️  Duration: ${duration}s`);
  console.log(`💰 Estimated cost: ~$${estimatedCost}`);
  console.log('='.repeat(50));
  
  if (successCount === posts.length) {
    console.log('\n🎉 All embeddings generated successfully!');
  } else {
    console.log('\n⚠️  Some posts failed. You can re-run this script to retry.');
  }
}

/**
 * Verify embeddings in database
 */
async function verifyEmbeddings() {
  const { data, error } = await supabase
    .from('posts')
    .select('id, embedding')
    .limit(1000);

  if (error) {
    console.error('Error verifying:', error.message);
    return;
  }

  const total = data.length;
  const withEmbeddings = data.filter(p => p.embedding !== null).length;
  
  console.log('\n📊 Database Status:');
  console.log(`   Total posts: ${total}`);
  console.log(`   With embeddings: ${withEmbeddings}`);
  console.log(`   Without embeddings: ${total - withEmbeddings}`);
}

// Run the script
(async () => {
  try {
    // Verify environment variables
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not found in .env.local');
    }
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      throw new Error('Supabase credentials not found in .env.local');
    }

    await generateAllEmbeddings();
    await verifyEmbeddings();
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  }
})();

