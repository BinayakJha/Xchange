import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './EarningsSummary.css';

type EarningsSummaryItem = {
  symbol: string;
  companyName: string;
  reportDate: string | null;
  quarter: string | null;
  epsActual: number | null;
  epsEstimate: number | null;
  surprisePercent: number | null;
  revenueActual: number | null;
  revenueEstimate: number | null;
  nextEpsEstimate: number | null;
  nextGrowthPercent: number | null;
  summaryText: string | null;
  tweets?: Array<{
    content: string;
    username: string;
    displayName?: string;
    verified?: boolean;
    impact?: string;
    engagement?: number;
    likes?: number;
    retweets?: number;
    timestamp?: string;
    imageUrls?: string[] | null;
    tweetUrl?: string | null;
  }>;
};

type EarningsApiResponse = {
  success: boolean;
  summaries?: EarningsSummaryItem[];
  generatedAt?: string;
  error?: string;
};

const LOOKBACK_DAYS = 7;

const formatEPS = (value: number | null) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toFixed(2);
  }
  return '—';
};

const formatPercent = (value: number | null, withSign = false) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const formatted = Math.abs(value).toFixed(1);
    if (withSign) {
      return `${value >= 0 ? '+' : '-'}${formatted}%`;
    }
    return `${formatted}%`;
  }
  return '—';
};

