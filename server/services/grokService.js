import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Ensure dotenv is loaded
dotenv.config();

const GROK_API_KEY = process.env.GROK_API_KEY;
const API_URL = 'https://api.x.ai/v1/chat/completions';

if (!GROK_API_KEY) {
  console.error('ERROR: GROK_API_KEY not found in environment variables');
  console.error('Current working directory:', process.cwd());
  console.error('NODE_ENV:', process.env.NODE_ENV);
} else {
  console.log('GROK_API_KEY loaded successfully in grokService');
}

// Analyze stock and extract sentiment + tweets
export async function analyzeStockWithGrok(stockInput) {
  if (!GROK_API_KEY) {
    throw new Error('GROK_API_KEY is not configured');
  }

  const prompt = `Analyze the stock "${stockInput}" by examining all recent tweets and discussions on X (Twitter). 

Please provide a JSON response with the following structure:
{
  "sentiment": {
    "overall": "bullish" | "bearish" | "neutral",
    "positive": 0-100,
    "negative": 0-100,
    "neutral": 0-100
  },
  "tweets": [
    {
      "content": "tweet text",
      "username": "username",
      "displayName": "Display Name",
      "impact": "high" | "medium" | "low",
      "engagement": number
    }
  ],
  "analysis": "detailed analysis text",
  "keyDrivers": ["driver1", "driver2"],
  "trendingTopics": ["topic1", "topic2"]
}

Focus on:
1. Extract 5-10 most impactful tweets mentioning ${stockInput}
2. Calculate accurate sentiment percentages (must sum to 100)
3. Identify key themes and drivers
4. Provide comprehensive analysis

Return ONLY valid JSON, no markdown formatting.`;

  const headers = {
    Authorization: `Bearer ${GROK_API_KEY}`,
    'Content-Type': 'application/json',
  };

  const data = {
    model: 'grok-2-1212',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 3000,
    response_format: { type: 'json_object' },
  };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Grok API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const content = result.choices[0].message.content;
    
    // Try to parse as JSON
    try {
      return JSON.parse(content);
    } catch (e) {
      // If not JSON, return as text analysis
      return {
        sentiment: {
          overall: 'neutral',
          positive: 50,
          negative: 25,
          neutral: 25,
        },
        tweets: [],
        analysis: content,
        keyDrivers: [],
        trendingTopics: [],
      };
    }
  } catch (error) {
    console.error('Error calling Grok API:', error);
    throw error;
  }
}

// Get sentiment only (faster, for real-time updates)
export async function getStockSentiment(stockInput) {
  if (!GROK_API_KEY) {
    throw new Error('GROK_API_KEY is not configured');
  }

  const prompt = `Analyze sentiment for stock "${stockInput}" from X/Twitter. Return JSON:
{
  "sentiment": {
    "overall": "bullish" | "bearish" | "neutral",
    "positive": 0-100,
    "negative": 0-100,
    "neutral": 0-100
  },
  "keyDrivers": ["brief driver 1", "brief driver 2"]
}

Return ONLY valid JSON.`;

  const headers = {
    Authorization: `Bearer ${GROK_API_KEY}`,
    'Content-Type': 'application/json',
  };

  const data = {
    model: 'grok-2-1212',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 500,
    response_format: { type: 'json_object' },
  };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Grok API error: ${response.status}`);
    }

    const result = await response.json();
    const content = result.choices[0].message.content;
    return JSON.parse(content);
  } catch (error) {
    console.error('Error getting sentiment:', error);
    throw error;
  }
}

// Get overall market sentiment from market-moving accounts
export async function getOverallMarketSentiment() {
  if (!GROK_API_KEY) {
    throw new Error('GROK_API_KEY is not configured');
  }

  const marketMovingAccounts = ['elonmusk', 'realDonaldTrump', 'Bloomberg', 'CNBC', 'Reuters', 'WSJ', 'MarketWatch', 'YahooFinance', 'FederalReserve', 'JimCramer', 'DeItaone'];

  const prompt = `Analyze the OVERALL MARKET SENTIMENT from tweets by these market-moving accounts on X/Twitter from the LAST 24 HOURS: ${marketMovingAccounts.join(', ')}.

These accounts have significant impact on overall markets, not just individual stocks. Analyze their tweets to determine the general market mood.

Return JSON:
{
  "sentiment": {
    "overall": "bullish" | "bearish" | "neutral",
    "positive": 0-100,
    "negative": 0-100,
    "neutral": 0-100
  },
  "keyDrivers": ["brief driver 1", "brief driver 2", "brief driver 3"],
  "sourceAccounts": ["account1", "account2"]
}

Requirements:
- Analyze tweets from the last 24 hours only
- Focus on overall market sentiment, not individual stocks
- Consider macroeconomic factors, policy changes, market-moving news
- Weight high-impact accounts (elonmusk, FederalReserve, Bloomberg) more heavily
- Return percentages that sum to 100

Return ONLY valid JSON.`;

  const headers = {
    Authorization: `Bearer ${GROK_API_KEY}`,
    'Content-Type': 'application/json',
  };

  const data = {
    model: 'grok-2-1212',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 800,
    response_format: { type: 'json_object' },
  };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Grok API error: ${response.status}`);
    }

    const result = await response.json();
    const content = result.choices[0].message.content;
    const parsed = JSON.parse(content);
    
    return {
      sentiment: parsed.sentiment,
      keyDrivers: parsed.keyDrivers || [],
      sourceAccounts: parsed.sourceAccounts || marketMovingAccounts,
    };
  } catch (error) {
    console.error('Error getting overall market sentiment:', error);
    throw error;
  }
}

