// Frontend service to call the backend Grok API

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface Sentiment {
  overall: 'bullish' | 'bearish' | 'neutral';
  positive: number;
  negative: number;
  neutral: number;
}

export interface GrokTweet {
  content: string;
  username: string;
  displayName: string;
  impact: 'high' | 'medium' | 'low';
  engagement: number;
  timestamp?: string;
  profileImageUrl?: string;
  imageUrls?: string[] | null;
  verified?: boolean;
}

export interface StockAnalysis {
  ticker: string;
  sentiment?: Sentiment;
  tweets?: GrokTweet[];
  analysis?: string;
  keyDrivers?: string[];
  trendingTopics?: string[];
  success: boolean;
  error?: string;
}

export interface BatchAnalysisResponse {
  success: boolean;
  analyses: StockAnalysis[];
  timestamp: string;
}

export interface SentimentResponse {
  success: boolean;
  sentiment: Sentiment;
  keyDrivers?: string[];
}

export interface TweetsResponse {
  success: boolean;
  tweets: GrokTweet[];
}

export interface InfluentialUser {
  username: string;
  displayName: string;
  verified?: boolean;
  followers?: number;
  description?: string;
  impact?: 'high' | 'medium';
}

export interface UsersResponse {
  success: boolean;
  users: InfluentialUser[];
}

export interface MarketInsight {
  tweetId: string;
  username: string;
  direction: 'bullish' | 'bearish' | 'neutral';
  summary: string;
  displayName?: string;
  supportingTweetIds?: string[];
}

export interface MarketBreakdown {
  overall: 'bullish' | 'bearish' | 'neutral';
  bullish: number;
  bearish: number;
  neutral: number;
}

export interface AnalyzeMarketTweet {
  id: string;
  username: string;
  displayName?: string;
  content: string;
  impact?: 'high' | 'medium' | 'low';
  likes?: number;
  retweets?: number;
  timestamp?: string;
  mentionedStocks?: string[];
}

export interface AnalyzeMarketPosition {
  ticker: string;
  type?: 'stock' | 'option' | 'crypto';
  quantity?: number;
  entryPrice?: number;
  currentPrice?: number;
}

export interface AnalyzeMarketRequest {
  tweets: AnalyzeMarketTweet[];
  watchlist?: string[];
  positions?: AnalyzeMarketPosition[];
}

export interface GrokStockSuggestion {
  id: string;
  ticker: string;
  action: 'buy' | 'sell' | 'hold';
  timeframe?: 'intraday' | 'swing' | 'long_term';
  confidence?: number;
  reason?: string;
  supportingTweetIds?: string[];
  sourceAccounts?: string[];
}

export interface GrokOptionSuggestion {
  id: string;
  ticker: string;
  action: 'buy' | 'sell';
  strategy?: string;
  optionType?: 'call' | 'put';
  strike?: number;
  expiration?: string;
  confidence?: number;
  reason?: string;
  targetPrice?: number;
  premiumEstimate?: number;
  supportingTweetIds?: string[];
}

export interface MarketAnalysisResponse {
  success: boolean;
  sentiment: MarketBreakdown;
  summary?: string;
  keyDrivers?: string[];
  sourceAccounts?: string[];
  topInsights?: MarketInsight[];
  stockSuggestions?: GrokStockSuggestion[];
  optionSuggestions?: GrokOptionSuggestion[];
  analyzedAt?: string;
}

// Analyze single stock (full analysis with sentiment and tweets)
export const analyzeStock = async (stockInput: string): Promise<StockAnalysis> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ stockInput }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to analyze stock');
    }

    const data = await response.json();
    return { ticker: stockInput, ...data, success: true };
  } catch (error: any) {
    console.error('Error analyzing stock:', error);
    throw error;
  }
};

// Analyze multiple stocks
export const analyzeMultipleStocks = async (tickers: string[]): Promise<BatchAnalysisResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/analyze/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tickers }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to analyze stocks');
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('Error analyzing stocks:', error);
    throw error;
  }
};

// Get sentiment for a single stock (faster, for real-time updates)
export const getStockSentiment = async (ticker: string): Promise<SentimentResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/sentiment/${encodeURIComponent(ticker)}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get sentiment');
    }

    return await response.json();
  } catch (error: any) {
    console.error('Error getting sentiment:', error);
    throw error;
  }
};

// Get relevant tweets for a stock
export const getRelevantTweets = async (ticker: string, count: number = 10): Promise<TweetsResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/tweets/${encodeURIComponent(ticker)}?count=${count}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get tweets');
    }

    return await response.json();
  } catch (error: any) {
    console.error('Error getting tweets:', error);
    throw error;
  }
};

// Get sentiment for multiple stocks
export const getMultipleSentiments = async (tickers: string[]): Promise<{ success: boolean; sentiments: Array<{ ticker: string; sentiment: Sentiment; success: boolean }> }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/sentiment/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tickers }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get sentiments');
    }

    return await response.json();
  } catch (error: any) {
    console.error('Error getting sentiments:', error);
    throw error;
  }
};

// Find influential users for a stock
export const findInfluentialUsers = async (ticker: string): Promise<UsersResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(ticker)}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to find users');
    }

    return await response.json();
  } catch (error: any) {
    console.error('Error finding users:', error);
    throw error;
  }
};

