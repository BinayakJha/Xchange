import { Stock, Tweet, UnusualFlow, PapertradeSuggestion, Option, OptionSuggestion } from '../types';

export const popularStocks: Stock[] = [
  { ticker: 'AAPL', name: 'Apple Inc.', price: 175.43, change: 2.15, changePercent: 1.24, type: 'stock' },
  { ticker: 'MSFT', name: 'Microsoft Corp.', price: 378.85, change: -1.23, changePercent: -0.32, type: 'stock' },
  { ticker: 'GOOGL', name: 'Alphabet Inc.', price: 142.56, change: 3.45, changePercent: 2.48, type: 'stock' },
  { ticker: 'AMZN', name: 'Amazon.com Inc.', price: 151.94, change: 1.87, changePercent: 1.25, type: 'stock' },
  { ticker: 'TSLA', name: 'Tesla Inc.', price: 248.50, change: -5.20, changePercent: -2.05, type: 'stock' },
  { ticker: 'NVDA', name: 'NVIDIA Corp.', price: 485.09, change: 12.34, changePercent: 2.61, type: 'stock' },
  { ticker: 'META', name: 'Meta Platforms Inc.', price: 329.71, change: 4.56, changePercent: 1.40, type: 'stock' },
  { ticker: 'SPY', name: 'SPDR S&P 500 ETF', price: 456.78, change: 1.23, changePercent: 0.27, type: 'stock' },
];

export const popularCrypto: Stock[] = [
  { ticker: 'BTC-USD', name: 'Bitcoin', price: 43250.00, change: 1250.50, changePercent: 2.98, type: 'crypto' },
  { ticker: 'ETH-USD', name: 'Ethereum', price: 2650.75, change: -45.25, changePercent: -1.68, type: 'crypto' },
  { ticker: 'BNB-USD', name: 'Binance Coin', price: 315.20, change: 8.50, changePercent: 2.77, type: 'crypto' },
  { ticker: 'SOL-USD', name: 'Solana', price: 98.45, change: 3.20, changePercent: 3.36, type: 'crypto' },
  { ticker: 'ADA-USD', name: 'Cardano', price: 0.52, change: 0.02, changePercent: 4.00, type: 'crypto' },
  { ticker: 'XRP-USD', name: 'Ripple', price: 0.62, change: -0.01, changePercent: -1.59, type: 'crypto' },
  { ticker: 'DOGE-USD', name: 'Dogecoin', price: 0.085, change: 0.002, changePercent: 2.41, type: 'crypto' },
  { ticker: 'MATIC-USD', name: 'Polygon', price: 0.89, change: 0.03, changePercent: 3.49, type: 'crypto' },
];

export const allStocks: Stock[] = [
  ...popularStocks,
  { ticker: 'JPM', name: 'JPMorgan Chase', price: 158.32, change: 0.45, changePercent: 0.29 },
  { ticker: 'V', name: 'Visa Inc.', price: 267.89, change: -0.12, changePercent: -0.04 },
  { ticker: 'JNJ', name: 'Johnson & Johnson', price: 162.45, change: 0.78, changePercent: 0.48 },
  { ticker: 'WMT', name: 'Walmart Inc.', price: 168.23, change: 1.34, changePercent: 0.80 },
  { ticker: 'PG', name: 'Procter & Gamble', price: 156.78, change: -0.23, changePercent: -0.15 },
  { ticker: 'MA', name: 'Mastercard Inc.', price: 425.67, change: 2.34, changePercent: 0.55 },
  { ticker: 'DIS', name: 'Walt Disney Co.', price: 95.43, change: -1.23, changePercent: -1.27 },
  { ticker: 'NFLX', name: 'Netflix Inc.', price: 485.32, change: 5.67, changePercent: 1.18 },
];

export const mockTweets: Tweet[] = [
  {
    id: '1',
    userId: 'user1',
    username: 'finance_guru',
    displayName: 'Finance Guru',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=finance_guru',
    content: 'Just analyzed $AAPL earnings. Strong iPhone sales and services growth. Bullish on this one! 📈',
    timestamp: new Date(Date.now() - 1000 * 60 * 5),
    mentionedStocks: ['AAPL'],
    impact: 'high',
    likes: 1243,
    retweets: 89,
  },
  {
    id: '2',
    userId: 'user2',
    username: 'trading_pro',
    displayName: 'Trading Pro',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=trading_pro',
    content: '$TSLA showing weakness after delivery numbers. Might be a good short opportunity. What do you think?',
    timestamp: new Date(Date.now() - 1000 * 60 * 15),
    mentionedStocks: ['TSLA'],
    impact: 'medium',
    likes: 567,
    retweets: 34,
  },
  {
    id: '3',
    userId: 'user3',
    username: 'tech_analyst',
    displayName: 'Tech Analyst',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=tech_analyst',
    content: '$NVDA continues to dominate AI chip market. Data center revenue up 200% YoY. This is just the beginning! 🚀',
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
    mentionedStocks: ['NVDA'],
    impact: 'high',
    likes: 2341,
    retweets: 156,
  },
  {
    id: '4',
    userId: 'user4',
    username: 'market_watch',
    displayName: 'Market Watch',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=market_watch',
    content: 'Fed meeting minutes released. $SPY might see volatility. Keep an eye on bond yields.',
    timestamp: new Date(Date.now() - 1000 * 60 * 45),
    mentionedStocks: ['SPY'],
    impact: 'medium',
    likes: 892,
    retweets: 67,
  },
  {
    id: '5',
    userId: 'user5',
    username: 'options_trader',
    displayName: 'Options Trader',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=options_trader',
    content: 'Unusual options activity in $META. Large call buying suggests institutional interest. Worth watching!',
    timestamp: new Date(Date.now() - 1000 * 60 * 60),
    mentionedStocks: ['META'],
    impact: 'high',
    likes: 1456,
    retweets: 98,
  },
];

