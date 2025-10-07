/**
 * Bot Runner
 * 
 * Main orchestration logic for each bot
 * Coordinates: RSS fetch → deduplication → summarization → posting
 */

const { fetchItemsForBot } = require('./rss-fetcher');
const { filterUnprocessedItems, markItemAsProcessed } = require('./deduplicator');
const { generateSummariesBatch } = require('./summarizer');
const { createPostsBatch, verifyBotProfile } = require('./post-creator');

/**
 * Run a single bot's posting cycle
 * @param {Object} supabase - Supabase client
 * @param {Object} openai - OpenAI client
 * @param {Object} botConfig - Bot configuration
 * @param {Object} options - Run options
 * @returns {Promise<Object>} - Run results
 */
async function runBot(supabase, openai, botConfig, options = {}) {
  const {
    fetchWindowMinutes = 60,
    maxPostsPerRun = 5,
    openaiDelayMs = 1000,
    openaiModel = 'gpt-4o-mini',
    dryRun = false
  } = options;
  
  console.log('\n' + '='.repeat(80));
  console.log(`🤖 Running bot: ${botConfig.name} (@${botConfig.username})`);
  console.log('='.repeat(80));
  
  const startTime = Date.now();
  const results = {
    botId: botConfig.id,
    botName: botConfig.name,
    success: false,
    itemsFetched: 0,
    itemsNew: 0,
    itemsSummarized: 0,
    postsCreated: 0,
    errors: [],
    duration: 0
  };
  
  try {
    // Step 1: Verify bot profile exists
    console.log('\n📋 Step 1: Verifying bot profile...');
    const profileExists = await verifyBotProfile(supabase, botConfig.user_id);
    
    if (!profileExists) {
      throw new Error(`Bot profile not found: ${botConfig.user_id}. Run scripts/create-bot-profiles.sql first.`);
    }
    
    // Step 2: Fetch RSS feed items
    console.log(`\n📡 Step 2: Fetching RSS feeds (last ${fetchWindowMinutes} minutes)...`);
    const items = await fetchItemsForBot(botConfig, fetchWindowMinutes);
    results.itemsFetched = items.length;
    
    if (items.length === 0) {
      console.log('ℹ️  No recent items found in feeds');
      results.success = true;
      return results;
    }
    
    console.log(`✅ Fetched ${items.length} recent items`);
    
    // Step 3: Filter out already-processed items (deduplication)
    console.log('\n🔍 Step 3: Checking for duplicates...');
    const newItems = await filterUnprocessedItems(supabase, botConfig.id, items);
    results.itemsNew = newItems.length;
    
    if (newItems.length === 0) {
      console.log('ℹ️  All items have already been processed');
      results.success = true;
      return results;
    }
    
    console.log(`✅ Found ${newItems.length} new items to process`);
    
    // Limit items to process
    const itemsToProcess = newItems.slice(0, maxPostsPerRun);
    if (newItems.length > maxPostsPerRun) {
      console.log(`⚠️  Limiting to ${maxPostsPerRun} items (${newItems.length - maxPostsPerRun} will be processed next run)`);
    }
    
    // Step 4: Generate summaries using OpenAI
    console.log(`\n🤖 Step 4: Generating summaries using OpenAI (${openaiModel})...`);
    const itemsWithSummaries = await generateSummariesBatch(
      openai,
      itemsToProcess,
      botConfig.summaryPrompt,
      openaiDelayMs,
      openaiModel
    );
    results.itemsSummarized = itemsWithSummaries.length;
    
    if (itemsWithSummaries.length === 0) {
      console.log('⚠️  Failed to generate any summaries');
      results.success = false;
      return results;
    }
    
    console.log(`✅ Generated ${itemsWithSummaries.length} summaries`);
    
    // Step 5: Create posts in Supabase
    console.log('\n📝 Step 5: Creating posts...');
    const createdPosts = await createPostsBatch(
      supabase,
      botConfig,
      itemsWithSummaries,
      maxPostsPerRun,
      dryRun
    );
    results.postsCreated = createdPosts.length;
    
    if (dryRun) {
      console.log('\n🏃 DRY RUN: No posts actually created');
    } else {
      console.log(`✅ Created ${createdPosts.length} posts`);
      
      // Step 6: Mark items as processed in deduplication table
      console.log('\n✔️  Step 6: Marking items as processed...');
      for (const { post, item } of createdPosts) {
        await markItemAsProcessed(
          supabase,
          botConfig.id,
          botConfig.username,
          item,
          post.id
        );
      }
      console.log(`✅ Marked ${createdPosts.length} items as processed`);
    }
    
    results.success = true;
    
  } catch (error) {
    console.error('\n❌ Error running bot:', error.message);
    results.errors.push(error.message);
    results.success = false;
  } finally {
    results.duration = Date.now() - startTime;
  }
  
  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 Run Summary:');
  console.log(`   Bot: ${botConfig.name}`);
  console.log(`   Status: ${results.success ? '✅ Success' : '❌ Failed'}`);
  console.log(`   Items Fetched: ${results.itemsFetched}`);
  console.log(`   New Items: ${results.itemsNew}`);
  console.log(`   Summaries Generated: ${results.itemsSummarized}`);
  console.log(`   Posts Created: ${results.postsCreated}`);
  console.log(`   Duration: ${(results.duration / 1000).toFixed(2)}s`);
  if (results.errors.length > 0) {
    console.log(`   Errors: ${results.errors.join(', ')}`);
  }
  console.log('='.repeat(80) + '\n');
  
  return results;
}

