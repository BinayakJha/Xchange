import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import {
	analyzeStockWithGrok,
	getStockSentiment,
	getRelevantTweets,
	findInfluentialUsers,
	getTweetsFromUsers,
	getOverallMarketSentiment,
	analyzeMarketFromTweets,
	analyzeTweetImpact,
} from "./services/grokService.js";
import {
	getTweetsFromUsers as getTweetsFromTwitterAPI,
	searchTweets,
} from "./services/twitterService.js";
import { analyzeFlowImage } from "./services/imageAnalysisService.js";
import { chatWithAI } from "./services/chatService.js";
// Authentication removed - using simple dummy auth
// Dummy authenticateToken middleware - allows all requests
const authenticateToken = (req, res, next) => {
	// Dummy auth - just set a fake userId
	req.userId = 'dummy-user';
	req.username = 'guest';
	next();
};

import { 
	watchlistDb, 
	positionsDb, 
	tradeHistoryDb, 
	settingsDb,
	ensureInitialized 
} from "./database/db.js";

dotenv.config();

// Log environment status on startup
console.log("Environment check:");
console.log(
	"GROK_API_KEY:",
	process.env.GROK_API_KEY
		? `SET (${process.env.GROK_API_KEY.substring(0, 20)}...)`
		: "NOT SET"
);
console.log(
	"TWITTER_BEARER_TOKEN:",
	process.env.TWITTER_BEARER_TOKEN
		? `SET (${process.env.TWITTER_BEARER_TOKEN.substring(0, 20)}...)`
		: "NOT SET"
);
console.log(
	"TWITTER_CONSUMER_KEY:",
	process.env.TWITTER_CONSUMER_KEY
		? `SET (${process.env.TWITTER_CONSUMER_KEY.substring(0, 10)}...)`
		: "NOT SET"
);
console.log("PORT:", process.env.PORT || 3001);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
	res.json({ status: "ok" });
});

// ============================================
// WATCHLIST ENDPOINTS
// ============================================

// Get user's watchlist
app.get("/api/watchlist", authenticateToken, async (req, res) => {
	try {
		const watchlist = watchlistDb.getAll(req.userId);
		res.json({ 
			success: true, 
			watchlist: watchlist.map(item => ({
				ticker: item.ticker,
				addedAt: item.added_at
			}))
		});
	} catch (error) {
		console.error("[API] Get watchlist error:", error);
		res.status(500).json({ success: false, error: "Failed to get watchlist" });
	}
});

// Add to watchlist
app.post("/api/watchlist", authenticateToken, async (req, res) => {
	try {
		const { ticker } = req.body;
		if (!ticker || !ticker.trim()) {
			return res.status(400).json({ success: false, error: "Ticker is required" });
		}
		watchlistDb.add(req.userId, ticker.trim());
		res.json({ success: true });
	} catch (error) {
		console.error("[API] Add watchlist error:", error);
		res.status(500).json({ success: false, error: "Failed to add to watchlist" });
	}
});

// Remove from watchlist
app.delete("/api/watchlist/:ticker", authenticateToken, async (req, res) => {
	try {
		const { ticker } = req.params;
		watchlistDb.remove(req.userId, ticker);
		res.json({ success: true });
	} catch (error) {
		console.error("[API] Remove watchlist error:", error);
		res.status(500).json({ success: false, error: "Failed to remove from watchlist" });
	}
});

// ============================================
// POSITIONS ENDPOINTS
// ============================================

// Get user's positions
app.get("/api/positions", authenticateToken, async (req, res) => {
	try {
		const positions = positionsDb.getAll(req.userId);
		res.json({ 
			success: true, 
			positions: positions.map(pos => ({
				id: pos.id,
				ticker: pos.ticker,
				quantity: pos.quantity,
				entryPrice: pos.entry_price,
				currentPrice: pos.current_price,
				pnl: pos.pnl,
				pnlPercent: pos.pnl_percent,
				type: pos.type || 'stock',
				optionDetails: pos.option_details ? JSON.parse(pos.option_details) : null
			}))
		});
	} catch (error) {
		console.error("[API] Get positions error:", error);
		res.status(500).json({ success: false, error: "Failed to get positions" });
	}
});

