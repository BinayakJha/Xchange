import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { positionsApi } from '../services/userDataApi';
import { cashBalanceApi, tradesApi } from '../services/papertradeApi';
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

interface TradeData {
  ticker: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  total: number;
  assetType?: 'Stock' | 'Crypto' | 'Option';
  optionType?: 'CALL' | 'PUT';
  strikePrice?: number;
  expirationDate?: string;
  currentPrice?: number;
  premium?: number;
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

  const { isAuthenticated, useDatabase } = useApp();

  // Yahoo Finance API call
  const fetchStockData = async (symbols: string[]): Promise<StockData[]> => {
    if (!symbols || symbols.length === 0) return [];
    
    try {
      const symbolsStr = symbols.join(',');
      let response = await fetch(`/api/yahoo-finance?symbols=${symbolsStr}`);
      
      if (!response.ok) {
        console.log('[Papertrade] Trying direct Yahoo Finance API...');
        response = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${symbolsStr}?interval=1m&range=1d`,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          }
        );
        
        if (!response.ok) {
          console.error('[Papertrade] Failed to fetch data from Yahoo Finance:', response.status);
          return symbols.map(symbol => ({
            symbol,
            regularMarketPrice: 0,
            regularMarketChange: 0,
            regularMarketChangePercent: 0,
            regularMarketVolume: 0,
            marketCap: 0
          }));
        }
      }

      const data = await response.json();
      
      if (Array.isArray(data)) {
        return data.map((item: any) => ({
          symbol: item.symbol || item.ticker || '',
          regularMarketPrice: item.regularMarketPrice || item.price || 0,
          regularMarketChange: item.regularMarketChange || item.change || 0,
          regularMarketChangePercent: item.regularMarketChangePercent || item.changePercent || 0,
          regularMarketVolume: item.regularMarketVolume || item.volume || 0,
          marketCap: item.marketCap || 0,
          shortName: item.shortName,
          longName: item.longName
        }));
      }

      return [];
    } catch (error) {
      console.error('[Papertrade] Error fetching stock data:', error);
      return symbols.map(symbol => ({
        symbol,
        regularMarketPrice: 0,
        regularMarketChange: 0,
        regularMarketChangePercent: 0,
        regularMarketVolume: 0,
        marketCap: 0
      }));
    }
  };

  // Calculate portfolio metrics
  const calculatePortfolioMetrics = useCallback(() => {
    let totalValue = cashBalance;
    positions.forEach(position => {
      totalValue += position.totalValue;
    });
    
    const pnl = totalValue - 100000; // Initial balance
    
    setTotalEquity(totalValue);
    setTotalPnL(pnl);
  }, [positions, cashBalance]);

  // UNIFIED TRADE EXECUTION FUNCTION
  // This function handles trades from ALL sources: AI Chat, Flow Analysis, and Manual
  const executeTrade = useCallback(async (tradeData: TradeData): Promise<{ success: boolean; error?: string }> => {
    const { ticker, action, quantity, price, total, assetType, optionType, strikePrice, expirationDate, currentPrice, premium } = tradeData;

    console.log('[Papertrade] Executing trade:', tradeData);

    // Validate trade data
    if (!ticker || !quantity || quantity <= 0 || !price || price <= 0) {
      return { success: false, error: 'Invalid trade data' };
    }

    // Check cash balance for buy orders
    if (action === 'BUY') {
      if (isAuthenticated && useDatabase) {
        const balance = await cashBalanceApi.get();
        if (total > balance) {
          return { success: false, error: `Insufficient funds! You need $${total.toFixed(2)} but only have $${balance.toFixed(2)}.` };
        }
      } else {
        // Guest mode - check local state
        if (total > cashBalance) {
          return { success: false, error: `Insufficient funds! You need $${total.toFixed(2)} but only have $${cashBalance.toFixed(2)}.` };
        }
      }
    }

    // Check position for sell orders
    if (action === 'SELL') {
      const currentPositions = isAuthenticated && useDatabase 
        ? await positionsApi.getAll()
        : positions;

      let positionToSell;
      if (assetType === 'Option' && optionType && strikePrice && expirationDate) {
        positionToSell = currentPositions.find((p: any) => {
          const dbPos = p as any;
          return (dbPos.ticker || dbPos.symbol) === ticker &&
                 (dbPos.type === 'option' || dbPos.assetType === 'Option') &&
                 (dbPos.optionDetails?.optionType || dbPos.optionType) === optionType &&
                 (dbPos.optionDetails?.strikePrice || dbPos.strikePrice) === strikePrice &&
                 (dbPos.optionDetails?.expirationDate || dbPos.expirationDate) === expirationDate;
        });
      } else {
        positionToSell = currentPositions.find((p: any) => {
          const dbPos = p as any;
          return (dbPos.ticker || dbPos.symbol) === ticker &&
                 (dbPos.type === 'stock' || dbPos.assetType === 'Stock' || !dbPos.assetType);
        });
      }

      if (!positionToSell) {
        return { success: false, error: `No position found to sell for ${ticker}` };
      }

      const positionQty = positionToSell.quantity || (positionToSell as Position).quantity;
      if (positionQty < quantity) {
        return { success: false, error: `Insufficient ${assetType === 'Option' ? 'contracts' : 'shares'} to sell!` };
      }
    }

    try {
      // Execute trade in database (authenticated users)
      if (isAuthenticated && useDatabase) {
        const tradeType = assetType === 'Crypto' ? 'crypto' : assetType === 'Option' ? 'option' : 'stock';
        const optionDetails = assetType === 'Option' && optionType && strikePrice && expirationDate ? {
          optionType,
          strikePrice,
          expirationDate
        } : undefined;

        // Create trade record
        await tradesApi.create({
          ticker,
          action,
          quantity,
          price: premium || price,
          total,
          type: tradeType,
          optionDetails
        });

        // Update position
        const dbPositions = await positionsApi.getAll();
        
        if (action === 'BUY') {
          let existingPosition;
          if (assetType === 'Option' && optionDetails) {
            existingPosition = dbPositions.find(p => 
              p.ticker === ticker &&
              p.type === 'option' &&
              p.optionDetails?.optionType === optionDetails.optionType &&
              p.optionDetails?.strikePrice === optionDetails.strikePrice &&
              p.optionDetails?.expirationDate === optionDetails.expirationDate
            );
          } else {
            existingPosition = dbPositions.find(p => 
              p.ticker === ticker && p.type === tradeType
            );
          }

          if (existingPosition) {
            const newQuantity = existingPosition.quantity + quantity;
            const newAverage = ((existingPosition.entryPrice * existingPosition.quantity) + total) / newQuantity;
            await positionsApi.update(existingPosition.id!, {
              quantity: newQuantity,
              entryPrice: newAverage,
              currentPrice: premium || price
            });
          } else {
            await positionsApi.add({
              ticker,
              quantity,
              entryPrice: premium || price,
              currentPrice: premium || price,
              type: tradeType,
              optionDetails
            });
          }

          // Update cash balance
          const balance = await cashBalanceApi.get();
          await cashBalanceApi.update(balance - total);
        } else {
          // SELL
          let dbPosition;
          if (assetType === 'Option' && optionDetails) {
            dbPosition = dbPositions.find(p => 
              p.ticker === ticker &&
              p.type === 'option' &&
              p.optionDetails?.optionType === optionDetails.optionType &&
              p.optionDetails?.strikePrice === optionDetails.strikePrice &&
              p.optionDetails?.expirationDate === optionDetails.expirationDate
            );
          } else {
            dbPosition = dbPositions.find(p => p.ticker === ticker && p.type === tradeType);
          }

          if (dbPosition) {
            if (dbPosition.quantity <= quantity) {
              await positionsApi.remove(dbPosition.id!);
            } else {
              await positionsApi.update(dbPosition.id!, {
                quantity: dbPosition.quantity - quantity,
                currentPrice: premium || price
              });
            }
          }

          // Update cash balance
          const balance = await cashBalanceApi.get();
          await cashBalanceApi.update(balance + total);
        }

        // Reload data
        await loadData();
      } else {
        // Guest mode - update local state
        setCashBalance(prev => action === 'BUY' ? prev - total : prev + total);

        // Update positions
        setPositions(prev => {
          if (action === 'BUY') {
            if (assetType === 'Option' && optionType && strikePrice && expirationDate) {
              const existing = prev.find(p =>
                p.symbol === ticker &&
                p.assetType === 'Option' &&
                p.optionType === optionType &&
                p.strikePrice === strikePrice &&
                p.expirationDate === expirationDate
              );

              if (existing) {
                const newQty = existing.quantity + quantity;
                const newAvg = ((existing.averagePrice * existing.quantity) + total) / newQty;
                const multiplier = 100;
                return prev.map(p =>
                  (p.symbol === ticker && p.assetType === 'Option' && p.optionType === optionType && p.strikePrice === strikePrice && p.expirationDate === expirationDate)
                    ? {
                        ...p,
                        quantity: newQty,
                        averagePrice: newAvg,
                        currentPrice: premium || price,
                        totalValue: newQty * (premium || price) * multiplier,
                        pnl: ((premium || price) - newAvg) * newQty * multiplier,
                        pnlPercent: ((premium || price) - newAvg) / newAvg * 100
                      }
                    : p
                );
              } else {
                const multiplier = 100;
                const optionPremium = premium || price;
                return [...prev, {
                  symbol: ticker,
                  quantity,
                  averagePrice: optionPremium,
                  currentPrice: optionPremium,
                  totalValue: quantity * optionPremium * multiplier,
                  pnl: 0,
                  pnlPercent: 0,
                  assetType: 'Option' as const,
                  optionType,
                  strikePrice,
                  expirationDate
                }];
              }
            } else {
              // Stock/Crypto
              const existing = prev.find(p =>
                p.symbol === ticker &&
                (p.assetType === assetType || (!p.assetType && assetType === 'Stock'))
              );

              if (existing) {
                const newQty = existing.quantity + quantity;
                const newAvg = ((existing.averagePrice * existing.quantity) + total) / newQty;
                return prev.map(p =>
                  (p.symbol === ticker && (p.assetType === assetType || (!p.assetType && assetType === 'Stock')))
                    ? {
                        ...p,
                        quantity: newQty,
                        averagePrice: newAvg,
                        currentPrice: currentPrice || price,
                        totalValue: newQty * (currentPrice || price),
                        pnl: ((currentPrice || price) - newAvg) * newQty,
                        pnlPercent: ((currentPrice || price) - newAvg) / newAvg * 100
                      }
                    : p
                );
              } else {
                return [...prev, {
                  symbol: ticker,
                  quantity,
                  averagePrice: price,
                  currentPrice: currentPrice || price,
                  totalValue: quantity * (currentPrice || price),
                  pnl: 0,
                  pnlPercent: 0,
                  assetType: (assetType || 'Stock') as 'Stock' | 'Crypto' | 'Option'
                }];
              }
            }
          } else {
            // SELL
            if (assetType === 'Option' && optionType && strikePrice && expirationDate) {
              return prev.map(p =>
                (p.symbol === ticker && p.assetType === 'Option' && p.optionType === optionType && p.strikePrice === strikePrice && p.expirationDate === expirationDate)
                  ? {
                      ...p,
                      quantity: p.quantity - quantity,
                      totalValue: (p.quantity - quantity) * (premium || price) * 100,
                      pnl: ((premium || price) - p.averagePrice) * (p.quantity - quantity) * 100,
                      pnlPercent: ((premium || price) - p.averagePrice) / p.averagePrice * 100
                    }
                  : p
              ).filter(p => p.quantity > 0);
            } else {
              return prev.map(p =>
                (p.symbol === ticker && (p.assetType === assetType || (!p.assetType && assetType === 'Stock')))
                  ? {
                      ...p,
                      quantity: p.quantity - quantity,
                      totalValue: (p.quantity - quantity) * (currentPrice || price),
                      pnl: ((currentPrice || price) - p.averagePrice) * (p.quantity - quantity),
                      pnlPercent: ((currentPrice || price) - p.averagePrice) / p.averagePrice * 100
                    }
                  : p
              ).filter(p => p.quantity > 0);
            }
          }
        });

        // Add transaction
        const transaction: Transaction = {
          id: Date.now().toString(),
          symbol: ticker,
          type: action,
          quantity,
          price: premium || price,
          total,
          timestamp: new Date(),
          assetType: assetType || 'Stock',
          optionType,
          strikePrice,
          expirationDate
        };
        setTransactions(prev => [transaction, ...prev]);
      }

      return { success: true };
    } catch (error: any) {
      console.error('[Papertrade] Error executing trade:', error);
      return { success: false, error: error.message || 'Failed to execute trade' };
    }
  }, [isAuthenticated, useDatabase, positions, cashBalance]);

  // Load data from database
  const loadData = useCallback(async () => {
    if (isAuthenticated && useDatabase) {
      try {
        // Load cash balance
        const balance = await cashBalanceApi.get();
        setCashBalance(balance);

        // Load positions
        const dbPositions = await positionsApi.getAll();
        const mappedPositions = dbPositions.map(pos => {
          let totalValue = pos.quantity * pos.currentPrice;
          if (pos.type === 'option') {
            totalValue = pos.quantity * pos.currentPrice * 100;
          }
          
          return {
            symbol: pos.ticker,
            quantity: pos.quantity,
            averagePrice: pos.entryPrice,
            currentPrice: pos.currentPrice,
            totalValue: totalValue,
            pnl: pos.pnl || 0,
            pnlPercent: pos.pnlPercent || 0,
            assetType: pos.type === 'crypto' ? 'Crypto' : pos.type === 'option' ? 'Option' : 'Stock',
            optionType: pos.optionDetails?.optionType,
            strikePrice: pos.optionDetails?.strikePrice,
            expirationDate: pos.optionDetails?.expirationDate
          };
        });
        setPositions(mappedPositions);

        // Load trade history
        const trades = await tradesApi.getAll(100);
        setTransactions(trades.map(trade => ({
          id: trade.id,
          symbol: trade.ticker,
          type: trade.action,
          quantity: trade.quantity,
          price: trade.price,
          total: trade.total,
          timestamp: new Date(trade.timestamp),
          assetType: trade.type === 'crypto' ? 'Crypto' : trade.type === 'option' ? 'Option' : 'Stock',
          optionType: trade.optionDetails?.optionType,
          strikePrice: trade.optionDetails?.strikePrice,
          expirationDate: trade.optionDetails?.expirationDate
        })));
      } catch (error) {
        console.error('Error loading data:', error);
      }
    }
  }, [isAuthenticated, useDatabase]);

  // Initialize data
  useEffect(() => {
    const initializeData = async () => {
      setLoading(true);
      try {
        // Load market data
        const allSymbols = await fetchStockData(defaultSymbols);
        setWatchlistStocks(allSymbols);
        setMarketData(allSymbols);

        // Load user data if authenticated
        if (isAuthenticated && useDatabase) {
          await loadData();
        }

        setError(null);
      } catch (err) {
        setError('Failed to load market data');
      } finally {
        setLoading(false);
      }
    };

    initializeData();
    
    // Update data every 30 seconds
    const interval = setInterval(async () => {
      try {
        const allSymbols = await fetchStockData(defaultSymbols);
        if (allSymbols.length > 0) {
          setWatchlistStocks(allSymbols);
          setMarketData(allSymbols);
        }
      } catch (err) {
        console.error('[Papertrade] Error updating market data:', err);
      }
      
      // Update position prices
      if (isAuthenticated && useDatabase) {
        const dbPositions = await positionsApi.getAll();
        const tickers = dbPositions.map(p => p.ticker);
        if (tickers.length > 0) {
          const priceData = await fetchStockData(tickers);
          for (const pos of dbPositions) {
            const stock = priceData.find(s => s.symbol === pos.ticker);
            if (stock) {
              const pnl = (stock.regularMarketPrice - pos.entryPrice) * pos.quantity;
              const pnlPercent = ((stock.regularMarketPrice - pos.entryPrice) / pos.entryPrice) * 100;
              await positionsApi.update(pos.id!, {
                currentPrice: stock.regularMarketPrice,
                pnl,
                pnlPercent
              });
            }
          }
          await loadData();
        }
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated, useDatabase, loadData]);

  // Update portfolio metrics when positions change
  useEffect(() => {
    calculatePortfolioMetrics();
  }, [positions, cashBalance, calculatePortfolioMetrics]);

  // Listen for external trades (AI Chat, Flow Analysis)
  useEffect(() => {
    const handleExternalTrade = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const tradeData: TradeData = customEvent.detail;
      
      if (!tradeData) {
        console.error('[Papertrade] No trade data in event');
        return;
      }

      console.log('[Papertrade] Received external trade event:', tradeData);
      const result = await executeTrade(tradeData);
      
      if (!result.success && result.error) {
        alert(result.error);
      } else {
        // Success - switch to Portfolio tab to show the new position
        setTimeout(() => {
          setActiveTab('Portfolio');
        }, 100);
      }
    };

    window.addEventListener('executeFlowTrade', handleExternalTrade);
    return () => {
      window.removeEventListener('executeFlowTrade', handleExternalTrade);
    };
  }, [executeTrade]);

  // Listen for position refresh requests
  useEffect(() => {
    const handleRefreshPositions = async () => {
      console.log('[Papertrade] Refreshing positions after external trade...');
      if (isAuthenticated && useDatabase) {
        await loadData();
      }
    };

    window.addEventListener('refreshPapertradePositions', handleRefreshPositions);
    return () => {
      window.removeEventListener('refreshPapertradePositions', handleRefreshPositions);
    };
  }, [isAuthenticated, useDatabase, loadData]);

  // Update position values with current prices
  useEffect(() => {
    setPositions(prev => 
      prev.map(position => {
        if (position.assetType === 'Option') {
          const multiplier = 100;
          // Try to get current stock price, but if not available, use the position's current price
          const currentStock = watchlistStocks.find(s => s.symbol === position.symbol);
          
          if (currentStock && currentStock.regularMarketPrice > 0) {
            // If we have stock price, estimate premium change
            const stockPrice = currentStock.regularMarketPrice;
            const strikePrice = position.strikePrice || stockPrice;
            // Simple estimation: premium changes proportionally with stock price movement
            const priceRatio = stockPrice / strikePrice;
            const estimatedPremium = position.averagePrice * priceRatio;
            
            return {
              ...position,
              currentPrice: estimatedPremium,
              totalValue: position.quantity * estimatedPremium * multiplier,
              pnl: (estimatedPremium - position.averagePrice) * position.quantity * multiplier,
              pnlPercent: ((estimatedPremium - position.averagePrice) / position.averagePrice) * 100
            };
          } else {
            // If stock not in watchlist, keep the position with its current price (premium)
            // This ensures options from Unusual Flow always show in portfolio
            return {
              ...position,
              // Keep current price as is (the premium from when it was bought)
              currentPrice: position.currentPrice || position.averagePrice,
              totalValue: position.quantity * (position.currentPrice || position.averagePrice) * multiplier,
              pnl: ((position.currentPrice || position.averagePrice) - position.averagePrice) * position.quantity * multiplier,
              pnlPercent: ((position.currentPrice || position.averagePrice) - position.averagePrice) / position.averagePrice * 100
            };
          }
        }
        
        // For stocks/crypto, update if in watchlist
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
        // If stock not in watchlist, keep position as is (still show in portfolio)
        return position;
      })
    );
  }, [watchlistStocks]);

  // Handle manual buy/sell orders
  const handleTrade = async (action: 'BUY' | 'SELL') => {
    const selectedStock = watchlistStocks.find(s => s.symbol === selectedTicker);
    if (!selectedStock) {
      setError('Stock data not available');
      return;
    }

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
    const multiplier = assetType === 'Option' ? 100 : 1;
    const totalCost = price * quantity * multiplier;

    const tradeData: TradeData = {
      ticker: selectedTicker,
      action,
      quantity,
      price,
      total: totalCost,
      assetType: assetType === 'Crypto' ? 'Crypto' : assetType === 'Option' ? 'Option' : 'Stock',
      optionType: assetType === 'Option' ? optionType : undefined,
      strikePrice: assetType === 'Option' ? strikePrice : undefined,
      expirationDate: assetType === 'Option' ? expirationDate : undefined,
      currentPrice: selectedStock.regularMarketPrice
    };

    const result = await executeTrade(tradeData);
    
    if (!result.success && result.error) {
      alert(result.error);
    } else {
      alert(`✅ ${action} order executed successfully!`);
    }
  };

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  // Format percentage
  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  // Filter market data
  const filteredMarketData = marketData.filter(stock => {
    if (marketFilter === 'Gainers') {
      return stock.regularMarketChangePercent > 0;
    } else if (marketFilter === 'Losers') {
      return stock.regularMarketChangePercent < 0;
    }
    return true;
  });

  // Get current position for selected ticker
  const currentPosition = positions.find(p => {
    if (assetType === 'Option') {
      return p.symbol === selectedTicker &&
             p.assetType === 'Option' &&
             p.optionType === optionType &&
             p.strikePrice === strikePrice &&
             p.expirationDate === expirationDate;
    }
    return p.symbol === selectedTicker && (!p.assetType || p.assetType === assetType);
  });

  const selectedStock = watchlistStocks.find(s => s.symbol === selectedTicker);

  if (loading) {
    return (
      <div className="papertrade-container">
        <div className="loading">Loading market data...</div>
      </div>
    );
  }

  return (
    <div className="papertrade-container">
      <div className="papertrade-header">
        <h2>Paper Trading</h2>
        <div className="portfolio-summary">
          <div className="summary-item">
            <span className="summary-label">Cash Balance</span>
            <span className="summary-value">{formatCurrency(cashBalance)}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Total Equity</span>
            <span className="summary-value">{formatCurrency(totalEquity)}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Total P&L</span>
            <span className={`summary-value ${totalPnL >= 0 ? 'positive' : 'negative'}`}>
              {formatCurrency(totalPnL)} ({formatPercent((totalPnL / 100000) * 100)})
            </span>
          </div>
        </div>
      </div>

      <div className="papertrade-tabs">
        <button
          className={activeTab === 'Trade' ? 'active' : ''}
          onClick={() => setActiveTab('Trade')}
        >
          Trade
        </button>
        <button
          className={activeTab === 'Portfolio' ? 'active' : ''}
          onClick={() => setActiveTab('Portfolio')}
        >
          Portfolio
        </button>
        <button
          className={activeTab === 'History' ? 'active' : ''}
          onClick={() => setActiveTab('History')}
        >
          History
        </button>
      </div>

      {activeTab === 'Trade' && (
        <div className="trade-section">
          <div className="trade-form">
            <div className="form-section">
              <label>ASSET TYPE</label>
              <select
                value={assetType}
                onChange={(e) => setAssetType(e.target.value as 'Stock' | 'Crypto' | 'Option')}
                className="asset-type-select"
              >
                <option value="Stock">Stock</option>
                <option value="Crypto">Crypto</option>
                <option value="Option">Option</option>
              </select>
            </div>

            <div className="form-section">
              <label>TICKER</label>
              <input
                type="text"
                value={selectedTicker}
                onChange={(e) => setSelectedTicker(e.target.value.toUpperCase())}
                className="ticker-input"
                placeholder="Enter ticker"
              />
            </div>

            {assetType === 'Option' && (
              <>
                <div className="form-section">
                  <label>OPTION TYPE</label>
                  <select
                    value={optionType}
                    onChange={(e) => setOptionType(e.target.value as 'CALL' | 'PUT')}
                    className="option-type-select"
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
                  <span>Current Position: {currentPosition.quantity} {assetType === 'Option' ? 'contracts' : 'shares'}</span>
                  <span className={`position-pnl ${currentPosition.pnl >= 0 ? 'positive' : 'negative'}`}>
                    P&L: {formatCurrency(currentPosition.pnl)} ({formatPercent(currentPosition.pnlPercent)})
                  </span>
                </div>
              )}
            </div>

            <div className="order-summary">
              <div className="summary-row">
                <span>Order Total:</span>
                <span>{formatCurrency(((orderType === 'LIMIT' ? limitPrice : selectedStock?.regularMarketPrice || 0) * quantity * (assetType === 'Option' ? 100 : 1)))}</span>
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
                    <h4>{position.symbol}</h4>
                    {position.assetType && (
                      <span className="asset-type-badge">{position.assetType}</span>
                    )}
                  </div>
                  {position.assetType === 'Option' && (
                    <div className="option-details">
                      <span>{position.optionType} ${position.strikePrice?.toFixed(2)}</span>
                      <span>Exp: {position.expirationDate}</span>
                    </div>
                  )}
                  <div className="position-details">
                    <div className="detail-row">
                      <span>Quantity:</span>
                      <span>{position.quantity} {position.assetType === 'Option' ? 'contracts' : 'shares'}</span>
                    </div>
                    <div className="detail-row">
                      <span>Avg Price:</span>
                      <span>{formatCurrency(position.averagePrice)}</span>
                    </div>
                    <div className="detail-row">
                      <span>Current Price:</span>
                      <span>{formatCurrency(position.currentPrice)}</span>
                    </div>
                    <div className="detail-row">
                      <span>Total Value:</span>
                      <span>{formatCurrency(position.totalValue)}</span>
                    </div>
                    <div className="detail-row">
                      <span>P&L:</span>
                      <span className={position.pnl >= 0 ? 'positive' : 'negative'}>
                        {formatCurrency(position.pnl)} ({formatPercent(position.pnlPercent)})
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
          <h3>Trade History</h3>
          {transactions.length === 0 ? (
            <div className="empty-history">
              <p>No trades yet. Start trading to see your history!</p>
            </div>
          ) : (
            <div className="transactions-table">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Symbol</th>
                    <th>Type</th>
                    <th>Action</th>
                    <th>Quantity</th>
                    <th>Price</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td>{transaction.timestamp.toLocaleString()}</td>
                      <td>
                        {transaction.symbol}
                        {transaction.assetType === 'Option' && transaction.optionType && (
                          <span className="option-badge">
                            {transaction.optionType} ${transaction.strikePrice?.toFixed(2)}
                          </span>
                        )}
                      </td>
                      <td>{transaction.assetType || 'Stock'}</td>
                      <td className={transaction.type === 'BUY' ? 'buy-action' : 'sell-action'}>
                        {transaction.type}
                      </td>
                      <td>{transaction.quantity}</td>
                      <td>{formatCurrency(transaction.price)}</td>
                      <td>{formatCurrency(transaction.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {error && <div className="error-message">{error}</div>}
    </div>
  );
};

export default Papertrade;
