import * as gcp from '@pulumi/gcp';
import * as k8s from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { Input, Output } from '@pulumi/pulumi';
import { workers } from './workers';
import { crons } from './crons';
import {
  config,
  createMigrationJob,
  createServiceAccountAndGrantRoles,
  createSubscriptionsFromWorkers,
  createAutoscaledExposedApplication,
  deployDebeziumToKubernetes,
  getImageTag,
  location,
  bindK8sServiceAccountToGCP,
  getMemoryAndCpuMetrics,
  addLabelsToWorkers,
  convertRecordToContainerEnvVars,
  createKubernetesSecretFromRecord,
  createAutoscaledApplication,
  getPubSubUndeliveredMessagesMetric,
  getFullSubscriptionLabel,
  createPubSubCronJobs,
} from '@dailydotdev/pulumi-common';
import { readFile } from 'fs/promises';

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

const containerEnvVars = convertRecordToContainerEnvVars({
  secretName: name,
  data: envVars,
});

createKubernetesSecretFromRecord({
  data: envVars,
  resourceName: 'k8s-secret',
  name,
  namespace,
});

const image = `us.gcr.io/daily-ops/daily-${name}:${imageTag}`;

const k8sServiceAccount = bindK8sServiceAccountToGCP(
  '',
  name,
  namespace,
  serviceAccount,
);

const migrationJob = createMigrationJob(
  `${name}-migration`,
  namespace,
  image,
  ['node', './node_modules/typeorm/cli.js', 'migration:run'],
  containerEnvVars,
  k8sServiceAccount,
);

createSubscriptionsFromWorkers(
  name,
  addLabelsToWorkers(workers, { app: name }),
  { dependsOn: [debeziumTopic] },
);
createPubSubCronJobs(name, crons);

const memory = 2048;

const limits: pulumi.Input<{
  [key: string]: pulumi.Input<string>;
}> = {
  cpu: '1',
  memory: `${memory}Mi`,
};

const probe: k8s.types.input.core.v1.Probe = {
  httpGet: { path: '/health', port: 'http' },
};

const { labels } = createAutoscaledExposedApplication({
  name,
  namespace: namespace,
  version: imageTag,
  serviceAccount: k8sServiceAccount,
  containers: [
    {
      name: 'app',
      image,
      ports: [{ name: 'http', containerPort: 3000, protocol: 'TCP' }],
      readinessProbe: probe,
      livenessProbe: probe,
      env: [
        ...containerEnvVars,
        {
          name: 'NODE_OPTIONS',
          value: `--max-old-space-size=${Math.floor(memory * 0.9).toFixed(0)}`,
        },
      ],
      resources: {
        requests: limits,
        limits,
      },
    },
  ],
  minReplicas: 3,
  maxReplicas: 15,
  metrics: getMemoryAndCpuMetrics(60),
  enableCdn: true,
  deploymentDependsOn: [migrationJob],
});

const { labels: wsLabels } = createAutoscaledApplication({
  resourcePrefix: 'ws-',
  name: `${name}-ws`,
  namespace: namespace,
  version: imageTag,
  serviceAccount: k8sServiceAccount,
  containers: [
    {
      name: 'app',
      image,
      ports: [{ name: 'http', containerPort: 3000, protocol: 'TCP' }],
      readinessProbe: probe,
      livenessProbe: probe,
      env: [
        ...containerEnvVars,
        { name: 'ENABLE_SUBSCRIPTIONS', value: 'true' },
        {
          name: 'NODE_OPTIONS',
          value: `--max-old-space-size=${Math.floor(memory * 0.9).toFixed(0)}`,
        },
      ],
      resources: {
        requests: limits,
        limits,
      },
    },
  ],
  minReplicas: 3,
  maxReplicas: 15,
  metrics: getMemoryAndCpuMetrics(60),
  deploymentDependsOn: [migrationJob],
});

const bgLimits: pulumi.Input<{
  [key: string]: pulumi.Input<string>;
}> = { cpu: '1', memory: '256Mi' };

createAutoscaledApplication({
  resourcePrefix: 'bg-',
  name: `${name}-bg`,
  namespace,
  version: imageTag,
  serviceAccount: k8sServiceAccount,
  containers: [
    {
      name: 'app',
      image,
      env: [...containerEnvVars, { name: 'MODE', value: 'background' }],
      resources: {
        requests: bgLimits,
        limits: bgLimits,
      },
    },
  ],
  minReplicas: 6,
  maxReplicas: 10,
  metrics: [
    {
      external: {
        metric: {
          name: getPubSubUndeliveredMessagesMetric(),
          selector: {
            matchLabels: {
              [getFullSubscriptionLabel('app')]: name,
            },
          },
        },
        target: {
          type: 'Value',
          averageValue: '50',
        },
      },
      type: 'External',
    },
  ],
  deploymentDependsOn: [migrationJob],
});

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

const getDebeziumProps = async (): Promise<string> => {
  return (await readFile('./application.properties', 'utf-8'))
    .replace('%database_pass%', config.require('debeziumDbPass'))
    .replace('%database_user%', config.require('debeziumDbUser'))
    .replace('%database_dbname%', name)
    .replace('%hostname%', envVars.typeormHost as string)
    .replace('%topic%', debeziumTopicName);
};

deployDebeziumToKubernetes(
  name,
  namespace,
  debeziumTopic,
  Output.create(getDebeziumProps()),
  `${location}-f`,
  { diskType: 'pd-ssd', diskSize: 100, image: 'debezium/server:1.6' },
);
