import dotenv from 'dotenv';
import fetch from 'node-fetch';
import Tesseract from 'tesseract.js';
import { createWorker } from 'tesseract.js';

dotenv.config();

const GROK_API_KEY = process.env.GROK_API_KEY;
const API_URL = 'https://api.x.ai/v1/chat/completions';

// Cache for analyzed images (in-memory, can be upgraded to Redis for production)
const analysisCache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour cache

// Pre-initialize Tesseract worker for faster processing
let worker = null;
let workerInitialized = false;

/**
 * Initialize Tesseract worker (do this once at startup)
 */
async function initializeWorker() {
  if (workerInitialized && worker) {
    return worker;
  }
  
  try {
    console.log('[OCR] Initializing Tesseract worker...');
    worker = await createWorker('eng', 1, {
      logger: () => {}, // Disable verbose logging
    });
    
    // Optimize for speed
    await worker.setParameters({
      tessedit_pageseg_mode: '6', // Assume uniform block of text
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$.,/:- ',
    });
    
    workerInitialized = true;
    console.log('[OCR] Worker initialized successfully');
    return worker;
  } catch (error) {
    console.error('[OCR] Failed to initialize worker:', error);
    workerInitialized = false;
    return null;
  }
}

// Initialize worker on module load (non-blocking)
initializeWorker().catch(console.error);

/**
 * Download image and convert to buffer (with caching)
 */
async function downloadImage(imageUrl) {
  try {
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error('Error downloading image:', error);
    throw error;
  }
}

/**
 * Preprocess image for faster OCR (resize if too large)
 */
function preprocessImage(imageBuffer) {
  // For now, just return the buffer as-is
  // In production, you could use sharp or jimp to:
  // - Resize if > 2000px width
  // - Increase contrast
  // - Convert to grayscale
  // - Apply noise reduction
  
  // Quick check: if buffer is very large (> 5MB), we might want to resize
  // But for now, Tesseract handles this reasonably well
  return imageBuffer;
}

/**
 * Extract text from image using OCR (Tesseract.js) - Optimized for speed
 */
async function extractTextFromImage(imageBuffer) {
  try {
    const startTime = Date.now();
    
    // Use pre-initialized worker if available, otherwise fallback to recognize
    if (worker && workerInitialized) {
      const { data: { text } } = await worker.recognize(imageBuffer);
      const duration = Date.now() - startTime;
      console.log(`[OCR] Extracted text in ${duration}ms:`, text.substring(0, 100) + '...');
      return text;
    } else {
      // Fallback: use recognize with optimized settings
      const { data: { text } } = await Tesseract.recognize(imageBuffer, 'eng', {
        logger: () => {}, // Disable logging for speed
        // Optimize for speed
        options: {
          tessedit_pageseg_mode: '6', // Assume uniform block
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$.,/:- ',
        },
      });
      const duration = Date.now() - startTime;
      console.log(`[OCR] Extracted text in ${duration}ms:`, text.substring(0, 100) + '...');
      return text;
    }
  } catch (error) {
    console.error('[OCR] Error extracting text:', error);
    throw error;
  }
}

/**
 * Parse extracted text to find flow information
 */
