import { useState, useEffect, useCallback } from 'react';
import { Stock } from '../types';
import { searchStocks, getStockQuote } from '../services/stockApi';

export const useStockSearch = (query: string) => {
  const [results, setResults] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const search = async () => {
      if (!query.trim()) {
        setResults([]);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Debounce search
        const timeoutId = setTimeout(async () => {
          try {
            const stocks = await searchStocks(query);
            setResults(stocks || []);
          } catch (err) {
            console.error('Search error:', err);
            setError('Failed to search stocks');
            setResults([]);
          } finally {
            setLoading(false);
          }
        }, 300);

        return () => clearTimeout(timeoutId);
      } catch (err) {
        console.error('Search setup error:', err);
        setError('Failed to search stocks');
        setLoading(false);
        setResults([]);
      }
    };

    search();
  }, [query]);

  const getQuote = useCallback(async (ticker: string) => {
    return await getStockQuote(ticker);
  }, []);

  return { results, loading, error, getQuote };
};

