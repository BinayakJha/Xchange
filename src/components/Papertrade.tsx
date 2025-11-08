import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { allStocks, popularCrypto, getAvailableOptions } from '../data/mockData';
import { useStockData } from '../hooks/useStockData';
import { useCryptoData } from '../hooks/useCryptoData';
import { OptionSuggestion } from '../types';
import StockPreview from './StockPreview';
import CryptoLiveIndicator from './CryptoLiveIndicator';
import './Papertrade.css';

const Papertrade: React.FC = () => {
  const {
    watchlist,
    positions,
    addPosition,
    removePosition,
    tradeSuggestions: aiTradeSuggestions,
    optionSuggestions: aiOptionSuggestions,
  } = useApp();
  const [tradeType, setTradeType] = useState<'stock' | 'option' | 'crypto'>('stock');
  const [selectedTicker, setSelectedTicker] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [action, setAction] = useState<'buy' | 'sell'>('buy');
  
  // Options-specific state
  const [selectedStrike, setSelectedStrike] = useState<number | ''>('');
  const [selectedExpiration, setSelectedExpiration] = useState<Date | null>(null);
  const [selectedOptionType, setSelectedOptionType] = useState<'call' | 'put'>('call');

  const stockSuggestions = aiTradeSuggestions ?? [];
  const optionSuggestionList = aiOptionSuggestions ?? [];

  const getStockInfo = (ticker: string) => {
    // This will be used as fallback, real data comes from useStockData hook
    return allStocks.find((s) => s.ticker === ticker) || 
           popularCrypto.find((c) => c.ticker === ticker);
  };

  const handleStockTrade = async () => {
    if (!selectedTicker || quantity <= 0) return;

    // Use real stock data if available, otherwise fallback to mock
    const realStock = selectedStock || getStockInfo(selectedTicker);
    if (!realStock) return;

    if (action === 'buy') {
      const position: typeof positions[0] = {
        id: `pos-${Date.now()}`,
        ticker: selectedTicker,
        quantity,
        entryPrice: realStock.price,
        currentPrice: realStock.price,
        pnl: 0,
        pnlPercent: 0,
        type: 'stock',
      };
      addPosition(position);
    } else {
      const position = positions.find((p) => p.ticker === selectedTicker && p.type === 'stock');
      if (position) {
        removePosition(position.id);
      }
    }

    setSelectedTicker('');
    setQuantity(1);
  };

  const handleCryptoTrade = async () => {
    if (!selectedTicker || quantity <= 0) return;

    // Use real crypto data if available, otherwise fallback to mock
    const realCrypto = selectedCrypto || getStockInfo(selectedTicker);
    if (!realCrypto) return;

    if (action === 'buy') {
      const position: typeof positions[0] = {
        id: `crypto-${Date.now()}`,
        ticker: selectedTicker,
        quantity,
        entryPrice: realCrypto.price,
        currentPrice: realCrypto.price,
        pnl: 0,
        pnlPercent: 0,
        type: 'crypto',
      };
      addPosition(position);
    } else {
      const position = positions.find((p) => p.ticker === selectedTicker && p.type === 'crypto');
      if (position) {
        removePosition(position.id);
      }
    }

    setSelectedTicker('');
    setQuantity(1);
  };

  const handleOptionTrade = () => {
    if (!selectedTicker || !selectedStrike || !selectedExpiration || quantity <= 0) return;

    // Use real stock data if available, otherwise fallback to mock
    const stock = selectedStock || getStockInfo(selectedTicker);
    if (!stock) return;

    const availableOptions = getAvailableOptions(selectedTicker, stock.price);
    const option = availableOptions.find(
      (opt) =>
        opt.strike === selectedStrike &&
        opt.expiration.getTime() === selectedExpiration.getTime() &&
        opt.optionType === selectedOptionType
    );

    if (!option) return;

    const position: typeof positions[0] = {
      id: `opt-${Date.now()}`,
      ticker: selectedTicker,
      quantity,
      entryPrice: option.premium,
      currentPrice: option.premium,
      pnl: 0,
      pnlPercent: 0,
      type: 'option',
      optionDetails: {
        strike: selectedStrike,
        expiration: selectedExpiration,
        optionType: selectedOptionType,
      },
    };
    addPosition(position);

    // Reset form
    setSelectedTicker('');
    setSelectedStrike('');
    setSelectedExpiration(null);
    setQuantity(1);
  };

  const handleSuggestionClick = (suggestion: OptionSuggestion) => {
    if (!suggestion) return;
    setTradeType('option');
    setSelectedTicker(suggestion.ticker);
    setSelectedStrike(suggestion.strike);
    setSelectedExpiration(suggestion.expiration ? new Date(suggestion.expiration) : null);
    setSelectedOptionType(suggestion.optionType || 'call');
    setQuantity(1);
    setAction('buy');
  };

  const totalPnL = positions.reduce((sum, pos) => sum + pos.pnl, 0);
  const totalValue = positions.reduce((sum, pos) => sum + pos.currentPrice * pos.quantity, 0);

  const stockPositions = positions.filter((p) => p.type === 'stock');
  const optionPositions = positions.filter((p) => p.type === 'option');
  const cryptoPositions = positions.filter((p) => p.type === 'crypto');

  // Get real stock data for options and stocks
  const { stock: selectedStock } = useStockData(
    tradeType !== 'crypto' && selectedTicker ? selectedTicker : null
  );
  
  // Get real crypto data for crypto trades
  const { stock: selectedCrypto } = useCryptoData(
    tradeType === 'crypto' && selectedTicker ? selectedTicker : null
  );
  
  const availableOptions = selectedStock ? getAvailableOptions(selectedTicker, selectedStock.price) : [];
  const filteredOptions = availableOptions.filter(
    (opt) => !selectedExpiration || opt.expiration.getTime() === selectedExpiration.getTime()
  );

  // Get unique expirations
  const uniqueExpirations = Array.from(
    new Set(availableOptions.map((opt) => opt.expiration.getTime()))
  )
    .map((time) => new Date(time))
    .sort((a, b) => a.getTime() - b.getTime());

  return (
    <div className="papertrade">
      <div className="papertrade-header">
        <h2>Papertrading Portfolio</h2>
        <div className="portfolio-summary">
          <div className="summary-item">
            <span className="summary-label">Total Value</span>
            <span className="summary-value">${totalValue.toFixed(2)}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Total P&L</span>
            <span className={`summary-value ${totalPnL >= 0 ? 'positive' : 'negative'}`}>
              ${totalPnL >= 0 ? '+' : ''}
              {totalPnL.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      <div className="papertrade-content">
        <div className="trade-section">
          <div className="trade-type-tabs">
            <button
              className={`trade-type-tab ${tradeType === 'stock' ? 'active' : ''}`}
              onClick={() => setTradeType('stock')}
            >
              Stocks
            </button>
            <button
              className={`trade-type-tab ${tradeType === 'crypto' ? 'active' : ''}`}
              onClick={() => setTradeType('crypto')}
            >
              Crypto
            </button>
            <button
              className={`trade-type-tab ${tradeType === 'option' ? 'active' : ''}`}
              onClick={() => setTradeType('option')}
            >
              Options
            </button>
          </div>

          <h3>Execute Trade</h3>
          <div className="trade-form">
            <div className="form-group">
              <label>{tradeType === 'crypto' ? 'Crypto' : 'Stock'}</label>
              <select
                value={selectedTicker}
                onChange={(e) => {
                  setSelectedTicker(e.target.value);
                  setSelectedStrike('');
                  setSelectedExpiration(null);
                }}
                className="form-input"
              >
                <option value="">Select {tradeType === 'crypto' ? 'crypto' : 'stock'}...</option>
                {watchlist
                  .filter((item) => {
                    if (tradeType === 'crypto') {
                      return item.ticker.includes('-') || item.ticker.includes('USD');
                    } else {
                      return !item.ticker.includes('-') && !item.ticker.includes('USD');
                    }
                  })
                  .map((item) => {
                    const stock = getStockInfo(item.ticker);
                    return stock ? (
                      <option key={item.ticker} value={item.ticker}>
                        {tradeType === 'crypto' ? item.ticker.replace('-USD', '') : item.ticker} - {stock.name}
                      </option>
                    ) : null;
                  })}
              </select>
            </div>

            {tradeType === 'option' && selectedTicker && (
              <>
                <div className="form-group">
                  <label>Option Type</label>
                  <div className="action-buttons">
                    <button
                      className={`action-btn ${selectedOptionType === 'call' ? 'active call' : ''}`}
                      onClick={() => setSelectedOptionType('call')}
                    >
                      Call
                    </button>
                    <button
                      className={`action-btn ${selectedOptionType === 'put' ? 'active put' : ''}`}
                      onClick={() => setSelectedOptionType('put')}
                    >
                      Put
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label>Expiration</label>
                  <select
                    value={selectedExpiration ? selectedExpiration.getTime().toString() : ''}
                    onChange={(e) => {
                      const time = parseInt(e.target.value);
                      setSelectedExpiration(time ? new Date(time) : null);
                      setSelectedStrike('');
                    }}
                    className="form-input"
                  >
                    <option value="">Select expiration...</option>
                    {uniqueExpirations.map((exp) => (
                      <option key={exp.getTime()} value={exp.getTime().toString()}>
                        {exp.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Strike Price</label>
                  <select
                    value={selectedStrike}
                    onChange={(e) => setSelectedStrike(e.target.value ? parseFloat(e.target.value) : '')}
                    className="form-input"
                  >
                    <option value="">Select strike...</option>
                    {filteredOptions
                      .filter((opt) => opt.optionType === selectedOptionType)
                      .map((opt) => (
                        <option key={opt.strike} value={opt.strike}>
                          ${opt.strike} - Premium: ${opt.premium.toFixed(2)} (IV: {opt.impliedVolatility.toFixed(1)}%)
                        </option>
                      ))}
                  </select>
                </div>
              </>
            )}

            {(tradeType === 'stock' || tradeType === 'crypto') && (
              <div className="form-group">
                <label>Action</label>
                <div className="action-buttons">
                  <button
                    className={`action-btn ${action === 'buy' ? 'active buy' : ''}`}
                    onClick={() => setAction('buy')}
                  >
                    Buy
                  </button>
                  <button
                    className={`action-btn ${action === 'sell' ? 'active sell' : ''}`}
                    onClick={() => setAction('sell')}
                  >
                    Sell
                  </button>
                </div>
              </div>
            )}

            <div className="form-group">
              <label>Quantity {tradeType === 'option' ? '(Contracts)' : tradeType === 'crypto' ? '(Coins)' : '(Shares)'}</label>
              <input
                type="number"
                min="1"
                step={tradeType === 'crypto' ? '0.0001' : '1'}
                value={quantity}
                onChange={(e) => setQuantity(tradeType === 'crypto' ? parseFloat(e.target.value) || 0 : parseInt(e.target.value) || 1)}
                className="form-input"
              />
            </div>

            {selectedTicker && (
              <div className="trade-preview">
                {tradeType === 'stock' && (
                  <StockPreview ticker={selectedTicker} quantity={quantity} action={action} />
                )}
                {tradeType === 'crypto' && selectedCrypto && (
                  <>
                    <p>
                      {action === 'buy' ? 'Buy' : 'Sell'} {quantity} {selectedCrypto.ticker.replace('-USD', '')} at ${selectedCrypto.price.toFixed(selectedCrypto.price >= 1 ? 2 : 4)}
                    </p>
                    <p className="trade-total">
                      Total: ${(selectedCrypto.price * quantity).toFixed(selectedCrypto.price >= 1 ? 2 : 4)}
                    </p>
                    <CryptoLiveIndicator />
                  </>
                )}
                {tradeType === 'option' && selectedStrike && selectedExpiration && (
                  <>
                    <p>
                      Buy {quantity} {selectedOptionType} contract{quantity > 1 ? 's' : ''} of {selectedTicker}
                    </p>
                    <p>
                      Strike: ${selectedStrike} | Exp: {selectedExpiration.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                    {filteredOptions.find(
                      (opt) =>
                        opt.strike === selectedStrike &&
                        opt.optionType === selectedOptionType
                    ) && (
                      <p className="trade-total">
                        Premium: ${(
                          filteredOptions.find(
                            (opt) =>
                              opt.strike === selectedStrike &&
                              opt.optionType === selectedOptionType
                          )!.premium * quantity * 100
                        ).toFixed(2)}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            <button
              className="btn btn-primary btn-execute"
              onClick={
                tradeType === 'stock' 
                  ? handleStockTrade 
                  : tradeType === 'crypto'
                  ? handleCryptoTrade
                  : handleOptionTrade
              }
            >
              Execute {tradeType === 'crypto' 
                ? (action === 'buy' ? 'Buy' : 'Sell') 
                : tradeType === 'stock' 
                ? (action === 'buy' ? 'Buy' : 'Sell') 
                : 'Buy'} {tradeType === 'option' ? 'Option' : tradeType === 'crypto' ? 'Crypto' : ''}
            </button>
          </div>

          <div className="suggestions-box">
            <h4>Stock Suggestions</h4>
            <div className="quick-suggestions">
          {stockSuggestions
                .filter((s) => watchlist.some((w) => w.ticker === s.ticker))
                .map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className="quick-suggestion"
                    onClick={() => {
                      setTradeType('stock');
                      setSelectedTicker(suggestion.ticker);
                  setAction(suggestion.action === 'sell' ? 'sell' : 'buy');
                      setQuantity(1);
                    }}
                title={suggestion.reason}
                  >
                <div className="quick-suggestion-header">
                  <span className="quick-ticker">${suggestion.ticker}</span>
                  <span className={`quick-action ${suggestion.action}`}>
                    {suggestion.action.toUpperCase()}
                  </span>
                </div>
                {suggestion.timeframe && (
                  <span className="quick-timeframe">{suggestion.timeframe.replace('_', ' ')}</span>
                )}
                <p className="quick-reason">{suggestion.reason}</p>
                  </div>
                ))}
            </div>
          </div>

          <div className="suggestions-box">
            <h4>Options Suggestions</h4>
            <div className="options-suggestions">
          {optionSuggestionList
                .filter((s) => watchlist.some((w) => w.ticker === s.ticker))
                .map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className="option-suggestion"
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    <div className="option-suggestion-header">
                      <span className="option-ticker">${suggestion.ticker}</span>
                      <span className={`option-type ${suggestion.optionType}`}>
                        {suggestion.optionType.toUpperCase()}
                      </span>
                  {suggestion.action && (
                    <span className={`option-action ${suggestion.action}`}>
                      {suggestion.action.toUpperCase()}
                    </span>
                  )}
                  {suggestion.strategy && (
                    <span className="option-strategy">{suggestion.strategy.replace('_', ' ')}</span>
                  )}
                    </div>
                    <div className="option-suggestion-details">
                      <span>Strike: ${suggestion.strike}</span>
                      <span>Premium: ${suggestion.premium.toFixed(2)}</span>
                    </div>
                <div className="option-suggestion-meta">
                  {suggestion.timeframe && <span>{suggestion.timeframe.replace('_', ' ')}</span>}
                  <span>
                    Exp:{' '}
                    {suggestion.expiration.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
                    <div className="option-suggestion-reason">{suggestion.reason}</div>
                    <div className="option-suggestion-confidence">
                      <span>Confidence: {suggestion.confidence}%</span>
                      {suggestion.targetPrice && (
                        <span>Target: ${suggestion.targetPrice}</span>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>

        <div className="positions-section">
          <h3>Your Positions</h3>
          {positions.length === 0 ? (
            <div className="positions-empty">
              <p>No open positions. Start trading to build your portfolio!</p>
            </div>
          ) : (
            <>
              {stockPositions.length > 0 && (
                <div className="positions-group">
                  <h4 className="positions-group-title">Stocks</h4>
                  <div className="positions-list">
                    {stockPositions.map((position) => (
                      <div key={position.id} className="position-item">
                        <div className="position-header">
                          <span className="position-ticker">{position.ticker}</span>
                          <button
                            className="btn-close"
                            onClick={() => removePosition(position.id)}
                            title="Close position"
                          >
                            ×
                          </button>
                        </div>
                        <div className="position-details">
                          <div className="position-row">
                            <span>Quantity:</span>
                            <span>{position.quantity}</span>
                          </div>
                          <div className="position-row">
                            <span>Entry Price:</span>
                            <span>${position.entryPrice.toFixed(2)}</span>
                          </div>
                          <div className="position-row">
                            <span>Current Price:</span>
                            <span>${position.currentPrice.toFixed(2)}</span>
                          </div>
                          <div className="position-row">
                            <span>P&L:</span>
                            <span className={position.pnl >= 0 ? 'positive' : 'negative'}>
                              ${position.pnl >= 0 ? '+' : ''}
                              {position.pnl.toFixed(2)} ({position.pnlPercent >= 0 ? '+' : ''}
                              {position.pnlPercent.toFixed(2)}%)
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {cryptoPositions.length > 0 && (
                <div className="positions-group">
                  <h4 className="positions-group-title">
                    Crypto
                    <CryptoLiveIndicator />
                  </h4>
                  <div className="positions-list">
                    {cryptoPositions.map((position) => {
                      const isCrypto = position.type === 'crypto';
                      const formatPrice = (price: number) => {
                        if (isCrypto) {
                          if (price >= 1000) return price.toFixed(2);
                          if (price >= 1) return price.toFixed(2);
                          return price.toFixed(4);
                        }
                        return price.toFixed(2);
                      };
                      
                      return (
                        <div key={position.id} className="position-item crypto-position">
                          <div className="position-header">
                            <div className="position-ticker-info">
                              <span className="position-ticker">
                                {position.ticker.replace('-USD', '')}
                              </span>
                              <span className="crypto-badge-small">CRYPTO</span>
                            </div>
                            <button
                              className="btn-close"
                              onClick={() => removePosition(position.id)}
                              title="Close position"
                            >
                              ×
                            </button>
                          </div>
                          <div className="position-details">
                            <div className="position-row">
                              <span>Quantity:</span>
                              <span>{position.quantity}</span>
                            </div>
                            <div className="position-row">
                              <span>Entry Price:</span>
                              <span>${formatPrice(position.entryPrice)}</span>
                            </div>
                            <div className="position-row">
                              <span>Current Price:</span>
                              <span>${formatPrice(position.currentPrice)}</span>
                            </div>
                            <div className="position-row">
                              <span>P&L:</span>
                              <span className={position.pnl >= 0 ? 'positive' : 'negative'}>
                                ${position.pnl >= 0 ? '+' : ''}
                                {formatPrice(Math.abs(position.pnl))} ({position.pnlPercent >= 0 ? '+' : ''}
                                {position.pnlPercent.toFixed(2)}%)
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {optionPositions.length > 0 && (
                <div className="positions-group">
                  <h4 className="positions-group-title">Options</h4>
                  <div className="positions-list">
                    {optionPositions.map((position) => (
                      <div key={position.id} className="position-item option-position">
                        <div className="position-header">
                          <div className="position-ticker-info">
                            <span className="position-ticker">{position.ticker}</span>
                            <span className={`option-badge ${position.optionDetails?.optionType}`}>
                              {position.optionDetails?.optionType.toUpperCase()}
                            </span>
                          </div>
                          <button
                            className="btn-close"
                            onClick={() => removePosition(position.id)}
                            title="Close position"
                          >
                            ×
                          </button>
                        </div>
                        <div className="position-details">
                          <div className="position-row">
                            <span>Contracts:</span>
                            <span>{position.quantity}</span>
                          </div>
                          <div className="position-row">
                            <span>Strike:</span>
                            <span>${position.optionDetails?.strike.toFixed(2)}</span>
                          </div>
                          <div className="position-row">
                            <span>Expiration:</span>
                            <span>
                              {position.optionDetails?.expiration.toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                          </div>
                          <div className="position-row">
                            <span>Entry Premium:</span>
                            <span>${position.entryPrice.toFixed(2)}</span>
                          </div>
                          <div className="position-row">
                            <span>Current Premium:</span>
                            <span>${position.currentPrice.toFixed(2)}</span>
                          </div>
                          <div className="position-row">
                            <span>P&L:</span>
                            <span className={position.pnl >= 0 ? 'positive' : 'negative'}>
                              ${position.pnl >= 0 ? '+' : ''}
                              {position.pnl.toFixed(2)} ({position.pnlPercent >= 0 ? '+' : ''}
                              {position.pnlPercent.toFixed(2)}%)
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Papertrade;
