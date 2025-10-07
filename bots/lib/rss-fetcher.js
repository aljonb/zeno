/**
 * RSS Feed Fetcher
 * 
 * Fetches and parses RSS feeds, filters items by publication date
 */

const Parser = require('rss-parser');
const parser = new Parser({
  timeout: 10000, // 10 second timeout
  headers: {
    'User-Agent': 'BatoRSSBot/1.0'
  }
});

/**
 * Fetch and parse an RSS feed
 * @param {string} feedUrl - The RSS feed URL
 * @returns {Promise<Object>} - Parsed feed data
 */
async function fetchFeed(feedUrl) {
  try {
    console.log(`[RSS Fetcher] Fetching feed: ${feedUrl}`);
    const feed = await parser.parseURL(feedUrl);
    console.log(`[RSS Fetcher] Successfully fetched ${feed.items?.length || 0} items from ${feedUrl}`);
    return {
      success: true,
      feedUrl,
      title: feed.title,
      items: feed.items || [],
      error: null
    };
  } catch (error) {
    console.error(`[RSS Fetcher] Error fetching feed ${feedUrl}:`, error.message);
    return {
      success: false,
      feedUrl,
      title: null,
      items: [],
      error: error.message
    };
  }
}

/**
 * Filter feed items by publication date
 * @param {Array} items - Feed items
 * @param {number} minutesAgo - Filter items published within this many minutes
 * @returns {Array} - Filtered items
 */
function filterItemsByDate(items, minutesAgo = 60) {
  const cutoffTime = new Date(Date.now() - minutesAgo * 60 * 1000);
  
  return items.filter(item => {
    // Try different date fields (RSS feeds vary in their date field names)
    const pubDate = item.pubDate || item.published || item.isoDate;
    
    if (!pubDate) {
      console.warn('[RSS Fetcher] Item has no publication date, skipping:', item.title);
      return false;
    }
    
    const itemDate = new Date(pubDate);
    
    // Check if date is valid
    if (isNaN(itemDate.getTime())) {
      console.warn('[RSS Fetcher] Invalid date format for item:', item.title, pubDate);
      return false;
    }
    
    return itemDate >= cutoffTime;
  });
}

/**
 * Normalize a feed item to a standard format
 * @param {Object} item - Raw feed item
 * @param {string} feedUrl - Source feed URL
 * @returns {Object} - Normalized item
 */
function normalizeItem(item, feedUrl) {
  // Extract the best available content
  const content = item.contentSnippet || item.content || item.description || item.summary || '';
  
  // Get publication date
  const pubDate = item.pubDate || item.published || item.isoDate;
  
  // Generate a unique identifier (prefer guid, fallback to link)
  const guid = item.guid || item.id || item.link;
  
  return {
    guid: guid,
    link: item.link,
    title: item.title || 'Untitled',
    content: content.trim(),
    pubDate: pubDate,
    pubDateObject: new Date(pubDate),
    author: item.creator || item.author || null,
    categories: item.categories || [],
    feedUrl: feedUrl
  };
}

/**
 * Fetch items from multiple feeds
 * @param {Array<string>} feedUrls - Array of feed URLs
 * @param {number} minutesAgo - Filter items published within this many minutes
 * @returns {Promise<Array>} - Array of normalized feed items
 */
async function fetchMultipleFeeds(feedUrls, minutesAgo = 60) {
  console.log(`[RSS Fetcher] Fetching ${feedUrls.length} feeds...`);
  
  // Fetch all feeds concurrently
  const feedResults = await Promise.all(
    feedUrls.map(url => fetchFeed(url))
  );
  
  // Process and combine all items
  const allItems = [];
  
  for (const result of feedResults) {
    if (!result.success) {
      console.warn(`[RSS Fetcher] Skipping failed feed: ${result.feedUrl}`);
      continue;
    }
    
    // Filter by date
    const recentItems = filterItemsByDate(result.items, minutesAgo);
    console.log(`[RSS Fetcher] ${recentItems.length} recent items from ${result.feedUrl}`);
    
    // Normalize items
    const normalizedItems = recentItems.map(item => 
      normalizeItem(item, result.feedUrl)
    );
    
    allItems.push(...normalizedItems);
  }
  
  // Sort by publication date (newest first)
  allItems.sort((a, b) => b.pubDateObject - a.pubDateObject);
  
  console.log(`[RSS Fetcher] Total recent items: ${allItems.length}`);
  
  return allItems;
}

/**
 * Fetch items for a specific bot configuration
 * @param {Object} botConfig - Bot configuration object
 * @param {number} minutesAgo - Filter items published within this many minutes
 * @returns {Promise<Array>} - Array of normalized feed items
 */
async function fetchItemsForBot(botConfig, minutesAgo = 60) {
  if (!botConfig.feeds || botConfig.feeds.length === 0) {
    console.warn(`[RSS Fetcher] Bot ${botConfig.id} has no feeds configured`);
    return [];
  }
  
  console.log(`[RSS Fetcher] Fetching items for bot: ${botConfig.name}`);
  
  return await fetchMultipleFeeds(botConfig.feeds, minutesAgo);
}

module.exports = {
  fetchFeed,
  filterItemsByDate,
  normalizeItem,
  fetchMultipleFeeds,
  fetchItemsForBot
};

