import React from 'react';
import { useApp } from '../context/AppContext';
import { allStocks, popularCrypto } from '../data/mockData';
import { useMultipleStockData } from '../hooks/useStockData';
import { useMultipleCryptoData } from '../hooks/useCryptoData';
import CryptoLiveIndicator from './CryptoLiveIndicator';
import './WatchlistDisplay.css';

const WatchlistDisplay: React.FC = () => {
  const { watchlist, removeFromWatchlist } = useApp();
  const tickers = watchlist.map((item) => item.ticker);
  
  // Separate crypto and stock tickers
  const cryptoTickers = tickers.filter(t => t.includes('-') || t.includes('USD'));
  const stockTickers = tickers.filter(t => !t.includes('-') && !t.includes('USD'));
  
  const { stocks: stockData, loading: stocksLoading } = useMultipleStockData(stockTickers);
  const { stocks: cryptoData, loading: cryptoLoading } = useMultipleCryptoData(cryptoTickers);
  
  // Merge both maps
  const stocks = new Map([...stockData, ...cryptoData]);
  const loading = stocksLoading || cryptoLoading;

  if (watchlist.length === 0) {
    return (
      <div className="watchlist-display empty">
        <p className="empty-message">Your watchlist is empty. Add stocks to get started!</p>
      </div>
    );
  }

  const hasCrypto = cryptoTickers.length > 0;

  return (
    <div className="watchlist-display">
      <div className="watchlist-title-wrapper">
        <h2 className="watchlist-display-title">Your Watchlist</h2>
        {hasCrypto && <CryptoLiveIndicator />}
      </div>
      {loading && watchlist.length > 0 && (
        <div className="watchlist-loading">
          <div className="spinner"></div>
          <span>Loading prices...</span>
        </div>
      )}
      <div className="watchlist-items">
        {watchlist.map((item) => {
          if (!item || !item.ticker) return null;
          
          const stock = stocks.get(item.ticker) || 
            allStocks.find((s) => s.ticker === item.ticker) ||
            popularCrypto.find((c) => c.ticker === item.ticker);
          if (!stock) {
            // Show placeholder while loading
            return (
              <div key={item.ticker} className="watchlist-item">
                <div className="item-content">
                  <div className="item-header">
                    <span className="item-ticker">{item.ticker}</span>
                    <span className="item-name">Loading...</span>
                  </div>
                  <div className="item-price">
                    <span className="price">--</span>
                  </div>
                </div>
                <button
                  className="btn-remove"
                  onClick={() => removeFromWatchlist(item.ticker)}
                  title="Remove from watchlist"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            );
          }

          const isCrypto = stock.type === 'crypto' || item.ticker.includes('-');
          const formatPrice = (price: number) => {
            if (isCrypto) {
              if (price >= 1000) {
                return price.toFixed(2);
              } else if (price >= 1) {
                return price.toFixed(2);
              } else {
                return price.toFixed(4);
              }
            }
            return price.toFixed(2);
          };

          const formatChange = (change: number) => {
            if (isCrypto && Math.abs(change) < 1) {
              return change.toFixed(4);
            }
            return change.toFixed(2);
          };

          return (
            <div key={item.ticker} className="watchlist-item">
              <div className="item-content">
                <div className="item-header">
                  <div className="item-ticker-wrapper">
                    <span className="item-ticker">{isCrypto ? stock.ticker.replace('-USD', '') : stock.ticker}</span>
                    {isCrypto && (
                      <span className="crypto-badge-small">CRYPTO</span>
                    )}
                  </div>
                  <span className="item-name">{stock.name}</span>
                </div>
                <div className="item-price">
                  <span className="price">${formatPrice(stock.price)}</span>
                  <span
                    className={`change ${stock.change >= 0 ? 'positive' : 'negative'}`}
                  >
                    {stock.change >= 0 ? '+' : ''}
                    {formatChange(stock.change)} ({stock.changePercent >= 0 ? '+' : ''}
                    {stock.changePercent.toFixed(2)}%)
                  </span>
                </div>
              </div>
              <button
                className="btn-remove"
                onClick={() => removeFromWatchlist(item.ticker)}
                title="Remove from watchlist"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WatchlistDisplay;

