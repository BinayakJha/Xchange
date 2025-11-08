import React from 'react';
import { Tweet } from '../types';
import { useApp } from '../context/AppContext';
import './TweetCard.css';

interface TweetCardProps {
  tweet: Tweet;
}

const TweetCard: React.FC<TweetCardProps> = ({ tweet }) => {
  const { sentiments } = useApp();

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const getImpactIcon = () => {
    switch (tweet.impact) {
      case 'high':
        return '🔥';
      case 'medium':
        return '⚡';
      default:
        return '💡';
    }
  };

  const getImpactColor = () => {
    switch (tweet.impact) {
      case 'high':
        return 'var(--accent-red)';
      case 'medium':
        return 'var(--accent-yellow)';
      default:
        return 'var(--text-secondary)';
    }
  };

  return (
    <article id={`tweet-${tweet.id}`} className="tweet-card fade-in">
      <div className="tweet-avatar">
        <img src={tweet.avatar} alt={tweet.displayName} />
      </div>
      <div className="tweet-content">
        <div className="tweet-header">
          <div className="tweet-user">
            <span className="tweet-display-name">{tweet.displayName}</span>
            <span className="tweet-username">@{tweet.username}</span>
            <span className="tweet-time">· {formatTime(tweet.timestamp)}</span>
          </div>
          <div
            className="tweet-impact"
            style={{ color: getImpactColor() }}
            title={`${tweet.impact} impact`}
          >
            {getImpactIcon()}
          </div>
        </div>
        <div className="tweet-text">{tweet.content}</div>
        {tweet.mentionedStocks && tweet.mentionedStocks.length > 0 && (
          <div className="tweet-stocks">
            {tweet.mentionedStocks
              .filter((ticker) => ticker !== 'MARKET') // Don't show generic MARKET tag
              .map((ticker) => (
                <span key={ticker} className="stock-tag">
                  ${ticker}
                </span>
              ))}
          </div>
        )}
        
        {/* Show sentiment impact for each mentioned stock */}
        {tweet.sentimentImpact && Object.keys(tweet.sentimentImpact).length > 0 && (
          <div className="tweet-sentiment-impact">
            <span className="sentiment-impact-label">Impacting sentiment:</span>
            <div className="sentiment-impact-tags">
              {Object.entries(tweet.sentimentImpact)
                .filter(([ticker]) => ticker !== 'MARKET')
                .map(([ticker, direction]) => {
                  const sentiment = sentiments[ticker];
                  const sentimentPercent = sentiment
                    ? direction === 'bullish'
                      ? sentiment.bullish
                      : direction === 'bearish'
                      ? sentiment.bearish
                      : sentiment.neutral
                    : null;

                  return (
                    <span
                      key={ticker}
                      className={`sentiment-impact-tag ${direction}`}
                      title={`This tweet is ${direction} for ${ticker} sentiment`}
                    >
                      <span className="impact-ticker">${ticker}</span>
                      <span className="impact-direction">
                        {direction === 'bullish' ? '📈' : direction === 'bearish' ? '📉' : '➡️'}
                        {direction.toUpperCase()}
                      </span>
                      {sentimentPercent !== null && (
                        <span className="impact-percent">{sentimentPercent}%</span>
                      )}
                    </span>
                  );
                })}
            </div>
          </div>
        )}
        
        <div className="tweet-actions">
          <button className="tweet-action">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" />
            </svg>
            <span>{tweet.likes}</span>
          </button>
          <button className="tweet-action">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            <span>{tweet.retweets}</span>
          </button>
        </div>
      </div>
    </article>
  );
};

export default TweetCard;

