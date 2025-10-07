/**
 * RSS Bot Configuration
 * 
 * This file defines all bot accounts and their associated RSS feeds.
 * 
 * IMPORTANT: Before running the bot system:
 * 1. Run scripts/create-bot-profiles.sql to create bot profiles in Supabase
 * 2. Verify bot profiles exist by checking the profiles table
 * 3. Bot user_ids use format: bot_<botname> (no Clerk accounts needed)
 */

const BOT_CONFIGS = [
  {
    // US Politics News Bot
    id: 'us-politics-bot',
    name: 'US Politics Bot',
    username: 'uspolitics',
    email: 'uspolitics@bato.bot',
    user_id: 'bot_uspolitics',
    avatar_url: 'https://api.dicebear.com/7.x/icons/svg?seed=uspolitics&backgroundColor=1e40af',
    bio: '🇺🇸 Bringing you the latest US political news from trusted sources',
    
    // RSS Feed Sources
    feeds: [
      'https://feeds.reuters.com/reuters/politicsNews',
      'https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml',
      'https://www.politico.com/rss/politics08.xml'
    ],
    
    // Posting schedule (cron expression: every 15 minutes)
    schedule: '*/15 * * * *',
    
    // OpenAI prompt customization
    summaryPrompt: 'You are a US Politics news bot. Summarize this political news article in a concise, neutral, informative way (200-280 characters). Include relevant hashtags like #USPolitics #Politics #News. Be engaging but factual.',
  },
  
  {
    // Global Politics News Bot
    id: 'global-politics-bot',
    name: 'Global Politics Bot',
    username: 'globalpolitics',
    email: 'globalpolitics@bato.bot',
    user_id: 'bot_globalpolitics',
    avatar_url: 'https://api.dicebear.com/7.x/icons/svg?seed=globalpolitics&backgroundColor=059669',
    bio: '🌍 Global political news and international affairs from around the world',
    
    feeds: [
      'https://feeds.bbci.co.uk/news/world/rss.xml',
      'https://www.aljazeera.com/xml/rss/all.xml',
      'https://www.theguardian.com/world/rss'
    ],
    
    schedule: '*/15 * * * *',
    
    summaryPrompt: 'You are a Global Politics news bot. Summarize this international news article in a concise, informative way (200-280 characters). Include relevant hashtags like #GlobalPolitics #WorldNews #International. Be engaging and highlight the global significance.',
  },
  
  {
    // MMA News Bot
    id: 'mma-news-bot',
    name: 'MMA News Bot',
    username: 'mmanews',
    email: 'mmanews@bato.bot',
    user_id: 'bot_mmanews',
    avatar_url: 'https://api.dicebear.com/7.x/icons/svg?seed=mmanews&backgroundColor=dc2626',
    bio: '🥊 Your source for MMA, UFC, and combat sports news',
    
    feeds: [
      'https://www.mmafighting.com/rss/current',
      'https://www.youtube.com/gaming/trending',
      'https://rss.app/feeds/qwxrKwMR5B8oYq7k.xml'
    ],
    
    schedule: '*/15 * * * *',
    
    summaryPrompt: 'You are an MMA news bot. Summarize this MMA/combat sports article in an exciting, engaging way (200-280 characters). Include relevant hashtags like #MMA #UFC #CombatSports. Be enthusiastic and capture the energy of the sport.',
  },
  
  {
    // Tech News Bot
    id: 'tech-news-bot',
    name: 'Tech News Bot',
    username: 'technews',
    email: 'technews@bato.bot',
    user_id: 'bot_technews',
    avatar_url: 'https://api.dicebear.com/7.x/icons/svg?seed=technews&backgroundColor=7c3aed',
    bio: '💻 Latest technology news, gadgets, and innovation updates',
    
    feeds: [
      'https://techcrunch.com/feed/',
      'https://www.theverge.com/rss/index.xml',
      'https://feeds.arstechnica.com/arstechnica/index'
    ],
    
    schedule: '*/10 * * * *', // Every 10 minutes (tech news is fast-moving)
    
    summaryPrompt: 'You are a Tech news bot. Summarize this technology article in a clear, exciting way (200-280 characters). Include relevant hashtags like #Tech #Technology #Innovation. Be informative and highlight what makes this newsworthy.',
  },
  
  {
    // World News Bot
    id: 'world-news-bot',
    name: 'World News Bot',
    username: 'worldnews',
    email: 'worldnews@bato.bot',
    user_id: 'bot_worldnews',
    avatar_url: 'https://api.dicebear.com/7.x/icons/svg?seed=worldnews&backgroundColor=0891b2',
    bio: '📰 Breaking news and stories from around the globe',
    
    feeds: [
      'https://rss.app/feeds/qwxrKwMR5B8oYq7k.xml',
      'https://rss.app/feeds/E5L9GwwxQOUEEO2V.xml',
      'https://rss.app/feeds/y9at5b6p3vCdwCnm.xml'
    ],
    
    schedule: '*/10 * * * *', // Every 10 minutes (breaking news)
    
    summaryPrompt: 'You are a World News bot. Summarize this news article in a clear, informative way (200-280 characters). Include relevant hashtags like #WorldNews #Breaking #News. Be neutral and factual, highlighting the key points.',
  }
];

/**
 * Get all bot configurations
 */
function getAllBots() {
  return BOT_CONFIGS;
}

/**
 * Get a specific bot configuration by ID
 */
function getBotById(botId) {
  return BOT_CONFIGS.find(bot => bot.id === botId);
}

/**
 * Get a bot configuration by username
 */
function getBotByUsername(username) {
  return BOT_CONFIGS.find(bot => bot.username === username);
}

/**
 * Validate bot configuration
 * Returns array of validation errors, or empty array if valid
 */
function validateBotConfig(bot) {
  const errors = [];
  
  if (!bot.id) errors.push('Bot ID is required');
  if (!bot.name) errors.push('Bot name is required');
  if (!bot.username) errors.push('Bot username is required');
  if (!bot.email) errors.push('Bot email is required');
  if (!bot.user_id) errors.push('Bot user_id is required');
  if (!bot.feeds || bot.feeds.length === 0) errors.push('At least one RSS feed is required');
  if (!bot.schedule) errors.push('Bot schedule is required');
  
  // Ensure user_id follows bot_ naming convention
  if (bot.user_id && !bot.user_id.startsWith('bot_')) {
    errors.push(`Bot ${bot.id} user_id must start with 'bot_' prefix.`);
  }
  
  return errors;
}

/**
 * Validate all bot configurations
 * Throws error if any bot has validation issues
 */
function validateAllBots() {
  const allErrors = [];
  
  BOT_CONFIGS.forEach(bot => {
    const errors = validateBotConfig(bot);
    if (errors.length > 0) {
      allErrors.push({
        bot: bot.id,
        errors: errors
      });
    }
  });
  
  if (allErrors.length > 0) {
    console.error('❌ Bot configuration validation failed:');
    allErrors.forEach(({ bot, errors }) => {
      console.error(`\n${bot}:`);
      errors.forEach(error => console.error(`  - ${error}`));
    });
    throw new Error('Bot configuration validation failed. Please check the errors above.');
  }
  
  console.log('✅ All bot configurations are valid');
  return true;
}

module.exports = {
  BOT_CONFIGS,
  getAllBots,
  getBotById,
  getBotByUsername,
  validateBotConfig,
  validateAllBots
};


