/**
 * Post Creator
 * 
 * Creates posts in Supabase database as bot accounts
 */

/**
 * Create a post in Supabase
 * @param {Object} supabase - Supabase client
 * @param {Object} botConfig - Bot configuration
 * @param {string} content - Post content (original or AI summary)
 * @param {string} sourceUrl - Original article URL (optional)
 * @param {string} sourceName - Name of the RSS feed source (optional)
 * @param {string} originalContent - Full original RSS content (for toggle feature)
 * @param {string} aiSummary - AI-generated summary (null if summarizer disabled)
 * @returns {Promise<Object>} - Created post data or null
 */
async function createPost(supabase, botConfig, content, sourceUrl = null, sourceName = null, originalContent = null, aiSummary = null) {
  try {
    console.log(`[Post Creator] Creating post for bot: ${botConfig.username}`);
    console.log(`[Post Creator] Content: ${content.substring(0, 100)}...`);
    
    // Format content to include source (URL stored separately in rss_source_url)
    let formattedContent = content;
    if (sourceName) {
      formattedContent = `📰 ${sourceName}\n\n${content}`;
    }
    
    // Prepare post data matching your posts table schema
    const postData = {
      content: formattedContent,
      content_type: 'rss_bot', // Mark as RSS bot post
      rss_original_content: originalContent, // Store original for toggle
      rss_ai_summary: aiSummary, // Store AI summary (null if disabled)
      rss_source_url: sourceUrl, // Store source URL
      rss_source_name: sourceName, // Store source name
      user_id: botConfig.user_id,
      user_name: botConfig.name,
      user_email: botConfig.email,
      user_avatar: botConfig.avatar_url,
      image_urls: [], // Bots don't post images (for now)
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // Insert into posts table
    const { data, error } = await supabase
      .from('posts')
      .insert(postData)
      .select()
      .single();
    
    if (error) {
      console.error('[Post Creator] Error creating post:', error);
      return null;
    }
    
    console.log(`[Post Creator] ✅ Post created successfully! ID: ${data.id}`);
    
    return data;
  } catch (error) {
    console.error('[Post Creator] Unexpected error creating post:', error);
    return null;
  }
}

/**
 * Create multiple posts from summarized items
 * @param {Object} supabase - Supabase client
 * @param {Object} botConfig - Bot configuration
 * @param {Array} items - Array of items with summaries
 * @param {number} maxPosts - Maximum posts to create (default: 5)
 * @param {boolean} dryRun - If true, don't actually create posts
 * @returns {Promise<Array>} - Array of created posts
 */
async function createPostsBatch(supabase, botConfig, items, maxPosts = 5, dryRun = false) {
  if (!items || items.length === 0) {
    console.log('[Post Creator] No items to post');
    return [];
  }
  
  // Limit number of posts
  const itemsToPost = items.slice(0, maxPosts);
  console.log(`[Post Creator] Creating ${itemsToPost.length} posts for ${botConfig.username}...`);
  
  if (dryRun) {
    console.log('[Post Creator] 🏃 DRY RUN MODE - Not actually creating posts');
    itemsToPost.forEach((item, index) => {
      const displayContent = item.aiSummary || item.originalContent || item.content || item.title;
      console.log(`\n[DRY RUN] Post ${index + 1}:`);
      console.log(`  Bot: ${botConfig.username}`);
      console.log(`  Title: ${item.title}`);
      console.log(`  Display Content: ${displayContent.substring(0, 100)}...`);
      console.log(`  Has AI Summary: ${item.aiSummary ? 'Yes' : 'No (using original)'}`);
      console.log(`  Link: ${item.link}`);
    });
    return [];
  }
  
  const createdPosts = [];
  
  for (let i = 0; i < itemsToPost.length; i++) {
    const item = itemsToPost[i];
    
    try {
      // Determine what content to show (AI summary if available, otherwise original)
      const displayContent = item.aiSummary || item.originalContent || item.content || item.title;
      const sourceName = item.feedTitle || extractDomainName(item.feedUrl);
      
      // Create post with both original content and AI summary
      const post = await createPost(
        supabase, 
        botConfig, 
        displayContent,           // Content to display now
        item.link,                // Source URL
        sourceName,               // Source name
        item.originalContent || item.content || item.title, // Original content
        item.aiSummary            // AI summary (null if summarizer disabled)
      );
      
      if (post) {
        createdPosts.push({
          post: post,
          item: item
        });
      }
      
      // Small delay between posts to be respectful to the database
      if (i < itemsToPost.length - 1) {
        await sleep(500);
      }
    } catch (error) {
      console.error(`[Post Creator] Error creating post ${i + 1}:`, error);
      // Continue with next post
    }
  }
  
  console.log(`[Post Creator] ✅ Successfully created ${createdPosts.length}/${itemsToPost.length} posts`);
  
  return createdPosts;
}

/**
 * Verify that a bot profile exists in Supabase
 * @param {Object} supabase - Supabase client
 * @param {string} userId - Bot user_id
 * @returns {Promise<boolean>} - Whether profile exists
 */
async function verifyBotProfile(supabase, userId) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, username, full_name')
      .eq('user_id', userId)
      .single();
    
    if (error || !data) {
      console.error(`[Post Creator] Bot profile not found: ${userId}`);
      console.error('[Post Creator] Make sure to run scripts/create-bot-profiles.sql first');
      return false;
    }
    
    console.log(`[Post Creator] ✅ Bot profile verified: ${data.username} (${data.full_name})`);
    return true;
  } catch (error) {
    console.error('[Post Creator] Error verifying bot profile:', error);
    return false;
  }
}

/**
 * Get post statistics for a bot
 * @param {Object} supabase - Supabase client
 * @param {string} userId - Bot user_id
 * @returns {Promise<Object>} - Post statistics
 */
async function getBotPostStats(supabase, userId) {
  try {
    // Total posts
    const { count: totalCount, error: totalError } = await supabase
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    
    if (totalError) {
      console.error('[Post Creator] Error getting total posts:', totalError);
    }
    
    // Posts in last 24 hours
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const { count: recentCount, error: recentError } = await supabase
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', yesterday.toISOString());
    
    if (recentError) {
      console.error('[Post Creator] Error getting recent posts:', recentError);
    }
    
    // Latest post
    const { data: latestPost, error: latestError } = await supabase
      .from('posts')
      .select('content, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (latestError) {
      console.error('[Post Creator] Error getting latest post:', latestError);
    }
    
    return {
      total: totalCount || 0,
      last24Hours: recentCount || 0,
      latestPost: latestPost || null
    };
  } catch (error) {
    console.error('[Post Creator] Error getting post stats:', error);
    return {
      total: 0,
      last24Hours: 0,
      latestPost: null
    };
  }
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
    // Capitalize first letter
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
  createPost,
  createPostsBatch,
  verifyBotProfile,
  getBotPostStats,
  sleep
};

