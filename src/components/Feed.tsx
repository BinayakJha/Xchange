import React, { useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import TweetCard from './TweetCard';
import './Feed.css';

const Feed: React.FC = () => {
  const { tweets, watchlist, isAuthenticated } = useApp();
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (feedRef.current && tweets.length > 0) {
      const firstChild = feedRef.current.firstElementChild;
      if (firstChild) {
        firstChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [tweets.length]);

  return (
    <div className="feed" ref={feedRef}>
      <div className="feed-header">
        <h2>Finance Feed</h2>
        <p className="feed-subtitle">Real tweets from market movers & news sources (last 24 hours)</p>
      </div>
      <div className="feed-content">
        {tweets.length === 0 ? (
          <div className="feed-empty">
            <div className="feed-empty-icon">
              <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </div>
            <p>No tweets yet.</p>
            <p className="feed-empty-hint">Add stocks to your watchlist to see real tweets from influential users!</p>
            {process.env.NODE_ENV === 'development' && (
              <div className="feed-debug-info" style={{ marginTop: '20px', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <p><strong>Debug Info:</strong></p>
                <p>Authenticated: {isAuthenticated ? '✅ Yes' : '❌ No'}</p>
                <p>Watchlist: {watchlist.length} stock{watchlist.length !== 1 ? 's' : ''}</p>
                <p>Tweets: {tweets.length}</p>
                <p style={{ marginTop: '8px', fontSize: '11px', opacity: 0.7 }}>
                  Check browser console (F12) for detailed logs with [Tweets] and [Sentiment] prefixes.
                </p>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="feed-info">
              <span className="feed-badge">Real Tweets from X</span>
              <span className="feed-count">{tweets.length} tweet{tweets.length !== 1 ? 's' : ''}</span>
            </div>
            {tweets
              .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
              .map((tweet) => (
                <TweetCard key={tweet.id} tweet={tweet} />
              ))}
          </>
        )}
      </div>
    </div>
  );
};

export default Feed;

