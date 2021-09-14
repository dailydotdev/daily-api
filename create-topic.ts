import { PubSub } from '@google-cloud/pubsub';

(async () => {
  console.log('creating topic');
  const client = new PubSub();
  await client.createTopic('api.changes');
  process.exit();
})();
