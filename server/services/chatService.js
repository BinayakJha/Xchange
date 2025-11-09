import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const GROK_API_KEY = process.env.GROK_API_KEY;
const API_URL = "https://api.x.ai/v1/chat/completions";

/**
 * Map cryptocurrency names to their ticker symbols
 */
function normalizeCryptoTicker(name) {
	if (!name) return null;
	
	const upperName = name.toUpperCase().trim();
	
	// Direct ticker mappings (already in correct format)
	if (upperName.match(/^[A-Z]{1,5}(-USD)?$/)) {
		// If it already looks like a ticker, ensure it has -USD for crypto
		if (upperName.includes('-USD')) {
			return upperName;
		}
		// Check if it's a known crypto ticker without -USD
		const cryptoMap = {
			'BTC': 'BTC-USD',
			'ETH': 'ETH-USD',
			'BNB': 'BNB-USD',
			'SOL': 'SOL-USD',
			'ADA': 'ADA-USD',
			'XRP': 'XRP-USD',
			'DOGE': 'DOGE-USD',
			'DOT': 'DOT-USD',
			'MATIC': 'MATIC-USD',
			'AVAX': 'AVAX-USD',
		};
		if (cryptoMap[upperName]) {
			return cryptoMap[upperName];
		}
		// Otherwise assume it's a stock ticker
		return upperName;
	}
	
	// Cryptocurrency name mappings (including common misspellings)
	const cryptoNameMap = {
		// Bitcoin
		'BITCOIN': 'BTC-USD',
		'BTC': 'BTC-USD',
		
		// Ethereum (including misspellings)
		'ETHEREUM': 'ETH-USD',
		'ETHERUM': 'ETH-USD',
		'ETH': 'ETH-USD',
		
		// Other popular cryptos
		'BINANCE COIN': 'BNB-USD',
		'BNB': 'BNB-USD',
		'SOLANA': 'SOL-USD',
		'SOL': 'SOL-USD',
		'CARDANO': 'ADA-USD',
		'ADA': 'ADA-USD',
		'RIPPLE': 'XRP-USD',
		'XRP': 'XRP-USD',
		'DOGECOIN': 'DOGE-USD',
		'DOGE': 'DOGE-USD',
		'POLKADOT': 'DOT-USD',
		'DOT': 'DOT-USD',
		'POLYGON': 'MATIC-USD',
		'MATIC': 'MATIC-USD',
		'AVALANCHE': 'AVAX-USD',
		'AVAX': 'AVAX-USD',
		'LITECOIN': 'LTC-USD',
		'LTC': 'LTC-USD',
		'CHAINLINK': 'LINK-USD',
		'LINK': 'LINK-USD',
		'UNISWAP': 'UNI-USD',
		'UNI': 'UNI-USD',
	};
	
	// Try exact match first
	if (cryptoNameMap[upperName]) {
		return cryptoNameMap[upperName];
	}
	
	// Try partial matching for common patterns
	for (const [key, value] of Object.entries(cryptoNameMap)) {
		if (upperName.includes(key) || key.includes(upperName)) {
			return value;
		}
	}
	
	// Try fuzzy matching for common misspellings (starts with)
	if (upperName.startsWith('ETHER')) {
		return 'ETH-USD';
	}
	if (upperName.startsWith('BITCOIN') || upperName.startsWith('BIT')) {
		return 'BTC-USD';
	}
	
	return null;
}

/**
 * Extract and normalize ticker from text
 */
function extractTicker(text) {
	if (!text) return null;
	
	const trimmed = text.trim();
	
	// First try to normalize as crypto
	const normalized = normalizeCryptoTicker(trimmed);
	if (normalized) {
		return normalized;
	}
	
	// If it looks like a ticker symbol, return uppercase
	if (trimmed.match(/^[A-Z]{1,5}(-USD)?$/i)) {
		return trimmed.toUpperCase();
	}
	
	return null;
}

/**
 * Parse trade command from user message
 * Returns trade action if detected, null otherwise
 */
