import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { mockUnusualFlows, mockPapertradeSuggestions } from '../data/mockData';
import { UnusualFlow } from '../types';
import './UnusualFlowsSidebar.css';

const UnusualFlowsSidebar: React.FC = () => {
  const { watchlist, unusualFlows } = useApp();
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  // Use only real flows (no mock data), show all stocks
  const allFlows = (unusualFlows && Array.isArray(unusualFlows) && unusualFlows.length > 0) 
    ? unusualFlows 
    : [];

  // Filter flows with images for slideshow (all stocks, already sorted by most recent first)
  const slideshowFlows = allFlows.filter((flow) => flow.imageUrl);

  // Auto-play slideshow
  useEffect(() => {
    if (!isAutoPlaying || slideshowFlows.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentSlideIndex((prev) => (prev + 1) % slideshowFlows.length);
    }, 5000); // Change slide every 5 seconds

    return () => clearInterval(interval);
  }, [isAutoPlaying, slideshowFlows.length]);

  // Reset to first slide when flows change
  useEffect(() => {
    setCurrentSlideIndex(0);
  }, [slideshowFlows.length]);

  const goToSlide = (index: number) => {
    setCurrentSlideIndex(index);
    setIsAutoPlaying(false); // Pause auto-play when user manually navigates
  };

  const nextSlide = () => {
    setCurrentSlideIndex((prev) => (prev + 1) % slideshowFlows.length);
    setIsAutoPlaying(false);
  };

  const prevSlide = () => {
    setCurrentSlideIndex((prev) => (prev - 1 + slideshowFlows.length) % slideshowFlows.length);
    setIsAutoPlaying(false);
  };

  const formatValue = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    }
    return `$${(value / 1000).toFixed(0)}K`;
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    return `${Math.floor(minutes / 60)}h ago`;
  };

  const currentFlow = slideshowFlows.length > 0 ? slideshowFlows[currentSlideIndex] : null;

  return (
    <div className="unusual-flows-sidebar">
      <div className="flows-section">
        <h3 className="sidebar-title">Unusual Flows</h3>
        
        {/* Slideshow for flows with images */}
        {slideshowFlows.length > 0 ? (
          <div className="flows-slideshow">
            <div className="slideshow-container">
              {currentFlow && (
                <>
                  <div className="flow-item slideshow-item">
                    <div className="flow-header">
                      <span className="flow-ticker">${currentFlow.ticker}</span>
                      <span className={`flow-type ${currentFlow.type}`}>{currentFlow.type.toUpperCase()}</span>
                    </div>
                    
                    <div className="flow-image-container">
                      <a 
                        href={currentFlow.tweetUrl || `https://x.com/FL0WG0D`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flow-image-link"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <img 
                          src={currentFlow.imageUrl} 
                          alt={`Flow chart for ${currentFlow.ticker}`}
                          className="flow-image"
                          loading="lazy"
                        />
                      </a>
                    </div>
                    
                    <p className="flow-description">{currentFlow.description}</p>
                    
                    <div className="flow-footer">
                      {currentFlow.value > 0 && (
                        <span className="flow-value">{formatValue(currentFlow.value)}</span>
                      )}
                      <span className="flow-time">{formatTime(currentFlow.timestamp)}</span>
                    </div>
                  </div>

                  {/* Navigation buttons */}
                  {slideshowFlows.length > 1 && (
                    <>
                      <button 
                        className="slideshow-nav slideshow-prev"
                        onClick={prevSlide}
                        aria-label="Previous slide"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="15 18 9 12 15 6" />
                        </svg>
                      </button>
                      <button 
                        className="slideshow-nav slideshow-next"
                        onClick={nextSlide}
                        aria-label="Next slide"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </button>

                      {/* Slide indicators */}
                      <div className="slideshow-indicators">
                        {slideshowFlows.map((_, index) => (
                          <button
                            key={index}
                            className={`indicator ${index === currentSlideIndex ? 'active' : ''}`}
                            onClick={() => goToSlide(index)}
                            aria-label={`Go to slide ${index + 1}`}
                          />
                        ))}
                      </div>

                      {/* Auto-play toggle */}
                      <button
                        className="slideshow-autoplay-toggle"
                        onClick={() => setIsAutoPlaying(!isAutoPlaying)}
                        title={isAutoPlaying ? 'Pause slideshow' : 'Play slideshow'}
                      >
                        {isAutoPlaying ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <rect x="6" y="4" width="4" height="16" />
                            <rect x="14" y="4" width="4" height="16" />
                          </svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="5 3 19 12 5 21" />
                          </svg>
                        )}
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="sidebar-empty">
            <p>Loading unusual flows from FL0WG0D...</p>
            <p style={{ fontSize: '12px', marginTop: '8px', opacity: 0.7 }}>
              Fetching flow images from the past 24 hours
            </p>
          </div>
        )}

      </div>

      <div className="suggestions-section">
        <h3 className="sidebar-title">Papertrade Suggestions</h3>
        <div className="suggestions-list">
          {mockPapertradeSuggestions
            .filter((suggestion) =>
              watchlist.some((item) => item.ticker === suggestion.ticker)
            )
            .map((suggestion) => (
              <div key={suggestion.id} className="suggestion-item">
                <div className="suggestion-header">
                  <span className="suggestion-ticker">${suggestion.ticker}</span>
                  <span className={`suggestion-action ${suggestion.action}`}>
                    {suggestion.action.toUpperCase()}
                  </span>
                </div>
                <p className="suggestion-reason">{suggestion.reason}</p>
                <div className="suggestion-footer">
                  <div className="confidence-bar">
                    <div
                      className="confidence-fill"
                      style={{ width: `${suggestion.confidence}%` }}
                    />
                  </div>
                  <span className="confidence-text">{suggestion.confidence}% confidence</span>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default UnusualFlowsSidebar;

