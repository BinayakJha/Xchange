import { useState, useEffect } from 'react';
import { Stock } from '../types';
import { getStockQuote, getMultipleQuotes } from '../services/stockApi';
import { allStocks } from '../data/mockData';

export const useStockData = (ticker: string | null) => {
  const [stock, setStock] = useState<Stock | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ticker) {
      setStock(null);
      return;
    }

    const fetchStock = async () => {
      try {
        setLoading(true);
        const quote = await getStockQuote(ticker);
        if (quote) {
          setStock(quote);
        } else {
          // Fallback to mock data
          const mockStock = allStocks.find((s) => s.ticker === ticker);
          if (mockStock) {
            setStock(mockStock);
          }
        }
      } catch (error) {
        console.error('Error fetching stock data:', error);
        // Fallback to mock data on error
        const mockStock = allStocks.find((s) => s.ticker === ticker);
        if (mockStock) {
          setStock(mockStock);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchStock();
  }, [ticker]);

  return { stock, loading };
};

export const useMultipleStockData = (tickers: string[]) => {
  const [stocks, setStocks] = useState<Map<string, Stock>>(new Map());
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (tickers.length === 0) {
      setStocks(new Map());
      return;
    }

    const fetchStocks = async () => {
      try {
        setLoading(true);
        const quotes = await getMultipleQuotes(tickers);
        const stockMap = new Map<string, Stock>();
        
        quotes.forEach((stock) => {
          if (stock && stock.ticker) {
            stockMap.set(stock.ticker, stock);
          }
        });

        // Fill in missing stocks with mock data
        tickers.forEach((ticker) => {
          if (!stockMap.has(ticker)) {
            const mockStock = allStocks.find((s) => s.ticker === ticker);
            if (mockStock) {
              stockMap.set(ticker, mockStock);
            }
          }
        });

        setStocks(stockMap);
      } catch (error) {
        console.error('Error fetching multiple stocks:', error);
        // Fallback to mock data on error
        const stockMap = new Map<string, Stock>();
        tickers.forEach((ticker) => {
          const mockStock = allStocks.find((s) => s.ticker === ticker);
          if (mockStock) {
            stockMap.set(ticker, mockStock);
          }
        });
        setStocks(stockMap);
      } finally {
        setLoading(false);
      }
    };

    fetchStocks();

    // Set up periodic refresh (every 30 seconds)
    const interval = setInterval(() => {
      setRefreshKey((prev) => prev + 1);
    }, 30000);

    return () => clearInterval(interval);
  }, [tickers.join(','), refreshKey]);

  return { stocks, loading };
};

