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
    max_tokens: 2000, // Reduced from 3000 for token efficiency
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

  // Process in batches of 15 tweets (reduced from 20 for token efficiency)
  const batchSize = 15;
  const batches = [];
  for (let i = 0; i < tweets.length; i += batchSize) {
    batches.push(tweets.slice(i, i + batchSize));
  }

  const allResults = [];

  // Helper to truncate tweet content intelligently
  const truncateContent = (content, maxLen = 200) => {
    if (!content || content.length <= maxLen) return content;
    // Try to truncate at word boundary
    const truncated = content.substring(0, maxLen);
    const lastSpace = truncated.lastIndexOf(' ');
    return lastSpace > maxLen * 0.8 ? truncated.substring(0, lastSpace) + '...' : truncated + '...';
  };

  for (const batch of batches) {
    // Optimize tweet data: minimal fields, truncated content
    const tweetData = batch.map((tweet) => ({
      i: String(tweet.id || '').substring(0, 50), // Shortened field name
      u: String(tweet.username || '').substring(0, 30), // Shortened field name
      t: truncateContent(String(tweet.content || ''), 200), // Truncated to 200 chars
      l: Math.min(Number(tweet.likes) || 0, 999999), // Capped
      r: Math.min(Number(tweet.retweets) || 0, 999999), // Capped
    }));

    const prompt = `Analyze tweets for stock impact. Watchlist: ${watchlistTickers.join(',') || 'none'}

Tweets: ${JSON.stringify(tweetData)}

For each tweet (use "i" as tweetId), return:
{
  "tweetAnalyses": [
    {
      "tweetId": "i value",
      "impactedTickers": ["AAPL", "MARKET"],
      "sentimentPerTicker": {"AAPL": "bullish", "MARKET": "neutral"},
      "overallMarketImpact": "bullish|bearish|neutral|none"
    }
  ]
}

Rules:
- Only tag tickers EXPLICITLY mentioned or CLEARLY impacted
- Use "MARKET" for general market news
- Be conservative - only tag clear connections`;

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
        // Map back from shortened field names if needed
        const mappedResults = parsed.tweetAnalyses.map((analysis) => {
          // If tweetId is using short format, find original ID from batch
          const originalTweet = batch.find(t => String(t.id).substring(0, 50) === analysis.tweetId || t.id === analysis.tweetId);
          return {
            ...analysis,
            tweetId: originalTweet?.id || analysis.tweetId,
          };
        });
        allResults.push(...mappedResults);
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

  // Optimize: Reduce to top 20 most impactful tweets, truncate content
  const truncateContent = (content, maxLen = 180) => {
    if (!content || content.length <= maxLen) return content;
    const truncated = content.substring(0, maxLen);
    const lastSpace = truncated.lastIndexOf(' ');
    return lastSpace > maxLen * 0.8 ? truncated.substring(0, lastSpace) + '...' : truncated + '...';
  };

  // Sort by engagement and take top 20
  const sortedTweets = [...tweets]
    .sort((a, b) => ((b.likes || 0) + (b.retweets || 0)) - ((a.likes || 0) + (a.retweets || 0)))
    .slice(0, 20);

  const trimmedTweets = sortedTweets.map((tweet) => ({
    i: String(tweet.id || '').substring(0, 50), // Shortened field
    u: String(tweet.username || '').substring(0, 25), // Shortened
    t: truncateContent(String(tweet.content || ''), 180), // Truncated to 180 chars
    m: Array.isArray(tweet.mentionedStocks) ? tweet.mentionedStocks.slice(0, 3) : [], // Max 3 tickers
    e: Math.min((tweet.likes || 0) + (tweet.retweets || 0), 999999), // Engagement only
  }));

  const watchlistTickers = Array.isArray(context.watchlist) ? context.watchlist.map(w => typeof w === 'string' ? w : w.ticker).filter(Boolean) : [];
  const openPositions = Array.isArray(context.positions)
    ? context.positions.map((pos) => ({
        t: pos.ticker, // Shortened
        q: pos.quantity, // Shortened
        p: pos.currentPrice, // Shortened
      }))
    : [];

  // Extract unique usernames from tweets for sourceAccounts
  const uniqueUsernames = Array.from(
    new Set(trimmedTweets.map(t => t.u).filter(Boolean))
  );

  const prompt = `Market analysis from tweets. Watchlist: ${watchlistTickers.join(',') || 'none'}. Positions: ${openPositions.length || 0}

Tweets from multiple accounts: ${JSON.stringify(trimmedTweets)}

IMPORTANT: Analyze tweets from ALL accounts shown (usernames: ${uniqueUsernames.join(', ')}). Do NOT focus on just one account. Consider perspectives from:
- News sources (Bloomberg, CNBC, Reuters, WSJ)
- Market influencers (elonmusk, realDonaldTrump, JimCramer)
- Financial institutions (FederalReserve)
- Market analysts (DeItaone)

Return JSON:
{
  "sentiment": {"overall": "bullish|bearish|neutral", "bullish": 0-100, "bearish": 0-100, "neutral": 0-100},
  "summary": "max 200 chars",
  "keyDrivers": ["phrase1", "phrase2", "phrase3"],
  "sourceAccounts": [${uniqueUsernames.map(u => `"${u}"`).join(', ')}],
  "topInsights": [{"tweetId": "i value", "username": "u value", "direction": "bullish|bearish|neutral", "summary": "max 100 chars"}],
  "stockSuggestions": [{"id": "s1", "ticker": "AAPL", "action": "buy|sell|hold", "timeframe": "intraday|swing|long_term", "confidence": 0-100, "reason": "brief", "supportingTweetIds": ["i1"]}],
  "optionSuggestions": [{"id": "o1", "ticker": "TSLA", "action": "buy|sell", "strategy": "long_call|long_put|call_spread|put_spread", "optionType": "call|put", "strike": num, "expiration": "YYYY-MM-DD", "confidence": 0-100, "reason": "brief", "targetPrice": num, "premiumEstimate": num, "supportingTweetIds": ["i1"]}]
}

Use "i" as tweetId. Include insights from MULTIPLE accounts in topInsights. Base on tweets only. Keep text concise.`;

  const headers = {
    Authorization: `Bearer ${GROK_API_KEY}`,
    'Content-Type': 'application/json',
  };

    const data = {
      model: 'grok-2-1212',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5, // Slightly lower for more consistent output
      max_tokens: 1800, // Reduced from 2200
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
    let parsed = JSON.parse(content);

    // Map back from shortened field names
    if (parsed.topInsights && Array.isArray(parsed.topInsights)) {
      parsed.topInsights = parsed.topInsights.map((insight) => {
        const originalTweet = sortedTweets.find(t => String(t.id).substring(0, 50) === insight.tweetId || t.id === insight.tweetId);
        return {
          ...insight,
          tweetId: originalTweet?.id || insight.tweetId,
          username: originalTweet?.username || insight.username,
        };
      });
    }
    if (parsed.stockSuggestions && Array.isArray(parsed.stockSuggestions)) {
      parsed.stockSuggestions = parsed.stockSuggestions.map((suggestion) => {
        if (suggestion.supportingTweetIds) {
          suggestion.supportingTweetIds = suggestion.supportingTweetIds.map((tid) => {
            const originalTweet = sortedTweets.find(t => String(t.id).substring(0, 50) === tid || t.id === tid);
            return originalTweet?.id || tid;
          });
        }
        return suggestion;
      });
    }
    if (parsed.optionSuggestions && Array.isArray(parsed.optionSuggestions)) {
      parsed.optionSuggestions = parsed.optionSuggestions.map((suggestion) => {
        if (suggestion.supportingTweetIds) {
          suggestion.supportingTweetIds = suggestion.supportingTweetIds.map((tid) => {
            const originalTweet = sortedTweets.find(t => String(t.id).substring(0, 50) === tid || t.id === tid);
            return originalTweet?.id || tid;
          });
        }
        return suggestion;
      });
    }

    // Use the unique usernames we already extracted, or fallback to extracting from sorted tweets
    const uniqueAccounts = uniqueUsernames.length > 0 
      ? uniqueUsernames 
      : Array.from(new Set(sortedTweets.map((tweet) => tweet.username).filter(Boolean)));

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

  const prompt = `Extract ${count} REAL tweets ${stockContext} ${usersList} from last 24h.

Priority: elonmusk, realDonaldTrump, DeItaone, Bloomberg, CNBC, Reuters, WSJ, MarketWatch, FederalReserve, JimCramer. Include ALL DeItaone tweets.

Return JSON:
{
  "tweets": [
    {
      "content": "exact tweet text",
      "username": "username_no_@",
      "displayName": "Display Name",
      "verified": true/false,
      "impact": "high|medium|low",
      "engagement": likes+retweets,
      "likes": num,
      "retweets": num,
      "timestamp": "ISO8601",
      "relevance": "direct|market_impact|news"
    }
  ]
}

Rules:
- Only REAL tweets from last 24h
- Include: mentions "${stockInput}" OR market-moving accounts OR breaking news
- High engagement preferred (1000+)
- Mix bullish/bearish/neutral
- relevance: "direct" if mentions "${stockInput}", "market_impact" for influencers, "news" for news sources
- Return ONLY valid JSON.`;

  const headers = {
    Authorization: `Bearer ${GROK_API_KEY}`,
    'Content-Type': 'application/json',
  };

  const data = {
    model: 'grok-2-1212',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 2000, // Reduced from 3000 for token efficiency
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

  const prompt = `Extract ${count} REAL tweets about "${stockInput}" OR market-moving tweets from last 24h.

Priority: elonmusk, realDonaldTrump, DeItaone, Bloomberg, CNBC, Reuters, WSJ, MarketWatch, FederalReserve, JimCramer. Include ALL DeItaone tweets.

Return JSON:
{
  "tweets": [
    {
      "content": "exact tweet text",
      "username": "username_no_@",
      "displayName": "Display Name",
      "verified": true/false,
      "impact": "high|medium|low",
      "engagement": likes+retweets,
      "likes": num,
      "retweets": num,
      "timestamp": "ISO8601",
      "relevance": "direct|market_impact|news"
    }
  ]
}

Rules:
- Only REAL tweets from last 24h
- Include: mentions "${stockInput}" OR market-moving accounts OR breaking news
- High engagement preferred (1000+)
- Mix bullish/bearish/neutral
- relevance: "direct" if mentions "${stockInput}", "market_impact" for influencers, "news" for news sources
- Return ONLY valid JSON.`;

  const headers = {
    Authorization: `Bearer ${GROK_API_KEY}`,
    'Content-Type': 'application/json',
  };

  const data = {
    model: 'grok-2-1212',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 2000, // Reduced from 3000 for token efficiency
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