export const mockUnusualFlows: UnusualFlow[] = [
  {
    id: '1',
    ticker: 'AAPL',
    type: 'call',
    description: 'Large call buying - $175 strike expiring Friday',
    value: 2500000,
    timestamp: new Date(Date.now() - 1000 * 60 * 10),
  },
  {
    id: '2',
    ticker: 'TSLA',
    type: 'put',
    description: 'Unusual put volume - $240 strike',
    value: 1800000,
    timestamp: new Date(Date.now() - 1000 * 60 * 25),
  },
  {
    id: '3',
    ticker: 'NVDA',
    type: 'volume',
    description: 'Volume spike - 3x average daily volume',
    value: 45000000,
    timestamp: new Date(Date.now() - 1000 * 60 * 40),
  },
  {
    id: '4',
    ticker: 'META',
    type: 'call',
    description: 'Institutional call buying - $330 strike',
    value: 3200000,
    timestamp: new Date(Date.now() - 1000 * 60 * 55),
  },
];

export const mockPapertradeSuggestions: PapertradeSuggestion[] = [
  {
    id: '1',
    ticker: 'AAPL',
    action: 'buy',
    reason: 'Strong earnings momentum and positive sentiment',
    confidence: 85,
  },
  {
    id: '2',
    ticker: 'NVDA',
    action: 'buy',
    reason: 'AI chip demand surge and institutional buying',
    confidence: 92,
  },
  {
    id: '3',
    ticker: 'TSLA',
    action: 'sell',
    reason: 'Delivery numbers below expectations',
    confidence: 68,
  },
];

export const mockOptionSuggestions: OptionSuggestion[] = [
  {
    id: 'opt1',
    ticker: 'AAPL',
    strike: 180,
    expiration: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    optionType: 'call',
    reason: 'High IV crush opportunity after earnings, bullish momentum',
    confidence: 88,
    premium: 2.45,
    targetPrice: 185,
  },
  {
    id: 'opt2',
    ticker: 'NVDA',
    strike: 500,
    expiration: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
    optionType: 'call',
    reason: 'Strong AI trend, potential breakout above $500',
    confidence: 92,
    premium: 8.50,
    targetPrice: 520,
  },
  {
    id: 'opt3',
    ticker: 'TSLA',
    strike: 240,
    expiration: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    optionType: 'put',
    reason: 'Support break, bearish momentum after delivery miss',
    confidence: 75,
    premium: 3.20,
    targetPrice: 230,
  },
  {
    id: 'opt4',
    ticker: 'META',
    strike: 340,
    expiration: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), // 21 days
    optionType: 'call',
    reason: 'Unusual call buying detected, potential move higher',
    confidence: 82,
    premium: 5.75,
    targetPrice: 355,
  },
  {
    id: 'opt5',
    ticker: 'SPY',
    strike: 460,
    expiration: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
    optionType: 'call',
    reason: 'Market momentum, low IV relative to historical',
    confidence: 70,
    premium: 2.10,
    targetPrice: 465,
  },
];

// Helper function to generate available options for a stock
export const getAvailableOptions = (ticker: string, stockPrice: number): Option[] => {
  const strikes = [];
  const baseStrike = Math.round(stockPrice / 5) * 5; // Round to nearest $5
  
  // Generate strikes around current price
  for (let i = -4; i <= 4; i++) {
    strikes.push(baseStrike + (i * 5));
  }

  const options: Option[] = [];
  const expirations = [
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),   // 7 days
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),  // 30 days
  ];

  strikes.forEach((strike) => {
    expirations.forEach((expiration) => {
      const daysToExp = Math.ceil((expiration.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      const moneyness = strike / stockPrice;
      const isITM = (moneyness < 1.05 && moneyness > 0.95);
      
      // Calculate premium based on moneyness and time to expiration
      let premium = Math.abs(stockPrice - strike) * 0.1;
      if (isITM) premium += stockPrice * 0.02;
      premium += (daysToExp / 30) * stockPrice * 0.01;
      premium = Math.max(0.50, premium); // Minimum premium

      options.push({
        ticker,
        strike,
        expiration,
        optionType: strike < stockPrice ? 'call' : 'put',
        premium: Math.round(premium * 100) / 100,
        volume: Math.floor(Math.random() * 1000) + 100,
        openInterest: Math.floor(Math.random() * 5000) + 500,
        impliedVolatility: 20 + Math.random() * 30,
      });

      // Add opposite type for ATM strikes
      if (isITM) {
        options.push({
          ticker,
          strike,
          expiration,
          optionType: strike < stockPrice ? 'put' : 'call',
          premium: Math.round(premium * 0.8 * 100) / 100,
          volume: Math.floor(Math.random() * 800) + 50,
          openInterest: Math.floor(Math.random() * 3000) + 300,
          impliedVolatility: 20 + Math.random() * 30,
        });
      }
    });
  });

  return options;
};

