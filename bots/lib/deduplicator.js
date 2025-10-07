/**
 * Deduplication Service
 * 
 * Tracks processed RSS items in Supabase to prevent duplicate posts
 */

/**
 * Check if an RSS item has already been processed by this bot
 * @param {Object} supabase - Supabase client
 * @param {string} botId - Bot identifier
 * @param {Object} item - RSS item with guid and link
 * @returns {Promise<boolean>} - True if already processed
 */
async function isItemProcessed(supabase, botId, item) {
  try {
    // Check by guid first (more reliable)
    const { data: guidMatch, error: guidError } = await supabase
      .from('processed_rss_items')
      .select('id')
      .eq('bot_id', botId)
      .eq('item_guid', item.guid)
      .limit(1)
      .maybeSingle();
    
    if (guidError && guidError.code !== 'PGRST116') { // PGRST116 = no rows
      console.error('[Deduplicator] Error checking guid:', guidError);
    }
    
    if (guidMatch) {
      console.log(`[Deduplicator] Item already processed (by guid): ${item.title}`);
      return true;
    }
    
    // Fallback: check by link
    const { data: linkMatch, error: linkError } = await supabase
      .from('processed_rss_items')
      .select('id')
      .eq('bot_id', botId)
      .eq('item_link', item.link)
      .limit(1)
      .maybeSingle();
    
    if (linkError && linkError.code !== 'PGRST116') {
      console.error('[Deduplicator] Error checking link:', linkError);
    }
    
    if (linkMatch) {
      console.log(`[Deduplicator] Item already processed (by link): ${item.title}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('[Deduplicator] Unexpected error checking item:', error);
    // In case of error, assume not processed (better to risk duplicate than miss item)
    return false;
  }
}

/**
 * Mark an RSS item as processed
 * @param {Object} supabase - Supabase client
 * @param {string} botId - Bot identifier
 * @param {string} botUsername - Bot username
 * @param {Object} item - RSS item
 * @param {string} postId - Created post ID (optional)
 * @returns {Promise<boolean>} - Success status
 */
async function markItemAsProcessed(supabase, botId, botUsername, item, postId = null) {
  try {
    const { error } = await supabase
      .from('processed_rss_items')
      .insert({
        rss_url: item.feedUrl,
        item_guid: item.guid,
        item_link: item.link,
        item_title: item.title,
        bot_id: botId,
        bot_username: botUsername,
        created_post_id: postId,
        processed_at: new Date().toISOString()
      });
    
    if (error) {
      // If duplicate key error, that's fine (item was already marked)
      if (error.code === '23505') { // PostgreSQL unique violation
        console.log(`[Deduplicator] Item already marked as processed: ${item.title}`);
        return true;
      }
      
      console.error('[Deduplicator] Error marking item as processed:', error);
      return false;
    }
    
    console.log(`[Deduplicator] Marked item as processed: ${item.title}`);
    return true;
  } catch (error) {
    console.error('[Deduplicator] Unexpected error marking item:', error);
    return false;
  }
}

/**
 * Filter out already-processed items from a list
 * @param {Object} supabase - Supabase client
 * @param {string} botId - Bot identifier
 * @param {Array} items - Array of RSS items
 * @returns {Promise<Array>} - Filtered array of unprocessed items
 */
async function filterUnprocessedItems(supabase, botId, items) {
  if (!items || items.length === 0) {
    return [];
  }
  
  console.log(`[Deduplicator] Checking ${items.length} items for duplicates...`);
  
  const unprocessedItems = [];
  
  // Check each item (could be optimized with batch queries, but this is clearer)
  for (const item of items) {
    const processed = await isItemProcessed(supabase, botId, item);
    if (!processed) {
      unprocessedItems.push(item);
    }
  }
  
  console.log(`[Deduplicator] ${unprocessedItems.length} new items found`);
  
  return unprocessedItems;
}

/**
 * Clean up old processed items (older than specified days)
 * @param {Object} supabase - Supabase client
 * @param {number} daysOld - Delete items older than this many days (default: 30)
 * @returns {Promise<number>} - Number of items deleted
 */
async function cleanupOldItems(supabase, daysOld = 30) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    console.log(`[Deduplicator] Cleaning up items older than ${daysOld} days (before ${cutoffDate.toISOString()})...`);
    
    const { data, error } = await supabase
      .from('processed_rss_items')
      .delete()
      .lt('processed_at', cutoffDate.toISOString())
      .select('id');
    
    if (error) {
      console.error('[Deduplicator] Error cleaning up old items:', error);
      return 0;
    }
    
    const deletedCount = data?.length || 0;
    console.log(`[Deduplicator] Deleted ${deletedCount} old items`);
    
    return deletedCount;
  } catch (error) {
    console.error('[Deduplicator] Unexpected error during cleanup:', error);
    return 0;
  }
}

/**
 * Get processing statistics for a bot
 * @param {Object} supabase - Supabase client
 * @param {string} botId - Bot identifier
 * @returns {Promise<Object>} - Statistics object
 */
async function getBotStats(supabase, botId) {
  try {
    // Total processed items
    const { count: totalCount, error: totalError } = await supabase
      .from('processed_rss_items')
      .select('id', { count: 'exact', head: true })
      .eq('bot_id', botId);
    
    if (totalError) {
      console.error('[Deduplicator] Error getting total count:', totalError);
    }
    
    // Items processed in last 24 hours
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const { count: recentCount, error: recentError } = await supabase
      .from('processed_rss_items')
      .select('id', { count: 'exact', head: true })
      .eq('bot_id', botId)
      .gte('processed_at', yesterday.toISOString());
    
    if (recentError) {
      console.error('[Deduplicator] Error getting recent count:', recentError);
    }
    
    return {
      total: totalCount || 0,
      last24Hours: recentCount || 0
    };
  } catch (error) {
    console.error('[Deduplicator] Error getting stats:', error);
    return {
      total: 0,
      last24Hours: 0
    };
  }
}

module.exports = {
  isItemProcessed,
  markItemAsProcessed,
  filterUnprocessedItems,
  cleanupOldItems,
  getBotStats
};