// Add/Update position
app.post("/api/positions", authenticateToken, async (req, res) => {
	try {
		const { ticker, quantity, entryPrice, currentPrice, type, optionDetails } = req.body;
		
		if (!ticker || !quantity || !entryPrice || !currentPrice) {
			return res.status(400).json({ 
				success: false, 
				error: "Ticker, quantity, entryPrice, and currentPrice are required" 
			});
		}

		// Check if position exists for this ticker/option
		const existingPositions = positionsDb.getAll(req.userId);
		const existing = existingPositions.find(p => {
			if (type === 'option' && optionDetails) {
				const existingOpt = p.option_details ? JSON.parse(p.option_details) : {};
				return p.ticker === ticker && 
				       p.type === 'option' &&
				       existingOpt.optionType === optionDetails.optionType &&
				       existingOpt.strikePrice === optionDetails.strikePrice &&
				       existingOpt.expirationDate === optionDetails.expirationDate;
			}
			return p.ticker === ticker && (p.type === 'stock' || p.type === 'crypto');
		});

		const pnl = (currentPrice - entryPrice) * quantity;
		const pnlPercent = ((currentPrice - entryPrice) / entryPrice) * 100;

		if (existing) {
			// Update existing position
			const newQuantity = existing.quantity + quantity;
			const newEntryPrice = ((existing.entry_price * existing.quantity) + (entryPrice * quantity)) / newQuantity;
			const newPnl = (currentPrice - newEntryPrice) * newQuantity;
			const newPnlPercent = ((currentPrice - newEntryPrice) / newEntryPrice) * 100;

			positionsDb.update(req.userId, existing.id, {
				quantity: newQuantity,
				currentPrice,
				pnl: newPnl,
				pnlPercent: newPnlPercent
			});

			res.json({ success: true, positionId: existing.id });
		} else {
			// Create new position
			const positionId = `pos-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
			positionsDb.create({
				id: positionId,
				userId: req.userId,
				ticker: ticker.toUpperCase(),
				quantity,
				entryPrice,
				currentPrice,
				pnl,
				pnlPercent,
				type: type || 'stock',
				optionDetails
			});

			res.json({ success: true, positionId });
		}
	} catch (error) {
		console.error("[API] Add position error:", error);
		res.status(500).json({ success: false, error: "Failed to add position" });
	}
});

// Update position
app.put("/api/positions/:id", authenticateToken, async (req, res) => {
	try {
		const { id } = req.params;
		const updates = req.body;
		
		positionsDb.update(req.userId, id, updates);
		res.json({ success: true });
	} catch (error) {
		console.error("[API] Update position error:", error);
		res.status(500).json({ success: false, error: "Failed to update position" });
	}
});

// Delete position
app.delete("/api/positions/:id", authenticateToken, async (req, res) => {
	try {
		const { id } = req.params;
		positionsDb.delete(req.userId, id);
		res.json({ success: true });
	} catch (error) {
		console.error("[API] Delete position error:", error);
		res.status(500).json({ success: false, error: "Failed to delete position" });
	}
});

// ============================================
// TRADE HISTORY ENDPOINTS
// ============================================

// Get trade history
app.get("/api/trades", authenticateToken, async (req, res) => {
	try {
		const limit = parseInt(req.query.limit) || 100;
		const trades = tradeHistoryDb.getAll(req.userId, limit);
		res.json({ 
			success: true, 
			trades: trades.map(trade => ({
				id: trade.id,
				ticker: trade.ticker,
				action: trade.action,
				quantity: trade.quantity,
				price: trade.price,
				total: trade.total,
				type: trade.type || 'stock',
				optionDetails: trade.option_details ? JSON.parse(trade.option_details) : null,
				timestamp: trade.timestamp
			}))
		});
	} catch (error) {
		console.error("[API] Get trades error:", error);
		res.status(500).json({ success: false, error: "Failed to get trade history" });
	}
});

// Add trade to history
app.post("/api/trades", authenticateToken, async (req, res) => {
	try {
		const { ticker, action, quantity, price, total, type, optionDetails } = req.body;
		
		if (!ticker || !action || !quantity || !price || !total) {
			return res.status(400).json({ 
				success: false, 
				error: "Ticker, action, quantity, price, and total are required" 
			});
		}

		const tradeId = `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
		tradeHistoryDb.create({
			id: tradeId,
			userId: req.userId,
			ticker: ticker.toUpperCase(),
			action: action.toUpperCase(),
			quantity,
			price,
			total,
			type: type || 'stock',
			optionDetails
		});

		res.json({ success: true, tradeId });
	} catch (error) {
		console.error("[API] Add trade error:", error);
		res.status(500).json({ success: false, error: "Failed to add trade" });
	}
});

// ============================================
// CASH BALANCE ENDPOINTS
// ============================================

// Get cash balance
app.get("/api/cash-balance", authenticateToken, async (req, res) => {
	try {
		const settings = settingsDb.get(req.userId);
		const cashBalance = settings?.preferences 
			? JSON.parse(settings.preferences).cashBalance || 100000
			: 100000;
		res.json({ success: true, cashBalance });
	} catch (error) {
		console.error("[API] Get cash balance error:", error);
		res.status(500).json({ success: false, error: "Failed to get cash balance" });
	}
});

// Update cash balance
app.put("/api/cash-balance", authenticateToken, async (req, res) => {
	try {
		const { cashBalance } = req.body;
		if (typeof cashBalance !== 'number') {
			return res.status(400).json({ success: false, error: "Cash balance must be a number" });
		}

		const settings = settingsDb.get(req.userId);
		const preferences = settings?.preferences ? JSON.parse(settings.preferences) : {};
		preferences.cashBalance = cashBalance;

		settingsDb.createOrUpdate(req.userId, {
			theme: settings?.theme || 'dark',
			notificationsEnabled: settings?.notifications_enabled !== 0,
			preferences
		});

		res.json({ success: true, cashBalance });
	} catch (error) {
		console.error("[API] Update cash balance error:", error);
		res.status(500).json({ success: false, error: "Failed to update cash balance" });
	}
});

// Analyze stock endpoint (returns full analysis with sentiment and tweets)
app.post("/api/analyze", async (req, res) => {
	try {
		const { stockInput } = req.body;

		if (!stockInput) {
			return res.status(400).json({ error: "Stock input is required" });
		}

		console.log(`Analyzing stock: ${stockInput}`);
		const result = await analyzeStockWithGrok(stockInput);

		res.json({
			success: true,
			...result,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error("Error analyzing stock:", error);
		res.status(500).json({
			error: "Failed to analyze stock",
			message: error.message,
		});
	}
});

// Analyze multiple stocks endpoint
app.post("/api/analyze/batch", async (req, res) => {
	try {
		const { tickers } = req.body;

		if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
			return res.status(400).json({ error: "Tickers array is required" });
		}

		console.log(`Analyzing ${tickers.length} stocks: ${tickers.join(", ")}`);

		// Analyze stocks in parallel (with rate limiting consideration)
		const analyses = await Promise.all(
			tickers.map(async (ticker) => {
				try {
					const result = await analyzeStockWithGrok(ticker);
					return { ticker, ...result, success: true };
				} catch (error) {
					console.error(`Error analyzing ${ticker}:`, error);
					return { ticker, error: error.message, success: false };
				}
			})
		);

		res.json({
			success: true,
			analyses,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error("Error in batch analysis:", error);
		res.status(500).json({
			error: "Failed to analyze stocks",
			message: error.message,
		});
	}
});

// Get sentiment for a stock
app.get("/api/sentiment/:ticker", async (req, res) => {
	try {
		const { ticker } = req.params;
		const sentiment = await getStockSentiment(ticker);
		res.json({ success: true, sentiment });
	} catch (error) {
		console.error("Error getting sentiment:", error);
		res
			.status(500)
			.json({ error: "Failed to get sentiment", message: error.message });
	}
});

// Get relevant tweets for a stock
app.get("/api/tweets/:ticker", async (req, res) => {
	try {
		const { ticker } = req.params;
		const count = parseInt(req.query.count) || 10;
		const tweets = await getRelevantTweets(ticker, count);
		res.json({ success: true, tweets });
	} catch (error) {
		console.error("Error getting tweets:", error);
		res
			.status(500)
			.json({ error: "Failed to get tweets", message: error.message });
	}
});

// Find influential users for a stock
app.get("/api/users/:ticker", async (req, res) => {
	try {
		const { ticker } = req.params;
		const users = await findInfluentialUsers(ticker);
		res.json({ success: true, users });
	} catch (error) {
		console.error("Error finding users:", error);
		res
			.status(500)
			.json({ error: "Failed to find users", message: error.message });
	}
});

// Get tweets from specific users about a stock
app.post("/api/tweets/users", async (req, res) => {
	try {
		const { ticker, usernames, count } = req.body;
		if (!ticker) {
			return res.status(400).json({ error: "Ticker is required" });
		}
		const tweetCount = count || 10;
		const tweets = await getTweetsFromUsers(
			ticker,
			usernames || [],
			tweetCount
		);
		res.json({ success: true, tweets });
	} catch (error) {
		console.error("Error getting tweets from users:", error);
		res
			.status(500)
			.json({ error: "Failed to get tweets", message: error.message });
	}
});

// Get sentiment for multiple stocks
app.post("/api/sentiment/batch", async (req, res) => {
	try {
		const { tickers } = req.body;
		if (!tickers || !Array.isArray(tickers)) {
			return res.status(400).json({ error: "Tickers array is required" });
		}

		const sentiments = await Promise.all(
			tickers.map(async (ticker) => {
				try {
					const sentiment = await getStockSentiment(ticker);
					return { ticker, sentiment, success: true };
				} catch (error) {
					return { ticker, error: error.message, success: false };
				}
			})
		);

		res.json({ success: true, sentiments });
	} catch (error) {
		console.error("Error in batch sentiment:", error);
		res
			.status(500)
			.json({ error: "Failed to get sentiments", message: error.message });
	}
});

// Get overall market sentiment from market-moving accounts
app.get("/api/sentiment/market", async (req, res) => {
	try {
		console.log("Fetching overall market sentiment...");
		const result = await getOverallMarketSentiment();
		res.json({ success: true, ...result });
	} catch (error) {
		console.error("Error getting overall market sentiment:", error);
		res
			.status(500)
			.json({
				error: "Failed to get market sentiment",
				message: error.message,
			});
	}
});

// Analyze provided tweets to determine market sentiment and trade ideas
app.post("/api/market/analyze", async (req, res) => {
	try {
		const { tweets, watchlist = [], positions = [] } = req.body || {};

		if (!Array.isArray(tweets) || tweets.length === 0) {
			return res
				.status(400)
				.json({
					success: false,
					error: "tweets array (length > 0) is required",
				});
		}

		console.log(
			`[MarketAnalysis] Analyzing ${tweets.length} tweets for sentiment and trade ideas`
		);

		const result = await analyzeMarketFromTweets(tweets, {
			watchlist,
			positions,
		});

		res.json({
			success: true,
			...result,
			analyzedAt: new Date().toISOString(),
		});
	} catch (error) {
		console.error("Error analyzing market from tweets:", error);
		res
			.status(500)
			.json({
				success: false,
				error: "Failed to analyze market",
				message: error.message,
			});
	}
});

// Analyze individual tweets to determine their impact on market and specific stocks
app.post("/api/tweets/analyze-impact", async (req, res) => {
	try {
		const { tweets, watchlist = [] } = req.body || {};

		if (!Array.isArray(tweets) || tweets.length === 0) {
			return res
				.status(400)
				.json({
					success: false,
					error: "tweets array (length > 0) is required",
				});
		}

		console.log(
			`[TweetImpact] Analyzing ${tweets.length} tweets for market/stock impact`
		);

		const watchlistTickers = Array.isArray(watchlist)
			? watchlist
					.map((w) => (typeof w === "string" ? w : w.ticker))
					.filter(Boolean)
			: [];

		const result = await analyzeTweetImpact(tweets, watchlistTickers);

		res.json({
			success: true,
			analyses: result,
			analyzedAt: new Date().toISOString(),
		});
	} catch (error) {
		console.error("Error analyzing tweet impact:", error);
		res
			.status(500)
			.json({
				success: false,
				error: "Failed to analyze tweet impact",
				message: error.message,
			});
	}
});

// Get real tweets from Twitter API (from specific users)
app.post("/api/twitter/users", async (req, res) => {
	try {
		const { usernames, maxResults } = req.body;
		if (!usernames || !Array.isArray(usernames) || usernames.length === 0) {
			return res.status(400).json({ error: "Usernames array is required" });
		}

		console.log(
			`Fetching tweets from Twitter API for users: ${usernames.join(", ")}`
		);
		const tweets = await getTweetsFromTwitterAPI(usernames, maxResults || 10);

		res.json({
			success: true,
			tweets: tweets.map((tweet) => ({
				content: tweet.content,
				username: tweet.username,
				displayName: tweet.displayName,
				verified: tweet.verified,
				profileImageUrl: tweet.profileImageUrl,
				imageUrls: tweet.imageUrls || null,
				impact: tweet.impact,
				engagement: tweet.engagement,
				likes: tweet.likes,
				retweets: tweet.retweets,
				timestamp: tweet.timestamp,
				relevance: "market_impact",
			})),
		});
	} catch (error) {
		// Check if it's an authentication error
		const isAuthError =
			error.message?.includes("401") ||
			error.message?.includes("authentication failed") ||
			error.message?.includes("Unauthorized");

		if (isAuthError) {
			// Return empty tweets array so frontend can fall back to Grok
			console.warn(
				"Twitter API authentication failed. Returning empty result for frontend to fall back to Grok."
			);
			res.json({
				success: true,
				tweets: [],
			});
		} else {
			console.error("Error getting tweets from Twitter API:", error);
			res.status(500).json({
				success: false,
				error: "Failed to get tweets",
				message: error.message,
			});
		}
	}
});

// Search tweets using Twitter API
app.post("/api/twitter/search", async (req, res) => {
	try {
		const { query, maxResults } = req.body;
		if (!query) {
			return res.status(400).json({ error: "Query is required" });
		}

		console.log(`Searching tweets on Twitter API: ${query}`);
		const tweets = await searchTweets(query, maxResults || 10);

		res.json({
			success: true,
			tweets: tweets.map((tweet) => ({
				content: tweet.content,
				username: tweet.username,
				displayName: tweet.displayName,
				verified: tweet.verified,
				impact: tweet.impact,
				engagement: tweet.engagement,
				likes: tweet.likes,
				retweets: tweet.retweets,
				timestamp: tweet.timestamp,
				relevance: "direct",
			})),
		});
	} catch (error) {
		console.error("Error searching tweets:", error);
		res
			.status(500)
			.json({ error: "Failed to search tweets", message: error.message });
	}
});

// AI Chat endpoint
app.post("/api/chat", async (req, res) => {
	try {
		const { message, context } = req.body;

		if (!message || typeof message !== "string") {
			return res.status(400).json({ error: "message is required" });
		}

		console.log(`[Chat] Processing message: ${message.substring(0, 50)}...`);
		const result = await chatWithAI(message, context || {});

		res.json({
			success: true,
			response: result.response || "I apologize, but I encountered an error.",
			tradeAction: result.tradeAction || null,
			tradeActions: result.tradeActions || null, // Multiple trades for diversification
			heatmap: result.heatmap || null, // Sector heatmap data
		});
	} catch (error) {
		console.error("Error in chat endpoint:", error);
		res.status(500).json({
			success: false,
			error: "Failed to process chat message",
			message: error.message,
		});
	}
});

// Analyze flow image endpoint
app.post("/api/flow/analyze-image", async (req, res) => {
	try {
		const { imageUrl, fallbackTicker } = req.body;

		if (!imageUrl) {
			return res.status(400).json({ error: "imageUrl is required" });
		}

		console.log(`[FlowImage] Analyzing image: ${imageUrl}`);
		const analysis = await analyzeFlowImage(imageUrl, fallbackTicker || null);

		res.json({
			success: true,
			analysis,
			analyzedAt: new Date().toISOString(),
		});
	} catch (error) {
		console.error("Error analyzing flow image:", error);
		res.status(500).json({
			success: false,
			error: "Failed to analyze image",
			message: error.message,
		});
	}
});

// Yahoo Finance proxy endpoints (to avoid CORS issues)
app.get("/api/yahoo/search", async (req, res) => {
	try {
		const { q } = req.query;
		if (!q) {
			return res.status(400).json({ error: "Query parameter q is required" });
		}

		const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
			q
		)}&quotesCount=10&newsCount=0`;
		const response = await fetch(url);

		if (!response.ok) {
			throw new Error(`Yahoo Finance API error: ${response.status}`);
		}

		const data = await response.json();
		res.json(data);
	} catch (error) {
		console.error("Error proxying Yahoo Finance search:", error);
		res
			.status(500)
			.json({ error: "Failed to search stocks", message: error.message });
	}
});

// Yahoo Finance endpoint for multiple symbols (used by Papertrade)
app.get("/api/yahoo-finance", async (req, res) => {
	try {
		const { symbols } = req.query;
		if (!symbols) {
			return res.status(400).json({ error: "symbols query parameter is required" });
		}

		const symbolList = symbols.split(',').map(s => s.trim()).filter(Boolean);
		if (symbolList.length === 0) {
			return res.status(400).json({ error: "At least one symbol is required" });
		}

		// Fetch data for all symbols
		const results = [];
		for (const symbol of symbolList) {
			try {
				const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
					symbol
				)}?interval=1m&range=1d`;
				const response = await fetch(url, {
					headers: {
						'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
					}
				});

				if (response.ok) {
					const data = await response.json();
					const result = data.chart?.result?.[0];
					const meta = result?.meta;
					
					if (meta && meta.regularMarketPrice !== undefined) {
						const price = meta.regularMarketPrice || 0;
						const previousClose = meta.previousClose || meta.previousClosePrice || price;
						const change = meta.regularMarketChange ?? (price - previousClose);
						const changePercent = meta.regularMarketChangePercent ?? 
							(previousClose ? ((price - previousClose) / previousClose) * 100 : 0);

						results.push({
							symbol: meta.symbol || symbol,
							regularMarketPrice: price,
							regularMarketChange: change || 0,
							regularMarketChangePercent: changePercent || 0,
							regularMarketVolume: meta.regularMarketVolume || 0,
							marketCap: meta.marketCap || 0,
							shortName: meta.shortName || meta.longName || meta.displayName || symbol,
							longName: meta.longName || meta.shortName || symbol
						});
					}
				}
			} catch (error) {
				console.error(`[Yahoo Finance] Error fetching ${symbol}:`, error.message);
				// Continue with other symbols even if one fails
			}
		}

		res.json(results);
	} catch (error) {
		console.error("[Yahoo Finance] Error:", error);
		res.status(500).json({ error: "Failed to fetch quotes", message: error.message });
	}
});

app.get("/api/yahoo/quote/:ticker", async (req, res) => {
	try {
		const { ticker } = req.params;
		if (!ticker) {
			return res.status(400).json({ error: "Ticker is required" });
		}

		const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
			ticker
		)}?interval=1d&range=1d`;
		const response = await fetch(url);

		if (!response.ok) {
			throw new Error(`Yahoo Finance API error: ${response.status}`);
		}

		const data = await response.json();
		res.json(data);
	} catch (error) {
		console.error(
			`Error proxying Yahoo Finance quote for ${req.params.ticker}:`,
			error
		);
		res
			.status(500)
			.json({ error: "Failed to fetch quote", message: error.message });
	}
});

// Initialize database before starting server
ensureInitialized().then(() => {
	app.listen(PORT, () => {
		console.log(`Server running on http://localhost:${PORT}`);
	});
}).catch((error) => {
	console.error("Failed to initialize database:", error);
	process.exit(1);
});
