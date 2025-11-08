import React from 'react';
import { useApp } from '../context/AppContext';
import { popularStocks } from '../data/mockData';
import { useMultipleStockData } from '../hooks/useStockData';
import './PopularStocks.css';

const PopularStocks: React.FC = () => {
  const { addToWatchlist, watchlist } = useApp();
  const tickers = popularStocks.map((s) => s.ticker);
  const { stocks } = useMultipleStockData(tickers);

  const isInWatchlist = (ticker: string) => {
    return watchlist.some((item) => item.ticker === ticker);
  };

  return (
    <div className="popular-stocks">
      {popularStocks.map((mockStock) => {
        const stock = stocks.get(mockStock.ticker) || mockStock;
        
        // Safety checks
        if (!stock || !stock.ticker) return null;
        
        const price = stock.price ?? mockStock.price ?? 0;
        const change = stock.change ?? mockStock.change ?? 0;
        const changePercent = stock.changePercent ?? mockStock.changePercent ?? 0;
        const name = stock.name || mockStock.name || stock.ticker;

        return (
          <div key={stock.ticker} className="popular-stock-item">
            <div className="stock-info">
              <span className="stock-ticker">{stock.ticker}</span>
              <span className="stock-name">{name}</span>
              <div className="stock-price">
                <span className="price">${price.toFixed(2)}</span>
                <span
                  className={`change ${change >= 0 ? 'positive' : 'negative'}`}
                >
                  {change >= 0 ? '+' : ''}
                  {change.toFixed(2)} ({changePercent >= 0 ? '+' : ''}
                  {changePercent.toFixed(2)}%)
                </span>
              </div>
            </div>
            {isInWatchlist(stock.ticker) ? (
              <span className="stock-added">Added</span>
            ) : (
              <button
                className="btn-add"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  try {
                    addToWatchlist(stock.ticker);
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

export default PopularStocks;

