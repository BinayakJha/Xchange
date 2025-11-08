import { TwitterApi } from 'twitter-api-v2';
import dotenv from 'dotenv';

dotenv.config();

// Twitter API credentials
const TWITTER_ACCESS_TOKEN = process.env.TWITTER_ACCESS_TOKEN;
const TWITTER_ACCESS_TOKEN_SECRET = process.env.TWITTER_ACCESS_TOKEN_SECRET;
const TWITTER_CONSUMER_KEY = process.env.TWITTER_CONSUMER_KEY;
const TWITTER_CONSUMER_SECRET = process.env.TWITTER_CONSUMER_SECRET;
const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;

// Initialize Twitter API client
let twitterClient = null;
let twitterApiAvailable = false;

// Try Bearer Token first (simpler, better for read-only operations)
if (TWITTER_BEARER_TOKEN) {
  try {
    // Decode URL-encoded bearer token
    const decodedBearerToken = decodeURIComponent(TWITTER_BEARER_TOKEN);
    twitterClient = new TwitterApi(decodedBearerToken);
    twitterApiAvailable = true;
    console.log('Twitter API client initialized successfully with Bearer Token');
  } catch (error) {
    console.warn('Failed to initialize Twitter API client with Bearer Token:', error.message);
    twitterApiAvailable = false;
  }
} 
// Fallback to OAuth credentials if Bearer Token not available
else if (TWITTER_ACCESS_TOKEN && TWITTER_ACCESS_TOKEN_SECRET && TWITTER_CONSUMER_KEY && TWITTER_CONSUMER_SECRET) {
  try {
    twitterClient = new TwitterApi({
      appKey: TWITTER_CONSUMER_KEY,
      appSecret: TWITTER_CONSUMER_SECRET,
      accessToken: TWITTER_ACCESS_TOKEN,
      accessSecret: TWITTER_ACCESS_TOKEN_SECRET,
    });
    twitterApiAvailable = true;
    console.log('Twitter API client initialized successfully with OAuth credentials');
  } catch (error) {
    console.warn('Failed to initialize Twitter API client:', error.message);
    twitterApiAvailable = false;
  }
} else {
  console.warn('Twitter API credentials not configured. Will use Grok AI for tweets.');
  twitterApiAvailable = false;
}

/**
 * Get tweets from specific users (past 24 hours)
 * @param {string[]} usernames - Array of Twitter usernames (without @)
 * @param {number} maxResults - Maximum number of tweets per user (default: 10)
 * @returns {Promise<Array>} Array of tweet objects
 */
