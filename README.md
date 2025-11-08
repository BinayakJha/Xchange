# XFinance - Social Finance Platform

A modern, real-time finance platform that combines stock/crypto trading, social media sentiment analysis, and AI-powered market insights. Built with React, TypeScript, and Grok AI.

## 🚀 Quick Start Guide

This guide will help you set up and run XFinance on your laptop from scratch.

---

## 📋 Prerequisites

Before you begin, make sure you have the following installed:

1. **Node.js** (version 18 or higher)

   - Download from: https://nodejs.org/
   - Verify installation: Open terminal/command prompt and run:
     ```bash
     node --version
     npm --version
     ```
   - You should see version numbers (e.g., `v18.17.0` and `9.6.7`)

2. **Git** (optional, if cloning from repository)

   - Download from: https://git-scm.com/

3. **Grok API Key** (required for AI features)
   - Sign up at: https://x.ai/api
   - Get your API key from the dashboard

---

## 📦 Installation Steps

### Step 1: Get the Project

If you have the project folder, navigate to it:

```bash
cd Xfinance
```

If you're cloning from a repository:

```bash
git clone <repository-url>
cd Xfinance
```

### Step 2: Install Frontend Dependencies

Open a terminal in the project root directory and run:

```bash
npm install
```

This will install all React and frontend dependencies. Wait for it to complete (may take 1-2 minutes).

### Step 3: Install Backend Dependencies

Open a **new terminal window** (keep the first one open) and navigate to the server folder:

```bash
cd server
npm install
```

Wait for installation to complete.

### Step 4: Set Up Environment Variables

1. In the `server` folder, create a new file named `.env`:

   - On Windows: Right-click → New → Text Document → Rename to `.env` (make sure to remove `.txt` extension)
   - On Mac/Linux: In terminal, run: `touch .env`

2. Open the `.env` file in a text editor and add:

```env
# Required: Grok AI API Key
GROK_API_KEY=your_grok_api_key_here

# Server Port (default: 3001)
PORT=3001

# Optional: Twitter/X API (if you want to use Twitter API instead of Grok for tweets)
# TWITTER_BEARER_TOKEN=your_twitter_bearer_token_here
```

3. Replace `your_grok_api_key_here` with your actual Grok API key from https://x.ai/api

**Important:**

- Don't use quotes around the API key
- Don't add spaces around the `=` sign
- Keep this file secret - never commit it to Git!

---

## 🏃 Running the Application

You need to run **two servers** simultaneously: the frontend (React) and the backend (Express).

### Option 1: Two Terminal Windows (Recommended)

**Terminal 1 - Backend Server:**

```bash
cd server
npm run dev
```

You should see:

```
Server running on http://localhost:3001
```

**Terminal 2 - Frontend Server:**

```bash
# Make sure you're in the root Xfinance directory (not in server/)
npm run dev
```

You should see:

```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
```

### Option 2: Using a Terminal Manager (Advanced)

If you have `tmux` or `screen`, you can run both in split panes.

---

## 🌐 Accessing the Application

Once both servers are running:

1. Open your web browser
2. Navigate to: **http://localhost:5173**
3. You should see the XFinance landing page!

---

## ✨ Features Overview

### 📊 Stock & Crypto Trading

- **Real-time prices** from Yahoo Finance (free, no API key needed)
- **Paper trading** - practice trading with virtual money
- **Stock search** - find any stock by ticker or company name
- **Crypto support** - Bitcoin, Ethereum, and more

### 🤖 AI Trading Assistant

- Chat with AI to:
  - Buy/sell stocks: "Buy $1000 worth of AAPL"
  - Get sentiment: "What's the sentiment on TSLA?"
  - View positions: "Show me my positions"
  - **Sector heatmaps**: "Show me a heatmap of the technology sector"
  - **Crypto heatmaps**: "Visualize the DeFi sector"

### 📱 Social Feed

- Real-time tweets from market influencers
- Filtered to show only market-impactful content
- Recent tweets (last 6 hours) prioritized
- Sentiment analysis for each stock

### 📈 Market Sentiment

- AI-powered sentiment analysis
- Bullish/Bearish/Neutral percentages
- Key market drivers
- Top insights from recent tweets

---

## 🔧 Troubleshooting

### Problem: "Cannot find module" errors

**Solution:**

```bash
# In root directory
rm -rf node_modules package-lock.json
npm install

# In server directory
cd server
rm -rf node_modules package-lock.json
npm install
```

### Problem: Port 3001 already in use

**Solution:** Change the port in `server/.env`:

```env
PORT=3002
```

Then update `vite.config.ts` (if it exists) to proxy to the new port.

### Problem: "GROK_API_KEY is not configured"