function parseTradeCommand(message, watchlist, positions) {
	const upperMessage = message.toUpperCase();

	// Patterns for buying - updated to capture longer names and crypto names
	const buyPatterns = [
		/BUY\s+\$?(\d+(?:\.\d+)?)\s+WORTH\s+OF\s+([A-Za-z]+(?:-USD)?)\b/i,
		/BUY\s+(\d+(?:\.\d+)?)\s+SHARES?\s+OF\s+([A-Za-z]+(?:-USD)?)\b/i,
		/BUY\s+\$?(\d+(?:\.\d+)?)\s+([A-Za-z]+(?:-USD)?)\b/i,
		/PURCHASE\s+(\d+(?:\.\d+)?)\s+([A-Za-z]+(?:-USD)?)\b/i,
	];

	// Patterns for selling - updated to capture longer names and crypto names
	const sellPatterns = [
		/SELL\s+(\d+(?:\.\d+)?)\s+SHARES?\s+OF\s+([A-Za-z]+(?:-USD)?)\b/i,
		/SELL\s+(\d+(?:\.\d+)?)\s+([A-Za-z]+(?:-USD)?)\b/i,
		/CLOSE\s+(\d+(?:\.\d+)?)\s+([A-Za-z]+(?:-USD)?)\b/i,
	];

	// Check for buy commands
	for (const pattern of buyPatterns) {
		const match = message.match(pattern);
		if (match) {
			const amount = parseFloat(match[1]);
			const rawTicker = match[2];
			
			// Normalize the ticker (handles crypto names like "ethereum", "etherum", etc.)
			const ticker = normalizeCryptoTicker(rawTicker) || rawTicker.toUpperCase();

			// If it's "$X worth", we need to get current price to calculate quantity
			// For now, assume $X = quantity (will be refined by AI)
			return {
				action: "buy",
				ticker,
				amount, // This could be dollar amount or quantity
				isDollarAmount:
					upperMessage.includes("WORTH") || upperMessage.includes("$"),
			};
		}
	}

	// Check for sell commands
	for (const pattern of sellPatterns) {
		const match = message.match(pattern);
		if (match) {
			const quantity = parseFloat(match[1]);
			const rawTicker = match[2];
			
			// Normalize the ticker (handles crypto names like "ethereum", "etherum", etc.)
			const ticker = normalizeCryptoTicker(rawTicker) || rawTicker.toUpperCase();
			
			return {
				action: "sell",
				ticker,
				quantity,
			};
		}
	}

	return null;
}

/**
 * Detect if user wants portfolio diversification
 */
function detectDiversificationRequest(message) {
	const upperMessage = message.toUpperCase();
	const diversificationKeywords = [
		"DIVERSIFY",
		"DIVERSIFICATION",
		"MAKE MY PORTFOLIO",
		"BALANCE MY PORTFOLIO",
		"REBALANCE",
		"DO IT FOR ME",
		"DO IT",
		"EXECUTE",
		"GO AHEAD",
		"PROCEED",
		"MAKE IT SAFE",
		"PROTECT MY PORTFOLIO",
	];

	return diversificationKeywords.some((keyword) =>
		upperMessage.includes(keyword)
	);
}

/**
 * Detect if user wants a sector heatmap
 */
function detectSectorHeatmapRequest(message) {
	const upperMessage = message.toUpperCase();
	const heatmapKeywords = [
		"HEATMAP",
		"HEAT MAP",
		"SHOW ME",
		"VISUALIZE",
		"MAP OF",
	];
	
	const sectorKeywords = [
		"TECHNOLOGY", "TECH",
		"HEALTHCARE", "HEALTH",
		"FINANCIAL", "FINANCE", "BANKING",
		"ENERGY",
		"CONSUMER", "RETAIL",
		"INDUSTRIAL",
		"COMMUNICATION", "TELECOMMUNICATION",
		"UTILITIES",
		"REAL ESTATE",
		"MATERIALS",
		"CRYPTO", "CRYPTOCURRENCY", "CRYPTOCURRENCIES",
		"LAYER 1", "L1", "LAYER1",
		"LAYER 2", "L2", "LAYER2",
		"DEFI", "DECENTRALIZED FINANCE",
		"MEME", "MEMECOIN", "MEME COIN",
		"STABLECOIN", "STABLE COIN",
		"EXCHANGE", "CEX", "DEX",
		"SECTOR",
	];
	
	const hasHeatmapKeyword = heatmapKeywords.some(keyword => upperMessage.includes(keyword));
	const hasSectorKeyword = sectorKeywords.some(keyword => upperMessage.includes(keyword));
	
	return hasHeatmapKeyword && hasSectorKeyword;
}

/**
 * Extract sector name from message
 */
