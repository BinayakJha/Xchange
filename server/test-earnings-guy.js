import { getTweetsFromUsers } from './services/twitterService.js';
import dotenv from 'dotenv';

dotenv.config();

async function testEarningsGuy() {
  try {
    console.log('Fetching tweets from @earnings_guy...\n');
    
    const tweets = await getTweetsFromUsers(['earnings_guy'], 10);
    
    console.log(`Found ${tweets.length} tweets:\n`);
    console.log('='.repeat(80));
    
    tweets.forEach((tweet, index) => {
      console.log(`\nTweet #${index + 1}:`);
      console.log(`- ID: ${tweet.id}`);
      console.log(`- Username: @${tweet.username}`);
      console.log(`- Display Name: ${tweet.displayName}`);
      console.log(`- Verified: ${tweet.verified}`);
      console.log(`- Timestamp: ${tweet.timestamp}`);
      console.log(`- Content: ${tweet.content}`);
      console.log(`- Image URLs: ${tweet.imageUrls ? JSON.stringify(tweet.imageUrls, null, 2) : 'None'}`);
      console.log(`- Likes: ${tweet.likes}`);
      console.log(`- Retweets: ${tweet.retweets}`);
      console.log(`- Engagement: ${tweet.engagement}`);
      console.log(`- Impact: ${tweet.impact}`);
      console.log('-'.repeat(80));
    });
    
    console.log(`\n\nSummary:`);
    console.log(`- Total tweets: ${tweets.length}`);
    console.log(`- Tweets with images: ${tweets.filter(t => t.imageUrls && t.imageUrls.length > 0).length}`);
    console.log(`- Verified: ${tweets.filter(t => t.verified).length}`);
    
  } catch (error) {
    console.error('Error fetching tweets:', error);
    console.error('Stack:', error.stack);
  }
}

testEarningsGuy();