export async function getTweetsFromUsers(usernames = [], maxResults = 10) {
  if (!twitterClient || !twitterApiAvailable) {
    throw new Error('Twitter API is not configured or unavailable');
  }

  if (!usernames || usernames.length === 0) {
    return [];
  }

  const allTweets = [];
  const oneDayAgo = new Date();
  oneDayAgo.setHours(oneDayAgo.getHours() - 24);

  try {
    // Track if we get any 401 errors (authentication failure)
    let hasAuthError = false;
    
    // Fetch tweets from each user
    for (const username of usernames) {
      try {
        // Get user ID first with profile image
        const user = await twitterClient.v2.userByUsername(username, {
          'user.fields': ['profile_image_url', 'verified', 'name', 'username']
        });
        if (!user.data) {
          console.warn(`User ${username} not found`);
          continue;
        }

        const userId = user.data.id;

        // Fetch user's tweets from the last 24 hours with media
        const tweets = await twitterClient.v2.userTimeline(userId, {
          max_results: Math.min(maxResults, 100), // Twitter API limit is 100
          'tweet.fields': ['created_at', 'public_metrics', 'text', 'author_id', 'attachments'],
          'user.fields': ['profile_image_url', 'verified', 'name', 'username'],
          'media.fields': ['type', 'url', 'preview_image_url'],
          expansions: ['attachments.media_keys'],
          start_time: oneDayAgo.toISOString(),
        });

        if (tweets && tweets.data && tweets.data.data) {
          // Get user info
          const userInfo = user.data;
          
          // Get media from includes if available
          const mediaMap = {};
          const includes = tweets.data.includes || tweets.includes;
          if (includes && includes.media) {
            includes.media.forEach((media) => {
              if (media.media_key) {
                mediaMap[media.media_key] = media;
              }
            });
          }
          
          tweets.data.data.forEach((tweet) => {
            // Check if tweet is within 24 hours
            const tweetDate = new Date(tweet.created_at);
            if (tweetDate >= oneDayAgo) {
              // Extract image URLs from media attachments
              const imageUrls = [];
              if (tweet.attachments && tweet.attachments.media_keys) {
                tweet.attachments.media_keys.forEach((mediaKey) => {
                  const media = mediaMap[mediaKey];
                  if (media && (media.type === 'photo' || media.type === 'animated_gif')) {
                    imageUrls.push(media.url || media.preview_image_url);
                  }
                });
              }
              
              allTweets.push({
                id: tweet.id,
                content: tweet.text,
                username: userInfo.username || username,
                displayName: userInfo.name || username,
                verified: userInfo.verified || false,
                profileImageUrl: userInfo.profile_image_url || null,
                imageUrls: imageUrls.length > 0 ? imageUrls : null,
                timestamp: tweet.created_at,
                likes: tweet.public_metrics?.like_count || 0,
                retweets: tweet.public_metrics?.retweet_count || 0,
                engagement: (tweet.public_metrics?.like_count || 0) + (tweet.public_metrics?.retweet_count || 0),
                impact: userInfo.verified ? 'high' : 'medium',
              });
            }
          });
        } else if (tweets && tweets.data && Array.isArray(tweets.data)) {
          // Handle case where data is directly an array
          const userInfo = user.data;
          
          // Get media from includes if available
          const mediaMap = {};
          if (tweets.includes && tweets.includes.media) {
            tweets.includes.media.forEach((media) => {
              if (media.media_key) {
                mediaMap[media.media_key] = media;
              }
            });
          }
          
          tweets.data.forEach((tweet) => {
            const tweetDate = new Date(tweet.created_at);
            if (tweetDate >= oneDayAgo) {
              // Extract image URLs from media attachments
              const imageUrls = [];
              if (tweet.attachments && tweet.attachments.media_keys) {
                tweet.attachments.media_keys.forEach((mediaKey) => {
                  const media = mediaMap[mediaKey];
                  if (media && (media.type === 'photo' || media.type === 'animated_gif')) {
                    imageUrls.push(media.url || media.preview_image_url);
                  }
                });
              }
              
              allTweets.push({
                id: tweet.id,
                content: tweet.text,
                username: userInfo.username || username,
                displayName: userInfo.name || username,
                verified: userInfo.verified || false,
                profileImageUrl: userInfo.profile_image_url || null,
                imageUrls: imageUrls.length > 0 ? imageUrls : null,
                timestamp: tweet.created_at,
                likes: tweet.public_metrics?.like_count || 0,
                retweets: tweet.public_metrics?.retweet_count || 0,
                engagement: (tweet.public_metrics?.like_count || 0) + (tweet.public_metrics?.retweet_count || 0),
                impact: userInfo.verified ? 'high' : 'medium',
              });
            }
          });
        }

        // Rate limiting: wait a bit between requests
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        // Log more details about the error
        if (error.code === 401 || error.message?.includes('401') || error.data?.title?.includes('Unauthorized')) {
          hasAuthError = true;
          // Only log once per batch to reduce noise
          if (username === usernames[0]) {
            console.error(`Twitter API authentication failed (401). Credentials may be invalid, expired, or require elevated access.`);
            console.error(`Will skip remaining users and fall back to Grok AI.`);
          }
          // Stop trying other users if we get 401 - they'll all fail
          break;
        } else {
          console.error(`Error fetching tweets from ${username}:`, error.message || error);
        }
        // Continue with other users even if one fails (unless it's auth error)
      }
    }

    // Sort by timestamp (newest first)
    allTweets.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // If we got no tweets due to auth error, mark API as unavailable
    if (allTweets.length === 0 && hasAuthError) {
      twitterApiAvailable = false;
      console.warn('Twitter API authentication failed. Disabling Twitter API and will use Grok AI for tweets.');
      throw new Error('Twitter API authentication failed (401)');
    }

    // If we got no tweets and there were errors, log a warning
    if (allTweets.length === 0 && usernames.length > 0 && !hasAuthError) {
      console.warn('Twitter API returned 0 tweets. This may be due to rate limits or no recent tweets.');
    }

    return allTweets;
  } catch (error) {
    // Check if it's an authentication error
    if (error.code === 401 || error.message?.includes('401') || error.message?.includes('Unauthorized') || error.message?.includes('authentication failed')) {
      twitterApiAvailable = false;
      console.error('Twitter API authentication failed (401). Credentials may be invalid, expired, or the API access level may not support user timeline access.');
      console.error('Will use Grok AI for tweet fetching.');
    } else {
      console.error('Error fetching tweets from Twitter API:', error.message || error);
    }
    throw error;
  }
}

