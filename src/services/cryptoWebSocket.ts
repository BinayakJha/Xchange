import { Stock } from '../types';

// Binance WebSocket API for real-time crypto prices (free, no API key required)
const BINANCE_WS_BASE = 'wss://stream.binance.com:9443/';

interface CryptoPriceUpdate {
  symbol: string;
  price: string;
  change24h?: number;
  changePercent24h?: number;
}

class CryptoWebSocketService {
  private ws: WebSocket | null = null;
  private subscribers: Map<string, Set<(data: Stock) => void>> = new Map();
  private prices: Map<string, Stock> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;

  // Convert Binance symbol to Yahoo Finance format (e.g., BTCUSDT -> BTC-USD)
  private convertSymbol(symbol: string): string {
    if (symbol.endsWith('USDT')) {
      return symbol.replace('USDT', '-USD');
    }
    return symbol;
  }

  // Convert Yahoo Finance ticker to Binance symbol (e.g., BTC-USD -> btcusdt)
  private convertTickerToBinance(ticker: string): string {
    const cleaned = ticker.replace('-USD', '').toLowerCase();
    return `${cleaned}usdt`;
  }

  private connect(symbols: string[]) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      // If already connected, check if we need to add new symbols
      // For simplicity, we'll reconnect if symbols change
      return;
    }

    if (symbols.length === 0) {
      return;
    }

    // Binance WebSocket requires lowercase symbols
    const binanceSymbols = symbols.map(ticker => this.convertTickerToBinance(ticker));
    
    // Binance supports multiple streams via stream names separated by /
    // Format: wss://stream.binance.com:9443/stream?streams=btcusdt@ticker/ethusdt@ticker
    const streamNames = binanceSymbols.map(symbol => `${symbol}@ticker`).join('/');
    const wsUrl = `${BINANCE_WS_BASE}stream?streams=${streamNames}`;
    
    console.log('Connecting to Binance WebSocket:', wsUrl);

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('Crypto WebSocket connected');
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('Crypto WebSocket error:', error);
      };

      this.ws.onclose = () => {
        console.log('Crypto WebSocket closed');
        this.ws = null;
        this.reconnect(symbols);
      };
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      this.reconnect(symbols);
    }
  }

  private handleMessage(data: any) {
    // Binance sends data in format: { stream: "btcusdt@ticker", data: {...} }
    const tickerData = data.data || data;
    
    if (tickerData.e === '24hrTicker' || tickerData.eventType === '24hrTicker') {
      const symbol = this.convertSymbol(tickerData.s); // Convert BTCUSDT to BTC-USD
      const price = parseFloat(tickerData.c); // Current price
      const openPrice = parseFloat(tickerData.o); // Open price 24h ago
      const change = price - openPrice;
      const changePercent = openPrice !== 0 ? (change / openPrice) * 100 : 0;

      const stock: Stock = {
        ticker: symbol,
        name: symbol.replace('-USD', ''),
        price,
        change,
        changePercent,
        type: 'crypto',
      };

      this.prices.set(symbol, stock);

      // Notify all subscribers
      const callbacks = this.subscribers.get(symbol);
      if (callbacks) {
        callbacks.forEach(callback => callback(stock));
      }
    }
  }

  private reconnect(symbols: string[]) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    setTimeout(() => {
      console.log(`Reconnecting... Attempt ${this.reconnectAttempts}`);
      this.connect(symbols);
    }, this.reconnectDelay);
  }

  public subscribe(ticker: string, callback: (data: Stock) => void) {
    if (!this.subscribers.has(ticker)) {
      this.subscribers.set(ticker, new Set());
    }
    this.subscribers.get(ticker)!.add(callback);

    // If we have cached data, send it immediately
    const cached = this.prices.get(ticker);
    if (cached) {
      callback(cached);
    }

    // Connect if not already connected
    const allTickers = Array.from(this.subscribers.keys());
    if (this.ws?.readyState !== WebSocket.OPEN) {
      this.connect(allTickers);
    }
  }

  public unsubscribe(ticker: string, callback: (data: Stock) => void) {
    const callbacks = this.subscribers.get(ticker);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.subscribers.delete(ticker);
      }
    }

    // Close connection if no subscribers
    if (this.subscribers.size === 0 && this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  public getCurrentPrice(ticker: string): Stock | undefined {
    return this.prices.get(ticker);
  }

  public disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.subscribers.clear();
    this.prices.clear();
  }
}

// Singleton instance
export const cryptoWebSocketService = new CryptoWebSocketService();

