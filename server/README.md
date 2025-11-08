# XFinance Backend Server

Backend server for XFinance that integrates with Grok API for stock sentiment analysis.

## Setup

1. Install dependencies:
```bash
cd server
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Add your API keys to `.env`:
```bash
# Required: Grok AI API key
GROK_API_KEY=your_grok_api_key_here

# Optional: Twitter/X API (Bearer Token preferred)
TWITTER_BEARER_TOKEN=your_twitter_bearer_token_here

# Optional: Twitter/X API OAuth (alternative to Bearer Token)
TWITTER_CONSUMER_KEY=your_twitter_consumer_key_here
TWITTER_CONSUMER_SECRET=your_twitter_consumer_secret_here
TWITTER_ACCESS_TOKEN=your_twitter_access_token_here
TWITTER_ACCESS_TOKEN_SECRET=your_twitter_access_token_secret_here

# Server port (default: 3001)
PORT=3001
```

4. Start the server:
```bash
npm run dev
```

The server will run on `http://localhost:3001`

## API Endpoints

### POST /api/analyze
Analyze a single stock using Grok AI.

**Request:**
```json
{
  "stockInput": "NVDA"
}
```

**Response:**
```json
{
  "success": true,
  "analysis": "Full analysis text...",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### POST /api/analyze/batch
Analyze multiple stocks in parallel.

**Request:**
```json
{
  "tickers": ["NVDA", "AAPL", "TSLA"]
}
```

**Response:**
```json
{
  "success": true,
  "analyses": [
    {
      "ticker": "NVDA",
      "analysis": "Full analysis...",
      "success": true
    }
  ],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Environment Variables

### Required
- `GROK_API_KEY`: Your Grok API key from [x.ai](https://x.ai/api) - Required for sentiment analysis

### Optional (Twitter/X API)
- `TWITTER_BEARER_TOKEN`: Twitter Bearer Token (recommended for read-only operations)
- `TWITTER_CONSUMER_KEY`: Twitter API Consumer Key (OAuth method)
- `TWITTER_CONSUMER_SECRET`: Twitter API Consumer Secret (OAuth method)
- `TWITTER_ACCESS_TOKEN`: Twitter API Access Token (OAuth method)
- `TWITTER_ACCESS_TOKEN_SECRET`: Twitter API Access Token Secret (OAuth method)

### Server Configuration
- `PORT`: Server port (default: 3001)

**Note:** If Twitter API credentials are not provided, the app will automatically fall back to Grok AI for tweet fetching. Bearer Token is preferred over OAuth for simplicity.

