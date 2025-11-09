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
	req.userId = "dummy-user";
	req.username = "guest";
	next();
};

import {
	watchlistDb,
	positionsDb,
	tradeHistoryDb,
	settingsDb,
	ensureInitialized,
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
			watchlist: watchlist.map((item) => ({
				ticker: item.ticker,
				addedAt: item.added_at,
			})),
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
			return res
				.status(400)
				.json({ success: false, error: "Ticker is required" });
		}
		watchlistDb.add(req.userId, ticker.trim());
		res.json({ success: true });
	} catch (error) {
		console.error("[API] Add watchlist error:", error);
		res
			.status(500)
			.json({ success: false, error: "Failed to add to watchlist" });
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
		res
			.status(500)
			.json({ success: false, error: "Failed to remove from watchlist" });
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
			positions: positions.map((pos) => ({
				id: pos.id,
				ticker: pos.ticker,
				quantity: pos.quantity,
				entryPrice: pos.entry_price,
				currentPrice: pos.current_price,
				pnl: pos.pnl,
				pnlPercent: pos.pnl_percent,
				type: pos.type || "stock",
				optionDetails: pos.option_details
					? JSON.parse(pos.option_details)
					: null,
			})),
		});
	} catch (error) {
		console.error("[API] Get positions error:", error);
		res.status(500).json({ success: false, error: "Failed to get positions" });
	}
});

