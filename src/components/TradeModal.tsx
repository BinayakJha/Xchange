import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { allStocks } from '../data/mockData';
import './TradeModal.css';

interface TradeModalProps {
  onClose: () => void;
  onTrade: (ticker: string, quantity: number) => void;
  watchlist: { ticker: string; addedAt: Date }[];
}

const TradeModal: React.FC<TradeModalProps> = ({ onClose, onTrade }) => {
  const { watchlist } = useApp();
  const [selectedTicker, setSelectedTicker] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [action, setAction] = useState<'buy' | 'sell'>('buy');

  const getStockInfo = (ticker: string) => {
    return allStocks.find((s) => s.ticker === ticker);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicker || quantity <= 0) return;
    if (action === 'buy') {
      onTrade(selectedTicker, quantity);
    }
    onClose();
  };

  return (
    <div className="trade-modal-overlay" onClick={onClose}>
      <div className="trade-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>New Trade</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} className="trade-form">
          <div className="form-group">
            <label>Stock</label>
            <select
              value={selectedTicker}
              onChange={(e) => setSelectedTicker(e.target.value)}
              className="form-input"
              required
            >
              <option value="">Select stock...</option>
              {watchlist.map((item) => {
                const stock = getStockInfo(item.ticker);
                return stock ? (
                  <option key={item.ticker} value={item.ticker}>
                    {item.ticker} - {stock.name}
                  </option>
                ) : null;
              })}
            </select>
          </div>

          <div className="form-group">
            <label>Action</label>
            <div className="action-buttons">
              <button
                type="button"
                className={`action-btn ${action === 'buy' ? 'active buy' : ''}`}
                onClick={() => setAction('buy')}
              >
                Buy
              </button>
              <button
                type="button"
                className={`action-btn ${action === 'sell' ? 'active sell' : ''}`}
                onClick={() => setAction('sell')}
              >
                Sell
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>Quantity</label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              className="form-input"
              required
            />
          </div>

          {selectedTicker && (
            <div className="trade-preview">
              <p>
                {action === 'buy' ? 'Buy' : 'Sell'} {quantity} share{quantity > 1 ? 's' : ''} of{' '}
                {selectedTicker} at ${getStockInfo(selectedTicker)?.price.toFixed(2)}
              </p>
              <p className="trade-total">
                Total: ${((getStockInfo(selectedTicker)?.price || 0) * quantity).toFixed(2)}
              </p>
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Execute {action === 'buy' ? 'Buy' : 'Sell'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TradeModal;

