# 🚀 XChange - Social Finance Platform

> **Where Market Chatter Becomes Market Insight**

XChange is a cutting-edge financial trading platform that leverages **Grok AI** to transform social media sentiment into actionable trading intelligence. Built for the modern trader who wants to stay ahead of market movements by analyzing real-time social media data.

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Grok AI](https://img.shields.io/badge/Grok_AI-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.ai/)

---

## ✨ Features

### 🤖 AI Trading Assistant

- **Natural Language Trading**: Execute trades through conversational commands like "Buy $3,000 of AAPL" or "Invest $5k based on market sentiment"
- **Market Sentiment Analysis**: Real-time sentiment scoring from social media with bullish/bearish/neutral percentages
- **Automated Trade Execution**: AI analyzes market conditions and executes trades automatically
- **Sector Heatmaps**: Visual representation of sector performance on demand (stocks & crypto)

### 📊 Paper Trading

- **$100,000 Starting Balance**: Practice trading with virtual money
- **Multi-Asset Support**: Trade stocks, crypto, and options seamlessly
- **Real-Time Portfolio Tracking**: Live price updates and P&L calculations
- **One-Click Selling**: Quick sell buttons directly from portfolio table
- **Trade History**: Complete transaction log with timestamps

### 📈 Unusual Options Flow

- **Real-Time Flow Detection**: Track unusual options activity from X/Twitter
- **Image Analysis**: AI-powered OCR extracts tradeable data from screenshots
- **Direct Trading**: Click-to-trade options directly from flow analysis
- **2-Day Historical Data**: Comprehensive flow tracking from @FL0WG0D
- **Detailed Analysis**: Strike prices, expiration dates, premiums, and volumes

### 💰 Earnings Intelligence

- **Automated Earnings Extraction**: Parse earnings data from @earnings_guy tweets
- **Image Parsing**: Extract structured data from earnings charts and images using Grok AI
- **Multi-Tweet Analysis**: Aggregate insights from multiple earnings posts
- **Real-Time Updates**: Latest earnings reports as they're posted
- **Structured Data**: EPS, revenue, surprise percentages automatically extracted

### 📱 Social Media Integration

- **X/Twitter Feed**: Curated market-moving tweets from influencers
- **Impact Filtering**: AI filters for high-impact, market-relevant content
- **Influencer Tracking**: Monitor key market movers (Elon Musk, Bloomberg, CNBC, etc.)
- **Sentiment Scoring**: Real-time bullish/bearish/neutral analysis
- **Recent Focus**: Prioritizes tweets from last 6 hours for actionable insights

---

## 🛠️ Tech Stack

### Frontend

- **React 18** with TypeScript for type-safe UI development
- **Vite** for blazing-fast development and hot module replacement
- **React Router** for seamless navigation
- **CSS3** with custom design system and dark theme

### Backend

- **Node.js** with Express for RESTful API
- **Grok AI API** for natural language processing and market analysis
- **Twitter/X API** for social media data integration
- **Tesseract.js** for OCR and image analysis
- **SQL.js** for local database storage (zero-setup SQLite)

### AI & ML

- **Grok AI** (X's Generative AI) for:
  - Market sentiment analysis
  - Natural language trade parsing
  - Earnings data extraction from images
  - Content filtering and relevance scoring
  - Sector heatmap generation

---

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+** and npm
- **Grok API key** from [x.ai](https://x.ai/api)
- (Optional) **Twitter/X API credentials** for enhanced tweet fetching

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/yourusername/xchange.git
cd xchange
```

2. **Install frontend dependencies**

```bash
npm install
```

3. **Install backend dependencies**

```bash
cd server
npm install
cd ..
```

4. **Set up environment variables**

Create `server/.env`:

```env
# Required
GROK_API_KEY=your_grok_api_key_here

# Optional: Twitter/X API (Bearer Token preferred)
TWITTER_BEARER_TOKEN=your_twitter_bearer_token_here

# Optional: Twitter OAuth (alternative)
TWITTER_CONSUMER_KEY=your_consumer_key
TWITTER_CONSUMER_SECRET=your_consumer_secret
TWITTER_ACCESS_TOKEN=your_access_token
TWITTER_ACCESS_TOKEN_SECRET=your_access_token_secret

# Server Configuration
PORT=3001
```

5. **Start the development servers**

**Terminal 1 (Backend):**

```bash
cd server
npm run dev
```

**Terminal 2 (Frontend):**

```bash
npm run dev
```

6. **Open your browser**

```
http://localhost:5173
```

---

## 📖 Usage Guide

### AI Trading Assistant

Simply chat with the AI to execute trades:

```
"Buy $3,000 of AAPL"
"Invest $5k based on current market sentiment"
"Show me a heatmap of the technology sector"
"What's the sentiment on TSLA?"
"Sell 10 shares of NVDA"
```

The AI will:

- Parse your command
- Analyze market conditions
- Execute trades automatically
- Provide trade confirmations

### Paper Trading

1. Navigate to the **Papertrade** tab
2. Select asset type (Stock, Crypto, or Option)
3. Enter ticker, quantity/amount, and price
4. Use "Fetch Price" to get latest market price
5. Click **Buy** or **Sell**
6. Monitor your portfolio in real-time
7. Click **Sell** button in portfolio table for quick exits

### Unusual Flow Trading

1. Go to **Unusual Flow** tab
2. Browse recent options flow activity (last 2 days)
3. Click on any flow to see detailed analysis
4. Review strike price, expiration, and premium
5. Click **Buy** or **Sell** to execute trades directly
6. Trades appear in your portfolio automatically

### Earnings Intelligence

1. Earnings data is automatically extracted from @earnings_guy
2. View latest earnings reports in the earnings section
3. See EPS beats/misses, revenue figures, and surprise percentages
4. Browse original tweets with earnings charts

---

## 🏗️ Project Structure

```
xchange/
├── src/
│   ├── components/              # React components
│   │   ├── AIChat.tsx          # AI trading assistant
│   │   ├── Papertrade.tsx      # Paper trading interface
│   │   ├── UnusualFlowFeed.tsx # Options flow feed
│   │   ├── EarningsSummary.tsx # Earnings display
│   │   ├── SectorHeatmap.tsx   # Sector visualization
│   │   └── ...
│   ├── pages/                  # Page components
│   │   ├── DashboardPage.tsx   # Main dashboard
│   │   ├── LandingPage.tsx    # Landing/auth page
│   │   └── ...
│   ├── context/                # React context (state management)
│   │   └── AppContext.tsx     # Global app state
│   ├── services/               # API services
│   │   ├── grokApi.ts         # Grok AI integration
│   │   └── stockApi.ts        # Stock data
│   └── types/                  # TypeScript definitions
├── server/
│   ├── services/               # Backend services
│   │   ├── grokService.js      # Grok AI integration
│   │   ├── chatService.js     # AI chat logic
│   │   ├── twitterService.js  # Twitter API wrapper
│   │   └── imageAnalysisService.js # OCR & image analysis
│   ├── database/               # Database layer
│   │   └── db.js              # SQL.js database
│   └── server.js               # Express server
├── package.json                # Frontend dependencies
└── README.md                   # This file
```

---

## 🔌 API Endpoints

### Chat & AI

- `POST /api/chat` - Chat with AI trading assistant
- `POST /api/analyze` - Analyze single stock with sentiment
- `POST /api/analyze/batch` - Analyze multiple stocks in parallel

### Trading

- `GET /api/positions` - Get user positions
- `POST /api/positions` - Add/update position
- `GET /api/trades` - Get trade history
- `POST /api/trades` - Record trade
- `GET /api/cash-balance` - Get cash balance
- `PUT /api/cash-balance` - Update cash balance

### Market Data

- `GET /api/yahoo-finance` - Get stock/crypto quotes (multiple symbols)
- `GET /api/yahoo/quote/:ticker` - Get single stock quote
- `GET /api/yahoo/search` - Search for stocks
- `GET /api/earnings/recent` - Get recent earnings from @earnings_guy

### Social Media

- `GET /api/twitter/users` - Get tweets from specific users
- `POST /api/twitter/search` - Search tweets

### Options Flow

- `POST /api/flow/analyze-image` - Analyze options flow image with OCR

---

## 🎯 Key Features in Detail

### AI-Powered Trade Execution

The AI assistant can:

- Parse natural language trade commands with high accuracy
- Analyze market sentiment before executing trades
- Diversify investments across multiple assets automatically
- Execute trades based on user intent ("invest $5k wherever you think best")
- Handle fractional quantities for crypto trades

### Real-Time Sentiment Analysis

- Processes thousands of tweets per minute
- Filters for market-impactful content (earnings, policy changes, major news)
- Scores sentiment (bullish/bearish/neutral) with percentages
- Prioritizes recent, high-engagement posts (last 6 hours)
- Tracks key market drivers and trending topics

### Earnings Intelligence

- Monitors @earnings_guy for latest earnings reports
- Extracts structured data from tweet images using Grok AI
- Parses EPS (actual vs estimate), revenue, surprise percentages
- Aggregates multiple tweets per company for comprehensive view
- Displays original tweets with earnings charts

### Unusual Options Flow

- Tracks @FL0WG0D for unusual options activity
- Analyzes flow images with OCR + AI
- Extracts ticker, strike, expiration, premium, volume
- Enables one-click trading from flow analysis
- Shows 2 days of historical flow data

---

## 🔧 Troubleshooting

### Port Already in Use

```bash
# Kill process on port 3001
lsof -ti:3001 | xargs kill

# Kill process on port 5173
lsof -ti:5173 | xargs kill
```

### API Key Issues

- Ensure `.env` file is in `server/` directory
- No quotes around API key value
- No spaces around `=` sign
- Restart backend server after changes

### Module Not Found

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# In server directory
cd server
rm -rf node_modules package-lock.json
npm install
```

### Frontend Can't Connect to Backend

- Verify backend is running on port 3001
- Check `vite.config.ts` proxy settings
- Ensure CORS is enabled in backend

---

## 🚨 Common Mistakes

1. ❌ Running `npm install` in wrong directory

   - Frontend: Root directory
   - Backend: `server/` directory

2. ❌ Forgetting to start backend server

   - Both servers must run simultaneously

3. ❌ Wrong API key format in `.env`

   - Use: `GROK_API_KEY=key` ✅
   - Not: `GROK_API_KEY="key"` ❌

4. ❌ `.env` file in wrong location

   - Must be in `server/.env`

5. ❌ Using old Node.js version
   - Requires Node.js 18+

---

## 📝 Environment Variables

### Required

- `GROK_API_KEY` - Your Grok API key from [x.ai](https://x.ai/api)

### Optional

- `TWITTER_BEARER_TOKEN` - Twitter Bearer Token (recommended)
- `TWITTER_CONSUMER_KEY` - Twitter OAuth Consumer Key
- `TWITTER_CONSUMER_SECRET` - Twitter OAuth Consumer Secret
- `TWITTER_ACCESS_TOKEN` - Twitter OAuth Access Token
- `TWITTER_ACCESS_TOKEN_SECRET` - Twitter OAuth Access Token Secret
- `PORT` - Server port (default: 3001)

---

## 🎨 Design Features

- **Dark Theme**: Modern dark UI with X (Twitter) inspired design
- **Responsive Layout**: Works on desktop, tablet, and mobile
- **Real-Time Updates**: Live price updates and sentiment changes
- **Smooth Animations**: Polished transitions and interactions
- **Accessible**: Keyboard navigation and screen reader support

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 🙏 Acknowledgments

- **Grok AI** by X (formerly Twitter) for powerful natural language processing
- **Yahoo Finance** for free market data
- **Twitter/X API** for social media integration
- **@earnings_guy** and **@FL0WG0D** for valuable market insights

---

## 📧 Contact & Support

- **Project Link**: [https://github.com/BinayakJha/Xchange](https://github.com/BinayakJha/Xchange)
- **Issues**: [GitHub Issues](https://github.com/BinayakJha/Xchange/issues)

---

<div align="center">

**Built with ❤️ using Grok AI**

⭐ Star this repo if you find it helpful!

**Where Market Chatter Becomes Market Insight** 🚀

</div>