/**
 * Search for tweets containing specific keywords (past 24 hours)
 * @param {string} query - Search query
 * @param {number} maxResults - Maximum number of results (default: 10)
 * @returns {Promise<Array>} Array of tweet objects
 */
export async function searchTweets(query, maxResults = 10) {
  if (!twitterClient) {
    throw new Error('Twitter API is not configured');
  }

  const oneDayAgo = new Date();
  oneDayAgo.setHours(oneDayAgo.getHours() - 24);

  try {
    const tweets = await twitterClient.v2.search({
      query: query,
      max_results: Math.min(maxResults, 100),
      'tweet.fields': ['created_at', 'public_metrics', 'text', 'author_id'],
      'user.fields': ['name', 'username', 'verified'],
      start_time: oneDayAgo.toISOString(),
    });

    if (!tweets.data || !tweets.data.data) {
      return [];
    }

    const results = [];
    
    // Get user info for each tweet
    const userIds = [...new Set(tweets.data.data.map(t => t.author_id))];
    const usersMap = new Map();
    
    for (const userId of userIds) {
      try {
        const user = await twitterClient.v2.user(userId, {
          'user.fields': ['name', 'username', 'verified'],
        });
        if (user.data) {
          usersMap.set(userId, user.data);
        }
      } catch (error) {
        console.error(`Error fetching user ${userId}:`, error.message);
      }
    }

    tweets.data.data.forEach((tweet) => {
      const userInfo = usersMap.get(tweet.author_id);
      if (userInfo) {
        results.push({
          id: tweet.id,
          content: tweet.text,
          username: userInfo.username,
          displayName: userInfo.name || userInfo.username,
          verified: userInfo.verified || false,
          timestamp: tweet.created_at,
          likes: tweet.public_metrics?.like_count || 0,
          retweets: tweet.public_metrics?.retweet_count || 0,
          engagement: (tweet.public_metrics?.like_count || 0) + (tweet.public_metrics?.retweet_count || 0),
          impact: userInfo.verified ? 'high' : 'medium',
        });
      }
    });

    return results;
  } catch (error) {
    console.error('Error searching tweets:', error);
    throw error;
  }
}

/**
 * Get user information by username
 * @param {string} username - Twitter username (without @)
 * @returns {Promise<Object>} User object
 */
export async function getUserInfo(username) {
  if (!twitterClient) {
    throw new Error('Twitter API is not configured');
  }

  try {
    const user = await twitterClient.v2.userByUsername(username, {
      'user.fields': ['name', 'username', 'verified', 'public_metrics', 'description'],
    });

    return user.data;
  } catch (error) {
    console.error(`Error fetching user info for ${username}:`, error);
    throw error;
  }
}

