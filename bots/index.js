#!/usr/bin/env node

/**
 * RSS Bot System - Main Entry Point
 * 
 * Schedules and runs multiple RSS news bots using node-cron
 */

require('dotenv').config();
const cron = require('node-cron');
const { createClient } = require('@supabase/supabase-js');
const { createOpenAIClient } = require('./lib/summarizer');
const { runBot, runMultipleBots } = require('./lib/bot-runner');
const { getAllBots, validateAllBots } = require('./config/bot-feeds');
const { cleanupOldItems } = require('./lib/deduplicator');

// ============================================
// Configuration
// ============================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Bot run options (can be overridden by environment variables)
const RUN_OPTIONS = {
  fetchWindowMinutes: parseInt(process.env.FETCH_WINDOW_MINUTES) || 60,
  maxPostsPerRun: parseInt(process.env.MAX_POSTS_PER_RUN) || 999999, // Effectively unlimited - shows all items
  maxPostsPerFeed: parseInt(process.env.MAX_POSTS_PER_FEED) || 999999, // Effectively unlimited - shows all items
  processFeedsSeparately: process.env.PROCESS_FEEDS_SEPARATELY !== 'false', // default true
  openaiDelayMs: parseInt(process.env.OPENAI_DELAY_MS) || 1000,
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  dryRun: process.env.DRY_RUN === 'true'
};

// ============================================
// Validate Configuration
// ============================================

function validateEnvironment() {
  const errors = [];
  
  if (!SUPABASE_URL) {
    errors.push('SUPABASE_URL is required');
  }
  
  if (!SUPABASE_SERVICE_KEY) {
    errors.push('SUPABASE_SERVICE_KEY is required (use service role key, not anon key)');
  }
  
  if (!OPENAI_API_KEY) {
    errors.push('OPENAI_API_KEY is required');
  }
  
  if (errors.length > 0) {
    console.error('❌ Environment validation failed:');
    errors.forEach(error => console.error(`   - ${error}`));
    console.error('\nPlease check your .env file. See env.example for reference.');
    process.exit(1);
  }
  
  console.log('✅ Environment variables validated');
}

// ============================================
// Initialize Clients
// ============================================

let supabase;
let openai;

function initializeClients() {
  try {
    // Initialize Supabase client with service role key
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    console.log('✅ Supabase client initialized');
    
    // Initialize OpenAI client
    openai = createOpenAIClient(OPENAI_API_KEY);
    console.log('✅ OpenAI client initialized');
    
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize clients:', error);
    return false;
  }
}

// ============================================
// Scheduled Jobs
// ============================================

const scheduledJobs = new Map();

/**
 * Schedule a bot to run on its configured schedule
 */
function scheduleBot(botConfig) {
  const schedule = botConfig.schedule || '*/15 * * * *'; // Default: every 15 minutes
  
  console.log(`📅 Scheduling ${botConfig.name}: ${schedule}`);
  
  const job = cron.schedule(schedule, async () => {
    try {
      await runBot(supabase, openai, botConfig, RUN_OPTIONS);
    } catch (error) {
      console.error(`❌ Error in scheduled job for ${botConfig.name}:`, error);
    }
  }, {
    scheduled: false, // Don't start immediately
    timezone: process.env.TZ || 'UTC'
  });
  
  scheduledJobs.set(botConfig.id, job);
  
  return job;
}

/**
 * Schedule all bots
 */
function scheduleAllBots() {
  const bots = getAllBots();
  
  console.log(`\n📅 Scheduling ${bots.length} bots...`);
  
  bots.forEach((bot, index) => {
    // Stagger initial runs by 30 seconds per bot to avoid overwhelming APIs
    setTimeout(() => {
      scheduleBot(bot);
      scheduledJobs.get(bot.id).start();
      console.log(`✅ Started schedule for ${bot.name}`);
    }, index * 30000);
  });
  
  console.log(`✅ All bots scheduled\n`);
}

/**
 * Run all bots immediately (manual trigger)
 */
async function runAllBotsNow() {
  const bots = getAllBots();
  await runMultipleBots(supabase, openai, bots, RUN_OPTIONS);
}

/**
 * Run a single bot by ID (manual trigger)
 */
async function runBotById(botId) {
  const bots = getAllBots();
  const bot = bots.find(b => b.id === botId);
  
  if (!bot) {
    console.error(`❌ Bot not found: ${botId}`);
    return;
  }
  
  await runBot(supabase, openai, bot, RUN_OPTIONS);
}

// ============================================
// Periodic Cleanup
// ============================================

/**
 * Schedule periodic cleanup of old processed items
 */
