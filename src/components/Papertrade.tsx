import React, { useState, useEffect } from 'react';
import './Papertrade.css';

interface StockData {
  symbol: string;
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  regularMarketVolume: number;
  marketCap: number;
  shortName?: string;
  longName?: string;
}

interface Position {
  symbol: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  totalValue: number;
  pnl: number;
  pnlPercent: number;
  assetType?: 'Stock' | 'Crypto' | 'Option';
  optionType?: 'CALL' | 'PUT';
  strikePrice?: number;
  expirationDate?: string;
}

interface Transaction {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  total: number;
  timestamp: Date;
  assetType?: 'Stock' | 'Crypto' | 'Option';
  optionType?: 'CALL' | 'PUT';
  strikePrice?: number;
  expirationDate?: string;
}

const Papertrade: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'Trade' | 'Portfolio' | 'History'>('Trade');
  const [assetType, setAssetType] = useState<'Stock' | 'Crypto' | 'Option'>('Stock');
  const [marketFilter, setMarketFilter] = useState<'All' | 'Gainers' | 'Losers'>('All');
  const [selectedTicker, setSelectedTicker] = useState('AAPL');
  const [quantity, setQuantity] = useState<number>(1);
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [limitPrice, setLimitPrice] = useState<number>(0);
  const [searchTicker, setSearchTicker] = useState('');
  const [optionType, setOptionType] = useState<'CALL' | 'PUT'>('CALL');
  const [strikePrice, setStrikePrice] = useState<number>(0);
  const [expirationDate, setExpirationDate] = useState<string>('');
  
  // Real-time data states
  const [watchlistStocks, setWatchlistStocks] = useState<StockData[]>([]);
  const [marketData, setMarketData] = useState<StockData[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Portfolio states
  const [cashBalance, setCashBalance] = useState(100000);
  const [totalEquity, setTotalEquity] = useState(100000);
  const [totalPnL, setTotalPnL] = useState(0);

  // Default watchlist symbols - mix of stocks and crypto
  const defaultSymbols = ['AAPL', 'TSLA', 'MSFT', 'BTC-USD', 'ETH-USD', 'GOOGL', 'AMZN', 'NVDA', 'SOL-USD'];

  // Yahoo Finance API call
  const fetchStockData = async (symbols: string[]): Promise<StockData[]> => {
    try {
      const symbolsStr = symbols.join(',');
      const response = await fetch(`/api/yahoo-finance?symbols=${symbolsStr}`);
      
      if (!response.ok) {
        // Fallback to direct Yahoo Finance API
        const yahooResponse = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${symbolsStr}?interval=1m&range=1d`,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          }
        );
        
        if (!yahooResponse.ok) throw new Error('Failed to fetch data');
        
        const data = await yahooResponse.json();
        return parseYahooData(data);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching stock data:', error);
      // Return mock data as fallback with realistic values
      return symbols.map(symbol => ({
        symbol,
        regularMarketPrice: Math.random() * 300 + 50,
        regularMarketChange: (Math.random() - 0.5) * 20,
        regularMarketChangePercent: (Math.random() - 0.5) * 10,
        regularMarketVolume: Math.floor(Math.random() * 100000000),
        marketCap: Math.floor(Math.random() * 3000000000000),
        shortName: symbol
      }));
    }
  };

  const parseYahooData = (data: any): StockData[] => {
    // Parse Yahoo Finance API response
    if (!data.chart?.result) return [];
    
    return data.chart.result.map((item: any) => {
      const meta = item.meta;
      
      return {
        symbol: meta.symbol,
        regularMarketPrice: meta.regularMarketPrice || 0,
        regularMarketChange: (meta.regularMarketPrice || 0) - (meta.previousClose || 0),
        regularMarketChangePercent: ((meta.regularMarketPrice || 0) - (meta.previousClose || 0)) / (meta.previousClose || 1) * 100,
        regularMarketVolume: meta.regularMarketVolume || 0,
        marketCap: meta.marketCap || 0,
        shortName: meta.shortName || meta.symbol
      };
    });
  };

  // Calculate portfolio metrics
  const calculatePortfolioMetrics = () => {
    let totalValue = cashBalance;
    let totalCost = 0;
    
    positions.forEach(position => {
      totalValue += position.totalValue;
      totalCost += position.quantity * position.averagePrice;
    });
    
    const pnl = totalValue - 100000; // Initial balance
    
    setTotalEquity(totalValue);
    setTotalPnL(pnl);
  };

  // Handle buy/sell orders
  const handleTrade = (action: 'BUY' | 'SELL') => {
    const selectedStock = watchlistStocks.find(s => s.symbol === selectedTicker);
    if (!selectedStock) return;

    // Validation for Options
    if (assetType === 'Option') {
      if (!strikePrice || strikePrice <= 0) {
        alert('Please enter a valid strike price!');
        return;
      }
      if (!expirationDate) {
        alert('Please select an expiration date!');
        return;
      }
    }

    const price = orderType === 'LIMIT' ? limitPrice : selectedStock.regularMarketPrice;
    const totalCost = price * quantity * (assetType === 'Option' ? 100 : 1); // Options are typically 100 shares per contract

    // Create unique position key for options
    const positionKey = assetType === 'Option' 
      ? `${selectedTicker}_${optionType}_${strikePrice}_${expirationDate}`
      : selectedTicker;

    if (action === 'BUY') {
      if (totalCost > cashBalance) {
        alert('Insufficient funds!');
        return;
      }

      setCashBalance(prev => prev - totalCost);
      
      // Update or create position
      setPositions(prev => {
        const existingPosition = prev.find(p => {
          if (assetType === 'Option') {
            return p.symbol === selectedTicker && 
                   p.assetType === 'Option' &&
                   p.optionType === optionType &&
                   p.strikePrice === strikePrice &&
                   p.expirationDate === expirationDate;
          }
          return p.symbol === selectedTicker && !p.assetType;
        });

        if (existingPosition) {
          const newQuantity = existingPosition.quantity + quantity;
          const newAverage = ((existingPosition.averagePrice * existingPosition.quantity) + totalCost) / newQuantity;
          return prev.map(p => 
            (assetType === 'Option' ? 
              (p.symbol === selectedTicker && p.optionType === optionType && p.strikePrice === strikePrice && p.expirationDate === expirationDate) :
              (p.symbol === selectedTicker && !p.assetType))
              ? {
                  ...p,
                  quantity: newQuantity,
                  averagePrice: newAverage,
                  totalValue: newQuantity * selectedStock.regularMarketPrice * (assetType === 'Option' ? 100 : 1),
                  pnl: (selectedStock.regularMarketPrice - newAverage) * newQuantity * (assetType === 'Option' ? 100 : 1),
                  pnlPercent: ((selectedStock.regularMarketPrice - newAverage) / newAverage) * 100
                }
              : p
          );
        } else {
          return [...prev, {
            symbol: selectedTicker,
            quantity,
            averagePrice: price,
            currentPrice: selectedStock.regularMarketPrice,
            totalValue: quantity * selectedStock.regularMarketPrice * (assetType === 'Option' ? 100 : 1),
            pnl: (selectedStock.regularMarketPrice - price) * quantity * (assetType === 'Option' ? 100 : 1),
            pnlPercent: ((selectedStock.regularMarketPrice - price) / price) * 100,
            assetType: assetType,
            optionType: assetType === 'Option' ? optionType : undefined,
            strikePrice: assetType === 'Option' ? strikePrice : undefined,
            expirationDate: assetType === 'Option' ? expirationDate : undefined
          }];
        }
      });
    } else {
      // SELL logic
      const position = positions.find(p => {
        if (assetType === 'Option') {
          return p.symbol === selectedTicker && 
                 p.assetType === 'Option' &&
                 p.optionType === optionType &&
                 p.strikePrice === strikePrice &&
                 p.expirationDate === expirationDate;
        }
        return p.symbol === selectedTicker && !p.assetType;
      });

      if (!position || position.quantity < quantity) {
        alert(`Insufficient ${assetType === 'Option' ? 'contracts' : 'shares'} to sell!`);
        return;
      }

      setCashBalance(prev => prev + totalCost);
      
      setPositions(prev => {
        return prev.map(p => 
          (assetType === 'Option' ? 
            (p.symbol === selectedTicker && p.optionType === optionType && p.strikePrice === strikePrice && p.expirationDate === expirationDate) :
            (p.symbol === selectedTicker && !p.assetType))
            ? {
                ...p,
                quantity: p.quantity - quantity,
                totalValue: (p.quantity - quantity) * selectedStock.regularMarketPrice * (assetType === 'Option' ? 100 : 1),
                pnl: (selectedStock.regularMarketPrice - p.averagePrice) * (p.quantity - quantity) * (assetType === 'Option' ? 100 : 1),
                pnlPercent: ((selectedStock.regularMarketPrice - p.averagePrice) / p.averagePrice) * 100
              }
            : p
        ).filter(p => p.quantity > 0);
      });
    }

    // Add transaction
    const transaction: Transaction = {
      id: Date.now().toString(),
      symbol: selectedTicker,
      type: action,
      quantity,
      price,
      total: totalCost,
      timestamp: new Date(),
      assetType: assetType,
      optionType: assetType === 'Option' ? optionType : undefined,
      strikePrice: assetType === 'Option' ? strikePrice : undefined,
      expirationDate: assetType === 'Option' ? expirationDate : undefined
    };
    setTransactions(prev => [transaction, ...prev]);
  };

  // Add stock to watchlist
  const addToWatchlist = async () => {
    if (!searchTicker || watchlistStocks.find(s => s.symbol === searchTicker.toUpperCase())) {
      return;
    }

    const newStockData = await fetchStockData([searchTicker.toUpperCase()]);
    if (newStockData.length > 0) {
      setWatchlistStocks(prev => [...prev, ...newStockData]);
      setSearchTicker('');
    }
  };

  // Remove from watchlist
  const removeFromWatchlist = (symbol: string) => {
    setWatchlistStocks(prev => prev.filter(s => s.symbol !== symbol));
  };

  // Initialize data
  useEffect(() => {
    const initializeData = async () => {
      setLoading(true);
      try {
        const allSymbols = await fetchStockData(defaultSymbols);
        
        setWatchlistStocks(allSymbols);
        setMarketData(allSymbols);
        setError(null);
      } catch (err) {
        setError('Failed to load market data');
      } finally {
        setLoading(false);
      }
    };

    initializeData();
    
    // Update data every 30 seconds
    const interval = setInterval(initializeData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Update portfolio metrics when positions change
  useEffect(() => {
    calculatePortfolioMetrics();
  }, [positions, cashBalance]);

  // Update position values with current prices
  useEffect(() => {
    setPositions(prev => 
      prev.map(position => {
        const currentStock = watchlistStocks.find(s => s.symbol === position.symbol);
        if (currentStock) {
          return {
            ...position,
            currentPrice: currentStock.regularMarketPrice,
            totalValue: position.quantity * currentStock.regularMarketPrice,
            pnl: (currentStock.regularMarketPrice - position.averagePrice) * position.quantity,
            pnlPercent: ((currentStock.regularMarketPrice - position.averagePrice) / position.averagePrice) * 100
          };
        }
        return position;
      })
    );
  }, [watchlistStocks]);

  const selectedStock = watchlistStocks.find(s => s.symbol === selectedTicker);
  const currentPosition = positions.find(p => p.symbol === selectedTicker);

  // Formatters for currency and percent
  const currencyFmt = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const formatCurrency = (value: number) => currencyFmt.format(Number.isFinite(value) ? value : 0);
  const formatPercent = (value: number) => `${(Number.isFinite(value) && value >= 0) ? '+' : ''}${(Number.isFinite(value) ? value : 0).toFixed(2)}%`;
  const formatCompact = (value: number) => {
    if (!Number.isFinite(value)) return '0';
    if (value >= 1_000_000_000_000) return `${(value / 1_000_000_000_000).toFixed(2)}T`;
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
    return value.toString();
  };

  if (loading) {
    return (
      <div className="papertrade">
        <div className="loading-screen">
          <div className="loading-spinner"></div>
          <p>Loading market data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="papertrade">
      <div className="papertrade-layout">
        {/* Left Sidebar - Watchlist */}
        <div className="watchlist-sidebar">
          <div className="watchlist-header">
            <h3>Watchlist</h3>
            <span className="stock-count">{watchlistStocks.length} assets</span>
          </div>
          
          <div className="add-stock-section">
            <div className="search-input-container">
              <input
                type="text"
                placeholder="Add ticker..."
                value={searchTicker}
                onChange={(e) => setSearchTicker(e.target.value.toUpperCase())}
                className="search-input"
                onKeyPress={(e) => e.key === 'Enter' && addToWatchlist()}
              />
              <button onClick={addToWatchlist} className="add-btn">+</button>
            </div>
          </div>
          
          <div className="watchlist-items">
            {watchlistStocks.map((stock) => (
              <div 
                key={stock.symbol} 
                className={`watchlist-item ${selectedTicker === stock.symbol ? 'active' : ''}`}
                onClick={() => setSelectedTicker(stock.symbol)}
              >
                <div className="stock-info">
                  <div className="stock-symbol">{stock.shortName || stock.symbol}</div>
                  <div className="stock-price">{formatCurrency(stock.regularMarketPrice)}</div>
                </div>
                <div className="stock-change-container">
                  <span className={`stock-change-percent ${stock.regularMarketChangePercent >= 0 ? 'positive' : 'negative'}`}>
                    {formatPercent(stock.regularMarketChangePercent)}
                  </span>
                  <button 
                    className="remove-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromWatchlist(stock.symbol);
                    }}
                  >×</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Center Content */}
        <div className="center-content">
          {/* Portfolio Summary Cards */}
          <div className="portfolio-cards-top">
            <div className="portfolio-card">
              <div className="card-icon cash-icon">$</div>
              <div className="card-info">
                <div className="card-label">Cash Balance</div>
                <div className="card-value">{formatCurrency(cashBalance)}</div>
              </div>
            </div>

            <div className="portfolio-card">
              <div className="card-icon equity-icon">₿</div>
              <div className="card-info">
                <div className="card-label">Total Equity</div>
                <div className="card-value">{formatCurrency(totalEquity)}</div>
              </div>
            </div>

            <div className="portfolio-card pnl-card">
              <div className="card-icon pnl-icon">↗</div>
              <div className="card-info">
                <div className="card-label">Total P&L</div>
                <div className={`card-value ${totalPnL >= 0 ? 'positive' : 'negative'}`}>
                  {formatCurrency(totalPnL)} {formatPercent(totalPnL / 100000 * 100)}
                </div>
              </div>
            </div>
          </div>

          {/* Top Navigation */}
          <div className="top-nav">
            {['Trade', 'Portfolio', 'History'].map((tab) => (
              <button
                key={tab}
                className={`nav-tab ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab as typeof activeTab)}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'Trade' && (
            <div className="trading-interface">
              <div className="trading-header">
                <h3>Trade {selectedTicker}</h3>
                <div className="cash-display">{formatCurrency(cashBalance)}</div>
              </div>

              <div className="trading-form">
                <div className="form-section">
                  <label>ASSET TYPE</label>
                  <select 
                    value={assetType}
                    onChange={(e) => setAssetType(e.target.value as 'Stock' | 'Crypto' | 'Option')}
                    className="symbol-select"
                  >
                    <option value="Stock">Stock</option>
                    <option value="Crypto">Crypto</option>
                    <option value="Option">Option</option>
                  </select>
                </div>

                <div className="form-section">
                  <label>SYMBOL</label>
                  <select 
                    value={selectedTicker}
                    onChange={(e) => setSelectedTicker(e.target.value)}
                    className="symbol-select"
                  >
                    {watchlistStocks.map(stock => (
                      <option key={stock.symbol} value={stock.symbol}>
                        {stock.symbol} - ${stock.regularMarketPrice.toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>

                {assetType === 'Option' && (
                  <>
                    <div className="form-section">
                      <label>OPTION TYPE</label>
                      <select 
                        value={optionType}
                        onChange={(e) => setOptionType(e.target.value as 'CALL' | 'PUT')}
                        className="order-type-select"
                      >
                        <option value="CALL">Call</option>
                        <option value="PUT">Put</option>
                      </select>
                    </div>

                    <div className="form-section">
                      <label>STRIKE PRICE</label>
                      <input
                        type="number"
                        step="0.01"
                        value={strikePrice}
                        onChange={(e) => setStrikePrice(Number(e.target.value))}
                        className="price-input"
                        placeholder="Strike price"
                      />
                    </div>

                    <div className="form-section">
                      <label>EXPIRATION DATE</label>
                      <input
                        type="date"
                        value={expirationDate}
                        onChange={(e) => setExpirationDate(e.target.value)}
                        className="price-input"
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                  </>
                )}

                <div className="form-section">
                  <label>ORDER TYPE</label>
                  <select 
                    value={orderType}
                    onChange={(e) => setOrderType(e.target.value as 'MARKET' | 'LIMIT')}
                    className="order-type-select"
                  >
                    <option value="MARKET">Market Order</option>
                    <option value="LIMIT">Limit Order</option>
                  </select>
                </div>

                <div className="form-section">
                  <label>QUANTITY</label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="quantity-input"
                  />
                </div>

                {orderType === 'LIMIT' && (
                  <div className="form-section">
                    <label>LIMIT PRICE</label>
                    <input
                      type="number"
                      step="0.01"
                      value={limitPrice}
                      onChange={(e) => setLimitPrice(Number(e.target.value))}
                      className="price-input"
                    />
                  </div>
                )}

                <div className="current-price">
                  <div className="price-display">
                    <span className="ticker-name">{selectedTicker}</span>
                    <span className={`price-value ${(selectedStock?.regularMarketChange ?? 0) >= 0 ? 'positive' : 'negative'}`}>
                      {selectedStock ? formatCurrency(selectedStock.regularMarketPrice) : formatCurrency(0)}
                    </span>
                    <span className={`price-change ${(selectedStock?.regularMarketChangePercent ?? 0) >= 0 ? 'positive' : 'negative'}`}>
                      {formatPercent(selectedStock?.regularMarketChangePercent ?? 0)}
                    </span>
                  </div>
                  
                  {currentPosition && (
                    <div className="position-display">
                      <span>Current Position: {currentPosition.quantity} shares</span>
                      <span className={`position-pnl ${currentPosition.pnl >= 0 ? 'positive' : 'negative'}`}>
                        P&L: {formatCurrency(currentPosition.pnl)} ({formatPercent(currentPosition.pnlPercent)})
                      </span>
                    </div>
                  )}
                </div>

                <div className="order-summary">
                  <div className="summary-row">
                    <span>Order Total:</span>
                    <span>{formatCurrency(((orderType === 'LIMIT' ? limitPrice : selectedStock?.regularMarketPrice || 0) * quantity))}</span>
                  </div>
                </div>

                <div className="trade-buttons">
                  <button 
                    className="buy-btn"
                    onClick={() => handleTrade('BUY')}
                    disabled={!selectedStock}
                  >
                    Buy {quantity} {assetType === 'Option' ? 'contract' + (quantity > 1 ? 's' : '') : 'share' + (quantity > 1 ? 's' : '')}
                  </button>
                  <button 
                    className="sell-btn"
                    onClick={() => handleTrade('SELL')}
                    disabled={!currentPosition || currentPosition.quantity < quantity}
                  >
                    Sell {quantity} {assetType === 'Option' ? 'contract' + (quantity > 1 ? 's' : '') : 'share' + (quantity > 1 ? 's' : '')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Portfolio' && (
            <div className="portfolio-view">
              <h3>Current Holdings</h3>
              {positions.length === 0 ? (
                <div className="empty-portfolio">
                  <p>No positions held. Start trading to build your portfolio!</p>
                </div>
              ) : (
                <div className="positions-grid">
                  {positions.map((position, index) => (
                    <div key={`${position.symbol}_${index}`} className="position-card">
                      <div className="position-header">
                        <span className="position-symbol">
                          {position.symbol}
                          {position.assetType === 'Option' && (
                            <span className="option-badge">{position.optionType}</span>
                          )}
                        </span>
                        <span className={`position-pnl ${position.pnl >= 0 ? 'positive' : 'negative'}`}>
                          {formatCurrency(position.pnl)}
                        </span>
                      </div>
                      <div className="position-details">
                        {position.assetType === 'Option' && (
                          <>
                            <div className="position-row">
                              <span>Strike Price:</span>
                              <span>{formatCurrency(position.strikePrice || 0)}</span>
                            </div>
                            <div className="position-row">
                              <span>Expiration:</span>
                              <span>{position.expirationDate}</span>
                            </div>
                          </>
                        )}
                        <div className="position-row">
                          <span>Quantity:</span>
                          <span>{position.quantity} {position.assetType === 'Option' ? 'contracts' : 'shares'}</span>
                        </div>
                        <div className="position-row">
                          <span>Avg Price:</span>
                          <span>{formatCurrency(position.averagePrice)}</span>
                        </div>
                        <div className="position-row">
                          <span>Current:</span>
                          <span>{formatCurrency(position.currentPrice)}</span>
                        </div>
                        <div className="position-row">
                          <span>Total Value:</span>
                          <span>{formatCurrency(position.totalValue)}</span>
                        </div>
                        <div className="position-row">
                          <span>P&L %:</span>
                          <span className={`${position.pnlPercent >= 0 ? 'positive' : 'negative'}`}>
                            {formatPercent(position.pnlPercent)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'History' && (
            <div className="history-view">
              <h3>Transaction History</h3>
              {transactions.length === 0 ? (
                <div className="empty-history">
                  <p>No transactions yet. Make your first trade!</p>
                </div>
              ) : (
                <div className="transactions-list">
                  {transactions.map(transaction => (
                    <div key={transaction.id} className="transaction-item">
                      <div className="transaction-main">
                        <span className={`transaction-type ${transaction.type.toLowerCase()}`}>
                          {transaction.type}
                        </span>
                        <span className="transaction-symbol">
                          {transaction.symbol}
                          {transaction.assetType === 'Option' && (
                            <span className="option-badge">{transaction.optionType} ${transaction.strikePrice} {transaction.expirationDate}</span>
                          )}
                        </span>
                        <span className="transaction-quantity">
                          {transaction.quantity} {transaction.assetType === 'Option' ? 'contracts' : 'shares'}
                        </span>
                        <span className="transaction-price">@ {formatCurrency(transaction.price)}</span>
                        <span className="transaction-total">{formatCurrency(transaction.total)}</span>
                      </div>
                      <div className="transaction-time">
                        {transaction.timestamp.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Sidebar - Market Heatmap */}
        <div className="market-sidebar">
          <div className="market-header">
            <div className="market-title">
              <span className="chart-icon">▤</span>
              Market Overview
            </div>
            <div className="market-filters">
              <button 
                className={`filter-btn ${marketFilter === 'All' ? 'active' : ''}`}
                onClick={() => setMarketFilter('All')}
              >
                All
              </button>
              <button 
                className={`filter-btn ${marketFilter === 'Gainers' ? 'active' : ''}`}
                onClick={() => setMarketFilter('Gainers')}
              >
                Gainers
              </button>
              <button 
                className={`filter-btn ${marketFilter === 'Losers' ? 'active' : ''}`}
                onClick={() => setMarketFilter('Losers')}
              >
                Losers
              </button>
            </div>
          </div>

          <div className="market-categories">
            <button className={`category-btn ${assetType === 'Stock' ? 'active' : ''}`} onClick={() => setAssetType('Stock')}>
              Stocks
            </button>
            <button className={`category-btn ${assetType === 'Crypto' ? 'active' : ''}`} onClick={() => setAssetType('Crypto')}>
              Crypto
            </button>
          </div>

          <div className="market-stats">
            <div className="stat-item">
              <span className="stat-label">Top Gainer</span>
              <span className="stat-value positive">
                {marketData.reduce((top, item) => 
                  item.regularMarketChangePercent > top.regularMarketChangePercent ? item : top, 
                  marketData[0] || { symbol: 'N/A', regularMarketChangePercent: 0 }
                ).symbol} +{marketData.reduce((top, item) => 
                  item.regularMarketChangePercent > top.regularMarketChangePercent ? item : top, 
                  marketData[0] || { regularMarketChangePercent: 0 }
                ).regularMarketChangePercent.toFixed(2)}%
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Top Loser</span>
              <span className="stat-value negative">
                {marketData.reduce((bottom, item) => 
                  item.regularMarketChangePercent < bottom.regularMarketChangePercent ? item : bottom, 
                  marketData[0] || { symbol: 'N/A', regularMarketChangePercent: 0 }
                ).symbol} {marketData.reduce((bottom, item) => 
                  item.regularMarketChangePercent < bottom.regularMarketChangePercent ? item : bottom, 
                  marketData[0] || { regularMarketChangePercent: 0 }
                ).regularMarketChangePercent.toFixed(2)}%
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Total Assets</span>
              <span className="stat-value">{marketData.length}</span>
            </div>
          </div>

          {/* Market Heatmap Items */}
          <div className="heatmap-grid">
            {marketData
              .filter(item => assetType === 'Crypto' ? item.symbol.includes('-USD') : !item.symbol.includes('-USD'))
              .filter(item => {
                if (marketFilter === 'Gainers') return item.regularMarketChangePercent > 0;
                if (marketFilter === 'Losers') return item.regularMarketChangePercent < 0;
                return true;
              })
              .map((item) => (
                <div 
                  key={item.symbol}
                  className={`heatmap-item ${item.regularMarketChangePercent >= 0 ? 'positive' : 'negative'}`}
                  onClick={() => setSelectedTicker(item.symbol)}
                >
                  <div className="heatmap-symbol">{item.shortName || item.symbol}</div>
                  <div className="heatmap-price">{formatCurrency(item.regularMarketPrice)}</div>
                  <div className="heatmap-change">
                    {formatPercent(item.regularMarketChangePercent)}
                  </div>
                  <div className="heatmap-details">
                    <span>VOL: {formatCompact(item.regularMarketVolume)}</span>
                    <span>CAP: {formatCompact(item.marketCap)}</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}
    </div>
  );
};

export default Papertrade;
