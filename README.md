# XFinance - Social Finance Platform

A modern, animated, and responsive React frontend for a "X (Twitter) for finance" web application. The app mirrors X's design and functionality while focusing entirely on finance, stocks, and trading.

## Features

### 🏠 Landing/Signup Page
- Clean, minimalistic design with X/Twitter-inspired branding
- Sign up options: Google, X, or email
- Smooth transitions to main dashboard

### 📊 Watchlist Interface
- **Popular Stocks**: Browse and add popular stocks to your watchlist
- **Stock Search**: Real-time search with **real stock prices** from Finnhub API
  - Search by ticker or company name
  - Shows current price, change, and change percentage
  - Live data updates
- **Watchlist Management**: Add/remove stocks with smooth animations

### 🔍 Analysis Backend
- **Real Grok AI Integration**: Analyzes stocks using Grok API and X/Twitter data
- Comprehensive sentiment analysis with social media trends
- Batch analysis for multiple stocks
- Detailed insights including market sentiment, trends, and recommendations

### 📱 Main Dashboard
- **X-Style Feed**: Real-time feed of tweets affecting your watchlist stocks
  - User profiles, timestamps, tweet content
  - Stock ticker mentions with impact indicators
  - Like and retweet interactions
- **Left Sidebar**: Market sentiment analysis for each watchlist stock
  - Bullish/Bearish/Neutral percentages
  - Real-time sentiment updates
- **Right Sidebar**: 
  - Unusual flows (options/volume activity)
  - Papertrade suggestions with confidence scores

### 💰 Papertrading
- Virtual portfolio management
- **Stock Trading**: Buy/Sell stocks with real prices
- **Options Trading**: Buy call/put options with strike prices and expirations
- Real-time position tracking with P&L
- Portfolio summary and equity tracking

## Tech Stack

- **React 18** with TypeScript
- **Vite** for build tooling
- **React Router** for navigation
- **Context API** for state management
- **Yahoo Finance API** for real stock data (free, no API key required)
- **Binance WebSocket** for real-time crypto prices (free, no API key required)
- **Grok API** for AI-powered sentiment analysis (requires API key)
- **Express.js** backend server for Grok API integration
- **CSS3** with custom animations and responsive design

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser to `http://localhost:5173`

**Stock & Crypto Data**: No API key required! Uses Yahoo Finance and Binance WebSocket for free data.

**Sentiment Analysis**: Requires Grok API key. See [Backend Setup](#backend-setup) below.

### Build for Production

```bash
npm run build
```

The production build will be in the `dist` directory.

### Backend Setup (for Grok AI Analysis)

1. Navigate to the server directory:
```bash
cd server
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```bash
cp .env.example .env
```

4. Add your Grok API key to `.env`:
```
GROK_API_KEY=your_grok_api_key_here
PORT=3001
```

5. Start the backend server:
```bash
npm run dev
```

The backend server will run on `http://localhost:3001` and handle Grok API requests.

**Note**: The frontend will work without the backend, but the Analysis page will show an error message. Stock and crypto data work independently without the backend.

## Stock Data Source

This app uses **Yahoo Finance's public API endpoints** for stock data:
- **Free**: No API key required
- **No sign-up needed**: Works out of the box
- **Features**: Real-time quotes, stock search, company names

The app includes:
- Automatic rate limiting (batched requests)
- Smart caching (1-minute cache) to reduce API calls
- Fallback to mock data if API fails
- Batch processing to avoid overwhelming the API

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── Feed.tsx
│   ├── Header.tsx
│   ├── Papertrade.tsx
│   ├── SentimentSidebar.tsx
│   ├── StockSearch.tsx
│   ├── TweetCard.tsx
│   └── ...
├── context/            # React Context for state management
│   └── AppContext.tsx
├── data/               # Mock data
│   └── mockData.ts
├── hooks/              # Custom React hooks
│   └── useStockSearch.ts
├── services/           # API services
│   └── stockApi.ts
├── pages/              # Page components
│   ├── DashboardPage.tsx
│   ├── LandingPage.tsx
│   ├── WatchlistPage.tsx
│   └── AnalysisPage.tsx
├── types/              # TypeScript interfaces
│   └── index.ts
├── App.tsx             # Main app component with routing
├── App.css             # Global styles
└── main.tsx            # Entry point
```

## Key Features

### Real Stock Data
- **Live Search**: Search for any stock ticker or company name
- **Real Prices**: Current stock prices, changes, and percentages
- **Auto Updates**: Prices update every 30 seconds
- **Caching**: Smart caching to minimize API calls

### Responsive Design
- Mobile, tablet, and desktop breakpoints
- Adaptive layouts for all screen sizes
- Touch-friendly interactions

### Animations
- Smooth fade-in/slide-in transitions
- Hover effects and micro-interactions
- Loading animations and progress indicators
- Real-time updates with animated transitions

### State Management
- Centralized state via React Context
- Easy to swap mock data with real API calls
- Persistent state across navigation

## Customization

### Styling
Global CSS variables are defined in `src/App.css`:
- `--bg-primary`, `--bg-secondary`: Background colors
- `--accent-blue`, `--accent-green`, `--accent-red`: Accent colors
- `--text-primary`, `--text-secondary`: Text colors

### Adding Real API Integration
1. Create API service files in `src/services/`
2. Replace mock data calls in `AppContext.tsx`
3. Update components to handle loading/error states

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## License

MIT
