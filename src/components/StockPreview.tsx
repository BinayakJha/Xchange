import React from 'react';
import { useStockData } from '../hooks/useStockData';
import { allStocks } from '../data/mockData';

interface StockPreviewProps {
  ticker: string;
  quantity: number;
  action: 'buy' | 'sell';
}

const StockPreview: React.FC<StockPreviewProps> = ({ ticker, quantity, action }) => {
  const { stock, loading } = useStockData(ticker);
  const mockStock = allStocks.find((s) => s.ticker === ticker);
  const displayStock = stock || mockStock;

  if (loading) {
    return (
      <div className="trade-preview">
        <p>Loading stock data...</p>
      </div>
    );
  }

  if (!displayStock) {
    return (
      <div className="trade-preview">
        <p>Stock not found</p>
      </div>
    );
  }

  return (
    <>
      <p>
        {action === 'buy' ? 'Buy' : 'Sell'} {quantity} share{quantity > 1 ? 's' : ''} of{' '}
        {ticker} at ${displayStock.price.toFixed(2)}
      </p>
      <p className="trade-total">
        Total: ${(displayStock.price * quantity).toFixed(2)}
      </p>
    </>
  );
};

export default StockPreview;

