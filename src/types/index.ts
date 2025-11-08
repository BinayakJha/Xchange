export interface Stock {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  type?: 'stock' | 'crypto'; // Added to distinguish stocks from crypto
}

export interface Tweet {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  avatar: string;
  content: string;
  timestamp: Date;
  mentionedStocks: string[];
  impact: 'high' | 'medium' | 'low';
  likes: number;
  retweets: number;
  sentimentImpact?: Record<string, 'bullish' | 'bearish' | 'neutral'>; // Track sentiment impact per stock
}

export interface Sentiment {
  ticker: string;
  bullish: number;
  bearish: number;
  neutral: number;
  lastUpdated: Date;
  overall?: 'bullish' | 'bearish' | 'neutral';
  keyDrivers?: string[];
  impactingTweetIds?: string[]; // Track which tweets are impacting this sentiment
}

export interface MarketSentiment {
  bullish: number;
  bearish: number;
  neutral: number;
  lastUpdated: Date;
  overall: 'bullish' | 'bearish' | 'neutral';
  keyDrivers?: string[];
  sourceAccounts?: string[];
  summary?: string;
  topInsights?: MarketInsight[];
}

export interface MarketInsight {
  tweetId: string;
  username: string;
  direction: 'bullish' | 'bearish' | 'neutral';
  summary: string;
  displayName?: string;
  supportingTweetIds?: string[];
}

export interface UnusualFlow {
  id: string;
  ticker: string;
  type: 'call' | 'put' | 'volume';
  description: string;
  value: number;
  timestamp: Date;
  imageUrl?: string; // URL to the flow image from Twitter
  tweetId?: string; // Original tweet ID
  tweetUrl?: string; // Link to original tweet
}

export interface PapertradeSuggestion {
  id: string;
  ticker: string;
  action: 'buy' | 'sell' | 'hold';
  reason: string;
  confidence: number;
  timeframe?: 'intraday' | 'swing' | 'long_term';
  type?: 'stock' | 'crypto';
  supportingTweetIds?: string[];
  sourceAccounts?: string[];
}

export interface Position {
  id: string;
  ticker: string;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  type?: 'stock' | 'option' | 'crypto';
  optionDetails?: {
    strike: number;
    expiration: Date;
    optionType: 'call' | 'put';
  };
}

export interface Option {
  ticker: string;
  strike: number;
  expiration: Date;
  optionType: 'call' | 'put';
  premium: number;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
}

export interface OptionSuggestion {
  id: string;
  ticker: string;
  strike: number;
  expiration: Date;
  optionType: 'call' | 'put';
  reason: string;
  confidence: number;
  premium: number;
  targetPrice?: number;
  action?: 'buy' | 'sell';
  strategy?: 'long_call' | 'long_put' | 'call_spread' | 'put_spread' | 'straddle' | 'strangle' | 'iron_condor' | 'collar' | 'covered_call';
  timeframe?: 'intraday' | 'swing' | 'long_term';
  supportingTweetIds?: string[];
  premiumEstimate?: number;
}

export interface User {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
}

export interface WatchlistItem {
  ticker: string;
  addedAt: Date;
}

