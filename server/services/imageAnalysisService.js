import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const GROK_API_KEY = process.env.GROK_API_KEY;
const API_URL = 'https://api.x.ai/v1/chat/completions';

/**
 * Download image and convert to base64
 */
async function imageToBase64(imageUrl) {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    const buffer = await response.buffer();
    return buffer.toString('base64');
  } catch (error) {
    console.error('Error converting image to base64:', error);
    throw error;
  }
}

/**
 * Analyze flow image using Grok Vision API
 */
export async function analyzeFlowImage(imageUrl) {
  if (!GROK_API_KEY) {
    throw new Error('GROK_API_KEY is not configured');
  }

  try {
    console.log(`[ImageAnalysis] Analyzing image: ${imageUrl}`);
    
    // Convert image to base64
    const base64Image = await imageToBase64(imageUrl);
    const imageDataUrl = `data:image/jpeg;base64,${base64Image}`;

    const prompt = `You are analyzing an options flow image from Twitter. Extract the following information from this image:

1. Stock Symbol/Ticker (e.g., AAPL, TSLA, SPY)
2. Expiration Date (format: MM/DD or MMM DD, e.g., "1/19", "01/19", "JAN 19", "2024-01-19")
3. Strike Price (the strike price of the option, e.g., $150, 150, 150.00)
4. Premium/Price (the premium paid for the option, e.g., $2.50, 2.50)
5. Option Type (CALL or PUT)
6. Action (BUY or SELL - determine if this is a buy or sell flow)
7. Volume/Size (if visible, the number of contracts)

Look carefully at the image. The image may contain:
- A chart or graph showing options flow
- Text overlays with ticker symbols, dates, strike prices
- Numbers and labels indicating option details
- Flow direction indicators (buy/sell)

Return ONLY valid JSON with this structure:
{
  "ticker": "AAPL" or null,
  "expirationDate": "1/19" or null,
  "strikePrice": 150.00 or null,
  "premium": 2.50 or null,
  "optionType": "call" or "put" or null,
  "action": "buy" or "sell" or null,
  "volume": 100 or null,
  "confidence": "high" or "medium" or "low"
}

If you cannot find a value, set it to null. Be precise and only extract what you can clearly see.`;

    const headers = {
      Authorization: `Bearer ${GROK_API_KEY}`,
      'Content-Type': 'application/json',
    };

    const data = {
      model: 'grok-2-1212', // Grok model (will try vision if supported)
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt,
            },
            {
              type: 'image_url',
              image_url: {
                url: imageDataUrl,
              },
            },
          ],
        },
      ],
      temperature: 0.1, // Low temperature for more accurate extraction
      max_tokens: 500,
      response_format: { type: 'json_object' },
    };

    const response = await fetch(API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ImageAnalysis] API error:', response.status, errorText);
      throw new Error(`Grok API error: ${response.status}`);
    }

    const result = await response.json();
    const content = result.choices[0].message.content;

    // Parse JSON response
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      console.error('[ImageAnalysis] JSON parse error:', parseError);
      // Try to extract JSON from markdown if present
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse JSON from response');
      }
    }

    console.log('[ImageAnalysis] Extracted data:', parsed);
    return parsed;
  } catch (error) {
    console.error('[ImageAnalysis] Error analyzing image:', error);
    throw error;
  }
}