// Analyze individual tweets to determine their impact on market and specific stocks
export async function analyzeTweetImpact(tweets = [], watchlistTickers = []) {
  if (!GROK_API_KEY) {
    throw new Error('GROK_API_KEY is not configured');
  }

  if (!Array.isArray(tweets) || tweets.length === 0) {
    return [];
  }

  // Process in batches of 20 tweets to stay within token limits
  const batchSize = 20;
  const batches = [];
  for (let i = 0; i < tweets.length; i += batchSize) {
    batches.push(tweets.slice(i, i + batchSize));
  }

  const allResults = [];

  for (const batch of batches) {
    // Sanitize tweet data to prevent JSON issues
    const tweetData = batch.map((tweet) => ({
      id: String(tweet.id || '').substring(0, 100), // Limit ID length
      username: String(tweet.username || '').substring(0, 50),
      displayName: String(tweet.displayName || tweet.username || '').substring(0, 100),
      content: String(tweet.content || '').substring(0, 500), // Limit content length to prevent token issues
      timestamp: tweet.timestamp || new Date().toISOString(),
      likes: Math.max(0, Math.min(Number(tweet.likes) || 0, 1000000)), // Sanitize numbers
      retweets: Math.max(0, Math.min(Number(tweet.retweets) || 0, 1000000)),
    }));

    const prompt = `You are Grok AI acting as a financial market analyst. Analyze each tweet below and determine:

1. Which specific stocks/cryptocurrencies (tickers) are impacted by this tweet
2. The sentiment direction (bullish, bearish, or neutral) for each impacted ticker
3. Whether the tweet impacts overall market sentiment (MARKET)
4. The confidence level of your analysis

Tweets to analyze (JSON array): ${JSON.stringify(tweetData)}

User's watchlist tickers: ${JSON.stringify(watchlistTickers)}

For EACH tweet, return:
- impactedTickers: Array of ticker symbols (e.g., ["AAPL", "TSLA", "MARKET"]) that this tweet affects
- sentimentPerTicker: Object mapping each ticker to its sentiment direction (e.g., {"AAPL": "bullish", "MARKET": "bearish"})
- overallMarketImpact: "bullish" | "bearish" | "neutral" | "none" - whether this impacts overall market
- reasoning: Brief explanation (max 100 chars) for why each ticker is impacted

Return ONLY valid JSON with this structure:
{
  "tweetAnalyses": [
    {
      "tweetId": "id from provided tweets",
      "impactedTickers": ["AAPL", "MARKET"],
      "sentimentPerTicker": {
        "AAPL": "bullish",
        "MARKET": "neutral"
      },
      "overallMarketImpact": "bullish" | "bearish" | "neutral" | "none",
      "reasoning": "Brief explanation"
    }
  ]
}

Rules:
- Only include tickers that are EXPLICITLY mentioned or CLEARLY impacted by the tweet content
- Do NOT tag tweets with tickers that are unrelated (e.g., don't tag a mayoral election tweet with stock tickers)
- For political/news tweets that affect markets indirectly, use "MARKET" ticker
- Be conservative - only tag if there's a clear connection
- Sentiment should be based on the tweet's actual content and tone, not assumptions`;

    const headers = {
      Authorization: `Bearer ${GROK_API_KEY}`,
      'Content-Type': 'application/json',
    };

    const data = {
      model: 'grok-2-1212',
      messages: [
        { 
          role: 'user', 
          content: prompt + '\n\nIMPORTANT: Return ONLY valid JSON. Ensure all strings are properly escaped. Do not include any markdown formatting or code blocks. The JSON must be parseable.'
        }
      ],
      temperature: 0.3, // Lower temperature for more consistent JSON output
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    };

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`Grok API error: ${response.status}`);
      }

      const result = await response.json();
      const content = result.choices[0].message.content;
      
      // Try to parse JSON with error recovery
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch (parseError) {
        console.error('JSON parse error, attempting to fix malformed JSON...');
        console.error('Error:', parseError.message);
        
        // Try to extract JSON from markdown code blocks if present
        let cleanedContent = content.trim();
        
        // Remove markdown code blocks if present
        cleanedContent = cleanedContent.replace(/```json\n?/gi, '').replace(/```\n?/g, '');
        
        // Try multiple recovery strategies
        let recovered = false;
        
        // Strategy 1: Find and extract the JSON object/array
        const jsonStart = cleanedContent.indexOf('{');
        const jsonEnd = cleanedContent.lastIndexOf('}');
        if (jsonStart >= 0 && jsonEnd > jsonStart) {
          try {
            const extracted = cleanedContent.substring(jsonStart, jsonEnd + 1);
            parsed = JSON.parse(extracted);
            recovered = true;
            console.log('Successfully recovered JSON by extracting object');
          } catch (e) {
            // Continue to next strategy
          }
        }
        
        // Strategy 2: Try to fix common issues and parse again
        if (!recovered) {
          try {
            // Remove any text before first { and after last }
            let fixed = cleanedContent;
            const firstBrace = fixed.indexOf('{');
            const lastBrace = fixed.lastIndexOf('}');
            if (firstBrace >= 0 && lastBrace > firstBrace) {
              fixed = fixed.substring(firstBrace, lastBrace + 1);
            }
            
            // Try to fix unterminated strings by closing them at the end of the object
            // This is a simple heuristic - find unclosed quotes before the last brace
            const quoteCount = (fixed.match(/"/g) || []).length;
            if (quoteCount % 2 !== 0) {
              // Odd number of quotes means unclosed string
              const lastQuote = fixed.lastIndexOf('"');
              if (lastQuote > 0 && lastQuote < lastBrace) {
                // Try to close the string before the last brace
                fixed = fixed.substring(0, lastBrace) + '"' + fixed.substring(lastBrace);
              }
            }
            
            parsed = JSON.parse(fixed);
            recovered = true;
            console.log('Successfully recovered JSON by fixing structure');
          } catch (e) {
            // Continue to next strategy
          }
        }
        
        // Strategy 3: Extract just the tweetAnalyses array
        if (!recovered) {
          try {
            const arrayMatch = cleanedContent.match(/"tweetAnalyses"\s*:\s*(\[[\s\S]*?\])/);
            if (arrayMatch) {
              const arrayStr = arrayMatch[1];
              const analysesArray = JSON.parse(arrayStr);
              parsed = { tweetAnalyses: analysesArray };
              recovered = true;
              console.log('Successfully recovered JSON by extracting array');
            }
          } catch (e) {
            // Last resort failed
          }
        }
        
        if (!recovered) {
          console.error('Could not recover JSON, skipping this batch');
          console.error('Content preview (first 500 chars):', content.substring(0, 500));
          continue; // Skip to next batch
        }
      }

      if (Array.isArray(parsed.tweetAnalyses)) {
        allResults.push(...parsed.tweetAnalyses);
      } else {
        console.warn('Parsed result does not contain tweetAnalyses array:', Object.keys(parsed));
      }
    } catch (error) {
      console.error('Error analyzing tweet impact:', error);
      // Continue with next batch even if one fails
    }
  }

  return allResults;
}