function scheduleCleanup() {
  // Run cleanup daily at 3 AM UTC
  const cleanupJob = cron.schedule('0 3 * * *', async () => {
    console.log('\n🧹 Running scheduled cleanup...');
    try {
      await cleanupOldItems(supabase, 30); // Delete items older than 30 days
      console.log('✅ Cleanup completed\n');
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
    }
  }, {
    timezone: process.env.TZ || 'UTC'
  });
  
  console.log('✅ Scheduled daily cleanup (3 AM UTC)');
  
  return cleanupJob;
}

// ============================================
// Graceful Shutdown
// ============================================

function setupGracefulShutdown() {
  const shutdown = async (signal) => {
    console.log(`\n\n⚠️  Received ${signal}, shutting down gracefully...`);
    
    // Stop all scheduled jobs
    console.log('🛑 Stopping scheduled jobs...');
    scheduledJobs.forEach((job, botId) => {
      job.stop();
      console.log(`   Stopped: ${botId}`);
    });
    
    console.log('✅ All jobs stopped');
    console.log('👋 Goodbye!\n');
    
    process.exit(0);
  };
  
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// ============================================
// Main Function
// ============================================

async function main() {
  console.log('\n' + '█'.repeat(80));
  console.log('🤖 RSS Bot System Starting...');
  console.log('█'.repeat(80) + '\n');
  
  // Validate environment
  validateEnvironment();
  
  // Validate bot configurations
  try {
    validateAllBots();
  } catch (error) {
    console.error('❌ Bot configuration validation failed');
    process.exit(1);
  }
  
  // Initialize clients
  if (!initializeClients()) {
    console.error('❌ Failed to initialize clients');
    process.exit(1);
  }
  
  // Setup graceful shutdown
  setupGracefulShutdown();
  
  // Check for command line arguments
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (command === 'now' || command === 'run') {
    // Run all bots immediately and exit
    console.log('🚀 Running all bots immediately (one-time run)...\n');
    await runAllBotsNow();
    console.log('\n✅ One-time run completed. Exiting...\n');
    process.exit(0);
  } else if (command === 'bot' && args[1]) {
    // Run a specific bot immediately and exit
    const botId = args[1];
    console.log(`🚀 Running bot: ${botId} (one-time run)...\n`);
    await runBotById(botId);
    console.log('\n✅ One-time run completed. Exiting...\n');
    process.exit(0);
  } else if (command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    process.exit(0);
  }
  
  // Default: Schedule all bots to run periodically
  if (RUN_OPTIONS.dryRun) {
    console.log('⚠️  DRY RUN MODE ENABLED - Posts will not be created\n');
  }
  
  console.log('Configuration:');
  console.log(`   Fetch Window: ${RUN_OPTIONS.fetchWindowMinutes} minutes`);
  console.log(`   Max Posts/Run: ${RUN_OPTIONS.maxPostsPerRun}`);
  console.log(`   Max Posts/Feed: ${RUN_OPTIONS.maxPostsPerFeed}`);
  console.log(`   Process Feeds Separately: ${RUN_OPTIONS.processFeedsSeparately}`);
  console.log(`   OpenAI Model: ${RUN_OPTIONS.openaiModel}`);
  console.log(`   OpenAI Delay: ${RUN_OPTIONS.openaiDelayMs}ms`);
  console.log(`   Dry Run: ${RUN_OPTIONS.dryRun}`);
  console.log('');
  
  // Schedule cleanup
  scheduleCleanup();
  
  // Schedule all bots
  scheduleAllBots();
  
  // Run initial cleanup
  console.log('🧹 Running initial cleanup...');
  await cleanupOldItems(supabase, 30);
  
  console.log('\n' + '█'.repeat(80));
  console.log('✅ Bot system is running!');
  console.log('   Press Ctrl+C to stop');
  console.log('█'.repeat(80) + '\n');
}

// ============================================
// Help Text
// ============================================

function printHelp() {
  console.log(`
RSS Bot System - Help

Usage:
  node index.js [command] [options]

Commands:
  (none)          Start the bot system with scheduled jobs (default)
  now, run        Run all bots once immediately and exit
  bot <bot-id>    Run a specific bot once and exit
  help            Show this help message

Examples:
  node index.js                    # Start scheduled bot system
  node index.js now                # Run all bots once
  node index.js bot us-politics-bot  # Run US Politics bot once

Environment Variables:
  See env.example for all available configuration options

Bot IDs:
  - us-politics-bot
  - global-politics-bot
  - mma-news-bot
  - tech-news-bot
  - world-news-bot
`);
}

// ============================================
// Run
// ============================================

if (require.main === module) {
  main().catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = {
  runBot,
  runMultipleBots,
  runAllBotsNow,
  runBotById
};

