import { useState, useEffect, useRef } from 'react';
import { Stock } from '../types';
import { cryptoWebSocketService } from '../services/cryptoWebSocket';
import { getStockQuote } from '../services/stockApi';
import { popularCrypto } from '../data/mockData';

// Hook for single crypto ticker with real-time WebSocket updates
export const useCryptoData = (ticker: string | null) => {
  const [stock, setStock] = useState<Stock | null>(null);
  const [loading, setLoading] = useState(false);
  const callbackRef = useRef<((data: Stock) => void) | null>(null);

  useEffect(() => {
    if (!ticker) {
      setStock(null);
      return;
    }

    // Check if it's a crypto ticker
    const isCrypto = ticker.includes('-') || ticker.includes('USD');
    if (!isCrypto) {
      // Fallback to regular API for non-crypto
      const fetchStock = async () => {
        try {
          setLoading(true);
          const quote = await getStockQuote(ticker);
          if (quote) {
            setStock(quote);
          }
        } catch (error) {
          console.error('Error fetching stock data:', error);
        } finally {
          setLoading(false);
        }
      };
      fetchStock();
      return;
    }

    // Use WebSocket for crypto
    setLoading(true);
    
    // Initial fetch from API
    const fetchInitial = async () => {
      try {
        const quote = await getStockQuote(ticker);
        if (quote) {
          setStock(quote);
        } else {
          // Fallback to mock data
          const mockCrypto = popularCrypto.find((c) => c.ticker === ticker);
          if (mockCrypto) {
            setStock(mockCrypto);
          }
        }
      } catch (error) {
        console.error('Error fetching initial crypto data:', error);
        const mockCrypto = popularCrypto.find((c) => c.ticker === ticker);
        if (mockCrypto) {
          setStock(mockCrypto);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchInitial();

    // Set up WebSocket subscription
    const callback = (data: Stock) => {
      setStock(data);
      setLoading(false);
    };

    callbackRef.current = callback;
    cryptoWebSocketService.subscribe(ticker, callback);

    return () => {
      if (callbackRef.current) {
        cryptoWebSocketService.unsubscribe(ticker, callbackRef.current);
      }
    };
  }, [ticker]);

  return { stock, loading };
};

// Hook for multiple crypto tickers with real-time WebSocket updates
export const useMultipleCryptoData = (tickers: string[]) => {
  const [stocks, setStocks] = useState<Map<string, Stock>>(new Map());
  const [loading, setLoading] = useState(false);
  const callbacksRef = useRef<Map<string, (data: Stock) => void>>(new Map());

  useEffect(() => {
    if (tickers.length === 0) {
      setStocks(new Map());
      return;
    }

    // Filter crypto tickers
    const cryptoTickers = tickers.filter(t => t.includes('-') || t.includes('USD'));
    const stockTickers = tickers.filter(t => !t.includes('-') && !t.includes('USD'));

    // Fetch stocks using regular API
    const fetchStocks = async () => {
      if (stockTickers.length === 0) return;
      
      try {
        const { getMultipleQuotes } = await import('../services/stockApi');
        const quotes = await getMultipleQuotes(stockTickers);
        setStocks(prev => {
          const updated = new Map(prev);
          quotes.forEach(stock => {
            if (stock && stock.ticker) {
              updated.set(stock.ticker, stock);
            }
          });
          return updated;
        });
      } catch (error) {
        console.error('Error fetching stocks:', error);
      }
    };

    // Initial fetch for crypto
    const fetchInitialCrypto = async () => {
      setLoading(true);
      try {
        const { getMultipleQuotes } = await import('../services/stockApi');
        const quotes = await getMultipleQuotes(cryptoTickers);
        setStocks(prev => {
          const updated = new Map(prev);
          quotes.forEach(stock => {
            if (stock && stock.ticker) {
              updated.set(stock.ticker, stock);
            }
          });
          return updated;
        });
      } catch (error) {
        console.error('Error fetching initial crypto data:', error);
        // Fallback to mock data
        const mockMap = new Map<string, Stock>();
        cryptoTickers.forEach(ticker => {
          const mockCrypto = popularCrypto.find((c) => c.ticker === ticker);
          if (mockCrypto) {
            mockMap.set(ticker, mockCrypto);
          }
        });
        setStocks(prev => {
          const updated = new Map(prev);
          mockMap.forEach((stock, ticker) => updated.set(ticker, stock));
          return updated;
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStocks();
    if (cryptoTickers.length > 0) {
      fetchInitialCrypto();
    }

    // Set up WebSocket subscriptions for crypto
    cryptoTickers.forEach(ticker => {
      const callback = (data: Stock) => {
        setStocks(prev => {
          const updated = new Map(prev);
          updated.set(ticker, data);
          return updated;
        });
        setLoading(false);
      };

      callbacksRef.current.set(ticker, callback);
      cryptoWebSocketService.subscribe(ticker, callback);
    });

    return () => {
      // Cleanup WebSocket subscriptions
      cryptoTickers.forEach(ticker => {
        const callback = callbacksRef.current.get(ticker);
        if (callback) {
          cryptoWebSocketService.unsubscribe(ticker, callback);
        }
      });
      callbacksRef.current.clear();
    };
  }, [tickers.join(',')]);

  return { stocks, loading };
};