// Add/Update position
app.post("/api/positions", authenticateToken, async (req, res) => {
	try {
		const { ticker, quantity, entryPrice, currentPrice, type, optionDetails } =
			req.body;

		if (!ticker || !quantity || !entryPrice || !currentPrice) {
			return res.status(400).json({
				success: false,
				error: "Ticker, quantity, entryPrice, and currentPrice are required",
			});
		}

		// Fallback: if we couldn't gather enough via direct tweets, ask Grok to summarize
		if (summaries.length < TARGET_EARNINGS_COUNT) {
			const missingCount = TARGET_EARNINGS_COUNT - summaries.length;
			console.log(
				`[Earnings] Only captured ${summaries.length} earnings from @earnings_guy timeline. Fetching ${missingCount} via Grok fallback.`
			);

			try {
				const fallbackPrompt = `You monitor @earnings_guy on X. List the latest ${TARGET_EARNINGS_COUNT} distinct company earnings posts that @earnings_guy has recently shared (within ~14 days). Focus on real data from that account.

Return ONLY valid JSON in this exact structure:
{
  "earnings": [
    {
      "symbol": "AAPL",
      "companyName": "Apple Inc.",
      "reportDate": "2024-01-25T00:00:00Z",
      "quarter": "Q1",
      "epsActual": 2.18,
      "epsEstimate": 2.10,
      "surprisePercent": 3.8,
      "revenueActual": 123945000000,
      "revenueEstimate": 121000000000,
      "summaryText": "EPS $2.18 vs $2.10 est. • Beat by 3.8% • Revenue $123.95B",
      "tweetUrl": "https://x.com/earnings_guy/status/1234567890",
      "tweetText": "Original tweet text here"
    }
  ]
}

Rules:
- Base details on actual posts from @earnings_guy.
- Only include one entry per company (use latest post if multiple).
- Use ISO 8601 timestamps for reportDate.
- summaryText should be concise bullet-style recap.
- tweetUrl must link to the specific post if known.`;

				const fallbackResponse = await fetch("https://api.x.ai/v1/chat/completions", {
					method: "POST",
					headers: {
						Authorization: `Bearer ${GROK_API_KEY}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						model: "grok-2-1212",
						messages: [{ role: "user", content: fallbackPrompt }],
						temperature: 0.2,
						max_tokens: 1400,
						response_format: { type: "json_object" },
					}),
				});

				if (!fallbackResponse.ok) {
					throw new Error(`Fallback Grok request failed with status ${fallbackResponse.status}`);
				}

				const fallbackData = await fallbackResponse.json();
				const fallbackContent = fallbackData.choices?.[0]?.message?.content;
				if (fallbackContent) {
					try {
						const parsedFallback = JSON.parse(fallbackContent);
						if (Array.isArray(parsedFallback.earnings)) {
							for (const entry of parsedFallback.earnings) {
								if (!entry?.symbol) continue;
								const symbol = entry.symbol.toUpperCase();
								if (summaries.find((s) => s.symbol === symbol)) {
									continue;
								}
								if (summaries.length >= TARGET_EARNINGS_COUNT) break;

								summaries.push({
									symbol,
									companyName: entry.companyName || symbol,
									reportDate: entry.reportDate || new Date().toISOString(),
									quarter: entry.quarter || null,
									epsActual: entry.epsActual ?? null,
									epsEstimate: entry.epsEstimate ?? null,
									surprisePercent: entry.surprisePercent ?? null,
									revenueActual: entry.revenueActual ?? null,
									revenueEstimate: entry.revenueEstimate ?? null,
									summaryText: entry.summaryText || entry.tweetText || null,
									tweets: [
										{
											content: entry.tweetText || entry.summaryText || "",
											username: "earnings_guy",
											displayName: "Earnings Guy",
											verified: true,
											imageUrls: entry.imageUrls || null,
											timestamp: entry.reportDate || new Date().toISOString(),
											likes: entry.likes || null,
											retweets: entry.retweets || null,
											engagement: entry.engagement || null,
											tweetUrl: entry.tweetUrl || null,
										},
									],
								});
								console.log(`[Earnings] Added fallback earnings for ${symbol}`);
							}
						}
					} catch (parseError) {
						console.error("[Earnings] Failed to parse Grok fallback response:", parseError.message);
					}
				}
			} catch (fallbackError) {
				console.error("[Earnings] Grok fallback request failed:", fallbackError.message);
			}
		}

		// Check if position exists for this ticker/option
		const existingPositions = positionsDb.getAll(req.userId);
		const existing = existingPositions.find((p) => {
			if (type === "option" && optionDetails) {
				const existingOpt = p.option_details
					? JSON.parse(p.option_details)
					: {};
				return (
					p.ticker === ticker &&
					p.type === "option" &&
					existingOpt.optionType === optionDetails.optionType &&
					existingOpt.strikePrice === optionDetails.strikePrice &&
					existingOpt.expirationDate === optionDetails.expirationDate
				);
			}
			return p.ticker === ticker && (p.type === "stock" || p.type === "crypto");
		});

		const pnl = (currentPrice - entryPrice) * quantity;
		const pnlPercent = ((currentPrice - entryPrice) / entryPrice) * 100;

		if (existing) {
			// Update existing position
			const newQuantity = existing.quantity + quantity;
			const newEntryPrice =
				(existing.entry_price * existing.quantity + entryPrice * quantity) /
				newQuantity;
			const newPnl = (currentPrice - newEntryPrice) * newQuantity;
			const newPnlPercent =
				((currentPrice - newEntryPrice) / newEntryPrice) * 100;

			positionsDb.update(req.userId, existing.id, {
				quantity: newQuantity,
				currentPrice,
				pnl: newPnl,
				pnlPercent: newPnlPercent,
			});

			res.json({ success: true, positionId: existing.id });
		} else {
			// Create new position
			const positionId = `pos-${Date.now()}-${Math.random()
				.toString(36)
				.substr(2, 9)}`;
			positionsDb.create({
				id: positionId,
				userId: req.userId,
				ticker: ticker.toUpperCase(),
				quantity,
				entryPrice,
				currentPrice,
				pnl,
				pnlPercent,
				type: type || "stock",
				optionDetails,
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
		res
			.status(500)
			.json({ success: false, error: "Failed to update position" });
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
		res
			.status(500)
			.json({ success: false, error: "Failed to delete position" });
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
			trades: trades.map((trade) => ({
				id: trade.id,
				ticker: trade.ticker,
				action: trade.action,
				quantity: trade.quantity,
				price: trade.price,
				total: trade.total,
				type: trade.type || "stock",
				optionDetails: trade.option_details
					? JSON.parse(trade.option_details)
					: null,
				timestamp: trade.timestamp,
			})),
		});
	} catch (error) {
		console.error("[API] Get trades error:", error);
		res
			.status(500)
			.json({ success: false, error: "Failed to get trade history" });
	}
});

// Add trade to history
app.post("/api/trades", authenticateToken, async (req, res) => {
	try {
		const { ticker, action, quantity, price, total, type, optionDetails } =
			req.body;

		if (!ticker || !action || !quantity || !price || !total) {
			return res.status(400).json({
				success: false,
				error: "Ticker, action, quantity, price, and total are required",
			});
		}

		const tradeId = `trade-${Date.now()}-${Math.random()
			.toString(36)
			.substr(2, 9)}`;
		tradeHistoryDb.create({
			id: tradeId,
			userId: req.userId,
			ticker: ticker.toUpperCase(),
			action: action.toUpperCase(),
			quantity,
			price,
			total,
			type: type || "stock",
			optionDetails,
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
		res
			.status(500)
			.json({ success: false, error: "Failed to get cash balance" });
	}
});

// Update cash balance
app.put("/api/cash-balance", authenticateToken, async (req, res) => {
	try {
		const { cashBalance } = req.body;
		if (typeof cashBalance !== "number") {
			return res
				.status(400)
				.json({ success: false, error: "Cash balance must be a number" });
		}

		const settings = settingsDb.get(req.userId);
		const preferences = settings?.preferences
			? JSON.parse(settings.preferences)
			: {};
		preferences.cashBalance = cashBalance;

		settingsDb.createOrUpdate(req.userId, {
			theme: settings?.theme || "dark",
			notificationsEnabled: settings?.notifications_enabled !== 0,
			preferences,
		});

		res.json({ success: true, cashBalance });
	} catch (error) {
		console.error("[API] Update cash balance error:", error);
		res
			.status(500)
			.json({ success: false, error: "Failed to update cash balance" });
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
		res.status(500).json({
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
			return res.status(400).json({
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
		res.status(500).json({
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
			return res.status(400).json({
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
		res.status(500).json({
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
app.get("/api/earnings/recent", async (req, res) => {
	try {
		const { days = "7" } = req.query;
		const lookbackDays = Math.min(Math.max(parseInt(days, 10) || 7, 1), 30);
		const cutoffTime = Date.now() - lookbackDays * 24 * 60 * 60 * 1000;

		// Fetch earnings tweets from @earnings_guy (fetch more to ensure we get 7 unique earnings)
		let earningsTweets = [];
		try {
			console.log("[Earnings] Fetching tweets from @earnings_guy...");
			earningsTweets = await getTweetsFromTwitterAPI(["earnings_guy"], 100);
			console.log(
				`[Earnings] Fetched ${earningsTweets.length} tweets from @earnings_guy`
			);
		} catch (error) {
			console.error(
				"[Earnings] Failed to fetch tweets from @earnings_guy:",
				error.message
			);
			// Fallback to Grok AI if Twitter API fails
			try {
				const grokTweets = await getRelevantTweets("earnings report", 20);
				earningsTweets = Array.isArray(grokTweets)
					? grokTweets.map((t) => ({
							content: t.content || t.text || "",
							username: t.username || "earnings_guy",
							displayName: t.displayName || "Earnings Guy",
							verified: t.verified || false,
							imageUrls: t.imageUrls || null,
							timestamp: t.timestamp || new Date().toISOString(),
							likes: t.likes || t.engagement || 0,
							retweets: t.retweets || 0,
							engagement: t.engagement || (t.likes || 0) + (t.retweets || 0),
					  }))
					: [];
			} catch (grokError) {
				console.error(
					"[Earnings] Grok fallback also failed:",
					grokError.message
				);
			}
		}

		// Filter tweets that contain "earnings are out" (case-insensitive)
		const earningsAreOutTweets = earningsTweets.filter((tweet) => {
			const content = (tweet.content || "").toLowerCase();
			return content.includes("earnings are out");
		});

		console.log(
			`[Earnings] Found ${earningsAreOutTweets.length} tweets containing "earnings are out"`
		);

		// Sort by timestamp (most recent first) and take top 6
		const topEarningsTweets = earningsAreOutTweets
			.sort((a, b) => {
				const aDate = new Date(a.timestamp).getTime();
				const bDate = new Date(b.timestamp).getTime();
				return bDate - aDate; // Most recent first
			})
			.slice(0, 6);

		console.log(
			`[Earnings] Processing top ${topEarningsTweets.length} "earnings are out" tweets`
		);

		// Use Grok AI to parse earnings data from tweets and images
		const summaries = [];
		const GROK_API_KEY = process.env.GROK_API_KEY;

		if (!GROK_API_KEY) {
			return res.status(500).json({
				success: false,
				error: "GROK_API_KEY not configured",
			});
		}

		// Process the top 6 tweets
		const TARGET_EARNINGS_COUNT = 6;
		
		for (const tweet of topEarningsTweets) {
			// Stop if we already have 6 earnings reports
			if (summaries.length >= TARGET_EARNINGS_COUNT) {
				console.log(`[Earnings] Found ${TARGET_EARNINGS_COUNT} earnings reports, stopping processing`);
				break;
			}
			try {
				// Build prompt with tweet text and image URLs
				const imageContext =
					tweet.imageUrls && tweet.imageUrls.length > 0
						? `\n\nIMAGES: ${tweet.imageUrls.join(
								", "
						  )}\nAnalyze the images in these tweets to extract earnings data.`
						: "";

				const prompt = `Extract structured earnings data from this tweet and its images:

TWEET TEXT: "${tweet.content}"
TWEET DATE: ${tweet.timestamp}
${imageContext}

Extract the following information if available:
- Company symbol/ticker (e.g., AAPL, MSFT, TSLA)
- Company name
- EPS (Earnings Per Share) - actual and estimate
- Revenue - actual and estimate
- Surprise percentage (beat/miss)
- Report date
- Quarter (Q1, Q2, Q3, Q4, FY)
- Year

Return JSON in this exact format:
{
  "symbol": "AAPL" or null,
  "companyName": "Apple Inc." or null,
  "reportDate": "2024-01-25T00:00:00Z" or null,
  "quarter": "Q1" or null,
  "epsActual": 2.18 or null,
  "epsEstimate": 2.10 or null,
  "surprisePercent": 3.8 or null,
  "revenueActual": 123945000000 or null,
  "revenueEstimate": 121000000000 or null,
  "summaryText": "EPS $2.18 vs $2.10 est. • Beat by 3.8% • Revenue $123.95B" or null,
  "confidence": "high" | "medium" | "low"
}

If the tweet doesn't contain earnings data, return:
{
  "symbol": null,
  "confidence": "low"
}

Return ONLY valid JSON, no markdown formatting.`;

				const response = await fetch("https://api.x.ai/v1/chat/completions", {
					method: "POST",
					headers: {
						Authorization: `Bearer ${GROK_API_KEY}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						model: "grok-2-1212",
						messages: [{ role: "user", content: prompt }],
						temperature: 0.3,
						max_tokens: 1000,
						response_format: { type: "json_object" },
					}),
				});

				if (!response.ok) {
					throw new Error(`Grok API error: ${response.status}`);
				}

				const result = await response.json();
				const content = result.choices[0].message.content;
				const parsed = JSON.parse(content);

				// Only add if we have a symbol and confidence is not low
				if (parsed.symbol && parsed.confidence !== "low") {
					const symbol = parsed.symbol.toUpperCase();
					
					// Check if we already have this symbol (only keep first occurrence for unique earnings)
					const existing = summaries.find((s) => s.symbol === symbol);
					if (existing) {
						// Merge tweets if it's the same company
						existing.tweets.push({
							id: tweet.id || null,
							content: tweet.content,
							username: tweet.username,
							displayName: tweet.displayName,
							verified: tweet.verified,
							imageUrls: tweet.imageUrls,
							timestamp: tweet.timestamp,
							likes: tweet.likes,
							retweets: tweet.retweets,
							engagement: tweet.engagement,
							tweetUrl: tweet.id
								? `https://x.com/${tweet.username}/status/${tweet.id}`
								: null,
						});
					} else {
						// Only add if we haven't reached 6 yet
						if (summaries.length < TARGET_EARNINGS_COUNT) {
							const summary = {
								symbol: symbol,
								companyName: parsed.companyName || symbol,
								reportDate: parsed.reportDate || tweet.timestamp,
								quarter: parsed.quarter || null,
								epsActual: parsed.epsActual,
								epsEstimate: parsed.epsEstimate,
								surprisePercent: parsed.surprisePercent,
								revenueActual: parsed.revenueActual,
								revenueEstimate: parsed.revenueEstimate,
								summaryText: parsed.summaryText || null,
								tweets: [
									{
										id: tweet.id || null,
										content: tweet.content,
										username: tweet.username,
										displayName: tweet.displayName,
										verified: tweet.verified,
										imageUrls: tweet.imageUrls,
										timestamp: tweet.timestamp,
										likes: tweet.likes,
										retweets: tweet.retweets,
										engagement: tweet.engagement,
										tweetUrl: tweet.id
											? `https://x.com/${tweet.username}/status/${tweet.id}`
											: null,
									},
								],
							};
							summaries.push(summary);
							console.log(`[Earnings] Added earnings for ${symbol} (${summaries.length}/${TARGET_EARNINGS_COUNT})`);
						}
					}
				}

				// Rate limiting
				await new Promise((resolve) => setTimeout(resolve, 500));
			} catch (error) {
				console.error(`[Earnings] Failed to parse tweet:`, error.message);
			}
		}

		// Fetch additional tweets for each earnings report to ensure at least 3 tweets per report
		for (const summary of summaries) {
			if (summary.tweets.length >= 3) {
				continue; // Already has enough tweets
			}

			const needed = 3 - summary.tweets.length;
			console.log(`[Earnings] Fetching ${needed} more tweets for ${summary.symbol}...`);

			try {
				// Search for tweets from @earnings_guy mentioning this symbol
				const symbolTweets = earningsTweets.filter((tweet) => {
					const content = (tweet.content || "").toUpperCase();
					const symbol = summary.symbol.toUpperCase();
					// Check if tweet mentions the symbol (with $ prefix or standalone)
					return content.includes(`$${symbol}`) || 
						   content.includes(` ${symbol} `) || 
						   content.includes(` ${symbol}\n`) ||
						   content.startsWith(`${symbol} `);
				});

				// Sort by timestamp and take the most recent ones we haven't already included
				const existingTweetIds = new Set(summary.tweets.map(t => {
					// Use id if available, otherwise use timestamp as fallback
					return t.id || (t.timestamp ? `timestamp_${t.timestamp}` : null);
				}).filter(Boolean));
				const additionalTweets = symbolTweets
					.filter(t => {
						const tweetId = t.id || (t.timestamp ? `timestamp_${t.timestamp}` : null);
						return tweetId && !existingTweetIds.has(tweetId);
					})
					.sort((a, b) => {
						const aDate = new Date(a.timestamp).getTime();
						const bDate = new Date(b.timestamp).getTime();
						return bDate - aDate;
					})
					.slice(0, needed);

				// Add the additional tweets
				for (const tweet of additionalTweets) {
					summary.tweets.push({
						id: tweet.id || null,
						content: tweet.content,
						username: tweet.username,
						displayName: tweet.displayName,
						verified: tweet.verified,
						imageUrls: tweet.imageUrls,
						timestamp: tweet.timestamp,
						likes: tweet.likes,
						retweets: tweet.retweets,
						engagement: tweet.engagement,
						tweetUrl: tweet.id
							? `https://x.com/${tweet.username}/status/${tweet.id}`
							: null,
					});
				}

				// Sort tweets by timestamp (most recent first)
				summary.tweets.sort((a, b) => {
					const aDate = new Date(a.timestamp).getTime();
					const bDate = new Date(b.timestamp).getTime();
					return bDate - aDate;
				});

				console.log(`[Earnings] Added ${additionalTweets.length} more tweets for ${summary.symbol} (now has ${summary.tweets.length} tweets)`);
			} catch (error) {
				console.error(`[Earnings] Failed to fetch additional tweets for ${summary.symbol}:`, error.message);
			}
		}

		// Sort tweets for all summaries
		for (const summary of summaries) {
			summary.tweets.sort((a, b) => {
				const aDate = new Date(a.timestamp).getTime();
				const bDate = new Date(b.timestamp).getTime();
				return bDate - aDate;
			});
		}

		// Sort by report date (most recent first) and limit to exactly 6
		summaries.sort((a, b) => {
			const aDate = a.reportDate ? new Date(a.reportDate).getTime() : 0;
			const bDate = b.reportDate ? new Date(b.reportDate).getTime() : 0;
			return bDate - aDate;
		});

		// Limit to exactly 6 most recent earnings
		const finalSummaries = summaries.slice(0, TARGET_EARNINGS_COUNT);
		
		console.log(`[Earnings] Returning ${finalSummaries.length} earnings reports from @earnings_guy (filtered by "earnings are out")`);

		res.json({
			success: true,
			summaries: finalSummaries,
			generatedAt: new Date().toISOString(),
			source: "twitter_earnings_guy",
			count: finalSummaries.length,
		});
	} catch (error) {
		console.error("[Earnings] Error:", error);
		res.status(500).json({
			success: false,
			error: "Failed to fetch earnings data",
			message: error.message,
		});
	}
});

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
			return res
				.status(400)
				.json({ error: "symbols query parameter is required" });
		}

		const symbolList = symbols
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
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
						"User-Agent":
							"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
					},
				});

				if (response.ok) {
					const data = await response.json();
					const result = data.chart?.result?.[0];
					const meta = result?.meta;

					if (meta && meta.regularMarketPrice !== undefined) {
						const price = meta.regularMarketPrice || 0;
						const previousClose =
							meta.previousClose || meta.previousClosePrice || price;
						const change = meta.regularMarketChange ?? price - previousClose;
						const changePercent =
							meta.regularMarketChangePercent ??
							(previousClose
								? ((price - previousClose) / previousClose) * 100
								: 0);

						results.push({
							symbol: meta.symbol || symbol,
							regularMarketPrice: price,
							regularMarketChange: change || 0,
							regularMarketChangePercent: changePercent || 0,
							regularMarketVolume: meta.regularMarketVolume || 0,
							marketCap: meta.marketCap || 0,
							shortName:
								meta.shortName || meta.longName || meta.displayName || symbol,
							longName: meta.longName || meta.shortName || symbol,
						});
					}
				}
			} catch (error) {
				console.error(
					`[Yahoo Finance] Error fetching ${symbol}:`,
					error.message
				);
				// Continue with other symbols even if one fails
			}
		}

		res.json(results);
	} catch (error) {
		console.error("[Yahoo Finance] Error:", error);
		res
			.status(500)
			.json({ error: "Failed to fetch quotes", message: error.message });
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
ensureInitialized()
	.then(() => {
		app.listen(PORT, () => {
			console.log(`Server running on http://localhost:${PORT}`);
		});
	})
	.catch((error) => {
		console.error("Failed to initialize database:", error);
		process.exit(1);
	});