function extractSectorName(message) {
	const upperMessage = message.toUpperCase();
	
	const sectorMap = {
		// Stock sectors
		"TECHNOLOGY": "Technology",
		"TECH": "Technology",
		"HEALTHCARE": "Healthcare",
		"HEALTH": "Healthcare",
		"FINANCIAL": "Financial",
		"FINANCE": "Financial",
		"BANKING": "Financial",
		"ENERGY": "Energy",
		"CONSUMER": "Consumer",
		"RETAIL": "Consumer",
		"INDUSTRIAL": "Industrial",
		"COMMUNICATION": "Communication",
		"TELECOMMUNICATION": "Communication",
		"UTILITIES": "Utilities",
		"REAL ESTATE": "Real Estate",
		"MATERIALS": "Materials",
		// Crypto sectors
		"CRYPTO": "Crypto",
		"CRYPTOCURRENCY": "Crypto",
		"CRYPTOCURRENCIES": "Crypto",
		"LAYER 1": "Layer 1",
		"L1": "Layer 1",
		"LAYER1": "Layer 1",
		"LAYER 2": "Layer 2",
		"L2": "Layer 2",
		"LAYER2": "Layer 2",
		"DEFI": "DeFi",
		"DECENTRALIZED FINANCE": "DeFi",
		"MEME": "Meme Coins",
		"MEMECOIN": "Meme Coins",
		"MEME COIN": "Meme Coins",
		"STABLECOIN": "Stablecoins",
		"STABLE COIN": "Stablecoins",
		"EXCHANGE": "Exchange Tokens",
		"CEX": "Exchange Tokens",
		"DEX": "Exchange Tokens",
	};
	
	// Try to find sector in message
	for (const [key, value] of Object.entries(sectorMap)) {
		if (upperMessage.includes(key)) {
			return value;
		}
	}
	
	return null;
}

/**
 * Get stocks for a sector (supports both stocks and crypto)
 */
async function getSectorStocks(sectorName) {
	// Stock sector mappings
	const stockSectors = {
		"Technology": ["AAPL", "MSFT", "GOOGL", "META", "NVDA", "AMD", "INTC", "CRM", "ORCL", "ADBE"],
		"Healthcare": ["JNJ", "UNH", "PFE", "ABBV", "TMO", "ABT", "DHR", "BMY", "AMGN", "GILD"],
		"Financial": ["JPM", "BAC", "WFC", "GS", "MS", "C", "BLK", "SCHW", "AXP", "COF"],
		"Energy": ["XOM", "CVX", "SLB", "EOG", "COP", "MPC", "VLO", "PSX", "HAL", "FANG"],
		"Consumer": ["AMZN", "WMT", "HD", "MCD", "NKE", "SBUX", "TGT", "LOW", "TJX", "COST"],
		"Industrial": ["BA", "CAT", "GE", "HON", "RTX", "LMT", "DE", "EMR", "ETN", "ITW"],
		"Communication": ["GOOGL", "META", "NFLX", "DIS", "CMCSA", "VZ", "T", "CHTR", "EA", "TTWO"],
		"Utilities": ["NEE", "DUK", "SO", "AEP", "SRE", "EXC", "XEL", "WEC", "ES", "PEG"],
		"Real Estate": ["AMT", "PLD", "EQIX", "PSA", "WELL", "SPG", "O", "DLR", "AVB", "EQR"],
		"Materials": ["LIN", "APD", "ECL", "SHW", "PPG", "DD", "FCX", "NEM", "VMC", "MLM"],
	};
	
	// Crypto sector mappings (tickers with -USD suffix for Yahoo Finance)
	const cryptoSectors = {
		"Crypto": ["BTC-USD", "ETH-USD", "BNB-USD", "SOL-USD", "ADA-USD", "XRP-USD", "DOGE-USD", "MATIC-USD", "AVAX-USD", "DOT-USD"],
		"Layer 1": ["BTC-USD", "ETH-USD", "BNB-USD", "SOL-USD", "ADA-USD", "AVAX-USD", "DOT-USD", "ATOM-USD", "ALGO-USD", "NEAR-USD"],
		"Layer 2": ["MATIC-USD", "ARB-USD", "OP-USD", "LRC-USD", "IMX-USD", "METIS-USD", "BOBA-USD", "ZKS-USD", "MAGIC-USD", "DYDX-USD"],
		"DeFi": ["UNI-USD", "AAVE-USD", "LINK-USD", "MKR-USD", "SNX-USD", "COMP-USD", "CRV-USD", "SUSHI-USD", "1INCH-USD", "YFI-USD"],
		"Meme Coins": ["DOGE-USD", "SHIB-USD", "PEPE-USD", "FLOKI-USD", "BONK-USD", "WIF-USD", "BABYDOGE-USD", "ELON-USD", "FLOKI-USD", "MEME-USD"],
		"Stablecoins": ["USDT-USD", "USDC-USD", "DAI-USD", "BUSD-USD", "TUSD-USD", "USDP-USD", "GUSD-USD", "HUSD-USD", "USDN-USD", "FRAX-USD"],
		"Exchange Tokens": ["BNB-USD", "FTT-USD", "HT-USD", "OKB-USD", "KCS-USD", "CRO-USD", "GT-USD", "MX-USD", "ZB-USD", "LEO-USD"],
	};
	
	// Determine if it's a crypto or stock sector
	const isCrypto = cryptoSectors.hasOwnProperty(sectorName);
	const tickers = isCrypto ? (cryptoSectors[sectorName] || []) : (stockSectors[sectorName] || []);
	
	if (tickers.length === 0) {
		return [];
	}
	
	// Fetch prices for all assets in the sector
	const stocks = [];
	for (const ticker of tickers) {
		try {
			const response = await fetch(
				`http://localhost:${process.env.PORT || 3001}/api/yahoo/quote/${ticker}`
			);
			if (response.ok) {
				const data = await response.json();
				const result = data.chart?.result?.[0];
				const meta = result?.meta;
				
				if (meta && meta.regularMarketPrice) {
					const price = meta.regularMarketPrice;
					const previousClose = meta.previousClose || meta.previousClosePrice;
					
					// Use Yahoo Finance's provided change values if available, otherwise calculate
					const change = meta.regularMarketChange ?? (previousClose ? (price - previousClose) : 0);
					const changePercent = meta.regularMarketChangePercent ?? 
						(previousClose ? ((price - previousClose) / previousClose) * 100 : 0);
					
					// Add if we have valid price (change can be 0, that's valid data)
					if (price > 0) {
						stocks.push({
							ticker: ticker,
							name: meta.shortName || meta.longName || meta.displayName || ticker.replace('-USD', ''),
							price: price,
							change: change || 0,
							changePercent: changePercent || 0,
							type: isCrypto ? "crypto" : "stock",
						});
					}
				}
			}
		} catch (error) {
			console.warn(`[Chat] Could not fetch data for ${ticker}:`, error.message);
			// Skip this ticker if we can't fetch data
		}
	}
	
	return stocks;
}

