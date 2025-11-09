import React, { useMemo, useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import './Papertrade.css';

type TradeTab = 'trade' | 'portfolio' | 'history';
type AssetType = 'stock' | 'crypto' | 'option';

const Papertrade: React.FC = () => {
  const {
    paperCash,
    paperPositions,
    paperTrades,
    executePaperTrade,
    updatePaperPositionPrices,
    resetPapertrade,
  } = useApp();

  const [activeTab, setActiveTab] = useState<TradeTab>('portfolio');
  const [assetType, setAssetType] = useState<AssetType>('stock');
  const [ticker, setTicker] = useState('AAPL');
  const [priceInput, setPriceInput] = useState('');
  const [quantityInput, setQuantityInput] = useState('1');
  const [amountInput, setAmountInput] = useState('');
  const [optionType, setOptionType] = useState<'CALL' | 'PUT'>('CALL');
  const [strikePriceInput, setStrikePriceInput] = useState('');
  const [expirationInput, setExpirationInput] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [fetchingQuote, setFetchingQuote] = useState(false);

  const holdingsValue = useMemo(
    () => paperPositions.reduce((sum, position) => sum + position.totalValue, 0),
    [paperPositions],
  );
  const totalEquity = useMemo(() => paperCash + holdingsValue, [paperCash, holdingsValue]);
  const totalPnL = useMemo(() => totalEquity - 100000, [totalEquity]);
  const totalPnLPercent = useMemo(() => (totalPnL / 100000) * 100, [totalPnL]);

  const resetForm = () => {
    setPriceInput('');
    setQuantityInput('1');
    setAmountInput('');
    setStrikePriceInput('');
    setExpirationInput('');
  };

  const fetchLatestPrice = async () => {
    if (!ticker.trim()) {
      setFeedback('Enter a ticker symbol to fetch the latest price.');
      return;
    }

    setFetchingQuote(true);
    setFeedback(null);

    try {
      const response = await fetch(`/api/yahoo-finance?symbols=${ticker.trim().toUpperCase()}`);
      if (!response.ok) {
        throw new Error('Unable to fetch price');
      }
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0 && data[0].regularMarketPrice) {
        setPriceInput(data[0].regularMarketPrice.toFixed(2));
        setFeedback(`Fetched latest price for ${ticker.toUpperCase()}`);
      } else {
        setFeedback('Price data not available. Please enter a price manually.');
      }
    } catch (error) {
      console.error('[Papertrade] Error fetching price:', error);
      setFeedback('Failed to fetch price. Please enter a price manually.');
    } finally {
      setFetchingQuote(false);
    }
  };

  const handleTrade = async (action: 'buy' | 'sell') => {
    setFeedback(null);
    const normalizedTicker = ticker.trim().toUpperCase();
    if (!normalizedTicker) {
      setFeedback('Please enter a ticker symbol.');
      return;
    }

    const price = parseFloat(priceInput);
    if (!Number.isFinite(price) || price <= 0) {
      setFeedback('Enter a valid trade price.');
      return;
    }

    const quantityValue = parseFloat(quantityInput);
    const amountValue = parseFloat(amountInput);

    if ((!Number.isFinite(quantityValue) || quantityValue <= 0) && (!Number.isFinite(amountValue) || amountValue <= 0)) {
      setFeedback('Enter either a quantity or an amount to trade.');
      return;
    }

    if (assetType === 'option') {
      if (!strikePriceInput || !expirationInput) {
        setFeedback('Enter strike price and expiration date for the option trade.');
        return;
      }
    }

    const result = await executePaperTrade({
      ticker: normalizedTicker,
      action,
      assetType,
      price,
      quantity: Number.isFinite(quantityValue) && quantityValue > 0 ? quantityValue : undefined,
      amount: Number.isFinite(amountValue) && amountValue > 0 ? amountValue : undefined,
      optionDetails:
        assetType === 'option'
          ? {
              optionType,
              strikePrice: parseFloat(strikePriceInput),
              expirationDate: expirationInput,
            }
          : undefined,
    });

    if (!result.success) {
      setFeedback(result.error || 'Trade failed.');
      return;
    }

    const actionText = action === 'buy' ? 'Purchased' : 'Sold';
    setFeedback(`✅ ${actionText} ${normalizedTicker} successfully.`);
    resetForm();
    setActiveTab('portfolio');
    window.dispatchEvent(new CustomEvent('switchToPapertrade'));
  };

  const refreshPrices = async () => {
    const symbols = Array.from(new Set(paperPositions.map((position) => position.symbol)));
    if (symbols.length === 0) {
      setFeedback('No positions to refresh.');
      return;
    }

    try {
      const response = await fetch(`/api/yahoo-finance?symbols=${symbols.join(',')}`);
      if (!response.ok) throw new Error('Failed to refresh prices');
      const data = await response.json();
      const priceMap: Record<string, number> = {};
      if (Array.isArray(data)) {
        data.forEach((item: any) => {
          if (item && item.symbol && item.regularMarketPrice) {
            priceMap[item.symbol.toUpperCase()] = item.regularMarketPrice;
          }
        });
      }
      updatePaperPositionPrices(priceMap);
      setFeedback('✅ Updated live prices for your positions.');
    } catch (error) {
      console.error('[Papertrade] Refresh prices error:', error);
      setFeedback('⚠️ Unable to refresh prices right now.');
    }
  };

  useEffect(() => {
    if (paperPositions.length > 0) {
      refreshPrices();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paperPositions.length]);

  return (
    <div className="papertrade-container">
      <header className="papertrade-header">
        <div>
          <h2>Paper Trading</h2>
          <p>Simulated portfolio with $100,000 starting balance.</p>
        </div>
        <div className="papertrade-header-actions">
          <button className="secondary" onClick={refreshPrices}>
            Refresh Prices
          </button>
          <button className="secondary" onClick={resetPapertrade}>
            Reset Account
          </button>
        </div>
      </header>

      <section className="papertrade-summary">
        <div className="summary-card">
          <span className="label">Cash Balance</span>
          <span className="value">${paperCash.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="summary-card">
          <span className="label">Positions Value</span>
          <span className="value">${holdingsValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="summary-card">
          <span className="label">Total Equity</span>
          <span className="value">${totalEquity.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
        <div className={`summary-card ${totalPnL >= 0 ? 'positive' : 'negative'}`}>
          <span className="label">P&L</span>
          <span className="value">
            ${totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2 })} ({totalPnLPercent.toFixed(2)}%)
          </span>
        </div>
      </section>

      <div className="papertrade-tabs">
        <button className={activeTab === 'trade' ? 'active' : ''} onClick={() => setActiveTab('trade')}>
          Trade
        </button>
        <button className={activeTab === 'portfolio' ? 'active' : ''} onClick={() => setActiveTab('portfolio')}>
          Portfolio
        </button>
        <button className={activeTab === 'history' ? 'active' : ''} onClick={() => setActiveTab('history')}>
          History
        </button>
      </div>

      {feedback && <div className="papertrade-feedback">{feedback}</div>}

      {activeTab === 'trade' && (
        <section className="trade-panel">
          <div className="trade-form">
            <div className="form-group">
              <label>Asset Type</label>
              <select value={assetType} onChange={(e) => setAssetType(e.target.value as AssetType)}>
                <option value="stock">Stock</option>
                <option value="crypto">Crypto</option>
                <option value="option">Option</option>
              </select>
            </div>

            <div className="form-group">
              <label>Ticker</label>
              <input value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} placeholder="e.g. AAPL" />
            </div>

            {assetType === 'option' && (
              <div className="option-fields">
                <div className="form-group">
                  <label>Option Type</label>
                  <select value={optionType} onChange={(e) => setOptionType(e.target.value as 'CALL' | 'PUT')}>
                    <option value="CALL">Call</option>
                    <option value="PUT">Put</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Strike Price</label>
                  <input
                    value={strikePriceInput}
                    onChange={(e) => setStrikePriceInput(e.target.value)}
                    placeholder="e.g. 150"
                    type="number"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="form-group">
                  <label>Expiration</label>
                  <input type="date" value={expirationInput} onChange={(e) => setExpirationInput(e.target.value)} />
                </div>
              </div>
            )}

            <div className="form-group">
              <label>Quantity</label>
              <input
                value={quantityInput}
                onChange={(e) => setQuantityInput(e.target.value)}
                type="number"
                min="0"
                step="1"
                placeholder="Shares / contracts"
              />
            </div>

            {assetType !== 'option' && (
              <div className="form-group">
                <label>Or Amount ($)</label>
                <input
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Optional investment amount"
                />
              </div>
            )}

            <div className="form-group">
              <label>Price ($)</label>
              <div className="price-input-group">
                <input
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Enter or fetch market price"
                />
                <button type="button" onClick={fetchLatestPrice} disabled={fetchingQuote}>
                  {fetchingQuote ? 'Fetching...' : 'Fetch Price'}
                </button>
              </div>
            </div>

            <div className="trade-actions">
              <button className="buy" onClick={() => handleTrade('buy')}>
                Buy
              </button>
              <button className="sell" onClick={() => handleTrade('sell')}>
                Sell
              </button>
            </div>
          </div>

          <aside className="trade-hints">
            <h4>Quick Tips</h4>
            <ul>
              <li>Fetch the latest price or set a custom limit.</li>
              <li>Options multiply by 100 automatically.</li>
              <li>You can use cash amount instead of quantity for equities/crypto.</li>
              <li>Reset account to restore $100,000 starting balance.</li>
            </ul>
          </aside>
        </section>
      )}

      {activeTab === 'portfolio' && (
        <section className="portfolio-panel">
          {paperPositions.length === 0 ? (
            <div className="empty-state">
              <p>No open positions. Place a trade to start building your paper portfolio.</p>
            </div>
          ) : (
            <table className="portfolio-table">
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th>Type</th>
                  <th>Quantity</th>
                  <th>Avg Price</th>
                  <th>Last Price</th>
                  <th>Total Value</th>
                  <th>P&L</th>
                </tr>
              </thead>
              <tbody>
                {paperPositions.map((position) => (
                  <tr key={position.id}>
                    <td>
                      <div className="ticker-cell">{position.symbol}</div>
                      {position.assetType === 'option' && position.optionDetails && (
                        <div className="option-meta">
                          {position.optionDetails.optionType} ${position.optionDetails.strikePrice.toFixed(2)} exp {position.optionDetails.expirationDate}
                        </div>
                      )}
                    </td>
                    <td>{position.assetType.toUpperCase()}</td>
                    <td>
                      {position.quantity}{' '}
                      {position.assetType === 'option' ? 'contract(s)' : position.assetType === 'crypto' ? 'token(s)' : 'share(s)'}
                    </td>
                    <td>${position.averagePrice.toFixed(2)}</td>
                    <td>${position.currentPrice.toFixed(2)}</td>
                    <td>${position.totalValue.toFixed(2)}</td>
                    <td className={position.pnl >= 0 ? 'positive' : 'negative'}>
                      ${position.pnl.toFixed(2)} ({position.pnlPercent.toFixed(2)}%)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {activeTab === 'history' && (
        <section className="history-panel">
          {paperTrades.length === 0 ? (
            <div className="empty-state">
              <p>No trades recorded yet. Execute a trade to populate history.</p>
            </div>
          ) : (
            <table className="history-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Action</th>
                  <th>Ticker</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Total</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {paperTrades.map((trade) => (
                  <tr key={trade.id}>
                    <td>{new Date(trade.timestamp).toLocaleString()}</td>
                    <td className={trade.action === 'BUY' ? 'positive' : 'negative'}>{trade.action}</td>
                    <td>
                      <div className="ticker-cell">{trade.symbol}</div>
                      {trade.assetType === 'option' && trade.optionDetails && (
                        <div className="option-meta">
                          {trade.optionDetails.optionType} ${trade.optionDetails.strikePrice.toFixed(2)} exp {trade.optionDetails.expirationDate}
                        </div>
                      )}
                    </td>
                    <td>{trade.quantity}</td>
                    <td>${trade.price.toFixed(2)}</td>
                    <td>${trade.total.toFixed(2)}</td>
                    <td>{trade.assetType.toUpperCase()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  );
};

export default Papertrade;
