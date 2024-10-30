import * as gcp from '@pulumi/gcp';
import * as k8s from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { Input, ProviderResource } from '@pulumi/pulumi';
import {
  digestDeadLetter,
  personalizedDigestWorkers,
  workers,
} from './workers';
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
  Stream,
  ClickHouseSync,
  ClickHouseSyncConfig,
} from '@dailydotdev/pulumi-common';

const isAdhocEnv = detectIsAdhocEnv();
const name = 'api';
const debeziumTopicName = `${name}.changes`;
const isPersonalizedDigestEnabled =
  config.require('enablePersonalizedDigest') === 'true';

const { image, imageTag } = getImageAndTag(`us.gcr.io/daily-ops/daily-${name}`);

const { serviceAccount } = createServiceAccountAndGrantRoles(
  `${name}-sa`,
  name,
  `daily-${name}`,
  [
    { name: 'profiler', role: 'roles/cloudprofiler.agent' },
    { name: 'trace', role: 'roles/cloudtrace.agent' },
    { name: 'monitoring', role: 'roles/monitoring.metricWriter' },
    { name: 'secret', role: 'roles/secretmanager.secretAccessor' },
    { name: 'pubsub', role: 'roles/pubsub.editor' },
    { name: 'objViewer', role: 'roles/storage.objectViewer' },
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
  tier: 'BASIC',
  memorySizeGb: 3,
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
  redisPass: redis.authString,
  redisPort: redis.port.apply((port) => port.toString()),
};

createSubscriptionsFromWorkers(
  name,
  isAdhocEnv,
  addLabelsToWorkers(workers, { app: name, subapp: 'background' }),
);

if (isPersonalizedDigestEnabled) {
  const deadLetterTopic = new Stream(digestDeadLetter, {
    isAdhocEnv,
    name: digestDeadLetter,
  });

  createSubscriptionsFromWorkers(
    name,
    isAdhocEnv,
    addLabelsToWorkers(personalizedDigestWorkers, {
      app: name,
      subapp: 'personalized-digest',
    }),
    { dependsOn: [deadLetterTopic] },
  );
}

const memory = 640;
const apiRequests: pulumi.Input<{ cpu: string; memory: string }> = {
  cpu: '800m',
  memory: '400Mi',
};
const apiLimits: pulumi.Input<{ memory: string }> = {
  memory: `${memory}Mi`,
};

const wsMemory = 2048;
const wsLimits: pulumi.Input<{
  [key: string]: pulumi.Input<string>;
}> = {
  cpu: '300m',
  memory: `${wsMemory}Mi`,
};

const bgLimits: pulumi.Input<{ memory: string }> = { memory: '256Mi' };
const bgRequests: pulumi.Input<{ cpu: string; memory: string }> = {
  cpu: '50m',
  memory: '150Mi',
};

const temporalLimits: pulumi.Input<{ memory: string }> = { memory: '256Mi' };
const temporalRequests: pulumi.Input<{ cpu: string; memory: string }> = {
  cpu: '200m',
  memory: '150Mi',
};

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

const temporalCert = config.requireObject<Record<string, string>>('temporal');

const vols = {
  volumes: [
    {
      name: 'cert',
      secret: {
        secretName: 'cert-secret',
      },
    },
    {
      name: 'temporal',
      secret: {
        secretName: 'temporal-secret',
      },
    },
  ],
  volumeMounts: [
    { name: 'cert', mountPath: '/opt/app/cert' },
    { name: 'temporal', mountPath: '/opt/app/temporal' },
  ],
};
const jwtEnv = [
  {
    name: 'JWT_PUBLIC_KEY_PATH',
    value: '/opt/app/cert/public.pem',
  },
  { name: 'JWT_PRIVATE_KEY_PATH', value: '/opt/app/cert/key.pem' },
];

let appsArgs: ApplicationArgs[];
if (isAdhocEnv) {
  appsArgs = [
    {
      args: ['npm', 'run', 'dev'],
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
        ...jwtEnv,
      ],
      minReplicas: 3,
      maxReplicas: 15,
      limits: apiLimits,
      requests: apiRequests,
      metric: { type: 'memory_cpu', cpu: 70 },
      ports: [
        { containerPort: 3000, name: 'http' },
        { containerPort: 9464, name: 'metrics' },
      ],
      servicePorts: [
        { targetPort: 3000, port: 80, name: 'http' },
        { targetPort: 9464, port: 9464, name: 'metrics' },
      ],
      podAnnotations: {
        'prometheus.io/scrape': 'true',
        'prometheus.io/port': '9464',
      },
      createService: true,
      ...vols,
    },
    {
      nameSuffix: 'bg',
      args: ['npm', 'run', 'dev:background'],
      minReplicas: 4,
      maxReplicas: 10,
      limits: bgLimits,
      requests: bgRequests,
      metric: {
        type: 'pubsub',
        labels: {
          app: name,
          subapp: 'background',
        },
        targetAverageValue: 50,
      },
      ports: [{ containerPort: 9464, name: 'metrics' }],
      servicePorts: [{ targetPort: 9464, port: 9464, name: 'metrics' }],
      podAnnotations: {
        'prometheus.io/scrape': 'true',
        'prometheus.io/port': '9464',
      },
      env: [...jwtEnv],
      ...vols,
    },
  ];

  if (isPersonalizedDigestEnabled) {
    appsArgs.push({
      nameSuffix: 'personalized-digest',
      args: ['npm', 'run', 'dev:personalized-digest'],
      minReplicas: 1,
      maxReplicas: 10,
      limits: bgLimits,
      requests: bgRequests,
      metric: {
        type: 'pubsub',
        labels: {
          app: name,
          subapp: 'personalized-digest',
        },
        targetAverageValue: 50,
      },
      ports: [{ containerPort: 9464, name: 'metrics' }],
      servicePorts: [{ targetPort: 9464, port: 9464, name: 'metrics' }],
      podAnnotations: {
        'prometheus.io/scrape': 'true',
        'prometheus.io/port': '9464',
      },
      env: [...jwtEnv],
      ...vols,
    });
  }
} else {
  appsArgs = [
    {
      env: [nodeOptions(memory), ...jwtEnv],
      minReplicas: 3,
      maxReplicas: 25,
      limits: apiLimits,
      requests: apiRequests,
      readinessProbe,
      livenessProbe,
      metric: { type: 'memory_cpu', cpu: 80, memory: 130 },
      createService: true,
      enableCdn: true,
      disableLifecycle: true,
      serviceTimeout: 60,
      ports: [
        { containerPort: 3000, name: 'http' },
        { containerPort: 9464, name: 'metrics' },
      ],
      servicePorts: [
        { targetPort: 3000, port: 80, name: 'http' },
        { targetPort: 9464, port: 9464, name: 'metrics' },
      ],
      spot: {
        enabled: true,
        weight: 50,
      },
      ...vols,
    },
    {
      nameSuffix: 'ws',
      port: 3000,
      env: [
        nodeOptions(wsMemory),
        { name: 'ENABLE_SUBSCRIPTIONS', value: 'true' },
        ...jwtEnv,
      ],
      args: ['dumb-init', 'node', 'bin/cli', 'websocket'],
      minReplicas: 3,
      maxReplicas: 10,
      limits: wsLimits,
      readinessProbe,
      livenessProbe,
      metric: { type: 'memory_cpu', cpu: 85 },
      disableLifecycle: true,
      spot: {
        enabled: true,
        weight: 90,
      },
      ...vols,
    },
    {
      nameSuffix: 'bg',
      env: [...jwtEnv],
      args: ['dumb-init', 'node', 'bin/cli', 'background'],
      minReplicas: 3,
      maxReplicas: 10,
      limits: bgLimits,
      requests: bgRequests,
      metric: {
        type: 'pubsub',
        labels: {
          app: name,
          subapp: 'background',
        },
        targetAverageValue: 100,
      },
      ports: [{ containerPort: 9464, name: 'metrics' }],
      servicePorts: [{ targetPort: 9464, port: 9464, name: 'metrics' }],
      spot: {
        enabled: true,
        weight: 70,
      },
      ...vols,
    },
    {
      nameSuffix: 'temporal',
      env: [...jwtEnv],
      args: ['dumb-init', 'node', 'bin/cli', 'temporal'],
      minReplicas: 1,
      maxReplicas: 3,
      limits: temporalLimits,
      requests: temporalRequests,
      metric: { type: 'memory_cpu', cpu: 80, memory: 130 },
      ports: [{ containerPort: 9464, name: 'metrics' }],
      servicePorts: [{ targetPort: 9464, port: 9464, name: 'metrics' }],
      spot: {
        enabled: true,
        weight: 50,
      },
      ...vols,
    },
    {
      nameSuffix: 'private',
      port: 3000,
      env: [{ name: 'ENABLE_PRIVATE_ROUTES', value: 'true' }, ...jwtEnv],
      minReplicas: 2,
      maxReplicas: 2,
      limits: {
        memory: '256Mi',
        cpu: '25m',
      },
      readinessProbe,
      livenessProbe,
      metric: { type: 'memory_cpu', cpu: 85 },
      createService: true,
      serviceType: 'ClusterIP',
      disableLifecycle: true,
      ...vols,
    },
  ];

  if (isPersonalizedDigestEnabled) {
    appsArgs.push({
      nameSuffix: 'personalized-digest',
      env: [...jwtEnv],
      args: ['dumb-init', 'node', 'bin/cli', 'personalized-digest'],
      minReplicas: 1,
      maxReplicas: 2,
      limits: { memory: '1Gi' },
      requests: {
        cpu: '1',
        memory: '512Mi',
      },
      metric: {
        type: 'pubsub',
        labels: {
          app: name,
          subapp: 'personalized-digest',
        },
        targetAverageValue: 100_000,
      },
      spot: {
        enabled: true,
        weight: 70,
      },
      ...vols,
    });
  }
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
      version: '2.2.1.Final',
      topicName: debeziumTopicName,
      propsPath: './application.properties',
      propsVars: {
        slot_name: isAdhocEnv ? 'debezium_api' : 'debezium',
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
      // TODO: split limit and request
      limits: {
        cpu: '100m',
        memory: '800Mi',
      },
    },
    additionalSecrets: [
      {
        name: 'cert-secret',
        data: {
          'public.pem': Buffer.from(cert.public).toString('base64'),
          'key.pem': Buffer.from(cert.key).toString('base64'),
        },
      },
      {
        name: 'temporal-secret',
        data: {
          'chain.pem': Buffer.from(temporalCert.chain).toString('base64'),
          'key.pem': Buffer.from(temporalCert.key).toString('base64'),
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
          limits: cron.limits ?? bgLimits,
          requests: cron.requests ?? bgRequests,
          activeDeadlineSeconds: cron.activeDeadlineSeconds ?? 300,
          spot: {
            enabled: true,
            weight: 70,
          }
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

if (!isAdhocEnv) {
  new ClickHouseSync(
    'clickhouse-sync',
    {
      isAdhocEnv: isAdhocEnv,
      namespace: namespace,
      env: [{ name: 'JDK_JAVA_OPTIONS', value: '-Xmx3840m -Xms1024m' }],
      props: {
        path: './clickhouse-sync.yml',
        keys: {
          ...config.requireObject<{ keys: ClickHouseSyncConfig }>(
            'clickhouseSync',
          ).keys,
          'database.hostname': envVars.typeormHost as string,
          'database.port': '5432',
          'database.password': config.require('debeziumDbPass'),
          'database.user': config.require('debeziumDbUser'),
          'database.server.name': name,
          'database.dbname': name,
        },
        vars: {
          ...config.requireObject<{ vars: Record<string, string> }>(
            'clickhouseSync',
          ).vars,
        },
      },
      image: {
        repository: 'gcr.io/daily-ops/clickhouse-sink-docker',
        tag: '89537c253d5dd17fdaae05220ccc7dfca265f4d7',
      },
      resources: {
        // TODO: adjust resources based on the actual usage
        requests: {
          cpu: '1',
          memory: '2048Mi',
        },
        limits: {
          // 4GiB
          memory: '4096Mi',
        },
      },
      toleratesSpot: true,
    },
    { provider: vpcNativeProvider?.provider },
  );
}