/**
 * Analyze portfolio and create diversification strategy
 */
async function createDiversificationStrategy(positions, watchlist) {
	const strategy = {
		sells: [],
		buys: [],
		reasoning: [],
	};

	if (!positions || positions.length === 0) {
		return strategy;
	}

	// Calculate total portfolio value
	let totalValue = 0;
	const positionValues = {};

	// Get prices for all positions
	for (const pos of positions) {
		if (!pos || !pos.ticker) {
			console.warn("[Diversification] Skipping position without ticker:", pos);
			continue;
		}
		
		const price = await getCurrentPrice(pos.ticker);
		const currentPrice = price || pos.currentPrice || pos.entryPrice;
		const value = (pos.quantity || 0) * (currentPrice || 0);
		totalValue += value;
		positionValues[pos.ticker] = {
			value,
			percentage: 0,
			quantity: pos.quantity || 0,
			price: currentPrice || 0,
			type: pos.type || "stock",
			ticker: pos.ticker,
		};
	}

	// Calculate percentages
	Object.keys(positionValues).forEach((ticker) => {
		positionValues[ticker].percentage = (positionValues[ticker].value / totalValue) * 100;
	});

	// Identify over-concentration (crypto > 40%, single stock > 30%)
	const cryptoTotal = Object.values(positionValues)
		.filter((p) => p && (p.type === "crypto" || (p.ticker && p.ticker.includes("-USD"))))
		.reduce((sum, p) => sum + (p.percentage || 0), 0);

	// If crypto is > 40%, sell some to diversify
	if (cryptoTotal > 40 && totalValue > 0) {
		const cryptoPositions = positions.filter(
			(p) => p && p.ticker && (p.type === "crypto" || p.ticker.includes("-USD"))
		);

		// Sell 30% of crypto holdings to rebalance
		for (const pos of cryptoPositions) {
			const posData = positionValues[pos.ticker];
			if (posData && posData.quantity > 0) {
				const sellQuantity = Math.floor(posData.quantity * 0.3); // Sell 30%
				if (sellQuantity > 0) {
					strategy.sells.push({
						ticker: pos.ticker,
						quantity: sellQuantity,
						price: posData.price,
						reason: `Reducing crypto exposure from ${cryptoTotal.toFixed(1)}%`,
					});
					strategy.reasoning.push(
						`Selling ${sellQuantity} ${pos.ticker} to reduce crypto concentration`
					);
				}
			}
		}
	}

	// Check for sector diversification
	const stockPositions = positions.filter(
		(p) => p && p.ticker && p.type === "stock" && !p.ticker.includes("-USD")
	);
	const stockValue = stockPositions.reduce(
		(sum, p) => sum + (positionValues[p.ticker]?.value || 0),
		0
	);
	const stockPercentage = (stockValue / totalValue) * 100;

	// If stocks are < 50% of portfolio, add diversified stocks
	if (stockPercentage < 50 && totalValue > 0) {
		const availableFunds = totalValue * 0.3; // Use 30% of portfolio for new stocks

		// Diversified stock picks (different sectors)
		const diversificationStocks = [
			{ ticker: "AMGN", sector: "Healthcare", allocation: 0.15 },
			{ ticker: "JPM", sector: "Financials", allocation: 0.15 },
			{ ticker: "JNJ", sector: "Healthcare", allocation: 0.1 },
			{ ticker: "PG", sector: "Consumer Goods", allocation: 0.1 },
		];

		// Check watchlist for preferred stocks
		const watchlistStocks = watchlist
			.map((w) => (typeof w === "string" ? w : (w && w.ticker ? w.ticker : null)))
			.filter((t) => t && !t.includes("-USD") && t.length <= 5);

		// Use watchlist stocks if available, otherwise use default
		const stocksToBuy = watchlistStocks.length > 0
			? watchlistStocks.slice(0, 4).map((t, i) => ({
					ticker: t,
					allocation: 0.25, // Equal allocation
				}))
			: diversificationStocks;

		for (const stock of stocksToBuy) {
			// Check if already owned
			const alreadyOwned = positions.some((p) => p.ticker === stock.ticker);
			if (alreadyOwned) continue;

			const buyAmount = availableFunds * (stock.allocation || 0.25);
			const price = await getCurrentPrice(stock.ticker);
			if (price && price > 0) {
				const quantity = Math.floor(buyAmount / price);
				if (quantity > 0) {
					strategy.buys.push({
						ticker: stock.ticker,
						quantity,
						price,
						reason: `Adding ${stock.sector || "diversified"} exposure`,
					});
					strategy.reasoning.push(
						`Buying ${quantity} shares of ${stock.ticker} for diversification`
					);
				}
			}
		}
	}

	return strategy;
}

