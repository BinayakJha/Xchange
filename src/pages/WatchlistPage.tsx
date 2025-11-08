import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import StockSearch from '../components/StockSearch';
import PopularStocks from '../components/PopularStocks';
import PopularCrypto from '../components/PopularCrypto';
import WatchlistDisplay from '../components/WatchlistDisplay';
import './WatchlistPage.css';

const WatchlistPage: React.FC = () => {
  const navigate = useNavigate();
  const { watchlist } = useApp();
  const [searchQuery, setSearchQuery] = useState('');

  const handleAnalyze = () => {
    if (watchlist.length > 0) {
      navigate('/analysis');
    }
  };

  return (
    <div className="watchlist-page">
      <div className="watchlist-header">
        <div className="watchlist-logo">
          <svg viewBox="0 0 24 24" className="logo-icon">
            <g>
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="currentColor" />
            </g>
          </svg>
          <span>XFinance</span>
        </div>
        <h1 className="watchlist-title">Build Your Watchlist</h1>
        <p className="watchlist-subtitle">Add stocks to track and analyze</p>
      </div>

      <div className="watchlist-content">
        <div className="watchlist-grid">
          <div className="watchlist-box popular-box">
            <h2 className="box-title">Popular Stocks</h2>
            <PopularStocks />
          </div>

          <div className="watchlist-box popular-box">
            <h2 className="box-title">Popular Crypto</h2>
            <PopularCrypto />
          </div>

          <div className="watchlist-box search-box">
            <h2 className="box-title">Search Stock or Crypto</h2>
            <StockSearch searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
          </div>
        </div>

        <div className="watchlist-display-section">
          <WatchlistDisplay />
        </div>

        <div className="watchlist-actions">
          <button
            className="btn btn-primary btn-analyze"
            onClick={handleAnalyze}
            disabled={watchlist.length === 0}
          >
            Analyze Watchlist
          </button>
        </div>
      </div>
    </div>
  );
};

export default WatchlistPage;

