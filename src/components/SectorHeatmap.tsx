import React from 'react';
import { Stock } from '../types';
import './SectorHeatmap.css';

interface SectorHeatmapProps {
  sector: string;
  stocks: Stock[];
}

const SectorHeatmap: React.FC<SectorHeatmapProps> = ({ sector, stocks }) => {
  if (!stocks || stocks.length === 0) {
    return (
      <div className="sector-heatmap-empty">
        <p>No stock data available for {sector} sector.</p>
      </div>
    );
  }

  // Sort stocks by change percent (most positive to most negative)
  const sortedStocks = [...stocks].sort((a, b) => (b.changePercent || 0) - (a.changePercent || 0));

  // Calculate color intensity based on change percent
  const getColorIntensity = (changePercent: number) => {
    const maxChange = Math.max(...stocks.map(s => Math.abs(s.changePercent || 0)));
    if (maxChange === 0) return 0.5;
    
    // Normalize to 0-1 range
    const normalized = Math.abs(changePercent) / maxChange;
    return Math.min(normalized, 1);
  };

  const getColor = (changePercent: number) => {
    if (changePercent > 0) {
      // Green gradient for positive changes
      const intensity = getColorIntensity(changePercent);
      const opacity = 0.3 + (intensity * 0.7); // 0.3 to 1.0
      return `rgba(34, 197, 94, ${opacity})`; // Green
    } else if (changePercent < 0) {
      // Red gradient for negative changes
      const intensity = getColorIntensity(changePercent);
      const opacity = 0.3 + (intensity * 0.7); // 0.3 to 1.0
      return `rgba(239, 68, 68, ${opacity})`; // Red
    } else {
      return 'rgba(156, 163, 175, 0.3)'; // Gray for no change
    }
  };

  // Calculate grid dimensions
  const itemCount = sortedStocks.length;
  const cols = Math.ceil(Math.sqrt(itemCount));
  const rows = Math.ceil(itemCount / cols);

  return (
    <div className="sector-heatmap">
      <div className="heatmap-header">
        <h3>{sector} Sector Heatmap</h3>
        <div className="heatmap-legend">
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: 'rgba(34, 197, 94, 0.8)' }}></div>
            <span>Gain</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: 'rgba(239, 68, 68, 0.8)' }}></div>
            <span>Loss</span>
          </div>
        </div>
      </div>
      <div 
        className="heatmap-grid" 
        style={{ 
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`
        }}
      >
        {sortedStocks.map((stock) => {
          const changePercent = stock.changePercent || 0;
          const isPositive = changePercent > 0;
          
          return (
            <div
              key={stock.ticker}
              className="heatmap-cell"
              style={{ backgroundColor: getColor(changePercent) }}
              title={`${stock.name} (${stock.ticker.replace('-USD', '')}): ${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`}
            >
              <div className="cell-ticker">{stock.ticker.replace('-USD', '')}</div>
              <div className={`cell-change ${isPositive ? 'positive' : changePercent < 0 ? 'negative' : 'neutral'}`}>
                {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%
              </div>
              <div className="cell-price">
                ${stock.type === 'crypto' && stock.price < 1 
                  ? stock.price.toFixed(4) 
                  : stock.price.toFixed(2)}
              </div>
            </div>
          );
        })}
      </div>
      <div className="heatmap-footer">
        <p className="heatmap-info">
          Showing {stocks.length} stocks. Color intensity indicates magnitude of price change.
        </p>
      </div>
    </div>
  );
};

export default SectorHeatmap;

