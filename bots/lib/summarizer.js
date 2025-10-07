/**
 * OpenAI Summarizer
 * 
 * Uses OpenAI API to generate concise, engaging post summaries from RSS items
 */

const OpenAI = require('openai');

/**
 * Create OpenAI client
 * @param {string} apiKey - OpenAI API key
 * @returns {OpenAI} - OpenAI client instance
 */
function createOpenAIClient(apiKey) {
  return new OpenAI({
    apiKey: apiKey || process.env.OPENAI_API_KEY
  });
}

/**
 * Generate a post summary from an RSS item
 * @param {OpenAI} openai - OpenAI client
 * @param {Object} item - RSS item with title and content
 * @param {string} customPrompt - Bot-specific prompt instructions
 * @param {string} model - OpenAI model to use (default: gpt-4o-mini)
 * @returns {Promise<string>} - Generated summary
 */
async function generateSummary(openai, item, customPrompt, model = 'gpt-4o-mini') {
  try {
    // Prepare the content
    const articleContent = `
Title: ${item.title}

Content: ${item.content.substring(0, 2000)} ${item.content.length > 2000 ? '...' : ''}

Link: ${item.link}
    `.trim();
    
    // Build the system prompt
    const systemPrompt = customPrompt || 
      'You are a news bot. Summarize this article in a concise, engaging way (200-280 characters). Include relevant hashtags. Be informative and capture the key points.';
    
    console.log(`[Summarizer] Generating summary for: ${item.title.substring(0, 50)}...`);
    
    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: articleContent
        }
      ],
      max_tokens: 150,
      temperature: 0.7
    });
    
    const summary = completion.choices[0]?.message?.content?.trim();
    
    if (!summary) {
      throw new Error('Empty response from OpenAI');
    }
    
    console.log(`[Summarizer] Generated summary (${summary.length} chars): ${summary.substring(0, 80)}...`);
    
    return summary;
  } catch (error) {
    console.error('[Summarizer] Error generating summary:', error.message);
    
    // Return a fallback summary
    const fallback = `${item.title} - ${item.link}`;
    console.log('[Summarizer] Using fallback summary');
    return fallback.substring(0, 280);
  }
}

/**
 * Generate summaries for multiple items with rate limiting
 * @param {OpenAI} openai - OpenAI client
 * @param {Array} items - Array of RSS items
 * @param {string} customPrompt - Bot-specific prompt instructions
 * @param {number} delayMs - Delay between API calls in milliseconds
 * @param {string} model - OpenAI model to use
 * @returns {Promise<Array>} - Array of items with summaries
 */
async function generateSummariesBatch(openai, items, customPrompt, delayMs = 1000, model = 'gpt-4o-mini') {
  const itemsWithSummaries = [];
  
  console.log(`[Summarizer] Generating summaries for ${items.length} items...`);
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    try {
      const summary = await generateSummary(openai, item, customPrompt, model);
      
      itemsWithSummaries.push({
        ...item,
        summary: summary
      });
      
      // Rate limiting: wait before next API call (except for last item)
      if (i < items.length - 1 && delayMs > 0) {
        await sleep(delayMs);
      }
    } catch (error) {
      console.error(`[Summarizer] Failed to summarize item ${i + 1}:`, error.message);
      // Skip this item
      continue;
    }
  }
  
  console.log(`[Summarizer] Successfully generated ${itemsWithSummaries.length} summaries`);
  
  return itemsWithSummaries;
}

/**
 * Retry wrapper for OpenAI API calls
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} delayMs - Delay between retries
 * @returns {Promise<any>} - Function result
 */
async function retryWithBackoff(fn, maxRetries = 3, delayMs = 1000) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry on certain errors
      if (error.status === 401 || error.status === 403) {
        throw error; // Authentication errors
      }
      
      if (attempt < maxRetries) {
        console.log(`[Summarizer] Attempt ${attempt} failed, retrying in ${delayMs}ms...`);
        await sleep(delayMs * attempt); // Exponential backoff
      }
    }
  }
  
  throw lastError;
}

/**
 * Generate summary with retry logic
 * @param {OpenAI} openai - OpenAI client
 * @param {Object} item - RSS item
 * @param {string} customPrompt - Bot-specific prompt
 * @param {string} model - OpenAI model
 * @param {number} maxRetries - Max retry attempts
 * @returns {Promise<string>} - Generated summary
 */
async function generateSummaryWithRetry(openai, item, customPrompt, model = 'gpt-4o-mini', maxRetries = 3) {
  return await retryWithBackoff(
    () => generateSummary(openai, item, customPrompt, model),
    maxRetries
  );
}

/**
 * Validate that a summary meets requirements
 * @param {string} summary - Generated summary
 * @param {number} minLength - Minimum character length
 * @param {number} maxLength - Maximum character length
 * @returns {boolean} - Whether summary is valid
 */
function validateSummary(summary, minLength = 50, maxLength = 280) {
  if (!summary || typeof summary !== 'string') {
    return false;
  }
  
  const length = summary.trim().length;
  return length >= minLength && length <= maxLength;
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
  createOpenAIClient,
  generateSummary,
  generateSummariesBatch,
  generateSummaryWithRetry,
  retryWithBackoff,
  validateSummary,
  sleep
};

