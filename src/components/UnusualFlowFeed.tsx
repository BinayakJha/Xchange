import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { UnusualFlow } from '../types';
import { BullishIcon, BearishIcon } from './Icons';
import './UnusualFlowFeed.css';

interface FlowAnalysis {
  ticker: string;
  expirationDate: string | null;
  strikePrice: number | null;
  premium: number | null;
  optionType: 'call' | 'put' | null;
  action: 'buy' | 'sell' | null;
}

const UnusualFlowFeed: React.FC = () => {
  const { unusualFlows, isAuthenticated, addPosition } = useApp();
  const feedRef = useRef<HTMLDivElement>(null);
  const [selectedFlow, setSelectedFlow] = useState<UnusualFlow | null>(null);
  const [analysis, setAnalysis] = useState<FlowAnalysis | null>(null);

  // Ensure unusualFlows is always an array
  const flows = Array.isArray(unusualFlows) ? unusualFlows : [];

  useEffect(() => {
    if (feedRef.current && flows.length > 0) {
      const firstChild = feedRef.current.firstElementChild;
      if (firstChild) {
        firstChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [flows.length]);

  const formatValue = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

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

  const getFlowTypeColor = (type: 'call' | 'put' | 'volume') => {
    switch (type) {
      case 'call':
        return 'var(--accent-green)';
      case 'put':
        return 'var(--accent-red)';
      default:
        return 'var(--accent-blue)';
    }
  };

  const getFlowTypeIcon = (type: 'call' | 'put' | 'volume') => {
    switch (type) {
      case 'call':
        return <BullishIcon size={16} style={{ color: getFlowTypeColor(type) }} />;
      case 'put':
        return <BearishIcon size={16} style={{ color: getFlowTypeColor(type) }} />;
      default:
        return '📊';
    }
  };

  // Analyze flow image to extract key information
  const analyzeFlow = async (flow: UnusualFlow) => {
    if (!flow.imageUrl) {
      // Fallback to text analysis if no image
      return analyzeFlowFromText(flow);
    }

    try {
      const { analyzeFlowImage } = await import('../services/grokApi');
      const imageAnalysis = await analyzeFlowImage(flow.imageUrl, flow.ticker);
      
      // Map image analysis to FlowAnalysis format
      const analysis: FlowAnalysis = {
        ticker: imageAnalysis.ticker || flow.ticker,
        expirationDate: imageAnalysis.expirationDate,
        strikePrice: imageAnalysis.strikePrice,
        premium: imageAnalysis.premium,
        optionType: imageAnalysis.optionType || (flow.type === 'call' || flow.type === 'put' ? flow.type : null),
        action: imageAnalysis.action,
      };

      return analysis;
    } catch (error) {
      console.error('[FlowAnalysis] Error analyzing image, falling back to text:', error);
      // Fallback to text analysis if image analysis fails
      return analyzeFlowFromText(flow);
    }
  };

  // Fallback: Analyze flow from text description
  const analyzeFlowFromText = (flow: UnusualFlow): FlowAnalysis => {
    const content = flow.description.toUpperCase();
    const analysis: FlowAnalysis = {
      ticker: flow.ticker,
      expirationDate: null,
      strikePrice: null,
      premium: null,
      optionType: flow.type === 'call' || flow.type === 'put' ? flow.type : null,
      action: null,
    };

    // Extract expiration date (common formats: "1/19", "01/19", "JAN 19", "2024-01-19")
    const datePatterns = [
      /(\d{1,2})\/(\d{1,2})/g, // 1/19, 01/19
      /(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s*(\d{1,2})/gi, // JAN 19
      /(\d{4})-(\d{2})-(\d{2})/g, // 2024-01-19
    ];

    for (const pattern of datePatterns) {
      const match = content.match(pattern);
      if (match) {
        analysis.expirationDate = match[0];
        break;
      }
    }

    // Extract strike price (common patterns: "$150", "150", "STRIKE 150")
    const strikePatterns = [
      /\$(\d+(?:\.\d+)?)/g,
      /STRIKE[:\s]+(\d+(?:\.\d+)?)/gi,
      /(\d{3,}(?:\.\d+)?)\s*(?:STRIKE|CALL|PUT)/gi,
    ];

    for (const pattern of strikePatterns) {
      const matches = content.match(pattern);
      if (matches) {
        const strikeMatch = matches[0].match(/(\d+(?:\.\d+)?)/);
        if (strikeMatch) {
          analysis.strikePrice = parseFloat(strikeMatch[1]);
          break;
        }
      }
    }

    // Extract premium (common patterns: "$2.50", "2.50", "PREMIUM 2.50")
    const premiumPatterns = [
      /PREMIUM[:\s]+\$?(\d+(?:\.\d+)?)/gi,
      /\$(\d+\.\d{2})/g,
    ];

    for (const pattern of premiumPatterns) {
      const match = content.match(pattern);
      if (match) {
        const premiumMatch = match[0].match(/(\d+(?:\.\d+)?)/);
        if (premiumMatch) {
          analysis.premium = parseFloat(premiumMatch[1]);
          break;
        }
      }
    }

    // Determine action based on flow type and content
    if (flow.type === 'call') {
      analysis.action = 'buy';
    } else if (flow.type === 'put') {
      analysis.action = 'buy';
    } else {
      // Try to infer from content
      if (content.includes('BUY') || content.includes('LONG') || content.includes('CALL BUYER')) {
        analysis.action = 'buy';
      } else if (content.includes('SELL') || content.includes('SHORT') || content.includes('PUT BUYER')) {
        analysis.action = 'sell';
      }
    }

    return analysis;
  };

  // Handle flow selection
  const handleFlowSelect = async (flow: UnusualFlow) => {
    setSelectedFlow(flow);
    setAnalysis(null); // Clear previous analysis while loading
    
    try {
      const flowAnalysis = await analyzeFlow(flow);
      setAnalysis(flowAnalysis);
    } catch (error) {
      console.error('[FlowAnalysis] Error analyzing flow:', error);
      // Set fallback analysis
      const fallbackAnalysis = analyzeFlowFromText(flow);
      setAnalysis(fallbackAnalysis);
    }
  };

  // Handle buy/sell action
  const handleTrade = async (action: 'buy' | 'sell') => {
    if (!selectedFlow || !analysis) return;

    // For now, just log the action
    // Later this can be integrated with the papertrade system
    console.log(`[Flow Trade] ${action.toUpperCase()} ${analysis.ticker}`, analysis);
    
    // TODO: Integrate with addPosition from AppContext
    // This would require creating an option position
    alert(`${action.toUpperCase()} order for ${analysis.ticker} would be executed here`);
  };

  return (
    <div className="unusual-flow-feed" ref={feedRef}>
      <div className="flow-feed-header">
        <h2>Unusual Flows</h2>
        <p className="flow-feed-subtitle">Real-time options flow from FL0WG0D (past 24 hours)</p>
      </div>
      <div className="flow-feed-content">
        {!isAuthenticated ? (
          <div className="flow-feed-empty">
            <p>Please log in to view unusual flows.</p>
          </div>
        ) : flows.length === 0 ? (
          <div className="flow-feed-empty">
            <div className="flow-feed-empty-icon">
              <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
            </div>
            <p>Loading unusual flows...</p>
            <p className="flow-feed-empty-hint">Fetching flow images from FL0WG0D (past 24 hours)</p>
            {process.env.NODE_ENV === 'development' && (
              <div className="flow-feed-debug-info">
                <p><strong>Debug Info:</strong></p>
                <p>Authenticated: {isAuthenticated ? '✅ Yes' : '❌ No'}</p>
                <p>Flows: {flows.length}</p>
                <p style={{ marginTop: '8px', fontSize: '11px', opacity: 0.7 }}>
                  Check browser console (F12) for detailed logs with [Unusual Flows] prefix.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="flow-feed-layout">
            <div className="flow-feed-grid">
              <div className="flow-feed-info">
                <span className="flow-feed-badge">Real Flows from X</span>
                <span className="flow-feed-count">{flows.length} flow{flows.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="flow-cards-grid">
                {flows.map((flow) => (
                  <FlowCard 
                    key={flow.id} 
                    flow={flow} 
                    formatValue={formatValue} 
                    formatTime={formatTime} 
                    getFlowTypeColor={getFlowTypeColor} 
                    getFlowTypeIcon={getFlowTypeIcon}
                    isSelected={selectedFlow?.id === flow.id}
                    onSelect={() => handleFlowSelect(flow)}
                  />
                ))}
              </div>
            </div>
            
            <div className="flow-analysis-panel">
              {selectedFlow ? (
                analysis ? (
                  <FlowAnalysisPanel 
                    flow={selectedFlow}
                    analysis={analysis}
                    onTrade={handleTrade}
                  />
                ) : (
                  <div className="analysis-loading">
                    <div className="analysis-loading-spinner">
                      <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" opacity="0.25" />
                        <path d="M12 2 A10 10 0 0 1 22 12" strokeLinecap="round" />
                      </svg>
                    </div>
                    <p>Analyzing image...</p>
                    <p className="analysis-loading-hint">Extracting data from flow image</p>
                  </div>
                )
              ) : (
                <div className="analysis-placeholder">
                  <div className="analysis-placeholder-icon">
                    <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                    </svg>
                  </div>
                  <p>Select a flow to analyze</p>
                  <p className="analysis-placeholder-hint">Click on any flow card to analyze the image</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface FlowCardProps {
  flow: UnusualFlow;
  formatValue: (value: number) => string;
  formatTime: (date: Date) => string;
  getFlowTypeColor: (type: 'call' | 'put' | 'volume') => string;
  getFlowTypeIcon: (type: 'call' | 'put' | 'volume') => React.ReactNode;
  isSelected?: boolean;
  onSelect?: () => void;
}

const FlowCard: React.FC<FlowCardProps> = ({ flow, formatValue, formatTime, getFlowTypeColor, getFlowTypeIcon, isSelected, onSelect }) => {
  return (
    <article 
      className={`flow-card fade-in ${isSelected ? 'selected' : ''}`}
      onClick={onSelect}
      style={{ cursor: onSelect ? 'pointer' : 'default' }}
    >
      <div className="flow-card-header">
        <div className="flow-card-user">
          <div className="flow-card-avatar">
            <svg viewBox="0 0 24 24" width="40" height="40" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
            </svg>
          </div>
          <div className="flow-card-user-info">
            <div className="flow-card-user-header">
              <span className="flow-card-display-name">FL0WG0D</span>
              <span className="flow-card-username">@FL0WG0D</span>
              <span className="flow-card-time">· {formatTime(flow.timestamp)}</span>
            </div>
            <div className="flow-card-ticker-info">
              <span className="flow-card-ticker">${flow.ticker}</span>
              <span 
                className="flow-card-type" 
                style={{ color: getFlowTypeColor(flow.type) }}
              >
                {getFlowTypeIcon(flow.type)} {flow.type.toUpperCase()}
              </span>
              {flow.value > 0 && (
                <span className="flow-card-value">{formatValue(flow.value)}</span>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {flow.description && (
        <div className="flow-card-text">{flow.description}</div>
      )}
      
      {flow.imageUrl && (
        <div className="flow-card-image-container" onClick={(e) => e.stopPropagation()}>
          <a 
            href={flow.tweetUrl || `https://x.com/FL0WG0D`} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flow-card-image-link"
          >
            <img 
              src={flow.imageUrl} 
              alt={`Flow chart for ${flow.ticker}`}
              className="flow-card-image"
              loading="lazy"
            />
          </a>
        </div>
      )}
      
      <div className="flow-card-footer">
        {flow.tweetUrl && (
          <a 
            href={flow.tweetUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flow-card-link"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            <span>View on X</span>
          </a>
        )}
      </div>
    </article>
  );
};

interface FlowAnalysisPanelProps {
  flow: UnusualFlow;
  analysis: FlowAnalysis;
  onTrade: (action: 'buy' | 'sell') => void;
}

const FlowAnalysisPanel: React.FC<FlowAnalysisPanelProps> = ({ flow, analysis, onTrade }) => {
  return (
    <div className="flow-analysis">
      <div className="analysis-header">
        <h3>Flow Analysis</h3>
        <a 
          href={flow.tweetUrl || `https://x.com/FL0WG0D`} 
          target="_blank" 
          rel="noopener noreferrer"
          className="analysis-link"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
          View on X
        </a>
      </div>

      <div className="analysis-content">
        <div className="analysis-section">
          <label>Stock Symbol</label>
          <div className="analysis-value large">${analysis.ticker}</div>
        </div>

        <div className="analysis-section">
          <label>Expiration Date</label>
          <div className="analysis-value">
            {analysis.expirationDate || 'Not found'}
          </div>
        </div>

        <div className="analysis-section">
          <label>Strike Price</label>
          <div className="analysis-value">
            {analysis.strikePrice ? `$${analysis.strikePrice.toFixed(2)}` : 'Not found'}
          </div>
        </div>

        <div className="analysis-section">
          <label>Premium</label>
          <div className="analysis-value">
            {analysis.premium ? `$${analysis.premium.toFixed(2)}` : 'Not found'}
          </div>
        </div>

        <div className="analysis-section">
          <label>Option Type</label>
          <div className="analysis-value">
            {analysis.optionType ? (
              <span className={`option-type-badge ${analysis.optionType}`}>
                {analysis.optionType.toUpperCase()}
              </span>
            ) : 'Not specified'}
          </div>
        </div>

        <div className="analysis-actions">
          <button
            className={`action-button buy ${analysis.action === 'buy' ? 'recommended' : ''}`}
            onClick={() => onTrade('buy')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Buy
          </button>
          <button
            className={`action-button sell ${analysis.action === 'sell' ? 'recommended' : ''}`}
            onClick={() => onTrade('sell')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Sell
          </button>
        </div>
      </div>
    </div>
  );
};

export default UnusualFlowFeed;

