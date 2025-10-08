/**
 * Bot Runner
 * 
 * Main orchestration logic for each bot
 * Coordinates: RSS fetch → deduplication → summarization → posting
 */

const { fetchItemsForBot, fetchItemsForBotSeparately } = require('./rss-fetcher');
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
    maxPostsPerFeed = 2,
    processFeedsSeparately = true,
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
    feedsProcessed: 0,
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
    
    let itemsToProcess = [];
    
    if (processFeedsSeparately) {
      // NEW: Process each feed separately for balanced representation
      console.log(`\n📡 Step 2: Fetching RSS feeds separately (last ${fetchWindowMinutes} minutes)...`);
      const separatedFeeds = await fetchItemsForBotSeparately(botConfig, fetchWindowMinutes);
      
      if (separatedFeeds.length === 0) {
        console.log('ℹ️  No feeds returned any items');
        results.success = true;
        return results;
      }
      
      results.feedsProcessed = separatedFeeds.length;
      
      // Process each feed individually
      for (const feed of separatedFeeds) {
        console.log(`\n🔍 Processing feed: ${feed.feedUrl}`);
        console.log(`   Found ${feed.items.length} recent items`);
        
        results.itemsFetched += feed.items.length;
        
        if (feed.items.length === 0) {
          console.log('   ℹ️  No recent items in this feed');
          continue;
        }
        
        // Step 3: Filter out already-processed items for this feed
        const newItems = await filterUnprocessedItems(supabase, botConfig.id, feed.items);
        results.itemsNew += newItems.length;
        
        if (newItems.length === 0) {
          console.log('   ℹ️  All items from this feed have been processed');
          continue;
        }
        
        console.log(`   ✅ Found ${newItems.length} new items`);
        
        // Attach feedTitle to each item so posts can show the source
        const itemsWithSource = newItems.map(item => ({
          ...item,
          feedTitle: feed.feedTitle || extractDomainName(feed.feedUrl),
          // Add placeholder for AI summary (will be null until summarizer is enabled)
          aiSummary: null,
          originalContent: item.content || item.title
        }));
        
        // Add items with source info
        itemsToProcess.push(...itemsWithSource);
      }
      
      // No overall limit - process ALL new items from all feeds
      
      if (itemsToProcess.length === 0) {
        console.log('\nℹ️  No new items to process from any feed');
        results.success = true;
        return results;
      }
      
      console.log(`\n📊 Total items to process: ${itemsToProcess.length} (from ${results.feedsProcessed} feeds)`);
      
    } else {
      // ORIGINAL: Combine all feeds
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
      
      // Process ALL new items (no limit)
      // Add placeholders for AI summary and original content
      itemsToProcess = newItems.map(item => ({
        ...item,
        aiSummary: null,
        originalContent: item.content || item.title
      }));
    }
    
    // Step 4: SKIP AI summarization (disabled for now - showing original content)
    console.log(`\n📝 Step 4: Using original RSS content (AI summarizer disabled)...`);
    
    // Items already have originalContent and aiSummary (null) from earlier steps
    // When summarizer is re-enabled, uncomment the code below:
    /*
    const itemsWithSummaries = await generateSummariesBatch(
      openai,
      itemsToProcess,
      botConfig.summaryPrompt,
      openaiDelayMs,
      openaiModel
    );
    // Then add: item.aiSummary = summary for each item
    */
    
    const itemsWithSummaries = itemsToProcess; // Use items as-is with original content
    results.itemsSummarized = 0; // No AI summaries generated
    
    console.log(`✅ Prepared ${itemsWithSummaries.length} items with original content`);
    
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
  if (results.feedsProcessed > 0) {
    console.log(`   Feeds Processed: ${results.feedsProcessed}`);
  }
  console.log(`   Items Fetched: ${results.itemsFetched}`);
  console.log(`   New Items: ${results.itemsNew}`);
  console.log(`   AI Summaries Generated: ${results.itemsSummarized} (summarizer disabled)`);
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
 * Extract a readable domain name from a feed URL
 * @param {string} feedUrl - RSS feed URL
 * @returns {string} - Readable domain name
 */
function extractDomainName(feedUrl) {
  try {
    const url = new URL(feedUrl);
    let domain = url.hostname.replace('www.', '');
    domain = domain.charAt(0).toUpperCase() + domain.slice(1);
    return domain;
  } catch {
    return 'Unknown Source';
  }
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

