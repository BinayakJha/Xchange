import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { analyzeStockWithGrok, getStockSentiment, getRelevantTweets, findInfluentialUsers, getTweetsFromUsers, getOverallMarketSentiment, analyzeMarketFromTweets, analyzeTweetImpact } from './services/grokService.js';
import { getTweetsFromUsers as getTweetsFromTwitterAPI, searchTweets } from './services/twitterService.js';
import { analyzeFlowImage } from './services/imageAnalysisService.js';

dotenv.config();

// Log environment status on startup
console.log('Environment check:');
console.log('GROK_API_KEY:', process.env.GROK_API_KEY ? `SET (${process.env.GROK_API_KEY.substring(0, 20)}...)` : 'NOT SET');
console.log('TWITTER_BEARER_TOKEN:', process.env.TWITTER_BEARER_TOKEN ? `SET (${process.env.TWITTER_BEARER_TOKEN.substring(0, 20)}...)` : 'NOT SET');
console.log('TWITTER_CONSUMER_KEY:', process.env.TWITTER_CONSUMER_KEY ? `SET (${process.env.TWITTER_CONSUMER_KEY.substring(0, 10)}...)` : 'NOT SET');
console.log('PORT:', process.env.PORT || 3001);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Analyze stock endpoint (returns full analysis with sentiment and tweets)
app.post('/api/analyze', async (req, res) => {
  try {
    const { stockInput } = req.body;

    if (!stockInput) {
      return res.status(400).json({ error: 'Stock input is required' });
    }

    console.log(`Analyzing stock: ${stockInput}`);
    const result = await analyzeStockWithGrok(stockInput);

    res.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error analyzing stock:', error);
    res.status(500).json({
      error: 'Failed to analyze stock',
      message: error.message,
    });
  }
});

// Analyze multiple stocks endpoint
app.post('/api/analyze/batch', async (req, res) => {
  try {
    const { tickers } = req.body;

    if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
      return res.status(400).json({ error: 'Tickers array is required' });
    }

    console.log(`Analyzing ${tickers.length} stocks: ${tickers.join(', ')}`);
    
    // Analyze stocks in parallel (with rate limiting consideration)
    const analyses = await Promise.all(
      tickers.map(async (ticker) => {
        try {
          const result = await analyzeStockWithGrok(ticker);
          return { ticker, ...result, success: true };
        } catch (error) {
          console.error(`Error analyzing ${ticker}:`, error);
          return { ticker, error: error.message, success: false };
        }
      })
    );

    res.json({
      success: true,
      analyses,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in batch analysis:', error);
    res.status(500).json({
      error: 'Failed to analyze stocks',
      message: error.message,
    });
  }
});

// Get sentiment for a stock
app.get('/api/sentiment/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    const sentiment = await getStockSentiment(ticker);
    res.json({ success: true, sentiment });
  } catch (error) {
    console.error('Error getting sentiment:', error);
    res.status(500).json({ error: 'Failed to get sentiment', message: error.message });
  }
});

// Get relevant tweets for a stock
app.get('/api/tweets/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    const count = parseInt(req.query.count) || 10;
    const tweets = await getRelevantTweets(ticker, count);
    res.json({ success: true, tweets });
  } catch (error) {
    console.error('Error getting tweets:', error);
    res.status(500).json({ error: 'Failed to get tweets', message: error.message });
  }
});

// Find influential users for a stock
app.get('/api/users/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    const users = await findInfluentialUsers(ticker);
    res.json({ success: true, users });
  } catch (error) {
    console.error('Error finding users:', error);
    res.status(500).json({ error: 'Failed to find users', message: error.message });
  }
});

// Get tweets from specific users about a stock
app.post('/api/tweets/users', async (req, res) => {
  try {
    const { ticker, usernames, count } = req.body;
    if (!ticker) {
      return res.status(400).json({ error: 'Ticker is required' });
    }
    const tweetCount = count || 10;
    const tweets = await getTweetsFromUsers(ticker, usernames || [], tweetCount);
    res.json({ success: true, tweets });
  } catch (error) {
    console.error('Error getting tweets from users:', error);
    res.status(500).json({ error: 'Failed to get tweets', message: error.message });
  }
});

// Get sentiment for multiple stocks
app.post('/api/sentiment/batch', async (req, res) => {
  try {
    const { tickers } = req.body;
    if (!tickers || !Array.isArray(tickers)) {
      return res.status(400).json({ error: 'Tickers array is required' });
    }

    const sentiments = await Promise.all(
      tickers.map(async (ticker) => {
        try {
          const sentiment = await getStockSentiment(ticker);
          return { ticker, sentiment, success: true };
        } catch (error) {
          return { ticker, error: error.message, success: false };
        }
      })
    );

    res.json({ success: true, sentiments });
  } catch (error) {
    console.error('Error in batch sentiment:', error);
    res.status(500).json({ error: 'Failed to get sentiments', message: error.message });
  }
});

// Get overall market sentiment from market-moving accounts
app.get('/api/sentiment/market', async (req, res) => {
  try {
    console.log('Fetching overall market sentiment...');
    const result = await getOverallMarketSentiment();
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error getting overall market sentiment:', error);
    res.status(500).json({ error: 'Failed to get market sentiment', message: error.message });
  }
});

