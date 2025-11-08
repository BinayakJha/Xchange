import React, { useMemo, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { allStocks, popularCrypto } from '../data/mockData';
import { useMultipleStockData } from '../hooks/useStockData';
import { useMultipleCryptoData } from '../hooks/useCryptoData';
import { Stock } from '../types';
import './SentimentSidebar.css';

const SentimentSidebar: React.FC = () => {
  const { watchlist, sentiments, marketSentiment } = useApp();
  const tickers = watchlist.map((item) => item.ticker);
  
  // Separate crypto and stock tickers
  const cryptoTickers = tickers.filter(t => t.includes('-') || t.includes('USD'));
  const stockTickers = tickers.filter(t => !t.includes('-') && !t.includes('USD'));
  
  const { stocks: stockData, loading: stocksLoading } = useMultipleStockData(stockTickers);
  const { stocks: cryptoData, loading: cryptoLoading } = useMultipleCryptoData(cryptoTickers);
  
  // Merge both maps - use size and tickers as dependencies to prevent infinite loops
  const stocks = useMemo(() => {
    return new Map([...stockData, ...cryptoData]);
  }, [stockData.size, cryptoData.size, tickers.join(',')]);
  
  const loading = stocksLoading || cryptoLoading;

  const handleInsightClick = useCallback((tweetId: string) => {
    if (!tweetId) return;
    const element = document.getElementById(`tweet-${tweetId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('tweet-highlight');
      window.setTimeout(() => {
        element.classList.remove('tweet-highlight');
      }, 2500);
    }
  }, []);


  if (watchlist.length === 0) {
    return (
      <div className="sentiment-sidebar">
        <h3 className="sidebar-title">Market Sentiment</h3>
        <div className="sidebar-empty">
          <p>Add stocks to your watchlist to see sentiment analysis</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sentiment-sidebar">
      <h3 className="sidebar-title">Market Sentiment</h3>
      
      {/* Overall Market Sentiment */}
      {marketSentiment && (
        <div className="market-sentiment-overall">
          <div className="market-sentiment-header">
            <span className="market-sentiment-label">Overall Market</span>
            <span className={`market-sentiment-overall-badge ${marketSentiment.overall}`}>
              {marketSentiment.overall.toUpperCase()}
            </span>
          </div>
          <div className="sentiment-bars">
            <div className="sentiment-bar-container">
              <div className="sentiment-bar-label">
                <span>Bullish</span>
                <span>{marketSentiment.bullish}%</span>
              </div>
              <div className="sentiment-bar">
                <div
                  className="sentiment-bar-fill bullish"
                  style={{ width: `${marketSentiment.bullish}%` }}
                />
              </div>
            </div>
            <div className="sentiment-bar-container">
              <div className="sentiment-bar-label">
                <span>Neutral</span>
                <span>{marketSentiment.neutral}%</span>
              </div>
              <div className="sentiment-bar">
                <div
                  className="sentiment-bar-fill neutral"
                  style={{ width: `${marketSentiment.neutral}%` }}
                />
              </div>
            </div>
            <div className="sentiment-bar-container">
              <div className="sentiment-bar-label">
                <span>Bearish</span>
                <span>{marketSentiment.bearish}%</span>
              </div>
              <div className="sentiment-bar">
                <div
                  className="sentiment-bar-fill bearish"
                  style={{ width: `${marketSentiment.bearish}%` }}
                />
              </div>
            </div>
          </div>
          {marketSentiment.summary && 
           !marketSentiment.summary.includes('unavailable') && 
           !marketSentiment.summary.includes('API error') && (
            <p className="market-sentiment-summary">{marketSentiment.summary}</p>
          )}
          {marketSentiment.topInsights && marketSentiment.topInsights.length > 0 && (
            <div className="market-sentiment-insights">
              <p className="insights-label">Tweet Drivers</p>
              <ul className="insights-list">
                {marketSentiment.topInsights.slice(0, 4).map((insight) => (
                  <li key={insight.tweetId}>
                    <button
                      type="button"
                      className={`insight-pill ${insight.direction}`}
                      onClick={() => handleInsightClick(insight.tweetId)}
                    >
                      <span className="insight-user">@{insight.username}</span>
                      <span className="insight-direction">{insight.direction.toUpperCase()}</span>
                      <span className="insight-summary">{insight.summary}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {marketSentiment.keyDrivers && 
           marketSentiment.keyDrivers.length > 0 && 
           !marketSentiment.keyDrivers.some(d => d.includes('unavailable') || d.includes('Analyzing')) && (
            <div className="market-sentiment-drivers">
              <p className="drivers-label">Key Drivers:</p>
              <ul className="drivers-list">
                {marketSentiment.keyDrivers.map((driver, idx) => (
                  <li key={idx}>{driver}</li>
                ))}
              </ul>
            </div>
          )}
          {marketSentiment.sourceAccounts && marketSentiment.sourceAccounts.length > 0 && (
            <div className="market-sentiment-sources">
              <p className="sources-label">From: {marketSentiment.sourceAccounts.slice(0, 3).join(', ')}{marketSentiment.sourceAccounts.length > 3 ? ` +${marketSentiment.sourceAccounts.length - 3} more` : ''}</p>
            </div>
          )}
        </div>
      )}

      {loading && watchlist.length > 0 && (
        <div className="sidebar-loading">
          <div className="spinner"></div>
          <span>Loading prices...</span>
        </div>
      )}
      <div className="sentiment-list">
        {watchlist.map((item) => {
          if (!item || !item.ticker) return null;
          
          const stock = stocks.get(item.ticker) || 
            allStocks.find((s) => s.ticker === item.ticker) ||
            popularCrypto.find((c) => c.ticker === item.ticker);
          const sentiment = sentiments[item.ticker];
          
          if (!stock) {
            // Show placeholder while loading
            return (
              <div key={item.ticker} className="sentiment-item">
                <div className="sentiment-header">
                  <span className="sentiment-ticker">{item.ticker}</span>
                  <span className="sentiment-price">--</span>
                </div>
                <div className="sentiment-bars">
                  <p style={{ color: 'var(--text-secondary)', fontSize: '14px', padding: '8px' }}>Loading...</p>
                </div>
              </div>
            );
          }
          
          // If no sentiment data, show default neutral
          if (!sentiment) {
            return (
              <div key={item.ticker} className="sentiment-item">
                <div className="sentiment-header">
                  <div className="sentiment-ticker-wrapper">
                    <span className="sentiment-ticker">{isCrypto ? item.ticker.replace('-USD', '') : item.ticker}</span>
                    {isCrypto && (
                      <span className="crypto-badge-small">CRYPTO</span>
                    )}
                  </div>
                  <div className="sentiment-price-info">
                    <span className="sentiment-price">${formatPrice(price)}</span>
                    {change !== 0 && (
                      <span className={`sentiment-change ${change >= 0 ? 'positive' : 'negative'}`}>
                        {change >= 0 ? '+' : ''}{formatPrice(Math.abs(change))}
                      </span>
                    )}
                  </div>
                </div>
                <div className="sentiment-bars">
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px', padding: '8px' }}>
                    Calculating sentiment...
                  </p>
                </div>
              </div>
            );
          }

          const isCrypto = stock.type === 'crypto' || item.ticker.includes('-');
          const price = stock.price ?? 0;
          const change = stock.change ?? 0;

          // Ensure we have valid percentages (not all zeros)
          const hasValidSentiment = sentiment.bullish > 0 || sentiment.bearish > 0 || sentiment.neutral > 0;
          if (!hasValidSentiment) {
            // Default to neutral if all zeros
            sentiment.bullish = 33;
            sentiment.bearish = 33;
            sentiment.neutral = 34;
            sentiment.overall = 'neutral';
          }
          
          const formatPrice = (p: number) => {
            if (isCrypto) {
              if (p >= 1000) return p.toFixed(2);
              if (p >= 1) return p.toFixed(2);
              return p.toFixed(4);
            }
            return p.toFixed(2);
          };

          return (
            <div key={item.ticker} className="sentiment-item">
              <div className="sentiment-header">
                <div className="sentiment-ticker-wrapper">
                  <span className="sentiment-ticker">{isCrypto ? item.ticker.replace('-USD', '') : item.ticker}</span>
                  {isCrypto && (
                    <span className="crypto-badge-small">CRYPTO</span>
                  )}
                </div>
                <div className="sentiment-price-info">
                  <span className="sentiment-price">${formatPrice(price)}</span>
                  {change !== 0 && (
                    <span className={`sentiment-change ${change >= 0 ? 'positive' : 'negative'}`}>
                      {change >= 0 ? '+' : ''}{formatPrice(Math.abs(change))}
                    </span>
                  )}
                </div>
              </div>
              <div className="sentiment-bars">
                <div className="sentiment-bar-container">
                  <div className="sentiment-bar-label">
                    <span>Bullish</span>
                    <span>{sentiment.bullish}%</span>
                  </div>
                  <div className="sentiment-bar">
                    <div
                      className="sentiment-bar-fill bullish"
                      style={{ width: `${sentiment.bullish}%` }}
                    />
                  </div>
                </div>
                <div className="sentiment-bar-container">
                  <div className="sentiment-bar-label">
                    <span>Neutral</span>
                    <span>{sentiment.neutral}%</span>
                  </div>
                  <div className="sentiment-bar">
                    <div
                      className="sentiment-bar-fill neutral"
                      style={{ width: `${sentiment.neutral}%` }}
                    />
                  </div>
                </div>
                <div className="sentiment-bar-container">
                  <div className="sentiment-bar-label">
                    <span>Bearish</span>
                    <span>{sentiment.bearish}%</span>
                  </div>
                  <div className="sentiment-bar">
                    <div
                      className="sentiment-bar-fill bearish"
                      style={{ width: `${sentiment.bearish}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SentimentSidebar;

