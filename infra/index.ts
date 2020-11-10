import * as gcp from '@pulumi/gcp';
import { Output } from '@pulumi/pulumi';
import {
  addIAMRolesToServiceAccount,
  createEnvVarsFromSecret,
  getCloudRunPubSubInvoker,
  infra,
  location,
  serviceAccountToMember,
  config,
} from './helpers';
import { workers } from './workers';

const name = 'api';

const imageTag = config.require('tag');

const vpcConnector = infra.getOutput('serverlessVPC') as Output<
  gcp.vpcaccess.Connector
>;

const serviceAccount = new gcp.serviceaccount.Account(`${name}-sa`, {
  accountId: `daily-${name}`,
  displayName: `daily-${name}`,
});

addIAMRolesToServiceAccount(
  name,
  [
    { name: 'profiler', role: 'roles/cloudprofiler.agent' },
    { name: 'trace', role: 'roles/cloudtrace.agent' },
    { name: 'secret', role: 'roles/secretmanager.secretAccessor' },
    { name: 'pubsub', role: 'roles/pubsub.editor' },
  ],
  serviceAccount,
);

const secrets = createEnvVarsFromSecret(name);

const image = `gcr.io/daily-ops/daily-${name}:${imageTag}`;

const service = new gcp.cloudrun.Service(name, {
  name,
  location,
  template: {
    metadata: {
      annotations: {
        'autoscaling.knative.dev/maxScale': '20',
        'run.googleapis.com/vpc-access-connector': vpcConnector.name,
      },
    },
    spec: {
      serviceAccountName: serviceAccount.email,
      containers: [
        {
          image,
          resources: { limits: { cpu: '1', memory: '512Mi' } },
          envs: secrets,
        },
      ],
    },
  },
});

const bgService = new gcp.cloudrun.Service(`${name}-background`, {
  name: `${name}-background`,
  location,
  template: {
    metadata: {
      annotations: {
        'autoscaling.knative.dev/maxScale': '20',
        'run.googleapis.com/vpc-access-connector': vpcConnector.name,
      },
    },
    spec: {
      serviceAccountName: serviceAccount.email,
      containers: [
        {
          image,
          resources: { limits: { cpu: '1', memory: '256Mi' } },
          envs: secrets,
          args: ['background'],
        },
      ],
    },
  },
});

export const serviceUrl = service.statuses[0].url;
export const bgServiceUrl = bgService.statuses[0].url;

new gcp.cloudrun.IamMember(`${name}-public`, {
  service: service.name,
  location,
  role: 'roles/run.invoker',
  member: 'allUsers',
});

const cloudRunPubSubInvoker = getCloudRunPubSubInvoker();
new gcp.cloudrun.IamMember(`${name}-pubsub-invoker`, {
  service: bgService.name,
  location,
  role: 'roles/run.invoker',
  member: serviceAccountToMember(cloudRunPubSubInvoker),
});

workers.map(
  (worker) =>
    new gcp.pubsub.Subscription(`${name}-sub-${worker.subscription}`, {
      topic: worker.topic,
      name: worker.subscription,
      pushConfig: {
        pushEndpoint: bgServiceUrl.apply(
          (url) => `${url}/${worker.subscription}`,
        ),
        oidcToken: {
          serviceAccountEmail: cloudRunPubSubInvoker.email,
        },
      },
      retryPolicy: {
        minimumBackoff: '10s',
        maximumBackoff: '600s',
      },
    }),
);

new gcp.cloudscheduler.Job(`${name}-job-`, {
  httpTarget: {
    uri: '',
    oidcToken: {
      serviceAccountEmail: cloudRunPubSubInvoker.email,
      audience: '',
    },
  },
});