/**
 * Run multiple bots sequentially
 * @param {Object} supabase - Supabase client
 * @param {Object} openai - OpenAI client
 * @param {Array} botConfigs - Array of bot configurations
 * @param {Object} options - Run options
 * @returns {Promise<Array>} - Array of run results
 */
async function runMultipleBots(supabase, openai, botConfigs, options = {}) {
  console.log('\n' + '█'.repeat(80));
  console.log(`🚀 Starting bot run cycle - ${new Date().toISOString()}`);
  console.log(`   Running ${botConfigs.length} bots`);
  console.log('█'.repeat(80));
  
  const allResults = [];
  
  for (const botConfig of botConfigs) {
    try {
      const result = await runBot(supabase, openai, botConfig, options);
      allResults.push(result);
      
      // Small delay between bots
      await sleep(2000);
    } catch (error) {
      console.error(`❌ Fatal error running bot ${botConfig.name}:`, error);
      allResults.push({
        botId: botConfig.id,
        botName: botConfig.name,
        success: false,
        errors: [error.message]
      });
    }
  }
  
  // Print overall summary
  printOverallSummary(allResults);
  
  return allResults;
}

/**
 * Print overall summary for all bots
 * @param {Array} results - Array of bot run results
 */
function printOverallSummary(results) {
  const totalFetched = results.reduce((sum, r) => sum + (r.itemsFetched || 0), 0);
  const totalNew = results.reduce((sum, r) => sum + (r.itemsNew || 0), 0);
  const totalPosts = results.reduce((sum, r) => sum + (r.postsCreated || 0), 0);
  const successCount = results.filter(r => r.success).length;
  const totalDuration = results.reduce((sum, r) => sum + (r.duration || 0), 0);
  
  console.log('\n' + '█'.repeat(80));
  console.log('📊 OVERALL SUMMARY');
  console.log('█'.repeat(80));
  console.log(`   Bots Run: ${results.length}`);
  console.log(`   Successful: ${successCount}/${results.length}`);
  console.log(`   Total Items Fetched: ${totalFetched}`);
  console.log(`   Total New Items: ${totalNew}`);
  console.log(`   Total Posts Created: ${totalPosts}`);
  console.log(`   Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
  console.log('█'.repeat(80) + '\n');
}

/**
 * Sleep utility function
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  runBot,
  runMultipleBots,
  printOverallSummary
};