function parseFlowDataFromText(text, fallbackTicker = null) {
  const upperText = text.toUpperCase();
  const result = {
    ticker: null,
    expirationDate: null,
    strikePrice: null,
    premium: null,
    optionType: null,
    action: null,
    volume: null,
    confidence: 'medium',
  };

  // Extract ticker (common stock symbols, 1-5 uppercase letters)
  const tickerPatterns = [
    /\$([A-Z]{1,5})\b/g,
    /\b([A-Z]{1,5})\s+(?:CALL|PUT|OPTION|STRIKE)/gi,
    /\b([A-Z]{2,5})\s+\d{1,2}\/\d{1,2}/g, // Ticker before date
  ];
  
  for (const pattern of tickerPatterns) {
    const match = upperText.match(pattern);
    if (match) {
      const ticker = match[0].replace(/[^A-Z]/g, '');
      if (ticker.length >= 1 && ticker.length <= 5) {
        result.ticker = ticker;
        break;
      }
    }
  }

  // Use fallback ticker if not found
  if (!result.ticker && fallbackTicker) {
    result.ticker = fallbackTicker.toUpperCase();
  }

  // Extract expiration date
  const datePatterns = [
    /\b(\d{1,2}\/\d{1,2})\b/g, // 1/19, 01/19
    /\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s*(\d{1,2})\b/gi, // JAN 19
    /\b(\d{4}-\d{2}-\d{2})\b/g, // 2024-01-19
  ];

  for (const pattern of datePatterns) {
    const match = upperText.match(pattern);
    if (match) {
      result.expirationDate = match[0];
      break;
    }
  }

  // Extract strike price
  const strikePatterns = [
    /STRIKE[:\s]+\$?(\d+(?:\.\d+)?)/gi,
    /\$(\d{3,}(?:\.\d+)?)/g, // $150, $150.00
    /\b(\d{3,}(?:\.\d+)?)\s*(?:STRIKE|CALL|PUT)/gi,
  ];

  for (const pattern of strikePatterns) {
    const match = upperText.match(pattern);
    if (match) {
      const numMatch = match[0].match(/(\d+(?:\.\d+)?)/);
      if (numMatch) {
        result.strikePrice = parseFloat(numMatch[1]);
        break;
      }
    }
  }

  // Extract premium
  const premiumPatterns = [
    /PREMIUM[:\s]+\$?(\d+(?:\.\d+)?)/gi,
    /\$(\d+\.\d{2})\b/g, // $2.50
    /PRICE[:\s]+\$?(\d+(?:\.\d+)?)/gi,
  ];

  for (const pattern of premiumPatterns) {
    const match = upperText.match(pattern);
    if (match) {
      const numMatch = match[0].match(/(\d+(?:\.\d+)?)/);
      if (numMatch) {
        result.premium = parseFloat(numMatch[1]);
        break;
      }
    }
  }

  // Determine option type
  if (upperText.includes('CALL') || upperText.includes('C')) {
    result.optionType = 'call';
  } else if (upperText.includes('PUT') || upperText.includes('P')) {
    result.optionType = 'put';
  }

  // Determine action
  if (upperText.includes('BUY') || upperText.includes('LONG') || upperText.includes('CALL BUYER')) {
    result.action = 'buy';
  } else if (upperText.includes('SELL') || upperText.includes('SHORT') || upperText.includes('PUT BUYER')) {
    result.action = 'sell';
  } else if (result.optionType) {
    // Default to buy if option type is known
    result.action = 'buy';
  }

  // Extract volume
  const volumePatterns = [
    /VOLUME[:\s]+(\d+)/gi,
    /SIZE[:\s]+(\d+)/gi,
    /\b(\d+)\s*(?:CONTRACT|CT)/gi,
  ];

  for (const pattern of volumePatterns) {
    const match = upperText.match(pattern);
    if (match) {
      const numMatch = match[0].match(/(\d+)/);
      if (numMatch) {
        result.volume = parseInt(numMatch[1], 10);
        break;
      }
    }
  }

  // Set confidence based on how much data we found
  const foundFields = Object.values(result).filter(v => v !== null && v !== 'medium').length;
  if (foundFields >= 5) {
    result.confidence = 'high';
  } else if (foundFields >= 3) {
    result.confidence = 'medium';
  } else {
    result.confidence = 'low';
  }

  return result;
}

/**
 * Analyze flow image using OCR and then Grok AI for parsing (with caching)
 */
