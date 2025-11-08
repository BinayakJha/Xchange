import React from 'react';
import { useApp } from '../context/AppContext';
import { popularCrypto } from '../data/mockData';
import { useMultipleCryptoData } from '../hooks/useCryptoData';
import CryptoLiveIndicator from './CryptoLiveIndicator';
import './PopularCrypto.css';

const PopularCrypto: React.FC = () => {
  const { addToWatchlist, watchlist } = useApp();
  const tickers = popularCrypto.map((c) => c.ticker);
  const { stocks } = useMultipleCryptoData(tickers);

  const isInWatchlist = (ticker: string) => {
    return watchlist.some((item) => item.ticker === ticker);
  };

  const formatPrice = (price: number) => {
    if (price >= 1000) {
      return price.toFixed(2);
    } else if (price >= 1) {
      return price.toFixed(2);
    } else {
      return price.toFixed(4);
    }
  };

  return (
    <div className="popular-crypto">
      <div className="crypto-header-section">
        <CryptoLiveIndicator />
      </div>
      {popularCrypto.map((mockCrypto) => {
        const crypto = stocks.get(mockCrypto.ticker) || mockCrypto;
        
        // Safety checks
        if (!crypto || !crypto.ticker) return null;
        
        const price = crypto.price ?? mockCrypto.price ?? 0;
        const change = crypto.change ?? mockCrypto.change ?? 0;
        const changePercent = crypto.changePercent ?? mockCrypto.changePercent ?? 0;
        const name = crypto.name || mockCrypto.name || crypto.ticker;

        return (
          <div key={crypto.ticker} className="popular-crypto-item">
            <div className="crypto-info">
              <div className="crypto-header">
                <span className="crypto-ticker">{crypto.ticker.replace('-USD', '')}</span>
                <span className="crypto-badge">CRYPTO</span>
              </div>
              <span className="crypto-name">{name}</span>
              <div className="crypto-price">
                <span className="price">${formatPrice(price)}</span>
                <span
                  className={`change ${change >= 0 ? 'positive' : 'negative'}`}
                >
                  {change >= 0 ? '+' : ''}
                  {change >= 0 ? formatPrice(change) : formatPrice(Math.abs(change))} ({changePercent >= 0 ? '+' : ''}
                  {changePercent.toFixed(2)}%)
                </span>
              </div>
            </div>
            {isInWatchlist(crypto.ticker) ? (
              <span className="crypto-added">Added</span>
            ) : (
              <button
                className="btn-add"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  try {
                    addToWatchlist(crypto.ticker);
                  } catch (error) {
                    console.error('Error adding to watchlist:', error);
                  }
                }}
              >
                Add
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default PopularCrypto;

