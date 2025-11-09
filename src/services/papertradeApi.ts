// Paper trading API service

import { getAuthHeader } from './authApi';

export interface Position {
  id?: string;
  ticker: string;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  type?: 'stock' | 'crypto' | 'option';
  optionDetails?: {
    optionType: 'CALL' | 'PUT';
    strikePrice: number;
    expirationDate: string;
  };
}

export interface Trade {
  id: string;
  ticker: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  total: number;
  type?: 'stock' | 'crypto' | 'option';
  optionDetails?: {
    optionType: 'CALL' | 'PUT';
    strikePrice: number;
    expirationDate: string;
  };
  timestamp: string;
}

// Cash Balance API
export const cashBalanceApi = {
  get: async (): Promise<number> => {
    try {
      const response = await fetch('/api/cash-balance', {
        headers: {
          ...getAuthHeader(),
        },
      });

      if (!response.ok) {
        return 100000; // Default starting balance
      }

      const data = await response.json();
      return data.success ? data.cashBalance : 100000;
    } catch (error) {
      console.error('Get cash balance error:', error);
      return 100000;
    }
  },

  update: async (cashBalance: number): Promise<boolean> => {
    try {
      const response = await fetch('/api/cash-balance', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({ cashBalance }),
      });

      const data = await response.json();
      return data.success === true;
    } catch (error) {
      console.error('Update cash balance error:', error);
      return false;
    }
  },
};

// Trades API
export const tradesApi = {
  getAll: async (limit: number = 100): Promise<Trade[]> => {
    try {
      const response = await fetch(`/api/trades?limit=${limit}`, {
        headers: {
          ...getAuthHeader(),
        },
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.success
        ? data.trades.map((trade: any) => ({
            id: trade.id,
            ticker: trade.ticker,
            action: trade.action,
            quantity: trade.quantity,
            price: trade.price,
            total: trade.total,
            type: trade.type || 'stock',
            optionDetails: trade.optionDetails,
            timestamp: trade.timestamp,
          }))
        : [];
    } catch (error) {
      console.error('Get trades error:', error);
      return [];
    }
  },

  create: async (trade: Omit<Trade, 'id' | 'timestamp'>): Promise<string | null> => {
    try {
      const response = await fetch('/api/trades', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify(trade),
      });

      const data = await response.json();
      return data.success ? data.tradeId : null;
    } catch (error) {
      console.error('Create trade error:', error);
      return null;
    }
  },
};

