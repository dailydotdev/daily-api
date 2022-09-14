import * as gcp from '@pulumi/gcp';
import * as k8s from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { Input } from '@pulumi/pulumi';
import { workers } from './workers';
import { crons } from './crons';
import {
  config,
  createServiceAccountAndGrantRoles,
  createSubscriptionsFromWorkers,
  getImageTag,
  location,
  addLabelsToWorkers,
  createPubSubCronJobs,
  nodeOptions,
  deployApplicationSuite,
} from '@dailydotdev/pulumi-common';

const imageTag = getImageTag();
const name = 'api';
const debeziumTopicName = `${name}.changes`;

const debeziumTopic = new gcp.pubsub.Topic('debezium-topic', {
  name: debeziumTopicName,
});

[
  'source-feed-added',
  'source-feed-removed',
  'alerts-updated',
  'settings-updated',
  'update-comments',
  'post-scout-matched',
  'community-link-submitted',
  'community-link-rejected',
  'community-link-access',
].map(
  (topic) =>
    new gcp.pubsub.Topic(topic, {
      name: topic,
    }),
);

const { serviceAccount } = createServiceAccountAndGrantRoles(
  `${name}-sa`,
  name,
  `daily-${name}`,
  [
    { name: 'profiler', role: 'roles/cloudprofiler.agent' },
    { name: 'trace', role: 'roles/cloudtrace.agent' },
    { name: 'secret', role: 'roles/secretmanager.secretAccessor' },
    { name: 'pubsub', role: 'roles/pubsub.editor' },
  ],
);

// Provision Redis (Memorystore)
const redis = new gcp.redis.Instance(`${name}-redis`, {
  name: `${name}-redis`,
  tier: 'STANDARD_HA',
  memorySizeGb: 10,
  region: location,
  authEnabled: true,
  redisVersion: 'REDIS_6_X',
  maintenancePolicy: {
    weeklyMaintenanceWindows: [
      {
        day: 'SUNDAY',
        startTime: {
          hours: 7,
          minutes: 0,
        },
      },
    ],
  },
});

export const redisHost = redis.host;

const { namespace, host: subsHost } = config.requireObject<{
  namespace: string;
  host: string;
}>('k8s');

const envVars: Record<string, Input<string>> = {
  ...config.requireObject<Record<string, string>>('env'),
  redisHost,
};

const image = `us.gcr.io/daily-ops/daily-${name}:${imageTag}`;

createSubscriptionsFromWorkers(
  name,
  addLabelsToWorkers(workers, { app: name }),
  { dependsOn: [debeziumTopic] },
);
createPubSubCronJobs(name, crons);

const memory = 1024;
const limits: pulumi.Input<{
  [key: string]: pulumi.Input<string>;
}> = {
  cpu: '1',
  memory: `${memory}Mi`,
};

const wsMemory = 2048;
const wsLimits: pulumi.Input<{
  [key: string]: pulumi.Input<string>;
}> = {
  cpu: '1',
  memory: `${wsMemory}Mi`,
};

const bgLimits: pulumi.Input<{
  [key: string]: pulumi.Input<string>;
}> = { cpu: '500m', memory: '256Mi' };

const probe: k8s.types.input.core.v1.Probe = {
  httpGet: { path: '/health', port: 'http' },
};

const [legacyApps, vpcNativeApps] = deployApplicationSuite({
  name,
  namespace,
  image,
  imageTag,
  serviceAccount,
  secrets: envVars,
  migration: {
    args: ['node', './node_modules/typeorm/cli.js', 'migration:run'],
  },
  debezium: {
    topic: debeziumTopic,
    topicName: debeziumTopicName,
    propsPath: './application.properties',
    propsVars: {
      database_pass: config.require('debeziumDbPass'),
      database_user: config.require('debeziumDbUser'),
      database_dbname: name,
      hostname: envVars.typeormHost as string,
    },
  },
  apps: [
    {
      port: 3000,
      env: [nodeOptions(memory)],
      minReplicas: 3,
      maxReplicas: 15,
      limits,
      readinessProbe: probe,
      metric: { type: 'memory_cpu', cpu: 60 },
      createService: true,
      enableCdn: true,
    },
    {
      nameSuffix: 'ws',
      port: 3000,
      env: [
        nodeOptions(wsMemory),
        { name: 'ENABLE_SUBSCRIPTIONS', value: 'true' },
      ],
      minReplicas: 3,
      maxReplicas: 15,
      limits: wsLimits,
      readinessProbe: probe,
      metric: { type: 'memory_cpu', cpu: 60 },
    },
    {
      nameSuffix: 'bg',
      env: [{ name: 'MODE', value: 'background' }],
      minReplicas: 3,
      maxReplicas: 10,
      limits: bgLimits,
      metric: { type: 'pubsub', labels: { app: name }, targetAverageValue: 50 },
    },
    {
      nameSuffix: 'private',
      port: 3000,
      env: [
        nodeOptions(memory),
        { name: 'ENABLE_PRIVATE_ROUTES', value: 'true' },
      ],
      minReplicas: 2,
      maxReplicas: 4,
      limits,
      readinessProbe: probe,
      metric: { type: 'memory_cpu', cpu: 60 },
      createService: true,
      serviceType: 'ClusterIP',
    },
  ],
});
const { labels } = legacyApps[0];
const { labels: wsLabels } = legacyApps[1];

const k8sBackendConfig = new k8s.apiextensions.CustomResource(
  `${name}-k8s-backend-config`,
  {
    apiVersion: 'cloud.google.com/v1',
    kind: 'BackendConfig',
    metadata: {
      name: `${name}-subs`,
      namespace,
      labels,
    },
    spec: {
      timeoutSec: 43200,
    },
  },
);

const k8sService = new k8s.core.v1.Service(`${name}-k8s-service`, {
  metadata: {
    name: `${name}-subs`,
    namespace,
    labels,
    annotations: {
      'beta.cloud.google.com/backend-config':
        k8sBackendConfig.metadata.name.apply(
          (name) => `{"ports": {"http": "${name}"}}`,
        ),
    },
  },
  spec: {
    type: 'NodePort',
    ports: [{ port: 80, targetPort: 'http', protocol: 'TCP', name: 'http' }],
    selector: wsLabels,
  },
});

const k8sManagedCert = new k8s.apiextensions.CustomResource(
  `${name}-k8s-managed-cert`,
  {
    apiVersion: 'networking.gke.io/v1beta2',
    kind: 'ManagedCertificate',
    metadata: {
      name: `${name}-subs`,
      namespace,
      labels,
    },
    spec: {
      domains: [subsHost],
    },
  },
);

new k8s.networking.v1.Ingress(`${name}-k8s-ingress`, {
  metadata: {
    name,
    namespace,
    labels,
    annotations: {
      'kubernetes.io/ingress.global-static-ip-name': 'api-subscriptions',
      'networking.gke.io/managed-certificates': k8sManagedCert.metadata.name,
    },
  },
  spec: {
    rules: [
      {
        host: subsHost,
        http: {
          paths: [
            {
              path: '/*',
              pathType: 'ImplementationSpecific',
              backend: {
                service: {
                  name: k8sService.metadata.name,
                  port: {
                    name: 'http',
                  },
                },
              },
            },
          ],
        },
      },
    ],
  },
});
