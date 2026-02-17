import * as gcp from '@pulumi/gcp';
import {
  workers,
  personalizedDigestWorkers as commonDigestWorkers,
  workerJobWorkers as commonWorkerJobWorkers,
  digestDeadLetter,
  WorkerArgs,
  Worker,
} from './common';

export { workers, digestDeadLetter };

const digestWorkersArgsMap: Record<string, WorkerArgs> = {
  'api.personalized-digest-email': {
    ackDeadlineSeconds: 120,
    deadLetterPolicy: {
      deadLetterTopic: `projects/${gcp.config.project}/topics/${digestDeadLetter}`,
      maxDeliveryAttempts: 5,
    },
  },
  'api.personalized-digest-email-dead-letter-log': {
    expirationPolicy: {
      ttl: '',
    },
  },
};

export const personalizedDigestWorkers: Worker[] = commonDigestWorkers.map(
  (worker) => {
    const args: WorkerArgs = digestWorkersArgsMap[worker.subscription];

    if (!args) {
      return worker;
    }

    const updated: Worker = { ...worker };

    updated.args = args;

    return updated;
  },
);

export const workerJobWorkers: Worker[] = commonWorkerJobWorkers;
