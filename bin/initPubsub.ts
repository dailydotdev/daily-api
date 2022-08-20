import '../src/config';
import { workers } from '../.infra/workers';
import { PubSub, ServiceError } from '@google-cloud/pubsub';
import { Status } from '@grpc/grpc-js/build/src/constants';

if (process.env.GCLOUD_PROJECT) {
  const pubsub = new PubSub();

  (async () => {
    await Promise.all(
      workers.map(async (worker) => {
        const topic = pubsub.topic(worker.topic);
        if (!(await topic.exists())[0]) {
          console.log(`creating topic ${worker.topic}`);
          try {
            await topic.create();
          } catch (err) {
            if ((err as ServiceError)?.code !== Status.ALREADY_EXISTS) {
              throw err;
            }
          }
        }
        const sub = pubsub.subscription(worker.subscription);
        if (!(await sub.exists())[0]) {
          console.log(`creating subscription ${worker.subscription}`);
          await topic.createSubscription(worker.subscription);
        }
      }),
    );
    console.log('done!');
  })();
}