// Analyze provided tweets to extract market sentiment and trade suggestions
export async function analyzeMarketFromTweets(tweets = [], context = {}) {
  if (!GROK_API_KEY) {
    throw new Error('GROK_API_KEY is not configured');
  }

  if (!Array.isArray(tweets) || tweets.length === 0) {
    return {
      sentiment: {
        overall: 'neutral',
        bullish: 34,
        bearish: 33,
        neutral: 33,
      },
      keyDrivers: ['Insufficient tweet data provided for analysis'],
      sourceAccounts: [],
      topInsights: [],
      stockSuggestions: [],
      optionSuggestions: [],
      summary: 'Not enough tweets were available to evaluate current market sentiment.',
    };
  }

  // Trim to top 40 tweets to stay within token limits
  const trimmedTweets = tweets.slice(0, 40).map((tweet) => ({
    id: tweet.id,
    username: tweet.username,
    displayName: tweet.displayName,
    content: tweet.content,
    impact: tweet.impact,
    likes: tweet.likes,
    retweets: tweet.retweets,
    timestamp: tweet.timestamp,
    mentionedStocks: tweet.mentionedStocks,
  }));

  const watchlistTickers = Array.isArray(context.watchlist) ? context.watchlist : [];
  const openPositions = Array.isArray(context.positions)
    ? context.positions.map((pos) => ({
        ticker: pos.ticker,
        type: pos.type || 'stock',
        quantity: pos.quantity,
        entryPrice: pos.entryPrice,
        currentPrice: pos.currentPrice,
      }))
    : [];

  const uniqueAccounts = Array.from(
    new Set(trimmedTweets.map((tweet) => tweet.username))
  );

  const prompt = `You are Grok AI acting as an institutional market strategist. You are given REAL tweets from the last 24 hours (JSON provided below) that are already curated from market-moving X/Twitter accounts.

Tweets JSON (array of objects): ${JSON.stringify(trimmedTweets)}

Additional context:
- Watchlist tickers the user cares about: ${JSON.stringify(watchlistTickers)}
- Current paper positions: ${JSON.stringify(openPositions)}

Tasks:
1. Determine the overall market sentiment (bullish, bearish, neutral) based ONLY on these tweets.
2. Provide percentages for bullish, bearish, and neutral that sum to 100.
3. Identify 3-5 key drivers (short phrases) describing what is moving the market.
4. Select 3-5 of the most impactful tweets from the list and explain how each influences sentiment. Reference the original tweet by its "id".
5. Generate up to 4 stock trade suggestions (buy/sell/hold) focused on the watchlist tickers or other highly impacted tickers mentioned in the tweets.
6. Generate up to 3 option trade ideas (calls/puts or spreads) with strike, expiration (YYYY-MM-DD), and rationale.
7. Use the user's current positions to avoid duplicate trades (e.g., do not recommend buying a stock that is already held unless adding makes sense).

Return ONLY valid JSON with this structure:
{
  "sentiment": {
    "overall": "bullish" | "bearish" | "neutral",
    "bullish": 0-100,
    "bearish": 0-100,
    "neutral": 0-100
  },
  "summary": "one paragraph summary (max 280 characters)",
  "keyDrivers": ["driver 1", "driver 2", "driver 3"],
  "sourceAccounts": ["username1", "username2"],
  "topInsights": [
    {
      "tweetId": "id from provided tweets",
      "username": "tweet author",
      "direction": "bullish" | "bearish" | "neutral",
      "summary": "short explanation referencing the tweet (max 140 chars)"
    }
  ],
  "stockSuggestions": [
    {
      "id": "suggestion identifier",
      "ticker": "AAPL",
      "action": "buy" | "sell" | "hold",
      "timeframe": "intraday" | "swing" | "long_term",
      "confidence": 0-100,
      "reason": "brief rationale referencing tweets or sentiment",
      "supportingTweetIds": ["tweetId1", "tweetId2"]
    }
  ],
  "optionSuggestions": [
    {
      "id": "option-suggestion identifier",
      "ticker": "TSLA",
      "action": "buy" | "sell",
      "strategy": "long_call" | "long_put" | "call_spread" | "put_spread" | "straddle" | "strangle",
      "optionType": "call" | "put",
      "strike": number,
      "expiration": "YYYY-MM-DD",
      "confidence": 0-100,
      "reason": "brief rationale",
      "targetPrice": number,
      "premiumEstimate": number,
      "supportingTweetIds": ["tweetId1"]
    }
  ]
}

Rules:
- Base all conclusions strictly on the provided tweets.
- If data is mixed, the overall sentiment can be neutral, but percentages must still add up to 100.
- Option strikes should be near current prices mentioned; make reasonable assumptions if prices not provided.
- Keep text concise. No markdown.`;

  const headers = {
    Authorization: `Bearer ${GROK_API_KEY}`,
    'Content-Type': 'application/json',
  };

  const data = {
    model: 'grok-2-1212',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.6,
    max_tokens: 2200,
    response_format: { type: 'json_object' },
  };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Grok API error: ${response.status}`);
    }

    const result = await response.json();
    const content = result.choices[0].message.content;
    const parsed = JSON.parse(content);

    const sanitizePercent = (value, fallback) => {
      const num = Number(value);
      if (Number.isFinite(num)) {
        return Math.min(100, Math.max(0, Math.round(num)));
      }
      return fallback;
    };

    const bullish = sanitizePercent(parsed?.sentiment?.bullish, 34);
    const bearish = sanitizePercent(parsed?.sentiment?.bearish, 33);
    const neutral = sanitizePercent(parsed?.sentiment?.neutral, 33);
    const total = bullish + bearish + neutral;
    const adjustFactor = total === 0 ? 1 : 100 / total;

    const sentiment = {
      overall: parsed?.sentiment?.overall || 'neutral',
      bullish: Math.round(bullish * adjustFactor),
      bearish: Math.round(bearish * adjustFactor),
      neutral: Math.max(0, 100 - Math.round(bullish * adjustFactor) - Math.round(bearish * adjustFactor)),
    };

    return {
      sentiment,
      summary: parsed?.summary || '',
      keyDrivers: Array.isArray(parsed?.keyDrivers) ? parsed.keyDrivers : [],
      sourceAccounts:
        Array.isArray(parsed?.sourceAccounts) && parsed.sourceAccounts.length > 0
          ? parsed.sourceAccounts
          : uniqueAccounts,
      topInsights: Array.isArray(parsed?.topInsights) ? parsed.topInsights : [],
      stockSuggestions: Array.isArray(parsed?.stockSuggestions) ? parsed.stockSuggestions : [],
      optionSuggestions: Array.isArray(parsed?.optionSuggestions) ? parsed.optionSuggestions : [],
    };
  } catch (error) {
    console.error('Error analyzing market from tweets:', error);
    throw error;
  }
}

// Find influential users who tweet about a stock
export async function findInfluentialUsers(stockInput) {
  if (!GROK_API_KEY) {
    throw new Error('GROK_API_KEY is not configured');
  }

  const prompt = `Find 10-15 most influential X/Twitter users who regularly tweet about stock "${stockInput}" OR impact overall markets. These should be REAL users who actually exist on X/Twitter:

STOCK-SPECIFIC ACCOUNTS:
- Financial analysts, traders, or investors with verified accounts who tweet about "${stockInput}"
- Accounts with high engagement and followers (100K+) focused on this stock
- Users who have made significant impact with their tweets about this stock
- Accounts known for accurate market insights and predictions about "${stockInput}"

MARKET-MOVING ACCOUNTS (ALWAYS INCLUDE):
- High-profile individuals who impact overall markets: elonmusk, realDonaldTrump, etc.
- Major news organizations: Bloomberg, CNBC, Reuters, WSJ, FinancialTimes
- Market data providers: MarketWatch, YahooFinance, etc.
- Central banks and financial institutions: FederalReserve, etc.
- Well-known finance personalities: JimCramer, etc.

Return JSON:
{
  "users": [
    {
      "username": "actual_twitter_username (without @)",
      "displayName": "Real Display Name",
      "verified": true/false,
      "followers": actual_follower_count,
      "description": "brief description of their expertise",
      "impact": "high" | "medium",
      "type": "stock_specific" | "market_moving" | "news"
    }
  ]
}

Requirements:
- Return ONLY real X/Twitter usernames that exist
- Use actual follower counts
- ALWAYS include market-moving accounts like elonmusk, Bloomberg, etc. even if they don't specifically tweet about "${stockInput}"
- Include news accounts that provide real-time market updates
- Focus on verified accounts when possible
- Mix of stock-specific and general market-impact accounts

Return ONLY valid JSON.`;

  const headers = {
    Authorization: `Bearer ${GROK_API_KEY}`,
    'Content-Type': 'application/json',
  };

  const data = {
    model: 'grok-2-1212',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 1500,
    response_format: { type: 'json_object' },
  };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Grok API error: ${response.status}`);
    }

    const result = await response.json();
    const content = result.choices[0].message.content;
    const parsed = JSON.parse(content);
    return Array.isArray(parsed.users) ? parsed.users : [];
  } catch (error) {
    console.error('Error finding influential users:', error);
    throw error;
  }
}

