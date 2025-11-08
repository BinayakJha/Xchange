import dotenv from 'dotenv';
import { getTweetsFromUsers } from './services/twitterService.js';

dotenv.config();

async function testFL0WG0D() {
  try {
    console.log('Fetching tweets from FL0WG0D...\n');
    const tweets = await getTweetsFromUsers(['FL0WG0D'], 5);
    
    console.log(`Found ${tweets.length} tweets:\n`);
    console.log('='.repeat(80));
    
    tweets.forEach((tweet, index) => {
      console.log(`\nTweet ${index + 1}:`);
      console.log(`ID: ${tweet.id}`);
      console.log(`Username: @${tweet.username}`);
      console.log(`Display Name: ${tweet.displayName}`);
      console.log(`Content: ${tweet.content}`);
      console.log(`Has Images: ${tweet.imageUrls ? 'Yes (' + tweet.imageUrls.length + ')' : 'No'}`);
      if (tweet.imageUrls && tweet.imageUrls.length > 0) {
        console.log(`Image URLs:`);
        tweet.imageUrls.forEach((url, i) => {
          console.log(`  ${i + 1}. ${url}`);
        });
      }
      console.log(`Likes: ${tweet.likes}`);
      console.log(`Retweets: ${tweet.retweets}`);
      console.log(`Timestamp: ${tweet.timestamp}`);
      console.log(`Profile Image: ${tweet.profileImageUrl || 'N/A'}`);
      console.log('-'.repeat(80));
    });
    
    console.log(`\nTotal tweets with images: ${tweets.filter(t => t.imageUrls && t.imageUrls.length > 0).length}`);
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

testFL0WG0D().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

