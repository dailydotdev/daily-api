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
  getImageAndTag,
  location,
  addLabelsToWorkers,
  nodeOptions,
  deployApplicationSuite,
  getVpcNativeCluster,
  ApplicationArgs,
  Redis,
  detectIsAdhocEnv,
  SqlDatabase,
} from '@dailydotdev/pulumi-common';

const isAdhocEnv = detectIsAdhocEnv();
const name = 'api';
const debeziumTopicName = `${name}.changes`;

const { image, imageTag } = getImageAndTag(`us.gcr.io/daily-ops/daily-${name}`);

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
  isAdhocEnv,
);

const dependsOn: pulumi.Resource[] = [];
if (isAdhocEnv) {
  const db = new SqlDatabase('database', {
    isAdhocEnv,
    name,
    instance: 'postgres',
  });
  dependsOn.push(db);
}

// Provision Redis (Memorystore)
const redis = new Redis(`${name}-redis`, {
  isAdhocEnv,
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

createSubscriptionsFromWorkers(
  name,
  isAdhocEnv,
  addLabelsToWorkers(workers, { app: name }),
);

const memory = 512;
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
  cpu: '500m',
  memory: `${wsMemory}Mi`,
};

const bgLimits: pulumi.Input<{
  [key: string]: pulumi.Input<string>;
}> = { cpu: '250m', memory: '256Mi' };

const initialDelaySeconds = 20;
const readinessProbe: k8s.types.input.core.v1.Probe = {
  httpGet: { path: '/health', port: 'http' },
  failureThreshold: 2,
  periodSeconds: 2,
  initialDelaySeconds,
};

const livenessProbe: k8s.types.input.core.v1.Probe = {
  httpGet: { path: '/liveness', port: 'http' },
  failureThreshold: 3,
  periodSeconds: 5,
  initialDelaySeconds,
};

let appsArgs: ApplicationArgs[];
if (isAdhocEnv) {
  appsArgs = [
    {
      args: ['npm', 'run', 'dev'],
      port: 3000,
      env: [
        nodeOptions(memory),
        {
          name: 'PORT',
          value: '3000',
        },
        {
          name: 'ENABLE_SUBSCRIPTIONS',
          value: 'true',
        },
        { name: 'ENABLE_PRIVATE_ROUTES', value: 'true' },
        { name: 'JWT_PUBLIC_KEY_PATH', value: '/opt/app/cert/public.pem' },
        { name: 'JWT_PRIVATE_KEY_PATH', value: '/opt/app/cert/key.pem' },
      ],
      minReplicas: 3,
      maxReplicas: 15,
      limits,
      metric: { type: 'memory_cpu', cpu: 70 },
      createService: true,
      volumes: [
        {
          name: 'cert',
          secret: {
            secretName: 'cert-secret',
          },
        },
      ],
      volumeMounts: [{ name: 'cert', mountPath: '/opt/app/cert' }],
    },
    {
      nameSuffix: 'bg',
      args: ['npm', 'run', 'dev:background'],
      minReplicas: 4,
      maxReplicas: 10,
      limits: bgLimits,
      metric: {
        type: 'pubsub',
        labels: { app: name },
        targetAverageValue: 50,
      },
    },
  ];
} else {
  appsArgs = [
    {
      port: 3000,
      env: [
        nodeOptions(memory),
        { name: 'JWT_PUBLIC_KEY_PATH', value: '/opt/app/cert/public.pem' },
        { name: 'JWT_PRIVATE_KEY_PATH', value: '/opt/app/cert/key.pem' },
      ],
      minReplicas: 3,
      maxReplicas: 10,
      limits,
      readinessProbe,
      livenessProbe,
      metric: { type: 'memory_cpu', cpu: 90 },
      createService: true,
      enableCdn: true,
      disableLifecycle: true,
      volumes: [
        {
          name: 'cert',
          secret: {
            secretName: 'cert-secret',
          },
        },
      ],
      volumeMounts: [{ name: 'cert', mountPath: '/opt/app/cert' }],
    },
    {
      nameSuffix: 'ws',
      port: 3000,
      env: [
        nodeOptions(wsMemory),
        { name: 'ENABLE_SUBSCRIPTIONS', value: 'true' },
      ],
      minReplicas: 3,
      maxReplicas: 10,
      limits: wsLimits,
      readinessProbe,
      livenessProbe,
      metric: { type: 'memory_cpu', cpu: 85 },
      disableLifecycle: true,
    },
    {
      nameSuffix: 'bg',
      args: ['dumb-init', 'node', 'bin/cli', 'background'],
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
      env: [{ name: 'ENABLE_PRIVATE_ROUTES', value: 'true' }],
      minReplicas: 2,
      maxReplicas: 2,
      limits: {
        memory: '256Mi',
        cpu: '500m',
      },
      readinessProbe,
      livenessProbe,
      metric: { type: 'memory_cpu', cpu: 85 },
      createService: true,
      serviceType: 'ClusterIP',
      disableLifecycle: true,
    },
  ];
}

const vpcNativeProvider = isAdhocEnv ? undefined : getVpcNativeCluster();
const cert = config.requireObject<Record<string, string>>('cert');
const [apps] = deployApplicationSuite(
  {
    name,
    namespace,
    image,
    imageTag,
    serviceAccount,
    secrets: envVars,
    migration: {
      args: isAdhocEnv
        ? ['npm', 'run', 'db:migrate:latest']
        : [
            'node',
            './node_modules/typeorm/cli.js',
            'migration:run',
            '-d',
            'src/data-source.js',
          ],
    },
    debezium: {
      version: '2.0',
      topicName: debeziumTopicName,
      propsPath: './application.properties',
      propsVars: {
        database_pass: config.require('debeziumDbPass'),
        database_user: config.require('debeziumDbUser'),
        database_dbname: name,
        hostname: envVars.typeormHost as string,
      },
      env: [
        {
          name: 'ENABLE_DEBEZIUM_SCRIPTING',
          value: 'true',
        },
      ],
    },
    additionalSecrets: [
      {
        name: 'cert-secret',
        data: {
          'public.pem': Buffer.from(cert.public).toString('base64'),
          'key.pem': Buffer.from(cert.key).toString('base64'),
        },
      },
    ],
    apps: appsArgs,
    crons: isAdhocEnv
      ? []
      : crons.map((cron) => ({
          nameSuffix: cron.name,
          args: ['dumb-init', 'node', 'bin/cli', 'cron', cron.name],
          schedule: cron.schedule,
          limits: bgLimits,
          activeDeadlineSeconds: 300,
        })),
    isAdhocEnv,
    dependsOn,
  },
  vpcNativeProvider,
);

if (vpcNativeProvider) {
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
  deploySubsService(vpcNativeProvider.provider, 'vpc-native-');

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
}
