import { Stock } from '../types';

// Free stock data using Yahoo Finance (no API key required)
// Using backend proxy to avoid CORS issues (via Vite proxy)

// Helper function to fetch via backend proxy
// Uses relative path so Vite proxy handles it
const fetchViaBackend = async (endpoint: string) => {
  return fetch(endpoint);
};

// Cache for stock data to reduce API calls
const stockCache = new Map<string, { data: Stock; timestamp: number }>();
const CACHE_DURATION = 60000; // 1 minute cache

// Search for stocks using Yahoo Finance
export const searchStocks = async (query: string): Promise<Stock[]> => {
  if (!query.trim()) return [];

  try {
    const url = `/api/yahoo/search?q=${encodeURIComponent(query)}`;
    const response = await fetchViaBackend(url);

    if (!response.ok) {
      throw new Error('Failed to search stocks');
    }

    let data;
    try {
      data = await response.json();
    } catch (error) {
      console.error('Error parsing search response:', error);
      return [];
    }
    
    // Handle different response formats
    if (!data || (!data.quotes && !data.result)) {
      return [];
    }
    
    const quotes = data.quotes || data.result || [];
    if (!Array.isArray(quotes) || quotes.length === 0) {
      return [];
    }

    // Filter for stocks and crypto (exclude ETFs, indices, etc.)
    const stockQuotes = quotes.filter((quote: any) => 
      quote && quote.symbol && 
      (quote.quoteType === 'EQUITY' || 
       quote.quoteType === 'CRYPTOCURRENCY' ||
       quote.type === 'EQUITY' || 
       quote.type === 'CRYPTOCURRENCY' ||
       (!quote.quoteType && !quote.type)) && 
      !quote.symbol.includes('.') &&
      !quote.symbol.includes('^')
    );

    // Fetch quotes for top results
    const stocks: Stock[] = [];
    
    for (const quote of stockQuotes.slice(0, 8)) {
      const stock = await getStockQuote(quote.symbol);
      if (stock) {
        stocks.push(stock);
      }
    }

    return stocks;
  } catch (error) {
    console.error('Error searching stocks:', error);
    return [];
  }
};

// Get stock quote (current price) from Yahoo Finance
export const getStockQuote = async (ticker: string): Promise<Stock | null> => {
  // Check cache first
  const cached = stockCache.get(ticker);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    const url = `/api/yahoo/quote/${encodeURIComponent(ticker)}`;
    const response = await fetchViaBackend(url);

    if (!response.ok) {
      throw new Error('Failed to fetch quote');
    }

    let data;
    try {
      data = await response.json();
    } catch (error) {
      console.error('Error parsing quote response:', error);
      return null;
    }

    if (!data || !data.chart || !data.chart.result || !Array.isArray(data.chart.result) || data.chart.result.length === 0) {
      return null;
    }

    const result = data.chart.result[0];
    if (!result || !result.meta) {
      return null;
    }

    const meta = result.meta;
    const regularMarketPrice = meta.regularMarketPrice;
    const previousClose = meta.previousClose || meta.previousClosePrice;
    const regularMarketChange = meta.regularMarketChange;
    const regularMarketChangePercent = meta.regularMarketChangePercent;

    if (!regularMarketPrice || regularMarketPrice === 0) {
      return null;
    }

    // Calculate change and changePercent safely
    const change = regularMarketChange ?? (regularMarketPrice - previousClose);
    const changePercent = regularMarketChangePercent ?? 
      (previousClose ? ((regularMarketPrice - previousClose) / previousClose) * 100 : 0);

    // Determine if it's crypto (Yahoo Finance crypto tickers end with -USD or similar)
    const isCrypto = ticker.includes('-') || meta.quoteType === 'CRYPTOCURRENCY' || meta.instrumentType === 'CRYPTOCURRENCY';
    
    const stock: Stock = {
      ticker: ticker.toUpperCase(),
      name: meta.shortName || meta.longName || meta.displayName || ticker,
      price: regularMarketPrice,
      change: change || 0,
      changePercent: changePercent || 0,
      type: isCrypto ? 'crypto' : 'stock',
    };

    // Cache the result
    stockCache.set(ticker, { data: stock, timestamp: Date.now() });

    return stock;
  } catch (error) {
    console.error(`Error fetching quote for ${ticker}:`, error);
    return null;
  }
};

// Get company profile (optional, not always needed)
export const getCompanyProfile = async (ticker: string): Promise<{ name: string; logo?: string } | null> => {
  try {
    const stock = await getStockQuote(ticker);
    if (stock) {
      return {
        name: stock.name,
      };
    }
    return null;
  } catch (error) {
    console.error(`Error fetching profile for ${ticker}:`, error);
    return null;
  }
};

// Get multiple stock quotes at once
export const getMultipleQuotes = async (tickers: string[]): Promise<Stock[]> => {
  // Fetch quotes in parallel but limit concurrent requests
  const batchSize = 5;
  const quotes: Stock[] = [];

  for (let i = 0; i < tickers.length; i += batchSize) {
    const batch = tickers.slice(i, i + batchSize);
    const batchPromises = batch.map((ticker) => getStockQuote(ticker));
    const batchResults = await Promise.all(batchPromises);
    
    batchResults.forEach((quote) => {
      if (quote) {
        quotes.push(quote);
      }
    });

    // Small delay between batches to avoid rate limiting
    if (i + batchSize < tickers.length) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  return quotes;
};

// Update stock prices (for real-time updates)
export const updateStockPrices = async (tickers: string[]): Promise<Map<string, Stock>> => {
  const quotes = await getMultipleQuotes(tickers);
  const priceMap = new Map<string, Stock>();
  
  quotes.forEach((stock) => {
    priceMap.set(stock.ticker, stock);
  });

  return priceMap;
};
