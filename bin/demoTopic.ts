import { pubsub } from '../src/common/pubsub';
import { WarmIntro } from '@dailydotdev/schema';

(async () => {
  console.log('Starting script...');
  await pubsub.topic('gondul.v1.warm-intro-generated').publishMessage({
    data: WarmIntro.fromJson({
      opportunityId: '404e1d3b-a639-4a24-b492-21ad60330d92',
      userId: 'testuser1',
      description: 'Some random warm intro message for you',
    }).toBinary(),
  });
  process.exit(0);
})();