// Get tweets from specific users about a stock
export const getTweetsFromUsers = async (ticker: string, usernames: string[] = [], count: number = 10): Promise<TweetsResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/tweets/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ticker, usernames, count }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get tweets');
    }

    return await response.json();
  } catch (error: any) {
    console.error('Error getting tweets from users:', error);
    throw error;
  }
};

// Get overall market sentiment from market-moving accounts
export const getOverallMarketSentiment = async (): Promise<{ success: boolean; sentiment: Sentiment; keyDrivers?: string[]; sourceAccounts?: string[] }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/sentiment/market`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get market sentiment');
    }

    return await response.json();
  } catch (error: any) {
    console.error('Error getting overall market sentiment:', error);
    throw error;
  }
};

// Get real tweets from Twitter API (from specific users)
export const getTweetsFromTwitterAPI = async (usernames: string[] = [], maxResults: number = 10): Promise<TweetsResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/twitter/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ usernames, maxResults }),
    });

    const data = await response.json();
    
    // If Twitter API is unavailable or returned empty, return empty result
    // Frontend will handle fallback to Grok
    if (!response.ok || !data.success) {
      console.warn('Twitter API unavailable or failed, will use Grok fallback');
      return { success: true, tweets: [] };
    }

    // If we got tweets, return them
    if (data.tweets && data.tweets.length > 0) {
      return data;
    }

    // Empty tweets - frontend will fall back to Grok
    return { success: true, tweets: [] };
  } catch (error: any) {
    // On any error, return empty result so frontend can fall back to Grok
    console.warn('Twitter API error, will use Grok fallback:', error.message || error);
    return { success: true, tweets: [] };
  }
};

// Search tweets using Twitter API
export const searchTweetsOnTwitter = async (query: string, maxResults: number = 10): Promise<TweetsResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/twitter/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, maxResults }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to search tweets');
    }

    return await response.json();
  } catch (error: any) {
    console.error('Error searching tweets:', error);
    throw error;
  }
};

// Analyze market sentiment and trade ideas from provided tweets
export const analyzeMarketSentimentFromTweets = async (
  payload: AnalyzeMarketRequest
): Promise<MarketAnalysisResponse> => {
  try {
    console.log('[GrokAPI] Calling market analyze endpoint with', payload.tweets?.length || 0, 'tweets');
    
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/market/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || `HTTP ${response.status}` };
        }
        console.error('[GrokAPI] Market analyze API error:', response.status, errorData);
        throw new Error(errorData.message || errorData.error || `HTTP ${response.status}: Failed to analyze market sentiment`);
      }

      const data = await response.json();

      if (!data.success) {
        console.error('[GrokAPI] Market analyze returned unsuccessful:', data);
        throw new Error(data.message || data.error || 'Failed to analyze market sentiment');
      }

      console.log('[GrokAPI] Market analyze successful:', data.sentiment);
      return data;
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        throw new Error('Request timeout: Market analysis took too long');
      }
      throw fetchError;
    }
  } catch (error: any) {
    console.error('[GrokAPI] Error analyzing market sentiment from tweets:', error);
    // Re-throw with more context
    if (error.message) {
      throw error;
    }
    throw new Error(`Network or API error: ${error.message || 'Unknown error'}`);
  }
};

// Analyze individual tweets to determine their impact on market and specific stocks
export interface TweetImpactAnalysis {
  tweetId: string;
  impactedTickers: string[];
  sentimentPerTicker: Record<string, 'bullish' | 'bearish' | 'neutral'>;
  overallMarketImpact: 'bullish' | 'bearish' | 'neutral' | 'none';
  reasoning?: string;
}

export interface AnalyzeTweetImpactResponse {
  success: boolean;
  analyses: TweetImpactAnalysis[];
  analyzedAt?: string;
}

export const analyzeTweetImpact = async (
  tweets: any[],
  watchlist: string[]
): Promise<AnalyzeTweetImpactResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/tweets/analyze-impact`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tweets, watchlist }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || error.error || 'Failed to analyze tweet impact');
    }

    return await response.json();
  } catch (error: any) {
    console.error('Error analyzing tweet impact:', error);
    throw error;
  }
};

export interface FlowImageAnalysis {
  ticker: string | null;
  expirationDate: string | null;
  strikePrice: number | null;
  premium: number | null;
  optionType: 'call' | 'put' | null;
  action: 'buy' | 'sell' | null;
  volume: number | null;
  confidence: 'high' | 'medium' | 'low';
}

export interface AnalyzeFlowImageResponse {
  success: boolean;
  analysis: FlowImageAnalysis;
  analyzedAt?: string;
  error?: string;
  message?: string;
}

export const analyzeFlowImage = async (
  imageUrl: string
): Promise<FlowImageAnalysis> => {
  try {
    console.log('[FlowImage] Analyzing image:', imageUrl);
    
    const response = await fetch(`${API_BASE_URL}/api/flow/analyze-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageUrl }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || error.error || 'Failed to analyze flow image');
    }

    const data: AnalyzeFlowImageResponse = await response.json();
    
    if (!data.success || !data.analysis) {
      throw new Error(data.message || data.error || 'Failed to analyze flow image');
    }

    console.log('[FlowImage] Analysis result:', data.analysis);
    return data.analysis;
  } catch (error: any) {
    console.error('[FlowImage] Error analyzing image:', error);
    throw error;
  }
};

