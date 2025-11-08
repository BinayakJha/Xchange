import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useStockSearch } from '../hooks/useStockSearch';
import './StockSearch.css';

const StockSearch: React.FC<{ searchQuery: string; setSearchQuery: (query: string) => void }> = ({
  searchQuery,
  setSearchQuery,
}) => {
  const { addToWatchlist, watchlist } = useApp();
  const [isFocused, setIsFocused] = useState(false);
  const { results, loading } = useStockSearch(searchQuery);

  const handleAdd = (ticker: string) => {
    try {
      if (!ticker || !ticker.trim()) return;
      addToWatchlist(ticker.trim().toUpperCase());
      setSearchQuery('');
      setIsFocused(false);
    } catch (error) {
      console.error('Error adding stock to watchlist:', error);
    }
  };

  const isInWatchlist = (ticker: string) => {
    return watchlist.some((item) => item.ticker === ticker);
  };

  const formatPrice = (price: number) => {
    return price.toFixed(2);
  };

  const formatChange = (change: number, changePercent: number) => {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)} (${sign}${changePercent.toFixed(2)}%)`;
  };

  return (
    <div className="stock-search">
      <div className="search-input-wrapper">
        <svg
          className="search-icon"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          className="search-input"
          placeholder="Search by ticker, company name, or crypto (e.g., BTC-USD)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
        />
        {loading && (
          <div className="search-loading">
            <div className="spinner"></div>
          </div>
        )}
      </div>

      {isFocused && searchQuery.trim() && (
        <div className="search-results">
          {loading && results.length === 0 ? (
            <div className="search-loading-state">
              <div className="spinner"></div>
              <span>Searching...</span>
            </div>
          ) : results.length > 0 ? (
            results.map((stock) => {
              if (!stock || !stock.ticker) return null;
              
              const isCrypto = stock.type === 'crypto' || stock.ticker.includes('-');
              const price = stock.price ?? 0;
              const change = stock.change ?? 0;
              const changePercent = stock.changePercent ?? 0;
              const name = stock.name || stock.ticker;
              
              const formatCryptoPrice = (p: number) => {
                if (p >= 1000) return p.toFixed(2);
                if (p >= 1) return p.toFixed(2);
                return p.toFixed(4);
              };
              
              return (
                <div key={stock.ticker} className="search-result-item">
                  <div className="result-info">
                    <div className="result-header">
                      <div className="result-ticker-wrapper">
                        <span className="result-ticker">{isCrypto ? stock.ticker.replace('-USD', '') : stock.ticker}</span>
                        {isCrypto && (
                          <span className="crypto-badge-small">CRYPTO</span>
                        )}
                      </div>
                      <span className="result-price">${isCrypto ? formatCryptoPrice(price) : formatPrice(price)}</span>
                    </div>
                    <span className="result-name">{name}</span>
                    <span className={`result-change ${change >= 0 ? 'positive' : 'negative'}`}>
                      {formatChange(change, changePercent)}
                    </span>
                  </div>
                  {isInWatchlist(stock.ticker) ? (
                    <span className="result-added">Added</span>
                  ) : (
                    <button
                      className="btn-add-small"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleAdd(stock.ticker);
                      }}
                    >
                      Add
                    </button>
                  )}
                </div>
              );
            })
          ) : (
            <div className="search-no-results">
              <span>No stocks found</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StockSearch;