const formatCurrency = (value: number | null) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const absolute = Math.abs(value);
    if (absolute >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (absolute >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (absolute >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    return `$${value.toFixed(2)}`;
  }
  return '—';
};

const formatDate = (value: string | null) => {
  if (!value) return 'Date TBA';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const EarningsSummary: React.FC = () => {
  const [summaries, setSummaries] = useState<EarningsSummaryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<number>(0);

  const fetchEarnings = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        days: String(LOOKBACK_DAYS),
      });

      const response = await fetch(`/api/earnings/recent?${params.toString()}`, { signal });
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const data: EarningsApiResponse = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to load earnings data');
      }

      setSummaries(Array.isArray(data.summaries) ? data.summaries : []);
      setLastUpdated(data.generatedAt || new Date().toISOString());
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return;
      }
      console.error('[EarningsSummary] Error fetching earnings:', err);
      setError(err?.message || 'Unable to load earnings right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchEarnings(controller.signal);
    return () => controller.abort();
  }, [fetchEarnings, refreshToken]);

  const handleRefresh = () => {
    setRefreshToken((prev) => prev + 1);
  };

  const sortedSummaries = useMemo(() => {
    return [...summaries].sort((a, b) => {
      const aDate = a.reportDate ? new Date(a.reportDate).getTime() : 0;
      const bDate = b.reportDate ? new Date(b.reportDate).getTime() : 0;
      return bDate - aDate;
    });
  }, [summaries]);

  return (
    <section className="earnings-summary">
      <div className="earnings-summary-header">
        <div>
          <h2>Recent Earnings Summary</h2>
          <p>Fresh highlights from the latest reported quarters across market leaders.</p>
        </div>
        <div className="earnings-summary-actions">
          {lastUpdated && (
            <span className="earnings-summary-updated">
              Updated {formatDate(lastUpdated)}
            </span>
          )}
          <button
            className="earnings-summary-refresh"
            onClick={handleRefresh}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {loading && summaries.length === 0 ? (
        <div className="earnings-summary-loading">
          <div className="spinner" aria-hidden="true" />
          <span>Loading earnings highlights…</span>
        </div>
      ) : error ? (
        <div className="earnings-summary-error">
          <p>{error}</p>
          <button onClick={handleRefresh}>Try again</button>
        </div>
      ) : sortedSummaries.length === 0 ? (
        <div className="earnings-summary-empty">
          <p>No recent earnings data available. Please try refreshing shortly.</p>
        </div>
      ) : (
        <div className="earnings-summary-grid">
          {sortedSummaries.map((item) => {
            const surpriseClass =
              typeof item.surprisePercent === 'number'
                ? item.surprisePercent > 0
                  ? 'positive'
                  : item.surprisePercent < 0
                    ? 'negative'
                    : 'neutral'
                : 'neutral';
            const growthClass =
              typeof item.nextGrowthPercent === 'number'
                ? item.nextGrowthPercent > 0
                  ? 'positive'
                  : item.nextGrowthPercent < 0
                    ? 'negative'
                    : 'neutral'
                : 'neutral';

            return (
              <article key={item.symbol} className="earnings-summary-card">
                <header className="earnings-card-header">
                  <div>
                    <span className="earnings-symbol">{item.symbol}</span>
                    <h3 className="earnings-company">{item.companyName}</h3>
                  </div>
                  <div className="earnings-report-meta">
                    <span className="earnings-quarter">{item.quarter || 'Latest quarter'}</span>
                    <span className="earnings-date">{formatDate(item.reportDate)}</span>
                  </div>
                </header>

                <div className="earnings-card-metrics">
                  <div>
                    <span className="metric-label">EPS</span>
                    <span className="metric-value">
                      {formatEPS(item.epsActual)} <span className="metric-sub">Actual</span>
                    </span>
                  </div>
                  <div>
                    <span className="metric-label">Estimate</span>
                    <span className="metric-value">
                      {formatEPS(item.epsEstimate)} <span className="metric-sub">Consensus</span>
                    </span>
                  </div>
                  <div>
                    <span className="metric-label">Surprise</span>
                    <span className={`metric-value ${surpriseClass}`}>
                      {formatPercent(item.surprisePercent, true)}
                    </span>
                  </div>
                </div>

                <div className="earnings-card-footnote">
                  <div>
                    <span className="metric-label">Revenue</span>
                    <span className="metric-value">{formatCurrency(item.revenueActual)}</span>
                  </div>
                  <div>
                    <span className="metric-label">Next EPS est.</span>
                    <span className="metric-value">{formatEPS(item.nextEpsEstimate)}</span>
                  </div>
                  <div>
                    <span className="metric-label">Next growth</span>
                    <span className={`metric-value ${growthClass}`}>
                      {formatPercent(item.nextGrowthPercent, true)}
                    </span>
                  </div>
                </div>

                {item.summaryText && (
                  <p className="earnings-card-summary">
                    {item.summaryText}
                  </p>
                )}

                {Array.isArray(item.tweets) && item.tweets.length > 0 && (
                  <div className="earnings-card-tweets">
                    <h4>Market chatter</h4>
                    <ul>
                      {item.tweets.map((tweet, index) => (
                        <li key={`${item.symbol}-tweet-${index}`}>
                          <div className="tweet-header">
                            <span className="tweet-author">
                              {tweet.displayName || tweet.username}
                              <span className="tweet-handle">@{tweet.username}</span>
                            </span>
                            {tweet.timestamp && (
                              <span className="tweet-time">
                                {formatDate(tweet.timestamp)}
                              </span>
                            )}
                          </div>
                          <p className="tweet-content">{tweet.content}</p>
                          {tweet.imageUrls && Array.isArray(tweet.imageUrls) && tweet.imageUrls.length > 0 && (
                            <div className="tweet-images">
                              {tweet.imageUrls.map((imageUrl, imgIndex) => (
                                <img
                                  key={`${item.symbol}-tweet-${index}-img-${imgIndex}`}
                                  src={imageUrl}
                                  alt={`Earnings chart for ${item.symbol}`}
                                  className="tweet-image"
                                  loading="lazy"
                                />
                              ))}
                            </div>
                          )}
                          <div className="tweet-meta">
                            {tweet.verified && <span className="verified-badge">✓ Verified</span>}
                            {tweet.impact && <span className={`impact ${tweet.impact}`}>{tweet.impact}</span>}
                            {typeof tweet.likes === 'number' && (
                              <span className="engagement">
                                ❤️ {tweet.likes.toLocaleString()}
                              </span>
                            )}
                            {typeof tweet.retweets === 'number' && (
                              <span className="engagement">
                                🔄 {tweet.retweets.toLocaleString()}
                              </span>
                            )}
                            {typeof tweet.engagement === 'number' && !tweet.likes && !tweet.retweets && (
                              <span className="engagement">
                                {tweet.engagement.toLocaleString()} engagements
                              </span>
                            )}
                            {tweet.tweetUrl && (
                              <a
                                href={tweet.tweetUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="tweet-link"
                              >
                                View on X ↗
                              </a>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default EarningsSummary;

