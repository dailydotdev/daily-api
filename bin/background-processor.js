import http from 'http';
import logger from '../src/logger';
import config from '../src/config';
import newPostsWorker from '../src/workers/newPosts';
import newViewEventsWorker from '../src/workers/newViewEvents';

const registerWorks = async () => {
  if (process.env.GCLOUD_PROJECT || process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    await newPostsWorker();
    await newViewEventsWorker();
  }
};

logger.info('booting background processor');
registerWorks()
  .then(() => {
    http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.write('healthy!');
      res.end();
    }).listen(config.port);
    logger.info(`server is listening to ${config.port}`);
  });
