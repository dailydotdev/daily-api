import * as gcp from '@pulumi/gcp';
import * as k8s from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { Input, ProviderResource } from '@pulumi/pulumi';
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
  getVpcNativeCluster,
} from '@dailydotdev/pulumi-common';

const imageTag = getImageTag();
const name = 'api';
const debeziumTopicName = `${name}.changes`;

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
);

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

const vpcNativeProvider = getVpcNativeCluster();
const [apps] = deployApplicationSuite(
  {
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
        metric: { type: 'memory_cpu', cpu: 70 },
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
        args: ['npm', 'run', 'start:background'],
        minReplicas: 3,
        maxReplicas: 10,
        limits: bgLimits,
        metric: {
          type: 'pubsub',
          labels: { app: name },
          targetAverageValue: 100,
        },
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
        metric: { type: 'memory_cpu', cpu: 70 },
        createService: true,
        serviceType: 'ClusterIP',
      },
    ],
    crons: crons.map((cron) => ({
      nameSuffix: cron.name,
      args: ['node', 'bin/cli', 'cron', cron.name],
      schedule: cron.schedule,
      limits: bgLimits,
    })),
  },
  vpcNativeProvider,
);
const { labels } = apps[0];
const { labels: wsLabels } = apps[1];

const subsServiceName = `${name}-subs`;

const deploySubsService = (
  provider?: ProviderResource,
  resourcePrefix: string = '',
): void => {
  const k8sBackendConfig = new k8s.apiextensions.CustomResource(
    `${resourcePrefix}${name}-k8s-backend-config`,
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
    { provider },
  );

  new k8s.core.v1.Service(
    `${resourcePrefix}${name}-k8s-service`,
    {
      metadata: {
        name: subsServiceName,
        namespace,
        labels,
        annotations: {
          'cloud.google.com/backend-config':
            k8sBackendConfig.metadata.name.apply(
              (name) => `{"default": "${name}"}`,
            ),
        },
      },
      spec: {
        type: provider ? 'ClusterIP' : 'NodePort',
        ports: [
          { port: 80, targetPort: 'http', protocol: 'TCP', name: 'http' },
        ],
        selector: wsLabels,
      },
    },
    { provider },
  );
};
deploySubsService();
deploySubsService(vpcNativeProvider.provider, 'vpc-native-');

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

const subsIngressSpec: k8s.types.input.networking.v1.IngressSpec = {
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
                name: subsServiceName,
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
};

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
  spec: subsIngressSpec,
});

const subsAddress = new gcp.compute.GlobalAddress(
  `vpc-native-subs-ingress-address`,
  {
    name: `vpc-native-${name}-subs-ip`,
    addressType: 'EXTERNAL',
  },
);

const vpcNativeManagedCert = new k8s.apiextensions.CustomResource(
  `vpc-native-k8s-managed-cert`,
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
  { provider: vpcNativeProvider.provider },
);

new k8s.networking.v1.Ingress(
  `vpc-native-subs-ingress`,
  {
    metadata: {
      name: `${name}-subs`,
      namespace,
      labels,
      annotations: {
        'kubernetes.io/ingress.global-static-ip-name': subsAddress.name,
        'networking.gke.io/managed-certificates':
          vpcNativeManagedCert.metadata.name,
      },
    },
    spec: subsIngressSpec,
  },
  { provider: vpcNativeProvider.provider },
);
