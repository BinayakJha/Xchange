import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import {
  WatchlistItem,
  Tweet,
  Sentiment,
  Position,
  Stock,
  MarketSentiment,
  PapertradeSuggestion,
  OptionSuggestion,
  MarketInsight,
  UnusualFlow,
} from '../types';
import { allStocks, mockPapertradeSuggestions, mockOptionSuggestions } from '../data/mockData';
import { getStockQuote, updateStockPrices as fetchStockPrices } from '../services/stockApi';

interface AppContextType {
  watchlist: WatchlistItem[];
  addToWatchlist: (ticker: string) => void;
  removeFromWatchlist: (ticker: string) => void;
  tweets: Tweet[];
  addTweet: (tweet: Tweet) => void;
  sentiments: Record<string, Sentiment>;
  updateSentiment: (ticker: string, sentiment: Sentiment) => void;
  marketSentiment: MarketSentiment | null;
  updateMarketSentiment: (sentiment: MarketSentiment) => void;
  marketInsights: MarketInsight[];
  tradeSuggestions: PapertradeSuggestion[];
  optionSuggestions: OptionSuggestion[];
  unusualFlows: UnusualFlow[];
  positions: Position[];
  addPosition: (position: Position) => void;
  removePosition: (id: string) => void;
  updateStockPrices: () => void;
  isAuthenticated: boolean;
  setAuthenticated: (value: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [tweets, setTweets] = useState<Tweet[]>([]); // Start with empty, will be populated by Grok
  const [sentiments, setSentiments] = useState<Record<string, Sentiment>>({});
  const [marketSentiment, setMarketSentiment] = useState<MarketSentiment | null>(null);
  const [marketInsights, setMarketInsights] = useState<MarketInsight[]>([]);
  const [tradeSuggestions, setTradeSuggestions] = useState<PapertradeSuggestion[]>(mockPapertradeSuggestions);
  const [optionSuggestions, setOptionSuggestions] = useState<OptionSuggestion[]>(mockOptionSuggestions);
  const [unusualFlows, setUnusualFlows] = useState<UnusualFlow[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [isAuthenticated, setAuthenticated] = useState(false);
  const isUpdatingPricesRef = React.useRef(false);
  const isFetchingTweetsRef = React.useRef(false);
  const lastTweetFetchRef = React.useRef<number>(0);
  const isAnalyzingMarketRef = React.useRef(false);
  const lastMarketAnalysisRef = React.useRef<number>(0);
  const influentialUsersRef = React.useRef<Record<string, string[]>>({}); // Cache of influential users per ticker

  const addToWatchlist = useCallback((ticker: string) => {
    try {
      if (!ticker || !ticker.trim()) {
        console.warn('Invalid ticker provided to addToWatchlist');
        return;
      }
      
      const normalizedTicker = ticker.trim().toUpperCase();
      setWatchlist((prev) => {
        if (prev.some((item) => item.ticker === normalizedTicker)) {
          return prev; // Already in watchlist
        }
        return [...prev, { ticker: normalizedTicker, addedAt: new Date() }];
      });
    } catch (error) {
      console.error('Error adding to watchlist:', error);
    }
  }, []);

  const removeFromWatchlist = useCallback((ticker: string) => {
    setWatchlist((prev) => prev.filter((item) => item.ticker !== ticker));
  }, []);

  const addTweet = useCallback((tweet: Tweet) => {
    setTweets((prev) => [tweet, ...prev]);
  }, []);

  const updateSentiment = useCallback((ticker: string, sentiment: Sentiment) => {
    setSentiments((prev) => ({ ...prev, [ticker]: sentiment }));
  }, []);

  const updateMarketSentiment = useCallback((sentiment: MarketSentiment) => {
    setMarketSentiment(sentiment);
  }, []);

  const addPosition = useCallback((position: Position) => {
    setPositions((prev) => [...prev, position]);
  }, []);

  const removePosition = useCallback((id: string) => {
    setPositions((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const updateStockPrices = useCallback(async () => {
    // Prevent concurrent calls
    if (isUpdatingPricesRef.current) {
      return;
    }

    try {
      isUpdatingPricesRef.current = true;

      // Get all unique tickers from watchlist and positions
      const tickers = new Set<string>();
      watchlist.forEach((item) => {
        if (item && item.ticker) {
          tickers.add(item.ticker);
        }
      });
      positions.forEach((pos) => {
        if (pos && pos.ticker) {
          tickers.add(pos.ticker);
        }
      });

      if (tickers.size === 0) {
        isUpdatingPricesRef.current = false;
        return;
      }

      // Fetch real stock prices
      const priceMap = await fetchStockPrices(Array.from(tickers));

      // Store updated stocks for components to use
      // This will trigger re-renders in components using watchlist stocks

      // Update positions with real prices
      setPositions((prev) =>
        prev.map((pos) => {
          if (!pos || !pos.ticker) return pos;
          
          const stock = priceMap.get(pos.ticker);
          if (!stock) return pos;

          try {
            if (pos.type === 'option' && pos.optionDetails) {
              // Calculate option premium based on stock price, strike, and time to expiration
              const daysToExp = Math.ceil(
                (pos.optionDetails.expiration.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
              );
              const intrinsicValue =
                pos.optionDetails.optionType === 'call'
                  ? Math.max(0, stock.price - pos.optionDetails.strike)
                  : Math.max(0, pos.optionDetails.strike - stock.price);
              
              // Simple time value calculation (decays as expiration approaches)
              const timeValue = daysToExp > 0 ? (daysToExp / 30) * stock.price * 0.01 : 0;
              const newPremium = Math.max(0.01, intrinsicValue + timeValue);

              const pnl = (newPremium - pos.entryPrice) * pos.quantity * 100; // Options are per 100 shares
              const pnlPercent = pos.entryPrice > 0 ? ((newPremium - pos.entryPrice) / pos.entryPrice) * 100 : 0;

              return {
                ...pos,
                currentPrice: newPremium,
                pnl,
                pnlPercent,
              };
            } else if (pos.type === 'crypto') {
              // Crypto position - prices update via WebSocket, but we can also update here
              const newPrice = stock.price || pos.currentPrice;
              const pnl = (newPrice - pos.entryPrice) * pos.quantity;
              const pnlPercent = pos.entryPrice > 0 ? ((newPrice - pos.entryPrice) / pos.entryPrice) * 100 : 0;
              return {
                ...pos,
                currentPrice: newPrice,
                pnl,
                pnlPercent,
              };
            } else {
              // Stock position
              const newPrice = stock.price || pos.currentPrice;
              const pnl = (newPrice - pos.entryPrice) * pos.quantity;
              const pnlPercent = pos.entryPrice > 0 ? ((newPrice - pos.entryPrice) / pos.entryPrice) * 100 : 0;
              return {
                ...pos,
                currentPrice: newPrice,
                pnl,
                pnlPercent,
              };
            }
          } catch (error) {
            console.error('Error updating position:', error);
            return pos; // Return unchanged position on error
          }
        })
      );
    } catch (error) {
      console.error('Error updating stock prices:', error);
      // Don't crash - just log the error
    } finally {
      isUpdatingPricesRef.current = false;
    }
  }, [watchlist, positions]);

  // Calculate sentiment from Grok AI (real-time)
  React.useEffect(() => {
    if (!watchlist || watchlist.length === 0 || !isAuthenticated) return;

    const fetchSentiments = async () => {
      try {
        const tickers = watchlist.map((item) => item.ticker).filter(Boolean);
        if (tickers.length === 0) {
          console.log('[Sentiment] No tickers in watchlist, skipping sentiment fetch');
          return;
        }

        console.log('[Sentiment] Fetching sentiment for:', tickers);

        // Use Grok API to get real sentiment
        const { getMultipleSentiments } = await import('../services/grokApi');
        
        try {
          const result = await getMultipleSentiments(tickers);
          console.log('[Sentiment] Grok API response:', result);

          if (!result || result.success === false || !Array.isArray(result.sentiments) || result.sentiments.length === 0) {
            console.warn('[Sentiment] Grok API returned no sentiments, falling back to tweet analysis');
            calculateSentimentFromTweets();
            return;
          }

          result.sentiments.forEach((item) => {
            if (item.success && item.sentiment) {
              const sentiment: Sentiment = {
                ticker: item.ticker,
                bullish: item.sentiment.positive || 0,
                bearish: item.sentiment.negative || 0,
                neutral: item.sentiment.neutral || 0,
                lastUpdated: new Date(),
                overall: item.sentiment.overall,
                keyDrivers: (item as any).keyDrivers || [],
              };
              console.log(`[Sentiment] Updating sentiment for ${item.ticker}:`, sentiment);
              updateSentiment(item.ticker, sentiment);
            } else {
              console.warn(`[Sentiment] Failed to get sentiment for ${item.ticker}:`, item);
            }
          });
        } catch (error) {
          console.error('[Sentiment] Error fetching Grok sentiments, falling back to tweet analysis:', error);
          // Fallback to tweet-based sentiment calculation
          calculateSentimentFromTweets();
        }
      } catch (error) {
        console.error('[Sentiment] Error in sentiment calculation:', error);
        // Fallback to tweet-based sentiment
        calculateSentimentFromTweets();
      }
    };

    const calculateSentimentFromTweets = () => {
      try {
        console.log('[Sentiment] Calculating sentiment from tweets. Total tweets:', tweets.length);
        
        watchlist.forEach((item) => {
          if (!item || !item.ticker) return;

          // Normalize ticker for matching (handle crypto format like BTC-USD -> BTC)
          const normalizedTicker = item.ticker.toUpperCase();
          const baseTicker = normalizedTicker.includes('-') ? normalizedTicker.split('-')[0] : normalizedTicker;

          // Find relevant tweets - only use tweets that actually mention this ticker
          const relevantTweets = tweets.filter((t) => {
            if (!t || !t.content) return false;
            
            // First check if tweet is explicitly tagged with this ticker
            if (t.mentionedStocks && Array.isArray(t.mentionedStocks)) {
              const hasExplicitTag = t.mentionedStocks.some((mentioned) => {
                const mentionedUpper = mentioned.toUpperCase();
                const mentionedBase = mentionedUpper.includes('-') ? mentionedUpper.split('-')[0] : mentionedUpper;
                return mentionedUpper === normalizedTicker || mentionedBase === baseTicker;
              });
              if (hasExplicitTag) return true;
            }
            
            // Also check tweet content for actual mentions (double-check)
            const contentUpper = t.content.toUpperCase();
            const exactPattern = new RegExp(`\\$${normalizedTicker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|\\b${normalizedTicker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
            if (exactPattern.test(t.content)) return true;
            
            if (baseTicker.length >= 2) {
              const basePattern = new RegExp(`\\$${baseTicker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|\\b${baseTicker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
              if (basePattern.test(t.content)) return true;
            }
            
            // Check for company name mentions
            const companyNames: Record<string, string[]> = {
              'AAPL': ['APPLE', 'IPHONE', 'IPAD', 'MACBOOK'],
              'MSFT': ['MICROSOFT', 'WINDOWS', 'AZURE'],
              'GOOGL': ['GOOGLE', 'ALPHABET', 'YOUTUBE'],
              'AMZN': ['AMAZON', 'AWS'],
              'TSLA': ['TESLA'],
              'NVDA': ['NVIDIA'],
              'META': ['FACEBOOK', 'META', 'INSTAGRAM'],
              'BTC': ['BITCOIN'],
              'ETH': ['ETHEREUM'],
              'SPY': ['S&P', 'SP500', 'SP 500'],
            };
            
            const names = companyNames[baseTicker] || [];
            if (names.some(name => contentUpper.includes(name))) return true;
            
            return false;
          });
          
          console.log(`[Sentiment] Found ${relevantTweets.length} relevant tweets for ${item.ticker}`);

          // If no relevant tweets, use default neutral sentiment
          if (relevantTweets.length === 0) {
            console.log(`[Sentiment] No tweets found for ${item.ticker}, using default neutral sentiment`);
            updateSentiment(item.ticker, {
              ticker: item.ticker,
              bullish: 33,
              bearish: 33,
              neutral: 34,
              lastUpdated: new Date(),
              overall: 'neutral',
            });
            return;
          }

          let bullish = 0;
          let bearish = 0;
          let neutral = 0;

          const impactingTweetIds: string[] = [];
          const tweetUpdates: Map<string, Record<string, 'bullish' | 'bearish' | 'neutral'>> = new Map();

          // Enhanced sentiment analysis with more keywords
          relevantTweets.forEach((tweet) => {
            if (!tweet || !tweet.content) return;
            
            const content = tweet.content.toLowerCase();
            
            // Expanded keyword lists with financial/political context
            const bullishWords = [
              'bullish', 'buy', 'up', 'growth', 'strong', 'positive', 'rise', 'gain', 'rally',
              'surge', 'soar', 'climb', 'boost', 'momentum', 'breakout', 'outperform', 'bull',
              'higher', 'increase', 'advance', 'profit', 'earnings beat', 'beat expectations',
              'optimistic', 'recovery', 'expansion', 'upside', 'bull market'
            ];
            const bearishWords = [
              'bearish', 'sell', 'down', 'weak', 'negative', 'drop', 'fall', 'short', 'crash',
              'plunge', 'decline', 'dip', 'slump', 'correction', 'underperform', 'bear',
              'lower', 'decrease', 'loss', 'miss', 'missed expectations', 'disappoint',
              'pessimistic', 'recession', 'decline', 'bear market', 'concern', 'worried',
              'fear', 'uncertainty', 'risk', 'volatility', 'trepidation', 'disruption',
              'regulation', 'regulatory', 'tax hike', 'lawless', 'business environment',
              'wall street', 'financier', 'billionaire', 'skeptical', 'antagonize'
            ];

            const bullishCount = bullishWords.filter((word) => content.includes(word)).length;
            const bearishCount = bearishWords.filter((word) => content.includes(word)).length;

            // Weight by impact level
            const impactWeight = tweet.impact === 'high' ? 2 : tweet.impact === 'medium' ? 1.5 : 1;

            // Determine tweet's sentiment direction for this stock
            let tweetSentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral';
            if (bullishCount > bearishCount) {
              bullish += impactWeight;
              tweetSentiment = 'bullish';
            } else if (bearishCount > bullishCount) {
              bearish += impactWeight;
              tweetSentiment = 'bearish';
            } else {
              neutral += impactWeight;
              tweetSentiment = 'neutral';
            }

            // Track this tweet as impacting this stock
            impactingTweetIds.push(tweet.id);

            // Store sentiment impact for batch update
            if (!tweetUpdates.has(tweet.id)) {
              tweetUpdates.set(tweet.id, {});
            }
            tweetUpdates.get(tweet.id)![item.ticker] = tweetSentiment;
          });

          // Batch update all tweets with sentiment impact
          if (tweetUpdates.size > 0) {
            setTweets((currentTweets) => {
              return currentTweets.map((t) => {
                const updates = tweetUpdates.get(t.id);
                if (updates) {
                  return {
                    ...t,
                    sentimentImpact: {
                      ...(t.sentimentImpact || {}),
                      ...updates,
                    },
                  };
                }
                return t;
              });
            });
          }

          const total = bullish + bearish + neutral;
          
          // Ensure we have valid percentages that sum to 100
          let bullishPercent = total > 0 ? Math.round((bullish / total) * 100) : 33;
          let bearishPercent = total > 0 ? Math.round((bearish / total) * 100) : 33;
          let neutralPercent = total > 0 ? Math.round((neutral / total) * 100) : 34;

          // Normalize to ensure they sum to 100
          const sum = bullishPercent + bearishPercent + neutralPercent;
          if (sum !== 100) {
            const diff = 100 - sum;
            if (diff > 0) {
              neutralPercent += diff;
            } else {
              // If over 100, proportionally reduce
              bullishPercent = Math.round((bullishPercent / sum) * 100);
              bearishPercent = Math.round((bearishPercent / sum) * 100);
              neutralPercent = 100 - bullishPercent - bearishPercent;
            }
          }

          // Determine overall sentiment
          let overall: 'bullish' | 'bearish' | 'neutral' = 'neutral';
          if (bullishPercent > bearishPercent + 10) {
            overall = 'bullish';
          } else if (bearishPercent > bullishPercent + 10) {
            overall = 'bearish';
          }

          const sentiment: Sentiment = {
            ticker: item.ticker,
            bullish: bullishPercent,
            bearish: bearishPercent,
            neutral: neutralPercent,
            lastUpdated: new Date(),
            overall,
            impactingTweetIds, // Track which tweets are impacting this sentiment
          };

          console.log(`[Sentiment] Calculated sentiment for ${item.ticker}:`, sentiment);
          updateSentiment(item.ticker, sentiment);
        });
      } catch (error) {
        console.error('[Sentiment] Error calculating sentiment from tweets:', error);
      }
    };

    // Always calculate from tweets first (immediate feedback)
    // Then try to enhance with Grok API if available
    calculateSentimentFromTweets();

    // Initial fetch from Grok (will fallback to tweets if fails)
    const timeoutId = setTimeout(() => {
      fetchSentiments();
    }, 1000); // Small delay to let tweets load

    // Update sentiments every 2 minutes
    const interval = setInterval(() => {
      fetchSentiments();
    }, 120000); // 2 minutes

    return () => {
      clearTimeout(timeoutId);
      clearInterval(interval);
    };
  }, [watchlist, isAuthenticated, updateSentiment, tweets]);

  // Fetch real tweets from influential users via Grok AI
  React.useEffect(() => {
    if (!isAuthenticated) {
      console.log('[Tweets] User not authenticated, skipping tweet fetch');
      return;
    }

    const fetchTweets = async () => {
      if (isFetchingTweetsRef.current) {
        console.log('[Tweets] Fetch already in progress, skipping');
        return;
      }

      isFetchingTweetsRef.current = true;
      lastTweetFetchRef.current = Date.now();

      const watchlistTickers = watchlist.map((w) => w.ticker).filter(Boolean);
      if (watchlistTickers.length === 0) {
        console.log('[Tweets] No tickers in watchlist, clearing tweets');
        setTweets([]);
        isFetchingTweetsRef.current = false;
        return;
      }

      console.log('[Tweets] Fetching tweets for:', watchlistTickers);
      console.log('[Tweets] Current tweets count:', tweets.length);

      const parseTimestamp = (rawTimestamp?: string): Date => {
        const fallback = new Date(Date.now() - Math.random() * (24 * 60 * 60 * 1000));
        if (!rawTimestamp) {
          return fallback;
        }
        try {
          const parsed = new Date(rawTimestamp);
          if (Number.isNaN(parsed.getTime())) {
            return fallback;
          }
          const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
          if (parsed.getTime() < oneDayAgo) {
            return new Date(oneDayAgo);
          }
          return parsed;
        } catch {
          return fallback;
        }
      };

      // Extract mentioned stocks/crypto from tweet content intelligently
      const extractMentionedTickers = (content: string): string[] => {
        if (!content) return [];
        
        const contentUpper = content.toUpperCase();
        const mentioned: string[] = [];
        
        // First, check if this is clearly NOT a financial tweet
        // Exclude political news, sports, entertainment, etc.
        const nonFinancialPatterns = [
          /mayoral|mayor|election|political|campaign|vote|voting|ballot/i,
          /sports|football|basketball|soccer|baseball|tennis|golf/i,
          /entertainment|movie|film|actor|actress|celebrity|music|song/i,
          /weather|temperature|rain|snow|storm/i,
        ];
        
        const isNonFinancial = nonFinancialPatterns.some(pattern => pattern.test(content));
        if (isNonFinancial) {
          return []; // Don't tag non-financial tweets
        }
        
        // Check each watchlist ticker
        watchlistTickers.forEach((ticker) => {
          const tickerUpper = ticker.toUpperCase();
          const baseTicker = tickerUpper.includes('-') ? tickerUpper.split('-')[0] : tickerUpper;
          
          // STRICT: Only match exact ticker symbols with $ prefix or as standalone word boundaries
          // This prevents false matches like "SPY" matching "spying" or "spyware"
          const dollarPattern = new RegExp(`\\$${tickerUpper.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
          const standalonePattern = new RegExp(`\\b${tickerUpper.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
          
          // For short tickers (3 chars or less), be extra strict - require $ or context
          if (tickerUpper.length <= 3) {
            // Only match with $ prefix for short tickers to avoid false positives
            if (dollarPattern.test(content)) {
              mentioned.push(ticker);
              return;
            }
          } else {
            // For longer tickers, allow standalone but with word boundaries
            if (dollarPattern.test(content) || standalonePattern.test(content)) {
              mentioned.push(ticker);
              return;
            }
          }
          
          // Check for base ticker mention (for crypto like BTC-USD -> BTC)
          // Only if base ticker is different from full ticker
          if (baseTicker !== tickerUpper && baseTicker.length >= 2) {
            const baseDollarPattern = new RegExp(`\\$${baseTicker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
            if (baseDollarPattern.test(content)) {
              mentioned.push(ticker);
              return;
            }
          }
          
          // Check for company name mentions (only for well-known mappings)
          // Be more conservative - only match if it's clearly about the company
          const companyNames: Record<string, string[]> = {
            'AAPL': ['APPLE INC', 'APPLE STOCK', 'APPLE SHARES', 'APPLE\'S'],
            'MSFT': ['MICROSOFT CORP', 'MICROSOFT STOCK', 'MICROSOFT SHARES'],
            'GOOGL': ['GOOGLE STOCK', 'ALPHABET STOCK', 'GOOGLE SHARES'],
            'AMZN': ['AMAZON STOCK', 'AMAZON SHARES', 'AMAZON.COM'],
            'TSLA': ['TESLA STOCK', 'TESLA SHARES', 'TESLA MOTORS'],
            'NVDA': ['NVIDIA STOCK', 'NVIDIA SHARES'],
            'META': ['META STOCK', 'FACEBOOK STOCK', 'META SHARES'],
            'BTC': ['BITCOIN', '$BTC'],
            'ETH': ['ETHEREUM', '$ETH'],
            'SPY': ['S&P 500', 'SP500', 'SP 500 INDEX'],
          };
          
          const names = companyNames[baseTicker] || [];
          // Only match if company name appears with financial context
          const hasFinancialContext = /(stock|share|price|trading|market|invest|buy|sell|earnings|revenue)/i.test(content);
          if (names.some(name => {
            const namePattern = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
            return namePattern.test(contentUpper) && hasFinancialContext;
          })) {
            mentioned.push(ticker);
          }
        });
        
        return mentioned;
      };

      const appendTweets = (
        incomingTweets: any[],
        resolveMentionedStocks?: (tweet: any) => string[]
      ) => {
        if (!incomingTweets || incomingTweets.length === 0) {
          return;
        }

        setTweets((currentTweets) => {
          const tweetsToAdd: Tweet[] = [];
          const existingKeys = new Set(currentTweets.map((t) => `${t.username}|${t.content}`));

          incomingTweets.forEach((grokTweet: any) => {
            if (!grokTweet || !grokTweet.content || !grokTweet.username) {
              return;
            }

            const key = `${grokTweet.username}|${grokTweet.content}`;
            if (existingKeys.has(key)) {
              return;
            }

            const timestamp = parseTimestamp(grokTweet.timestamp);
            
            // Determine mentioned stocks intelligently
            let mentioned: string[] = [];
            
            if (resolveMentionedStocks) {
              // Use provided resolver (for stock-specific tweets)
              mentioned = resolveMentionedStocks(grokTweet);
            } else {
              // For general market-moving tweets, only tag if actually mentioned
              const extracted = extractMentionedTickers(grokTweet.content);
              
              // If tweet is from market-moving account but doesn't mention specific stocks,
              // only tag as "MARKET" if it's truly market-related (not sports, entertainment, politics, etc.)
              const nonFinancialPatterns = [
                /mayoral|mayor|election|political|campaign|vote|voting|ballot/i,
                /sports|football|basketball|soccer|baseball|tennis|golf/i,
                /entertainment|movie|film|actor|actress|celebrity|music|song/i,
                /weather|temperature|rain|snow|storm/i,
              ];
              
              const isNonFinancial = nonFinancialPatterns.some(pattern => pattern.test(grokTweet.content));
              const isMarketRelated = !isNonFinancial && /(stock|market|trading|finance|economy|fed|inflation|recession|gdp|earnings|revenue|profit|loss|investment|portfolio|bull|bear|crypto|bitcoin|ethereum|dollar|yuan|euro|rate|interest|bond|equity|sector|index|wall street|dow|nasdaq|s&p)/i.test(grokTweet.content);
              
              if (extracted.length > 0) {
                mentioned = extracted;
              } else if (isMarketRelated) {
                // Only tag as MARKET if it's actually market-related
                mentioned = ['MARKET'];
              } else {
                // Don't tag non-market tweets at all (or tag as empty array)
                mentioned = [];
              }
            }

            // Use profile image from API if available, otherwise fallback to generated avatar
            const avatarUrl = grokTweet.profileImageUrl 
              ? grokTweet.profileImageUrl.replace('_normal', '_400x400') // Get higher resolution
              : `https://api.dicebear.com/7.x/avataaars/svg?seed=${grokTweet.username}`;

            const newTweet: Tweet = {
              id: `tweet-${Date.now()}-${Math.random()}`,
              userId: `user-${grokTweet.username}`,
              username: grokTweet.username,
              displayName: grokTweet.displayName || grokTweet.username,
              avatar: avatarUrl,
              content: grokTweet.content,
              timestamp,
              mentionedStocks: mentioned.length > 0 ? mentioned : [], // Empty array if no relevant mentions
              impact: grokTweet.impact || (grokTweet.verified ? 'high' : 'medium'),
              likes:
                typeof grokTweet.likes === 'number'
                  ? grokTweet.likes
                  : grokTweet.engagement || Math.floor(Math.random() * 5000),
              retweets:
                typeof grokTweet.retweets === 'number'
                  ? grokTweet.retweets
                  : Math.floor((grokTweet.engagement || 0) * 0.1) || Math.floor(Math.random() * 500),
            };

            tweetsToAdd.push(newTweet);
            existingKeys.add(key);
          });

          if (tweetsToAdd.length === 0) {
            return currentTweets;
          }

          console.log(`[Tweets] Appending ${tweetsToAdd.length} tweets to feed`);
          return [...tweetsToAdd, ...currentTweets];
        });
      };

      try {
        const {
          getRelevantTweets,
          findInfluentialUsers,
          getTweetsFromUsers,
          getTweetsFromTwitterAPI,
        } = await import('../services/grokApi');

        const marketMovingAccounts = [
          'elonmusk',
          'realDonaldTrump',
          'Bloomberg',
          'CNBC',
          'Reuters',
          'WSJ',
          'MarketWatch',
          'YahooFinance',
          'FederalReserve',
          'JimCramer',
          'DeItaone',
        ];

        // Fetch DeItaone tweets (high impact) - these are usually market-related
        try {
          console.log('[Tweets] Fetching DeItaone feed via Twitter API...');
          let deItaoneResult = await getTweetsFromTwitterAPI(['DeItaone'], 50);
          if (!deItaoneResult.tweets || deItaoneResult.tweets.length === 0) {
            console.log('[Tweets] Twitter API unavailable/empty for DeItaone, falling back to Grok');
            deItaoneResult = await getTweetsFromUsers('MARKET', ['DeItaone'], 50);
          }
          // DeItaone tweets are market-related, but only tag with actual mentioned tickers
          appendTweets(deItaoneResult.tweets);
        } catch (deItaoneError) {
          console.error('[Tweets] Error fetching DeItaone tweets:', deItaoneError);
        }

        // Fetch general market-moving accounts once per cycle
        try {
          console.log('[Tweets] Fetching market-moving accounts via Twitter API...');
          let marketResult = await getTweetsFromTwitterAPI(marketMovingAccounts, 30);
          if (!marketResult.tweets || marketResult.tweets.length === 0) {
            console.log('[Tweets] Twitter API unavailable/empty for market movers, falling back to Grok');
            marketResult = await getTweetsFromUsers('MARKET', marketMovingAccounts, 30);
          }
          // Market-moving tweets - only tag with actual mentioned tickers or MARKET if truly market-related
          appendTweets(marketResult.tweets);
        } catch (marketError) {
          console.error('[Tweets] Error fetching market-moving tweets:', marketError);
        }

        // Fetch tweets for each stock in the watchlist (stock-specific users only)
        for (const ticker of watchlistTickers) {
          try {
            console.log(`[Tweets] Processing ticker: ${ticker}`);
            const searchTicker = ticker.includes('-') ? ticker.split('-')[0] : ticker;

            let usernames = influentialUsersRef.current[ticker];
            if (!usernames || usernames.length === 0) {
              try {
                console.log(`[Tweets] Finding influential users for ${ticker} (search as ${searchTicker})...`);
                const usersResult = await findInfluentialUsers(searchTicker);
                if (usersResult.success && usersResult.users) {
                  usernames = usersResult.users.map((u: any) => u.username).filter(Boolean);
                  influentialUsersRef.current[ticker] = usernames;
                  console.log(`[Tweets] Cached ${usernames.length} influential users for ${ticker}`);
                }
              } catch (userError) {
                console.error(`[Tweets] Error finding users for ${ticker}:`, userError);
              }
            } else {
              console.log(`[Tweets] Using cached influential users for ${ticker}: ${usernames.length}`);
            }

            let result;
            if (usernames && usernames.length > 0) {
              try {
                console.log(`[Tweets] Fetching user timeline via Twitter API for ${ticker}`);
                result = await getTweetsFromTwitterAPI(usernames, 10);
                if (!result.tweets || result.tweets.length === 0) {
                  console.log(`[Tweets] Twitter API empty for ${ticker}, falling back to Grok`);
                  result = await getTweetsFromUsers(searchTicker, usernames, 10);
                }
              } catch (twitterError) {
                console.log(`[Tweets] Twitter API unavailable for ${ticker}, using Grok`);
                result = await getTweetsFromUsers(searchTicker, usernames, 10);
              }
            } else {
              console.log(`[Tweets] No influential users for ${ticker}, using relevant tweet search`);
              result = await getRelevantTweets(searchTicker, 10);
            }

            if (result.success && Array.isArray(result.tweets)) {
              appendTweets(result.tweets, (grokTweet) => {
                // Only tag with this specific ticker if tweet actually mentions it
                const content = (grokTweet.content || '').toUpperCase();
                const tickerUpper = ticker.toUpperCase();
                const baseTicker = tickerUpper.includes('-') ? tickerUpper.split('-')[0] : tickerUpper;
                
                // Check if tweet explicitly mentions this ticker
                const hasDollarSign = new RegExp(`\\$${tickerUpper.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(grokTweet.content || '');
                const hasStandalone = new RegExp(`\\b${tickerUpper.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(grokTweet.content || '');
                const hasBaseTicker = baseTicker !== tickerUpper && new RegExp(`\\$${baseTicker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(grokTweet.content || '');
                
                if (hasDollarSign || hasStandalone || hasBaseTicker) {
                  return [ticker]; // Only tag with this ticker if actually mentioned
                }
                
                // For market_impact or news tweets, only tag as MARKET if truly market-related
                // Don't tag with all watchlist tickers - that's wrong!
                if (grokTweet.relevance === 'market_impact' || grokTweet.relevance === 'news') {
                  const isMarketRelated = /(stock|market|trading|finance|economy|fed|inflation|recession|gdp|earnings|revenue|profit|loss|investment|portfolio|bull|bear|crypto|bitcoin|ethereum|dollar|yuan|euro|rate|interest|bond|equity|sector|index|wall street|dow|nasdaq|s&p)/i.test(grokTweet.content || '');
                  return isMarketRelated ? ['MARKET'] : [];
                }
                
                // If tweet doesn't mention ticker, don't tag it
                return [];
              });
            } else {
              console.warn(`[Tweets] Invalid response for ${ticker}`, result);
            }
          } catch (tickerError) {
            console.error(`[Tweets] Error fetching tweets for ${ticker}:`, tickerError);
          }

          // Avoid hammering APIs
          await new Promise((resolve) => setTimeout(resolve, 1200));
        }
      } catch (error) {
        console.error('[Tweets] Error fetching tweets:', error);
      } finally {
        isFetchingTweetsRef.current = false;
      }
    };

    // Initial fetch
    fetchTweets();

    // Fetch new tweets every 5 minutes
    const interval = setInterval(() => {
      fetchTweets();
    }, 300000); // 5 minutes

    return () => clearInterval(interval);
  }, [isAuthenticated, watchlist, addTweet]);

  // Calculate sentiment from AI analysis results
  const calculateSentimentFromAIAnalysis = React.useCallback((analyses: any[]) => {
    try {
      watchlist.forEach((item) => {
        if (!item || !item.ticker) return;

        const ticker = item.ticker;
        const relevantAnalyses = analyses.filter((analysis) =>
          analysis.impactedTickers?.includes(ticker)
        );

        if (relevantAnalyses.length === 0) {
          // No AI analysis for this ticker, use default
          updateSentiment(ticker, {
            ticker,
            bullish: 33,
            bearish: 33,
            neutral: 34,
            lastUpdated: new Date(),
            overall: 'neutral',
          });
          return;
        }

        // Count sentiment directions from AI analysis
        let bullish = 0;
        let bearish = 0;
        let neutral = 0;
        const impactingTweetIds: string[] = [];

        relevantAnalyses.forEach((analysis) => {
          const sentiment = analysis.sentimentPerTicker?.[ticker];
          if (!sentiment) return;

          impactingTweetIds.push(analysis.tweetId);

          // Weight by impact (high impact tweets count more)
          const weight = 1; // Could be enhanced based on tweet engagement
          
          if (sentiment === 'bullish') {
            bullish += weight;
          } else if (sentiment === 'bearish') {
            bearish += weight;
          } else {
            neutral += weight;
          }
        });

        const total = bullish + bearish + neutral;
        
        let bullishPercent = total > 0 ? Math.round((bullish / total) * 100) : 33;
        let bearishPercent = total > 0 ? Math.round((bearish / total) * 100) : 33;
        let neutralPercent = total > 0 ? Math.round((neutral / total) * 100) : 34;

        // Normalize to sum to 100
        const sum = bullishPercent + bearishPercent + neutralPercent;
        if (sum !== 100) {
          const diff = 100 - sum;
          if (diff > 0) {
            neutralPercent += diff;
          } else {
            bullishPercent = Math.round((bullishPercent / sum) * 100);
            bearishPercent = Math.round((bearishPercent / sum) * 100);
            neutralPercent = 100 - bullishPercent - bearishPercent;
          }
        }

        let overall: 'bullish' | 'bearish' | 'neutral' = 'neutral';
        if (bullishPercent > bearishPercent + 10) {
          overall = 'bullish';
        } else if (bearishPercent > bullishPercent + 10) {
          overall = 'bearish';
        }

        const sentiment: Sentiment = {
          ticker,
          bullish: bullishPercent,
          bearish: bearishPercent,
          neutral: neutralPercent,
          lastUpdated: new Date(),
          overall,
          impactingTweetIds,
        };

        console.log(`[AI Sentiment] Calculated sentiment for ${ticker}:`, sentiment);
        updateSentiment(ticker, sentiment);
      });
    } catch (error) {
      console.error('[AI Sentiment] Error calculating sentiment from AI analysis:', error);
    }
  }, [watchlist, updateSentiment]);

  // Analyze tweets with AI to determine market/stock impact (replaces keyword matching)
  React.useEffect(() => {
    if (!isAuthenticated || tweets.length === 0 || watchlist.length === 0) {
      return;
    }

    const analyzeTweetsWithAI = async () => {
      try {
        const watchlistTickers = watchlist.map((w) => w.ticker).filter(Boolean);
        if (watchlistTickers.length === 0) return;

        // Get recent tweets (last 30, reduced from 50 for token efficiency)
        // Sort by engagement to prioritize impactful tweets
        const recentTweets = [...tweets]
          .sort((a, b) => ((b.likes || 0) + (b.retweets || 0)) - ((a.likes || 0) + (a.retweets || 0)))
          .slice(0, 30)
          .map((tweet) => ({
            id: tweet.id,
            username: tweet.username,
            content: tweet.content, // Removed displayName, timestamp for token savings
            likes: tweet.likes,
            retweets: tweet.retweets,
          }));

        console.log('[AI Analysis] Analyzing', recentTweets.length, 'tweets with Grok AI');

        const { analyzeTweetImpact } = await import('../services/grokApi');
        const result = await analyzeTweetImpact(recentTweets, watchlistTickers);

        if (result.success && Array.isArray(result.analyses)) {
          console.log('[AI Analysis] Received', result.analyses.length, 'tweet analyses');

          // Update tweets with AI-determined impact
          setTweets((currentTweets) => {
            return currentTweets.map((tweet) => {
              const analysis = result.analyses.find((a) => a.tweetId === tweet.id);
              if (!analysis) return tweet;

              // Build sentiment impact object from AI analysis
              const sentimentImpact: Record<string, 'bullish' | 'bearish' | 'neutral'> = {};
              
              // Add sentiment for each impacted ticker
              if (analysis.sentimentPerTicker) {
                Object.entries(analysis.sentimentPerTicker).forEach(([ticker, sentiment]) => {
                  sentimentImpact[ticker] = sentiment;
                });
              }

              // Update mentioned stocks based on AI analysis
              const mentionedStocks = analysis.impactedTickers || [];

              return {
                ...tweet,
                mentionedStocks: mentionedStocks.length > 0 ? mentionedStocks : tweet.mentionedStocks,
                sentimentImpact: Object.keys(sentimentImpact).length > 0 ? sentimentImpact : tweet.sentimentImpact,
              };
            });
          });

          // Recalculate sentiment based on AI analysis
          calculateSentimentFromAIAnalysis(result.analyses);
        }
      } catch (error) {
        console.error('[AI Analysis] Error analyzing tweets with AI:', error);
        // Fall back to keyword-based analysis if AI fails
      }
    };

    // Debounce: analyze tweets 2 seconds after they're added
    const timeoutId = setTimeout(() => {
      analyzeTweetsWithAI();
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [tweets.length, watchlist, isAuthenticated, calculateSentimentFromAIAnalysis]);

  // Analyze market sentiment and trade ideas from the current tweet feed
  React.useEffect(() => {
    if (!isAuthenticated) {
      console.log('[Market Sentiment] User not authenticated, skipping market analysis');
      return;
    }

    if (!tweets || tweets.length === 0) {
      console.log('[Market Sentiment] No tweets available for market analysis');
      return;
    }

    let isCancelled = false;

    const runMarketAnalysis = async (trigger: 'initial' | 'interval' | 'dependency') => {
      // Prevent concurrent calls and throttle requests
      const now = Date.now();
      const timeSinceLastCall = now - lastMarketAnalysisRef.current;
      const minDelay = 5000; // Minimum 5 seconds between calls

      if (isAnalyzingMarketRef.current) {
        console.log('[Market Sentiment] Analysis already in progress, skipping');
        return;
      }

      if (timeSinceLastCall < minDelay && trigger !== 'interval') {
        console.log(`[Market Sentiment] Throttled: ${Math.round((minDelay - timeSinceLastCall) / 1000)}s remaining`);
        return;
      }

      isAnalyzingMarketRef.current = true;
      lastMarketAnalysisRef.current = now;

      try {
        // Optimize: Sort by engagement, take top 20, remove unnecessary fields
        const trimmedTweets = [...tweets]
          .sort((a, b) => ((b.likes || 0) + (b.retweets || 0)) - ((a.likes || 0) + (a.retweets || 0)))
          .slice(0, 20) // Reduced from 25 to 20 for token efficiency
          .map((tweet) => ({
            id: tweet.id,
            username: tweet.username,
            content: tweet.content, // Removed displayName, timestamp for token savings
            impact: tweet.impact,
            likes: tweet.likes || 0,
            retweets: tweet.retweets || 0,
            mentionedStocks: (tweet.mentionedStocks || []).slice(0, 3), // Limit to 3 tickers
          }));

        if (trimmedTweets.length === 0) {
          console.log('[Market Sentiment] Trimmed tweets list is empty, skipping analysis');
          return;
        }

        const watchlistTickers = watchlist.map((item) => item.ticker).filter(Boolean);
        const simplifiedPositions = positions.map((pos) => ({
          ticker: pos.ticker,
          type: pos.type || 'stock',
          quantity: pos.quantity,
          entryPrice: pos.entryPrice,
          currentPrice: pos.currentPrice,
        }));

        console.log(
          `[Market Sentiment] Running tweet-driven market analysis (${trigger}) with ${trimmedTweets.length} tweets`
        );

        const { analyzeMarketSentimentFromTweets } = await import('../services/grokApi');
        let analysis;
        try {
          analysis = await analyzeMarketSentimentFromTweets({
            tweets: trimmedTweets,
            watchlist: watchlistTickers,
            positions: simplifiedPositions,
          });
        } catch (apiError: any) {
          console.error('[Market Sentiment] API call failed:', apiError);
          throw new Error(`Failed to analyze market sentiment: ${apiError.message || 'Unknown error'}`);
        }

        if (!analysis || !analysis.sentiment) {
          console.warn('[Market Sentiment] Analysis result missing sentiment field');
          throw new Error('Analysis result missing sentiment field');
        }

        if (isCancelled) return;

        const insightMap: Record<string, Tweet> = {};
        tweets.forEach((tweet) => {
          insightMap[tweet.id] = tweet;
        });

        const insights: MarketInsight[] = Array.isArray(analysis.topInsights)
          ? analysis.topInsights
              .filter((insight) => insight && insight.tweetId)
              .map((insight) => {
                const sourceTweet = insightMap[insight.tweetId];
                return {
                  ...insight,
                  displayName: insight.displayName || sourceTweet?.displayName,
                };
              })
          : [];

        setMarketInsights(insights);

        const marketSentimentUpdate: MarketSentiment = {
          bullish: analysis.sentiment.bullish,
          bearish: analysis.sentiment.bearish,
          neutral: analysis.sentiment.neutral,
          overall: analysis.sentiment.overall,
          lastUpdated: new Date(),
          keyDrivers: analysis.keyDrivers || [],
          sourceAccounts: analysis.sourceAccounts || insights.map((insight) => insight.username),
          summary: analysis.summary,
          topInsights: insights,
        };

        updateMarketSentiment(marketSentimentUpdate);

        const normalizedStockSuggestions: PapertradeSuggestion[] = Array.isArray(analysis.stockSuggestions)
          ? analysis.stockSuggestions
              .filter((suggestion) => suggestion && suggestion.ticker)
              .map((suggestion, index) => ({
                id: suggestion.id || `stock-suggestion-${Date.now()}-${index}`,
                ticker: suggestion.ticker,
                action: suggestion.action || 'hold',
                reason: suggestion.reason || 'Derived from market tweets and sentiment analysis.',
                confidence:
                  typeof suggestion.confidence === 'number'
                    ? Math.min(100, Math.max(0, Math.round(suggestion.confidence)))
                    : 50,
                timeframe: suggestion.timeframe,
                type: 'stock',
                supportingTweetIds: suggestion.supportingTweetIds,
                sourceAccounts: suggestion.sourceAccounts,
              }))
          : [];

        setTradeSuggestions(
          normalizedStockSuggestions.length > 0
            ? normalizedStockSuggestions
            : mockPapertradeSuggestions.map((suggestion) => ({ ...suggestion }))
        );

        const normalizedOptionSuggestions: OptionSuggestion[] = Array.isArray(analysis.optionSuggestions)
          ? analysis.optionSuggestions
              .filter((suggestion) => suggestion && suggestion.ticker)
              .map((suggestion, index) => {
                const expirationDate = suggestion.expiration
                  ? new Date(suggestion.expiration)
                  : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

                return {
                  id: suggestion.id || `option-suggestion-${Date.now()}-${index}`,
                  ticker: suggestion.ticker,
                  strike: typeof suggestion.strike === 'number' ? suggestion.strike : 0,
                  expiration: expirationDate,
                  optionType: suggestion.optionType || 'call',
                  reason: suggestion.reason || 'Based on option flow inferred from tweets and sentiment.',
                  confidence:
                    typeof suggestion.confidence === 'number'
                      ? Math.min(100, Math.max(0, Math.round(suggestion.confidence)))
                      : 50,
                  premium:
                    typeof suggestion.premiumEstimate === 'number'
                      ? suggestion.premiumEstimate
                      : typeof suggestion.premium === 'number'
                      ? suggestion.premium
                      : 0,
                  targetPrice: suggestion.targetPrice,
                  action: suggestion.action || 'buy',
                  strategy: suggestion.strategy as OptionSuggestion['strategy'],
                  timeframe: suggestion.timeframe,
                  supportingTweetIds: suggestion.supportingTweetIds,
                  premiumEstimate: suggestion.premiumEstimate,
                };
              })
          : [];

        setOptionSuggestions(
          normalizedOptionSuggestions.length > 0
            ? normalizedOptionSuggestions
            : mockOptionSuggestions.map((suggestion) => ({ ...suggestion }))
        );
      } catch (error: any) {
        // Check if it's a resource exhaustion error
        const isResourceError = error.message?.includes('ERR_INSUFFICIENT_RESOURCES') || 
                                error.message?.includes('Failed to fetch') ||
                                error.message?.includes('network');
        
        if (isResourceError) {
          console.warn('[Market Sentiment] Resource exhaustion detected, will retry later');
          // Don't update state on resource errors, just log
          if (!isCancelled) {
            // Extend the throttle time to prevent immediate retry
            lastMarketAnalysisRef.current = Date.now() + 30000; // Wait 30 seconds before next attempt
          }
        }
        if (!isCancelled) {
          console.error('[Market Sentiment] Error running tweet-driven market analysis:', error);
          
          // Only update if we don't have existing valid sentiment data
          // This prevents overwriting good data with error messages
          if (!marketSentiment || 
              marketSentiment.keyDrivers?.includes('Market analysis unavailable') ||
              marketSentiment.summary?.includes('Market analysis unavailable')) {
            // Fallback to defaults if analysis fails and we don't have valid data
            setMarketInsights([]);
            updateMarketSentiment({
              bullish: 34,
              bearish: 33,
              neutral: 33,
              overall: 'neutral' as const,
              lastUpdated: new Date(),
              keyDrivers: ['Analyzing market sentiment...'],
              sourceAccounts: [],
              summary: 'Calculating market sentiment from recent tweets. Please try again in a moment.',
              topInsights: [],
            });
            setTradeSuggestions(mockPapertradeSuggestions.map((suggestion) => ({ ...suggestion })));
            setOptionSuggestions(mockOptionSuggestions.map((suggestion) => ({ ...suggestion })));
          } else {
            // Keep existing valid data, just log the error
            console.warn('[Market Sentiment] Keeping existing sentiment data due to API error');
          }
        }
      } finally {
        isAnalyzingMarketRef.current = false;
      }
    };

    // Initial run with slight delay to ensure tweets state is settled
    const timeoutId = setTimeout(() => runMarketAnalysis('initial'), 3000);

    // Re-run every 5 minutes (increased from 3 to reduce load)
    const intervalId = setInterval(() => runMarketAnalysis('interval'), 300000);

    // Don't run on dependency change immediately - let the timeout handle it
    // This prevents multiple simultaneous calls

    return () => {
      isCancelled = true;
      isAnalyzingMarketRef.current = false;
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [isAuthenticated, tweets.length, watchlist.length, positions.length, updateMarketSentiment]);

  // Update stock prices periodically
  React.useEffect(() => {
    if (!isAuthenticated) return;

    // Don't call immediately - wait a bit to avoid race conditions
    const timeoutId = setTimeout(() => {
      if (watchlist.length > 0 || positions.length > 0) {
        updateStockPrices().catch((error) => {
          console.error('Error in initial price update:', error);
        });
      }
    }, 2000); // Increased delay to avoid race conditions

    const interval = setInterval(() => {
      if (watchlist.length > 0 || positions.length > 0) {
        updateStockPrices().catch((error) => {
          console.error('Error in periodic price update:', error);
        });
      }
    }, 30000); // Update every 30 seconds to avoid rate limits

    return () => {
      clearTimeout(timeoutId);
      clearInterval(interval);
    };
  }, [isAuthenticated, updateStockPrices, watchlist.length, positions.length]);

  // Fetch unusual flows from FL0WG0D account (all stocks, past 24 hours)
  React.useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const fetchUnusualFlows = async () => {
      try {
        const { getTweetsFromTwitterAPI } = await import('../services/grokApi');
        
        console.log('[Unusual Flows] Fetching all flows from FL0WG0D (past 24 hours)...');
        // Fetch more tweets to get all flows from past 24 hours
        const result = await getTweetsFromTwitterAPI(['FL0WG0D'], 100);
        
        if (!result || !result.success) {
          console.log('[Unusual Flows] No result or unsuccessful response');
          return;
        }

        if (!Array.isArray(result.tweets) || result.tweets.length === 0) {
          console.log('[Unusual Flows] No tweets returned');
          return;
        }
        
        // Convert tweets with images to UnusualFlow format
        const flows: UnusualFlow[] = result.tweets
          .filter((tweet: any) => {
            // Safe check for imageUrls - only include tweets with images
            return tweet && 
                   Array.isArray(tweet.imageUrls) && 
                   tweet.imageUrls.length > 0 &&
                   tweet.imageUrls[0];
          })
          .map((tweet: any, index: number) => {
            // Try to extract ticker from tweet content
            const content = (tweet?.content || '').toUpperCase();
            const tickerMatch = content.match(/\$([A-Z]{1,5}(?:-USD)?)/);
            const ticker = tickerMatch ? tickerMatch[1] : 'UNKNOWN';
            
            // Determine flow type from content
            let flowType: 'call' | 'put' | 'volume' = 'volume';
            if (content.includes('CALL') || content.includes('BUY') || content.includes('LONG') || content.includes('CALL BUYER')) {
              flowType = 'call';
            } else if (content.includes('PUT') || content.includes('SELL') || content.includes('SHORT') || content.includes('PUT BUYER')) {
              flowType = 'put';
            }
            
            // Try to extract value from content (e.g., "$316K", "$750K")
            let value = 0;
            const valueMatch = content.match(/\$(\d+(?:\.\d+)?)([KM])?/);
            if (valueMatch) {
              const numValue = parseFloat(valueMatch[1]);
              const multiplier = valueMatch[2] === 'M' ? 1000000 : valueMatch[2] === 'K' ? 1000 : 1;
              value = numValue * multiplier;
            }
            
            // Safely get first image URL
            const imageUrl = Array.isArray(tweet.imageUrls) && tweet.imageUrls.length > 0
              ? tweet.imageUrls[0]
              : null;
            
            return {
              id: `flow-${tweet?.id || Date.now()}-${index}`,
              ticker,
              type: flowType,
              description: tweet?.content || 'Unusual options flow detected',
              value,
              timestamp: tweet?.timestamp ? new Date(tweet.timestamp) : new Date(),
              imageUrl: imageUrl || undefined,
              tweetId: tweet?.id,
              tweetUrl: tweet?.id ? `https://x.com/FL0WG0D/status/${tweet.id}` : undefined,
            };
          })
          .filter((flow: UnusualFlow) => {
            // Only include flows with images and valid tickers
            return flow.imageUrl && flow.ticker !== 'UNKNOWN';
          })
          // Sort by timestamp (most recent first)
          .sort((a, b) => {
            return b.timestamp.getTime() - a.timestamp.getTime();
          });
        
        console.log(`[Unusual Flows] Found ${flows.length} flows with images (all stocks, past 24 hours)`);
        setUnusualFlows(flows);
      } catch (error) {
        console.error('[Unusual Flows] Error fetching flows:', error);
        // Set empty array on error to prevent undefined state
        setUnusualFlows([]);
      }
    };

    // Fetch initially and then every 5 minutes
    fetchUnusualFlows();
    const interval = setInterval(fetchUnusualFlows, 300000); // 5 minutes

    return () => clearInterval(interval);
  }, [isAuthenticated]);

  return (
    <AppContext.Provider
      value={{
        watchlist,
        addToWatchlist,
        removeFromWatchlist,
        tweets,
        addTweet,
        sentiments,
        updateSentiment,
        marketSentiment,
        updateMarketSentiment,
        marketInsights,
        tradeSuggestions,
        optionSuggestions,
        unusualFlows,
        positions,
        addPosition,
        removePosition,
        updateStockPrices,
        isAuthenticated,
        setAuthenticated,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

