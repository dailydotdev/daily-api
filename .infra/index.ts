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
  ApplicationSuiteArgs,
  AdditionalSecret,
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
    { name: 'objUser', role: 'roles/storage.objectUser' },
    { name: 'bigqueryJobUser', role: 'roles/bigquery.jobUser' },
    { name: 'bigqueryDataViwer', role: 'roles/bigquery.dataViewer' },
    { name: 'tokenCreator', role: 'roles/iam.serviceAccountTokenCreator' },
  ],
  isAdhocEnv,
);

const dependsOn: pulumi.Resource[] = [];
const additionalSecrets: AdditionalSecret[] = [];
const vols: VolsType = {
  volumes: [
    { name: 'cert', secret: { secretName: 'cert-secret' } },
    { name: 'temporal', secret: { secretName: 'temporal-secret' } },
  ],
  volumeMounts: [
    { name: 'cert', mountPath: '/opt/app/cert' },
    { name: 'temporal', mountPath: '/opt/app/temporal' },
  ],
};

if (isAdhocEnv) {
  const db = new SqlDatabase('database', {
    isAdhocEnv,
    name,
    instance: 'postgres',
  });
  dependsOn.push(db);

  vols.volumes.push({
    name: 'adhoc-fylla-gcloud-credentials',
    secret: { secretName: 'adhoc-fylla-gcloud-credentials' },
  });
  vols.volumeMounts.push({
    name: 'adhoc-fylla-gcloud-credentials',
    mountPath: '/root/.config/gcloud',
  });
}

// Provision Redis (Memorystore)
const redis = new Redis(`${name}-redis`, {
  isAdhocEnv,
  name: `${name}-redis`,
  tier: 'BASIC',
  memorySizeGb: 1,
  region: location,
  authEnabled: true,
  redisVersion: 'REDIS_7_2',
  labels: { app: name },
  redisConfigs: {
    'maxmemory-policy': 'volatile-ttl',
    'maxmemory-gb': '0.95',
  },
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
    { dependsOn: [deadLetterTopic.resource] },
  );
}

const memory = 860;
const apiRequests: pulumi.Input<{ cpu: string; memory: string }> = {
  cpu: '500m',
  memory: '575Mi',
};
const apiLimits: pulumi.Input<{ memory: string }> = {
  memory: `${memory}Mi`,
};

const wsMemory = 1280;
const wsRequests: pulumi.Input<{ cpu: string; memory: string }> = {
  cpu: '75m',
  memory: '800Mi',
};
const wsLimits: pulumi.Input<{
  [key: string]: pulumi.Input<string>;
}> = {
  memory: `${wsMemory}Mi`,
};

const bgLimits: pulumi.Input<{ memory: string }> = { memory: '512Mi' };
const bgRequests: pulumi.Input<{ cpu: string; memory: string }> = {
  cpu: '50m',
  memory: '256Mi',
};