// Get real tweets from specific users about a stock
export async function getTweetsFromUsers(stockInput, usernames = [], count = 10) {
  if (!GROK_API_KEY) {
    throw new Error('GROK_API_KEY is not configured');
  }

  const usersList = usernames.length > 0 
    ? `from these specific users: ${usernames.join(', ')}`
    : 'from influential financial analysts, traders, and verified accounts';

  // If stockInput is "MARKET" or "GENERAL", fetch general market tweets
  const isGeneralMarket = stockInput === 'MARKET' || stockInput === 'GENERAL';
  const stockContext = isGeneralMarket 
    ? 'general market-moving tweets and financial insights'
    : `about stock "${stockInput}" OR general market-moving tweets`;

  const prompt = `You have access to X/Twitter data. Extract ${count} REAL tweets ${stockContext} ${usersList} on X/Twitter from the LAST 24 HOURS (including today). 

IMPORTANT: These must be ACTUAL tweets that currently exist on X/Twitter. Do NOT make up or generate fake tweets.

PRIORITY ACCOUNTS TO INCLUDE:
- Market-moving individuals: elonmusk, realDonaldTrump, DeItaone, and other high-profile accounts that impact markets
- Real-time news sources: Bloomberg, CNBC, Reuters, WSJ, MarketWatch, YahooFinance
- Financial institutions: FederalReserve, major banks
- Well-known finance personalities: JimCramer, DeItaone, etc.
- CRITICAL: Always include ALL tweets from DeItaone (@DeItaone) from the past 24 hours, regardless of whether they mention "${stockInput}" - this account provides important market insights

Return JSON:
{
  "tweets": [
    {
      "content": "exact tweet text as it appears on X/Twitter",
      "username": "actual_twitter_username (without @)",
      "displayName": "Actual Display Name from their profile",
      "verified": true/false,
      "impact": "high" | "medium" | "low",
      "engagement": actual_likes_plus_retweets,
      "likes": actual_likes_count,
      "retweets": actual_retweets_count,
      "timestamp": "ISO 8601 format timestamp (YYYY-MM-DDTHH:mm:ssZ) when tweet was posted",
      "relevance": "direct" | "market_impact" | "news"
    }
  ]
}

Requirements:
- Return ONLY REAL tweets that exist on X/Twitter from the last 24 hours
- Include tweets from today only (within the last 24 hours)
- Include tweets that:
  1. Directly mention "${stockInput}" OR
  2. Are from market-moving accounts (elonmusk, Bloomberg, etc.) that impact overall markets OR
  3. Are breaking news from Bloomberg, CNBC, Reuters that affect markets
- Use exact tweet content word-for-word as posted
- Use real usernames (without @ symbol)
- Use real display names from their profiles
- Include actual engagement numbers (likes, retweets)
- Prioritize tweets from verified accounts
- Include tweets with high engagement (1000+ likes/retweets)
- Mix of bullish, bearish, and neutral perspectives
- Focus on tweets from financial analysts, traders, market influencers, and news sources
- Include timestamp in ISO 8601 format (e.g., "2024-01-15T14:30:00Z")
- Set "relevance" to "direct" if tweet mentions "${stockInput}", "market_impact" for market-moving accounts, "news" for news sources

DO NOT generate or make up tweets. Only return tweets that actually exist on X/Twitter from the last 24 hours.

Return ONLY valid JSON.`;

  const headers = {
    Authorization: `Bearer ${GROK_API_KEY}`,
    'Content-Type': 'application/json',
  };

  const data = {
    model: 'grok-2-1212',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 3000,
    response_format: { type: 'json_object' },
  };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Grok API error: ${response.status}`);
    }

    const result = await response.json();
    const content = result.choices[0].message.content;
    const parsed = JSON.parse(content);
    return Array.isArray(parsed.tweets) ? parsed.tweets : [];
  } catch (error) {
    console.error('Error getting tweets from users:', error);
    throw error;
  }
}

// Extract relevant tweets for a stock (updated to use influential users)
export async function getRelevantTweets(stockInput, count = 10) {
  if (!GROK_API_KEY) {
    throw new Error('GROK_API_KEY is not configured');
  }

  const prompt = `You have access to X/Twitter data. Extract ${count} REAL tweets about stock "${stockInput}" OR general market-moving tweets from influential accounts on X/Twitter from the LAST 24 HOURS (including today). 

IMPORTANT: These must be ACTUAL tweets that currently exist on X/Twitter. Do NOT make up or generate fake tweets.

PRIORITY ACCOUNTS TO INCLUDE:
- Market-moving individuals: elonmusk, realDonaldTrump, DeItaone, and other high-profile accounts that impact markets
- Real-time news sources: Bloomberg, CNBC, Reuters, WSJ, MarketWatch, YahooFinance
- Financial institutions: FederalReserve, major banks
- Well-known finance personalities: JimCramer, DeItaone, etc.
- Stock-specific analysts and traders who tweet about "${stockInput}"
- CRITICAL: Always include ALL tweets from DeItaone (@DeItaone) from the past 24 hours, regardless of whether they mention "${stockInput}" - this account provides important market insights

Return JSON:
{
  "tweets": [
    {
      "content": "exact tweet text as it appears on X/Twitter",
      "username": "actual_twitter_username (without @)",
      "displayName": "Actual Display Name from their profile",
      "verified": true/false,
      "impact": "high" | "medium" | "low",
      "engagement": actual_likes_plus_retweets,
      "likes": actual_likes_count,
      "retweets": actual_retweets_count,
      "timestamp": "ISO 8601 format timestamp (YYYY-MM-DDTHH:mm:ssZ) when tweet was posted",
      "relevance": "direct" | "market_impact" | "news"
    }
  ]
}

Requirements:
- Return ONLY REAL tweets that exist on X/Twitter from the last 24 hours
- Include tweets from today only (within the last 24 hours)
- Include tweets that:
  1. Directly mention "${stockInput}" OR
  2. Are from market-moving accounts (elonmusk, Bloomberg, etc.) that impact overall markets OR
  3. Are breaking news from Bloomberg, CNBC, Reuters that affect markets
- Use exact tweet content word-for-word as posted
- Use real usernames (without @ symbol)
- Use real display names from their profiles
- Include actual engagement numbers (likes, retweets)
- Prioritize tweets from verified accounts
- Include tweets with high engagement (1000+ likes/retweets)
- Mix of bullish, bearish, and neutral perspectives
- Focus on tweets from financial analysts, traders, market influencers, and news sources
- Include timestamp in ISO 8601 format (e.g., "2024-01-15T14:30:00Z")
- Set "relevance" to "direct" if tweet mentions "${stockInput}", "market_impact" for market-moving accounts, "news" for news sources

DO NOT generate or make up tweets. Only return tweets that actually exist on X/Twitter from the last 24 hours.

Return ONLY valid JSON.`;

  const headers = {
    Authorization: `Bearer ${GROK_API_KEY}`,
    'Content-Type': 'application/json',
  };

  const data = {
    model: 'grok-2-1212',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 3000,
    response_format: { type: 'json_object' },
  };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Grok API error: ${response.status}`);
    }

    const result = await response.json();
    const content = result.choices[0].message.content;
    const parsed = JSON.parse(content);
    return Array.isArray(parsed.tweets) ? parsed.tweets : [];
  } catch (error) {
    console.error('Error getting relevant tweets:', error);
    // Fallback: try to get tweets from influential users
    try {
      const influentialUsers = await findInfluentialUsers(stockInput);
      const usernames = influentialUsers.map(u => u.username).filter(Boolean);
      return await getTweetsFromUsers(stockInput, usernames, count);
    } catch (fallbackError) {
      console.error('Fallback also failed:', fallbackError);
      throw error;
    }
  }
}