// Analyze provided tweets to determine market sentiment and trade ideas
app.post('/api/market/analyze', async (req, res) => {
  try {
    const { tweets, watchlist = [], positions = [] } = req.body || {};

    if (!Array.isArray(tweets) || tweets.length === 0) {
      return res.status(400).json({ success: false, error: 'tweets array (length > 0) is required' });
    }

    console.log(`[MarketAnalysis] Analyzing ${tweets.length} tweets for sentiment and trade ideas`);

    const result = await analyzeMarketFromTweets(tweets, { watchlist, positions });

    res.json({
      success: true,
      ...result,
      analyzedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error analyzing market from tweets:', error);
    res.status(500).json({ success: false, error: 'Failed to analyze market', message: error.message });
  }
});

// Analyze individual tweets to determine their impact on market and specific stocks
app.post('/api/tweets/analyze-impact', async (req, res) => {
  try {
    const { tweets, watchlist = [] } = req.body || {};

    if (!Array.isArray(tweets) || tweets.length === 0) {
      return res.status(400).json({ success: false, error: 'tweets array (length > 0) is required' });
    }

    console.log(`[TweetImpact] Analyzing ${tweets.length} tweets for market/stock impact`);

    const watchlistTickers = Array.isArray(watchlist) ? watchlist.map(w => typeof w === 'string' ? w : w.ticker).filter(Boolean) : [];
    
    const result = await analyzeTweetImpact(tweets, watchlistTickers);

    res.json({
      success: true,
      analyses: result,
      analyzedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error analyzing tweet impact:', error);
    res.status(500).json({ success: false, error: 'Failed to analyze tweet impact', message: error.message });
  }
});

// Get real tweets from Twitter API (from specific users)
app.post('/api/twitter/users', async (req, res) => {
  try {
    const { usernames, maxResults } = req.body;
    if (!usernames || !Array.isArray(usernames) || usernames.length === 0) {
      return res.status(400).json({ error: 'Usernames array is required' });
    }
    
    console.log(`Fetching tweets from Twitter API for users: ${usernames.join(', ')}`);
    const tweets = await getTweetsFromTwitterAPI(usernames, maxResults || 10);
    
    res.json({ 
      success: true, 
      tweets: tweets.map(tweet => ({
        content: tweet.content,
        username: tweet.username,
        displayName: tweet.displayName,
        verified: tweet.verified,
        profileImageUrl: tweet.profileImageUrl,
        imageUrls: tweet.imageUrls || null,
        impact: tweet.impact,
        engagement: tweet.engagement,
        likes: tweet.likes,
        retweets: tweet.retweets,
        timestamp: tweet.timestamp,
        relevance: 'market_impact',
      }))
    });
  } catch (error) {
    // Check if it's an authentication error
    const isAuthError = error.message?.includes('401') || 
                       error.message?.includes('authentication failed') || 
                       error.message?.includes('Unauthorized');
    
    if (isAuthError) {
      // Return empty tweets array so frontend can fall back to Grok
      console.warn('Twitter API authentication failed. Returning empty result for frontend to fall back to Grok.');
      res.json({ 
        success: true, 
        tweets: [] 
      });
    } else {
      console.error('Error getting tweets from Twitter API:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to get tweets', 
        message: error.message 
      });
    }
  }
});

// Search tweets using Twitter API
app.post('/api/twitter/search', async (req, res) => {
  try {
    const { query, maxResults } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    console.log(`Searching tweets on Twitter API: ${query}`);
    const tweets = await searchTweets(query, maxResults || 10);
    
    res.json({ 
      success: true, 
      tweets: tweets.map(tweet => ({
        content: tweet.content,
        username: tweet.username,
        displayName: tweet.displayName,
        verified: tweet.verified,
        impact: tweet.impact,
        engagement: tweet.engagement,
        likes: tweet.likes,
        retweets: tweet.retweets,
        timestamp: tweet.timestamp,
        relevance: 'direct',
      }))
    });
  } catch (error) {
    console.error('Error searching tweets:', error);
    res.status(500).json({ error: 'Failed to search tweets', message: error.message });
  }
});

// Analyze flow image endpoint
app.post('/api/flow/analyze-image', async (req, res) => {
  try {
    const { imageUrl } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({ error: 'imageUrl is required' });
    }

    console.log(`[FlowImage] Analyzing image: ${imageUrl}`);
    const analysis = await analyzeFlowImage(imageUrl);

    res.json({
      success: true,
      analysis,
      analyzedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error analyzing flow image:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze image',
      message: error.message,
    });
  }
});

// Yahoo Finance proxy endpoints (to avoid CORS issues)
app.get('/api/yahoo/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ error: 'Query parameter q is required' });
    }

    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Yahoo Finance API error: ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error proxying Yahoo Finance search:', error);
    res.status(500).json({ error: 'Failed to search stocks', message: error.message });
  }
});

app.get('/api/yahoo/quote/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    if (!ticker) {
      return res.status(400).json({ error: 'Ticker is required' });
    }

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Yahoo Finance API error: ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error(`Error proxying Yahoo Finance quote for ${req.params.ticker}:`, error);
    res.status(500).json({ error: 'Failed to fetch quote', message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