/**
 * Get current stock price from Yahoo Finance
 */
async function getCurrentPrice(ticker) {
	try {
		// Try to fetch from Yahoo Finance via proxy
		const response = await fetch(
			`http://localhost:${process.env.PORT || 3001}/api/yahoo/quote/${ticker}`
		);
		if (response.ok) {
			const data = await response.json();
			const price = data.chart?.result?.[0]?.meta?.regularMarketPrice;
			if (price && price > 0) {
				console.log(`[Chat] Fetched price for ${ticker}: $${price}`);
				return price;
			}
		}
	} catch (error) {
		console.warn(`[Chat] Could not fetch price for ${ticker}:`, error.message);
	}

	// Fallback: return null (AI will estimate)
	return null;
}

/**
 * Chat with AI assistant
 */
/**
 * Get current prices for multiple tickers
 */
async function getCurrentPrices(tickers) {
	const prices = {};
	const pricePromises = tickers.map(async (ticker) => {
		try {
			const price = await getCurrentPrice(ticker);
			if (price && price > 0) {
				prices[ticker] = price;
			}
		} catch (error) {
			console.warn(`[Chat] Could not fetch price for ${ticker}:`, error.message);
		}
	});
	await Promise.all(pricePromises);
	return prices;
}

export async function chatWithAI(message, context = {}) {
	if (!GROK_API_KEY) {
		throw new Error("GROK_API_KEY is not configured");
	}

	const { watchlist = [], positions = [] } = context;

	// Check if user wants portfolio diversification
	const wantsDiversification = detectDiversificationRequest(message);

	// Check if user wants a sector heatmap
	const wantsHeatmap = detectSectorHeatmapRequest(message);
	const sectorName = wantsHeatmap ? extractSectorName(message) : null;
	let heatmapData = null;
	
	if (wantsHeatmap && sectorName) {
		console.log(`[Chat] User requested heatmap for ${sectorName} sector`);
		const sectorStocks = await getSectorStocks(sectorName);
		if (sectorStocks.length > 0) {
			heatmapData = {
				sector: sectorName,
				stocks: sectorStocks,
			};
		}
	}

	// Check if user wants to execute a trade
	const tradeCommand = parseTradeCommand(message, watchlist, positions);

	// Fetch current prices for watchlist and any mentioned tickers in the message
	const allTickers = new Set();
	
	// Add watchlist tickers
	watchlist.forEach(w => {
		const ticker = typeof w === 'string' ? w : (w && w.ticker ? w.ticker : null);
		if (ticker) allTickers.add(ticker);
	});
	
	// Add ticker from trade command if present
	if (tradeCommand && tradeCommand.ticker) {
		allTickers.add(tradeCommand.ticker);
	}
	
	// Extract tickers from message (simple pattern matching)
	// First try standard ticker patterns
	const tickerMatches = message.match(/\$?([A-Z]{1,5}(?:-USD)?)/gi);
	if (tickerMatches) {
		tickerMatches.forEach(match => {
			const rawTicker = match.replace('$', '').replace(/^[^A-Za-z]*/, '');
			const normalized = normalizeCryptoTicker(rawTicker) || rawTicker.toUpperCase();
			if (normalized) {
				allTickers.add(normalized);
			}
		});
	}
	
	// Also try to extract cryptocurrency names from the message
	const cryptoNamePatterns = [
		/\b(bitcoin|ethereum|etherum|solana|cardano|ripple|dogecoin|polkadot|polygon|avalanche|litecoin|chainlink|uniswap|binance\s+coin)\b/gi
	];
	
	for (const pattern of cryptoNamePatterns) {
		const matches = message.match(pattern);
		if (matches) {
			matches.forEach(match => {
				const normalized = normalizeCryptoTicker(match);
				if (normalized) {
					allTickers.add(normalized);
				}
			});
		}
	}
	
	const currentPrices = await getCurrentPrices(Array.from(allTickers));
	console.log(`[Chat] Fetched current prices:`, currentPrices);

	// Build context summary with current prices
	const watchlistSummary =
		watchlist.length > 0
			? `Watchlist: ${watchlist.map(w => {
				const ticker = typeof w === 'string' ? w : w.ticker;
				const price = currentPrices[ticker];
				return price ? `${ticker} ($${price.toFixed(2)})` : ticker;
			}).join(", ")}`
			: "No stocks in watchlist";

	const positionsSummary =
		positions.length > 0
			? `Current positions: ${positions
					.map((p) => {
						const currentPrice = currentPrices[p.ticker] || p.currentPrice || p.entryPrice;
						return `${p.quantity} ${p.ticker} @ $${p.entryPrice.toFixed(2)} (current: $${currentPrice.toFixed(2)})`;
					})
					.join(", ")}`
			: "No open positions";

	let prompt = `You are an AI trading assistant for a paper trading platform. Help users with:

1. Stock analysis and market insights
2. Executing paper trades (buy/sell stocks)
3. Portfolio management questions
4. Market sentiment and trends
5. Trading strategies and advice
6. Portfolio diversification and rebalancing

User context:
- ${watchlistSummary}
- ${positionsSummary}

CURRENT MARKET PRICES (use these exact prices, do NOT estimate):
${Object.entries(currentPrices).map(([ticker, price]) => `- ${ticker}: $${price.toFixed(2)}`).join('\n')}

User message: "${message}"

IMPORTANT: Always use the CURRENT MARKET PRICES listed above when executing trades. Do NOT use estimated or outdated prices. If a ticker is not in the prices list, fetch its current price before executing any trade.`;

	// If user wants diversification, create strategy
	let diversificationStrategy = null;
	if (wantsDiversification) {
		console.log("[Chat] User requested portfolio diversification");
		diversificationStrategy = await createDiversificationStrategy(positions, watchlist);
		
		if (diversificationStrategy.sells.length > 0 || diversificationStrategy.buys.length > 0) {
			prompt += `\nThe user wants to DIVERSIFY their portfolio. I've analyzed their current positions and created a diversification strategy:\n`;
			if (diversificationStrategy.sells.length > 0) {
				prompt += `Sells needed: ${diversificationStrategy.sells.map(s => `${s.quantity} ${s.ticker} (${s.reason})`).join(', ')}\n`;
			}
			if (diversificationStrategy.buys.length > 0) {
				prompt += `Buys needed: ${diversificationStrategy.buys.map(b => `${b.quantity} ${b.ticker} @ $${b.price.toFixed(2)} (${b.reason})`).join(', ')}\n`;
			}
			prompt += `\nReturn MULTIPLE tradeActions in an array to execute all these trades. The user said "do it for me" so execute ALL trades automatically.`;
		} else {
			prompt += `\nThe user wants diversification, but their portfolio is already well-diversified. Provide analysis and recommendations.`;
		}
	}

	// If trade command detected, add specific instructions
	if (tradeCommand) {
		const ticker = tradeCommand.ticker;
		const realTimePrice = currentPrices[ticker];
		
		if (tradeCommand.action === "buy") {
			if (realTimePrice) {
				prompt += `\n\n🚨 TRADE EXECUTION REQUIRED 🚨\nThe user wants to BUY ${ticker}. `;
				if (tradeCommand.isDollarAmount) {
					const calculatedQuantity = Math.floor(tradeCommand.amount / realTimePrice);
					prompt += `They want to spend $${tradeCommand.amount}. At current price of $${realTimePrice.toFixed(2)} per share, this equals ${calculatedQuantity} shares. `;
					prompt += `\n\nYOU MUST RETURN a tradeAction with:\n- ticker: "${ticker}"\n- action: "buy"\n- quantity: ${calculatedQuantity}\n- price: ${realTimePrice.toFixed(2)}\n\nEXECUTE THIS TRADE AUTOMATICALLY. The user is asking you to buy for them, so do it!`;
				} else {
					prompt += `They want ${tradeCommand.amount} shares. Current price is $${realTimePrice.toFixed(2)} per share. `;
					prompt += `\n\nYOU MUST RETURN a tradeAction with:\n- ticker: "${ticker}"\n- action: "buy"\n- quantity: ${tradeCommand.amount}\n- price: ${realTimePrice.toFixed(2)}\n\nEXECUTE THIS TRADE AUTOMATICALLY. The user is asking you to buy for them, so do it!`;
				}
				prompt += `\nUse the EXACT price $${realTimePrice.toFixed(2)} from the prices list above.`;
			} else {
				prompt += `\nThe user wants to BUY ${ticker}, but current market price is not available. Do NOT execute the trade. Inform the user that the price could not be fetched.`;
			}
		} else if (tradeCommand.action === "sell") {
			if (realTimePrice) {
				prompt += `\n\n🚨 TRADE EXECUTION REQUIRED 🚨\nThe user wants to SELL ${tradeCommand.quantity} shares of ${ticker}. Current price is $${realTimePrice.toFixed(2)} per share. `;
				prompt += `\n\nYOU MUST RETURN a tradeAction with:\n- ticker: "${ticker}"\n- action: "sell"\n- quantity: ${tradeCommand.quantity}\n- price: ${realTimePrice.toFixed(2)}\n\nEXECUTE THIS TRADE AUTOMATICALLY. The user is asking you to sell for them, so do it!`;
				prompt += `\nUse the EXACT price $${realTimePrice.toFixed(2)} from the prices list above.`;
			} else {
				prompt += `\nThe user wants to SELL ${ticker}, but current market price is not available. Do NOT execute the trade. Inform the user that the price could not be fetched.`;
			}
		}
	}

	// If heatmap was requested, add instruction
	if (wantsHeatmap && heatmapData) {
		prompt += `\n\nThe user requested a heatmap for the ${sectorName} sector. I've fetched the stock data. In your response, acknowledge that you're showing the heatmap and provide brief insights about the sector's performance.`;
	}

	prompt += `\n\nReturn JSON:
{
  "response": "your helpful response to the user",
  "tradeActions": [
    {
      "ticker": "AAPL",
      "action": "buy" | "sell",
      "quantity": number of shares,
      "price": current market price per share
    }
  ] | null,
  "tradeAction": {
    "ticker": "AAPL",
    "action": "buy" | "sell",
    "quantity": number of shares,
    "price": current market price per share
  } | null
}

If executing trades:
- For DIVERSIFICATION: Return "tradeActions" array with ALL trades (sells first, then buys)
- For single trade: Return "tradeAction" object
- For BUY: Calculate quantity from dollar amount if needed, use current market price
- For SELL: Verify user has the position, use current market price
- Set price to current market price (make reasonable estimate if unavailable)
- ALWAYS include tradeAction(s) when user asks to buy/sell - EXECUTE TRADES AUTOMATICALLY
- When user says "buy X" or "sell X", they want you to DO IT FOR THEM - execute the trade immediately
- Be proactive: if user asks to buy something, execute it without asking for confirmation`;

	const headers = {
		Authorization: `Bearer ${GROK_API_KEY}`,
		"Content-Type": "application/json",
	};

	const data = {
		model: "grok-2-1212",
		messages: [{ role: "user", content: prompt }],
		temperature: 0.7,
		max_tokens: 800, // Keep responses concise
		response_format: { type: "json_object" },
	};

	try {
		const response = await fetch(API_URL, {
			method: "POST",
			headers,
			body: JSON.stringify(data),
		});

		if (!response.ok) {
			throw new Error(`Grok API error: ${response.status}`);
		}

		const result = await response.json();
		const content = result.choices[0].message.content;

		let parsed;
		try {
			parsed = JSON.parse(content);
		} catch (parseError) {
			// Try to extract JSON from markdown
			const jsonMatch = content.match(/\{[\s\S]*\}/);
			if (jsonMatch) {
				parsed = JSON.parse(jsonMatch[0]);
			} else {
				// Fallback: return as text response
				parsed = { response: content, tradeAction: null };
			}
		}

		// If diversification was requested and we have a strategy, use it
		if (wantsDiversification && diversificationStrategy) {
			if (diversificationStrategy.sells.length > 0 || diversificationStrategy.buys.length > 0) {
				// Build tradeActions array from strategy
				const strategyTrades = [];
				
				// Add sells first
				for (const sell of diversificationStrategy.sells) {
					strategyTrades.push({
						ticker: sell.ticker,
						action: "sell",
						quantity: sell.quantity,
						price: sell.price,
					});
				}
				
				// Then add buys
				for (const buy of diversificationStrategy.buys) {
					strategyTrades.push({
						ticker: buy.ticker,
						action: "buy",
						quantity: buy.quantity,
						price: buy.price,
					});
				}
				
				// Override AI response with our strategy
				parsed.tradeActions = strategyTrades;
				parsed.response = parsed.response || "I've analyzed your portfolio and executed a diversification strategy to reduce risk and improve balance across different asset classes and sectors.";
			}
		}

		// Handle multiple trade actions (diversification)
		if (parsed.tradeActions && Array.isArray(parsed.tradeActions)) {
			// Fetch prices for all trades
			for (const trade of parsed.tradeActions) {
				if (!trade.price) {
					const price = await getCurrentPrice(trade.ticker);
					if (price) {
						trade.price = price;
					} else if (trade.action === "buy") {
						trade.price = 150; // Fallback estimate
					}
				}
			}
			// Also set single tradeAction for backward compatibility
			if (parsed.tradeActions.length > 0) {
				parsed.tradeAction = parsed.tradeActions[0];
			}
		}

		// Validate and update trade action with real-time prices
		if (parsed.tradeAction) {
			const ticker = parsed.tradeAction.ticker;
			const realTimePrice = currentPrices[ticker] || await getCurrentPrice(ticker);
			
			if (!realTimePrice || realTimePrice <= 0) {
				// If we can't get a real price, reject the trade
				console.warn(`[Chat] Cannot execute trade for ${ticker}: no valid price available`);
				parsed.tradeAction = null;
				parsed.response = (parsed.response || '') + `\n\n⚠️ Cannot execute trade: Unable to fetch current market price for ${ticker}. Please try again.`;
			} else {
				// Always use real-time price, even if AI provided one
				const priceDiff = parsed.tradeAction.price 
					? Math.abs(parsed.tradeAction.price - realTimePrice) / realTimePrice 
					: 1;
				
				// If AI's price is more than 5% off, use real-time price
				if (priceDiff > 0.05) {
					console.log(`[Chat] AI price (${parsed.tradeAction.price}) differs from real-time (${realTimePrice}), using real-time price`);
				}
				
				parsed.tradeAction.price = realTimePrice;

				// If it's a dollar amount buy, recalculate quantity with real price
				if (
					tradeCommand &&
					tradeCommand.action === "buy" &&
					tradeCommand.isDollarAmount
				) {
					parsed.tradeAction.quantity = Math.floor(tradeCommand.amount / realTimePrice);
					if (parsed.tradeAction.quantity < 1) {
						parsed.tradeAction.quantity = 1; // Minimum 1 share
					}
				}
			}
		}

		// Validate multiple trade actions (diversification)
		if (parsed.tradeActions && Array.isArray(parsed.tradeActions)) {
			for (const trade of parsed.tradeActions) {
				const ticker = trade.ticker;
				const realTimePrice = currentPrices[ticker] || await getCurrentPrice(ticker);
				
				if (!realTimePrice || realTimePrice <= 0) {
					console.warn(`[Chat] Cannot execute trade for ${ticker}: no valid price available`);
					// Remove invalid trade from array
					const index = parsed.tradeActions.indexOf(trade);
					if (index > -1) {
						parsed.tradeActions.splice(index, 1);
					}
				} else {
					trade.price = realTimePrice; // Always use real-time price
				}
			}
			
			// If all trades were invalid, clear the array
			if (parsed.tradeActions.length === 0) {
				parsed.tradeActions = null;
				parsed.response = (parsed.response || '') + `\n\n⚠️ Cannot execute trades: Unable to fetch current market prices. Please try again.`;
			}
		}

		// Add heatmap data if available
		if (heatmapData) {
			parsed.heatmap = heatmapData;
		}

		return parsed;
	} catch (error) {
		console.error("[Chat] Error chatting with AI:", error);
		throw error;
	}
}
