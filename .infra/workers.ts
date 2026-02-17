import * as gcp from '@pulumi/gcp';
import {
  workers,
  personalizedDigestWorkers as commonDigestWorkers,
  workerJobWorkers as commonWorkerJobWorkers,
  digestDeadLetter,
  workerJobDeadLetter,
  WorkerArgs,
  Worker,
} from './common';

export { workers, digestDeadLetter, workerJobDeadLetter };

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

const workerJobWorkersArgsMap: Record<string, WorkerArgs> = {
  'api.worker-job-execute': {
    ackDeadlineSeconds: 120,
    deadLetterPolicy: {
      deadLetterTopic: `projects/${gcp.config.project}/topics/${workerJobDeadLetter}`,
      maxDeliveryAttempts: 3,
    },
  },
  'api.worker-job-execute-dead-letter-log': {
    expirationPolicy: {
      ttl: '',
    },
  },
};

export const workerJobWorkers: Worker[] = commonWorkerJobWorkers.map(
  (worker) => {
    const args: WorkerArgs = workerJobWorkersArgsMap[worker.subscription];

    if (!args) {
      return worker;
    }

    const updated: Worker = { ...worker };

    updated.args = args;

    return updated;
  },
);
