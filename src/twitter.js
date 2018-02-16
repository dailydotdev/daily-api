import Twitter from 'twitter';
import config from './config';

const client = new Twitter({
  consumer_key: config.twitter.consumerKey,
  consumer_secret: config.twitter.consumerSecret,
  access_token_key: config.twitter.accessTokenKey,
  access_token_secret: config.twitter.accessTokenSecret,
});

// eslint-disable-next-line import/prefer-default-export
export const tweet = status =>
  new Promise((resolve, reject) => {
    client.post('statuses/update', { status }, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