export async function analyzeFlowImage(imageUrl, fallbackTicker = null) {
  const startTime = Date.now();
  
  try {
    // Check cache first
    const cacheKey = `${imageUrl}:${fallbackTicker || ''}`;
    const cached = analysisCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      console.log(`[ImageAnalysis] Using cached result for ${imageUrl.substring(0, 50)}...`);
      return cached.data;
    }

    console.log(`[ImageAnalysis] Analyzing image: ${imageUrl}`);
    
    // Download image
    const downloadStart = Date.now();
    const imageBuffer = await downloadImage(imageUrl);
    const downloadTime = Date.now() - downloadStart;
    console.log(`[ImageAnalysis] Image downloaded in ${downloadTime}ms`);
    
    // Preprocess image (resize if needed)
    const processedBuffer = preprocessImage(imageBuffer);
    
    // Extract text using OCR
    const extractedText = await extractTextFromImage(processedBuffer);
    
    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error('No text could be extracted from image');
    }

    // Parse the extracted text (fast, synchronous)
    let parsedData = parseFlowDataFromText(extractedText, fallbackTicker);

    // Grok refinement is now optional and async (don't wait for it)
    // Return OCR results immediately, refine in background if needed
    if (GROK_API_KEY && extractedText.length > 0 && parsedData.confidence === 'low') {
      // Only refine if confidence is low, and do it async
      refineAnalysisWithGrok(extractedText, parsedData)
        .then((refined) => {
          // Update cache with refined data
          const refinedData = { ...parsedData, ...refined };
          analysisCache.set(cacheKey, {
            data: refinedData,
            timestamp: Date.now(),
          });
        })
        .catch((grokError) => {
          console.warn('[ImageAnalysis] Grok refinement failed:', grokError.message);
        });
    }

    // Cache the result
    analysisCache.set(cacheKey, {
      data: parsedData,
      timestamp: Date.now(),
    });

    // Clean up old cache entries (keep cache size reasonable)
    if (analysisCache.size > 100) {
      const now = Date.now();
      for (const [key, value] of analysisCache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
          analysisCache.delete(key);
        }
      }
    }

    const totalTime = Date.now() - startTime;
    console.log(`[ImageAnalysis] Analysis completed in ${totalTime}ms:`, parsedData);
    return parsedData;
  } catch (error) {
    console.error('[ImageAnalysis] Error analyzing image:', error);
    throw error;
  }
}

/**
 * Use Grok AI to refine the OCR-extracted text
 */
async function refineAnalysisWithGrok(extractedText, ocrResults) {
  if (!GROK_API_KEY) {
    return ocrResults;
  }

  const prompt = `I've extracted the following text from an options flow image using OCR. Please analyze it and extract structured information.

Extracted text:
${extractedText.substring(0, 1000)}

Current OCR results:
${JSON.stringify(ocrResults, null, 2)}

Please refine and extract the following information:
1. Stock Symbol/Ticker (e.g., AAPL, TSLA, SPY)
2. Expiration Date (format: MM/DD or MMM DD, e.g., "1/19", "01/19", "JAN 19")
3. Strike Price (the strike price of the option, e.g., 150, 150.00)
4. Premium/Price (the premium paid for the option, e.g., 2.50)
5. Option Type (CALL or PUT)
6. Action (BUY or SELL)
7. Volume/Size (number of contracts)

Return ONLY valid JSON with this structure (use null if not found):
{
  "ticker": "AAPL" or null,
  "expirationDate": "1/19" or null,
  "strikePrice": 150.00 or null,
  "premium": 2.50 or null,
  "optionType": "call" or "put" or null,
  "action": "buy" or "sell" or null,
  "volume": 100 or null
}`;

  try {
    const headers = {
      Authorization: `Bearer ${GROK_API_KEY}`,
      'Content-Type': 'application/json',
    };

    const data = {
      model: 'grok-2-1212',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    };

    const response = await fetch(API_URL, {
      method: 'POST',
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
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        return ocrResults; // Return OCR results if parsing fails
      }
    }

    // Merge with OCR results, preferring Grok's refined values
    return {
      ...ocrResults,
      ...parsed,
      // Only override if Grok found a value
      ticker: parsed.ticker || ocrResults.ticker,
      expirationDate: parsed.expirationDate || ocrResults.expirationDate,
      strikePrice: parsed.strikePrice || ocrResults.strikePrice,
      premium: parsed.premium || ocrResults.premium,
      optionType: parsed.optionType || ocrResults.optionType,
      action: parsed.action || ocrResults.action,
      volume: parsed.volume || ocrResults.volume,
    };
  } catch (error) {
    console.warn('[ImageAnalysis] Grok refinement error:', error.message);
    return ocrResults;
  }
}