**Solution:**

1. Make sure you created `.env` file in the `server` folder
2. Check that the file is named exactly `.env` (not `.env.txt`)
3. Verify the API key is correct (no quotes, no spaces)
4. Restart the backend server

### Problem: Frontend can't connect to backend

**Solution:**

1. Make sure backend is running on port 3001
2. Check `vite.config.ts` has correct proxy settings:
   ```js
   server: {
     proxy: {
       '/api': 'http://localhost:3001'
     }
   }
   ```

### Problem: "EADDRINUSE: address already in use"

**Solution:** Another process is using the port. Find and kill it:

```bash
# On Mac/Linux
lsof -ti:3001 | xargs kill
lsof -ti:5173 | xargs kill

# On Windows
netstat -ano | findstr :3001
taskkill /PID <PID_NUMBER> /F
```

### Problem: Tweets not showing

**Solution:**

- Make sure Grok API key is valid
- Check browser console for errors
- Verify backend server is running
- Wait a few seconds - tweets load asynchronously

### Problem: Stock prices not loading

**Solution:**

- Yahoo Finance API is free but may have rate limits
- Wait a moment and refresh
- Check internet connection
- Prices update every 30 seconds automatically

---

## 📁 Project Structure

```
Xfinance/
├── src/                    # Frontend React code
│   ├── components/         # UI components
│   ├── context/            # State management
│   ├── pages/              # Page components
│   ├── services/           # API services
│   └── types/              # TypeScript types
├── server/                 # Backend Express server
│   ├── services/           # Grok API services
│   └── server.js           # Main server file
├── package.json            # Frontend dependencies
└── README.md              # This file
```

---

## 🛠️ Development Commands

### Frontend (Root Directory)

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
```

### Backend (Server Directory)

```bash
cd server
npm run dev          # Start with auto-reload
npm start            # Start production server
```

---

## 🔑 API Keys & Services

### Required

- **Grok API Key**: Get from https://x.ai/api
  - Used for: AI chat, sentiment analysis, tweet fetching

### Free (No API Key Needed)

- **Yahoo Finance**: Stock prices and quotes
- **Binance WebSocket**: Real-time crypto prices

### Optional

- **Twitter/X API**: Alternative tweet source (not required - Grok handles tweets)

---

## 🎯 What Works Without Backend

The frontend will work partially without the backend:

- ✅ Stock/crypto price viewing
- ✅ Stock search
- ✅ Watchlist management
- ✅ Paper trading
- ❌ AI chat assistant
- ❌ Sentiment analysis
- ❌ Tweet feed
- ❌ Market insights

**To get full functionality, you need the backend running with a valid Grok API key.**

---

## 📝 Environment Variables Reference

### Server `.env` File

```env
# REQUIRED
GROK_API_KEY=your_key_here

# OPTIONAL
PORT=3001
TWITTER_BEARER_TOKEN=your_token_here
```

---

## 🚨 Common Mistakes to Avoid

1. ❌ **Running npm install in wrong directory**

   - Frontend: Run in root `Xfinance/` folder
   - Backend: Run in `Xfinance/server/` folder

2. ❌ **Forgetting to start backend server**

   - Both servers must run simultaneously

3. ❌ **Wrong API key format**

   - Don't use quotes: `GROK_API_KEY="key"` ❌
   - Use: `GROK_API_KEY=key` ✅

4. ❌ **`.env` file in wrong location**

   - Must be in `server/.env`, not root folder

5. ❌ **Using old Node.js version**
   - Requires Node.js 18+ (check with `node --version`)

---

## 💡 Tips

- **Keep both terminals open** - you'll need to see logs from both servers
- **Check terminal output** - errors usually show helpful messages
- **Browser console** - Press F12 to see frontend errors
- **API rate limits** - Grok API has rate limits, so don't spam requests
- **First load** - May take 10-30 seconds to fetch initial data

---

## 🆘 Getting Help

If you're stuck:

1. **Check the terminal output** - errors are usually shown there
2. **Check browser console** (F12 → Console tab)
3. **Verify all prerequisites** are installed correctly
4. **Make sure both servers are running**
5. **Check `.env` file** is set up correctly

---

## 📄 License

MIT License - feel free to use and modify!

---

## 🎉 You're All Set!

Once both servers are running and you see the app in your browser, you can:

1. **Add stocks to watchlist** - Search and add your favorite stocks
2. **Try the AI assistant** - Ask it to buy stocks or show heatmaps
3. **View market sentiment** - See real-time sentiment analysis
4. **Paper trade** - Practice trading without real money
5. **Explore sectors** - Ask for heatmaps of different sectors

Enjoy trading! 📈🚀