const temporalLimits: pulumi.Input<{ memory: string }> = { memory: '320Mi' };
const temporalRequests: pulumi.Input<{ cpu: string; memory: string }> = {
  cpu: '10m',
  memory: '256Mi',
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

type VolsType = {
  volumes: k8s.types.input.core.v1.Volume[];
  volumeMounts: k8s.types.input.core.v1.VolumeMount[];
};

const podAnnotations: ApplicationArgs['podAnnotations'] = {};

if (!isAdhocEnv) {
  vols.volumes.push({
    name: 'geoip-data',
    csi: {
      driver: 'gcsfuse.csi.storage.gke.io',
      volumeAttributes: {
        bucketName: `geoipupdate-storage`,
        mountOptions: 'implicit-dirs',
      },
    },
  });

  vols.volumeMounts.push({
    name: 'geoip-data',
    mountPath: '/usr/share/geoip',
    readOnly: true,
  });

  podAnnotations['gke-gcsfuse/volumes'] = 'true';
}

const jwtEnv = [
  {
    name: 'JWT_PUBLIC_KEY_PATH',
    value: '/opt/app/cert/public.pem',
  },
  { name: 'JWT_PRIVATE_KEY_PATH', value: '/opt/app/cert/key.pem' },
];

const commonEnv = [{ name: 'SERVICE_VERSION', value: imageTag }];

let appsArgs: ApplicationArgs[];
if (isAdhocEnv) {
  podAnnotations['prometheus.io/scrape'] = 'true';
  podAnnotations['prometheus.io/port'] = '9464';

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
        ...commonEnv,
        ...jwtEnv,
      ],
      minReplicas: 3,
      maxReplicas: 15,
      limits: apiLimits,
      requests: apiRequests,
      livenessProbe,
      metric: { type: 'memory_cpu', cpu: 70 },
      ports: [
        { containerPort: 3000, name: 'http' },
        { containerPort: 9464, name: 'metrics' },
      ],
      servicePorts: [
        { targetPort: 3000, port: 80, name: 'http' },
        { targetPort: 9464, port: 9464, name: 'metrics' },
      ],
      podAnnotations: podAnnotations,
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
      podAnnotations: podAnnotations,
      env: [
        {
          name: 'SERVICE_NAME',
          value: `${envVars.serviceName as string}-bg`,
        },
        ...commonEnv,
        ...jwtEnv,
      ],
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
      podAnnotations: podAnnotations,
      env: [...commonEnv, ...jwtEnv],
      ...vols,
    });
  }
} else {
  appsArgs = [
    {
      env: [nodeOptions(memory), ...commonEnv, ...jwtEnv],
      minReplicas: 3,
      maxReplicas: 25,
      limits: apiLimits,
      requests: apiRequests,
      readinessProbe,
      livenessProbe,
      metric: { type: 'memory_cpu', cpu: 120, memory: 130 },
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
      backendConfig: {
        customRequestHeaders: ['X-Client-Region:{client_region}'],
      },
      podAnnotations: podAnnotations,
      ...vols,
    },
    {
      nameSuffix: 'ws',
      port: 3000,
      env: [
        nodeOptions(wsMemory),
        { name: 'ENABLE_SUBSCRIPTIONS', value: 'true' },
        ...commonEnv,
        ...jwtEnv,
        {
          name: 'SERVICE_NAME',
          value: `${envVars.serviceName as string}-ws`,
        },
      ],
      args: ['dumb-init', 'node', 'bin/cli', 'websocket'],
      minReplicas: 2,
      maxReplicas: 10,
      limits: wsLimits,
      requests: wsRequests,
      readinessProbe,
      livenessProbe,
      metric: { type: 'memory_cpu', cpu: 85, memory: 130 },
      disableLifecycle: true,
      spot: { enabled: true },
      podAnnotations: podAnnotations,
      ...vols,
    },
    {
      nameSuffix: 'bg',
      env: [
        ...commonEnv,
        ...jwtEnv,
        {
          name: 'SERVICE_NAME',
          value: `${envVars.serviceName as string}-bg`,
        },
      ],
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
      spot: { enabled: true },
      podAnnotations: podAnnotations,
      ...vols,
    },
    {
      nameSuffix: 'temporal',
      env: [...commonEnv, ...jwtEnv],
      args: ['dumb-init', 'node', 'bin/cli', 'temporal'],
      minReplicas: 1,
      maxReplicas: 3,
      limits: temporalLimits,
      requests: temporalRequests,
      metric: { type: 'memory_cpu', cpu: 80, memory: 130 },
      ports: [{ containerPort: 9464, name: 'metrics' }],
      servicePorts: [{ targetPort: 9464, port: 9464, name: 'metrics' }],
      spot: { enabled: true },
      podAnnotations: podAnnotations,
      ...vols,
    },
    {
      nameSuffix: 'private',
      port: 3000,
      env: [
        { name: 'ENABLE_PRIVATE_ROUTES', value: 'true' },
        ...commonEnv,
        ...jwtEnv,
        {
          name: 'SERVICE_NAME',
          value: `${envVars.serviceName as string}-private`,
        },
      ],
      minReplicas: 2,
      maxReplicas: 2,
      requests: {
        memory: '450Mi',
        cpu: '10m',
      },
      limits: {
        memory: '510Mi',
      },
      readinessProbe,
      livenessProbe,
      metric: { type: 'memory_cpu', cpu: 85 },
      createService: true,
      serviceType: 'ClusterIP',
      disableLifecycle: true,
      podAnnotations: podAnnotations,
      ...vols,
    },
  ];

  if (isPersonalizedDigestEnabled) {
    appsArgs.push({
      nameSuffix: 'personalized-digest',
      env: [...commonEnv, ...jwtEnv],
      args: ['dumb-init', 'node', 'bin/cli', 'personalized-digest'],
      minReplicas: 1,
      maxReplicas: 2,
      limits: { memory: '1Gi' },
      requests: {
        cpu: '200m',
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
      podAnnotations: podAnnotations,
      ...vols,
    });
  }
}

const vpcNativeProvider = isAdhocEnv ? undefined : getVpcNativeCluster();
const cert = config.requireObject<Record<string, string>>('cert');

const migrations: ApplicationSuiteArgs['migrations'] = {
  db: {
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
};

if (!isAdhocEnv) {
  // for now we run clickhouse migrations manually in adhoc
  migrations.clickhouse = {
    args: ['node', './bin/runClickhouseMigrations.js'],
    toleratesSpot: false, // due to clickhouse not having transactions support
  };
}

const [apps] = deployApplicationSuite(
  {
    name,
    namespace,
    image,
    imageTag,
    serviceAccount,
    secrets: envVars,
    migrations,
    debezium: {
      version: '3.0.5.Final',
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
      requests: {
        cpu: '50m',
        memory: '450Mi'
      },
      limits: {
        memory: '900Mi',
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
      ...additionalSecrets,
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
          },
          podAnnotations: podAnnotations,
          ...vols,
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
        tag: '6b73adea1357df3e755dfc083c3a89bd2ccc348b',
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
