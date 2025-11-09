// User data API service (watchlist, positions, etc.)

import { getAuthHeader } from './authApi';
import { WatchlistItem, Position } from '../types';

// Watchlist API
export const watchlistApi = {
  // Get user's watchlist
  getAll: async (): Promise<WatchlistItem[]> => {
    try {
      const response = await fetch('/api/watchlist', {
        headers: {
          ...getAuthHeader(),
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch watchlist');
      }

      const data = await response.json();
      return data.success
        ? data.watchlist.map((item: any) => ({
            ticker: item.ticker,
            addedAt: new Date(item.addedAt),
          }))
        : [];
    } catch (error) {
      console.error('Get watchlist error:', error);
      return [];
    }
  },

  // Add to watchlist
  add: async (ticker: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/watchlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({ ticker }),
      });

      const data = await response.json();
      return data.success === true;
    } catch (error) {
      console.error('Add watchlist error:', error);
      return false;
    }
  },

  // Remove from watchlist
  remove: async (ticker: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/watchlist/${encodeURIComponent(ticker)}`, {
        method: 'DELETE',
        headers: {
          ...getAuthHeader(),
        },
      });

      const data = await response.json();
      return data.success === true;
    } catch (error) {
      console.error('Remove watchlist error:', error);
      return false;
    }
  },
};

// Positions API
export const positionsApi = {
  // Get user's positions
  getAll: async (): Promise<Position[]> => {
    try {
      const response = await fetch('/api/positions', {
        headers: {
          ...getAuthHeader(),
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch positions');
      }

      const data = await response.json();
      return data.success
        ? data.positions.map((pos: any) => ({
            id: pos.id,
            ticker: pos.ticker,
            quantity: pos.quantity,
            entryPrice: pos.entryPrice,
            currentPrice: pos.currentPrice,
            pnl: pos.pnl,
            pnlPercent: pos.pnlPercent,
            type: pos.type || 'stock',
            optionDetails: pos.optionDetails,
          }))
        : [];
    } catch (error) {
      console.error('Get positions error:', error);
      return [];
    }
  },

  // Add position
  add: async (position: Omit<Position, 'id'>): Promise<string | null> => {
    try {
      const response = await fetch('/api/positions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          ticker: position.ticker,
          quantity: position.quantity,
          entryPrice: position.entryPrice,
          currentPrice: position.currentPrice,
          type: position.type,
          optionDetails: position.optionDetails,
        }),
      });

      const data = await response.json();
      return data.success ? data.positionId : null;
    } catch (error) {
      console.error('Add position error:', error);
      return null;
    }
  },

  // Update position
  update: async (positionId: string, updates: Partial<Position>): Promise<boolean> => {
    try {
      const response = await fetch(`/api/positions/${positionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify(updates),
      });

      const data = await response.json();
      return data.success === true;
    } catch (error) {
      console.error('Update position error:', error);
      return false;
    }
  },

  // Delete position
  remove: async (positionId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/positions/${positionId}`, {
        method: 'DELETE',
        headers: {
          ...getAuthHeader(),
        },
      });

      const data = await response.json();
      return data.success === true;
    } catch (error) {
      console.error('Delete position error:', error);
      return false;
    }
  },
};

