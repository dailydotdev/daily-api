import * as gcp from '@pulumi/gcp';
import * as k8s from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { Input, Output } from '@pulumi/pulumi';
import { workers } from './workers';
import { crons } from './crons';
import {
  CloudRunAccess,
  config,
  createCloudRunService,
  createCronJobs,
  createEnvVarsFromSecret,
  createK8sServiceAccountFromGCPServiceAccount,
  createMigrationJob,
  createServiceAccountAndGrantRoles,
  createSubscriptionsFromWorkers,
  deployDebeziumToKubernetes,
  imageTag,
  k8sServiceAccountToIdentity,
  location,
  Secret,
} from '@dailydotdev/pulumi-common';
import { readFile } from 'fs/promises';

const name = 'api';
const debeziumTopicName = `${name}.changes`;

const debeziumTopic = new gcp.pubsub.Topic('debezium-topic', {
  name: debeziumTopicName,
});

const vpcConnector = new gcp.vpcaccess.Connector(`${name}-vpc-e2`, {
  name: `${name}-vpc-e2`,
  region: location,
  network: 'default',
  ipCidrRange: '10.6.0.0/28',
  minInstances: 2,
  maxInstances: 10,
  machineType: 'e2-standard-4',
});

const { serviceAccount, iamMembers } = createServiceAccountAndGrantRoles(
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
  memorySizeGb: 5,
  region: location,
  authEnabled: true,
  redisVersion: 'REDIS_6_X',
});

export const redisHost = redis.host;

const secrets: Input<Secret>[] = [
  ...createEnvVarsFromSecret(name),
  { name: 'REDIS_HOST', value: redisHost },
];

const image = `gcr.io/daily-ops/daily-${name}:${imageTag}`;

const { namespace, host: subsHost } = config.requireObject<{
  namespace: string;
  host: string;
}>('k8s');

const labels: pulumi.Input<{
  [key: string]: pulumi.Input<string>;
}> = {
  app: name,
};

const versionLabels: pulumi.Input<{
  [key: string]: pulumi.Input<string>;
}> = {
  ...labels,
  version: imageTag,
};

// Create K8S service account and assign it to a GCP service account
const k8sServiceAccount = createK8sServiceAccountFromGCPServiceAccount(
  `${name}-k8s-sa`,
  name,
  namespace,
  serviceAccount,
);

new gcp.serviceaccount.IAMBinding(`${name}-k8s-iam-binding`, {
  role: 'roles/iam.workloadIdentityUser',
  serviceAccountId: serviceAccount.id,
  members: [k8sServiceAccountToIdentity(k8sServiceAccount)],
});

const migrationJob = createMigrationJob(
  `${name}-migration`,
  namespace,
  image,
  ['node', './node_modules/typeorm/cli.js', 'migration:run'],
  secrets,
  k8sServiceAccount,
);

// Deploy to Cloud Run (foreground & background)
const service = createCloudRunService(
  name,
  image,
  secrets,
  { cpu: '1', memory: '512Mi' },
  vpcConnector,
  serviceAccount,
  {
    minScale: 1,
    concurrency: 250,
    dependsOn: [...iamMembers, redis, migrationJob],
    access: CloudRunAccess.Public,
    iamMemberName: `${name}-public`,
  },
);

const bgService = createCloudRunService(
  `${name}-background`,
  image,
  [...secrets, { name: 'MODE', value: 'background' }],
  { cpu: '1', memory: '256Mi' },
  vpcConnector,
  serviceAccount,
  {
    dependsOn: [...iamMembers, redis, migrationJob],
    access: CloudRunAccess.PubSub,
    iamMemberName: `${name}-pubsub-invoker`,
    concurrency: 80,
  },
);

export const serviceUrl = service.statuses[0].url;
export const bgServiceUrl = bgService.statuses[0].url;

createSubscriptionsFromWorkers(name, workers, bgServiceUrl, [debeziumTopic]);
createCronJobs(name, crons, bgServiceUrl);

// Subscriptions server deployment

const limits: pulumi.Input<{
  [key: string]: pulumi.Input<string>;
}> = {
  cpu: '2',
  memory: '1024Mi',
};

new k8s.policy.v1beta1.PodDisruptionBudget(`${name}-k8s-pdb`, {
  metadata: {
    name: `${name}-pdb`,
    namespace,
  },
  spec: {
    minAvailable: 1,
    selector: {
      matchLabels: labels,
    },
  },
});

new k8s.apps.v1.Deployment(
  `${name}-k8s-deployment`,
  {
    metadata: {
      name,
      namespace,
      labels: versionLabels,
    },
    spec: {
      replicas: 2,
      selector: { matchLabels: labels },
      template: {
        metadata: { labels },
        spec: {
          containers: [
            {
              name: 'app',
              image,
              ports: [{ name: 'http', containerPort: 3000, protocol: 'TCP' }],
              // readinessProbe: {
              //   httpGet: { path: '/health', port: 'http' },
              // },
              env: [
                ...secrets,
                { name: 'ENABLE_SUBSCRIPTIONS', value: 'true' },
              ],
              resources: {
                requests: limits,
                limits,
              },
            },
          ],
          serviceAccountName: k8sServiceAccount.metadata.name,
          affinity: {
            podAntiAffinity: {
              requiredDuringSchedulingIgnoredDuringExecution: [
                {
                  labelSelector: {
                    matchExpressions: Object.keys(versionLabels).map((key) => ({
                      key,
                      operator: 'In',
                      values: [versionLabels[key]],
                    })),
                  },
                  topologyKey: 'kubernetes.io/hostname',
                },
              ],
            },
          },
        },
      },
    },
  },
  { dependsOn: [migrationJob] },
);

const k8sBackendConfig = new k8s.apiextensions.CustomResource(
  `${name}-k8s-backend-config`,
  {
    apiVersion: 'cloud.google.com/v1beta1',
    kind: 'BackendConfig',
    metadata: {
      name: `${name}-backend-config`,
      namespace,
      labels,
    },
    spec: {
      sessionAffinity: {
        affinityType: 'CLIENT_IP',
      },
      timeoutSec: 300,
      connectionDraining: { drainingTimeoutSec: 600 },
    },
  },
);

const k8sService = new k8s.core.v1.Service(`${name}-k8s-service`, {
  metadata: {
    name,
    namespace,
    labels,
    annotations: {
      'cloud.google.com/backend-config': k8sBackendConfig.metadata.name.apply(
        (name) => `{"default": "${name}"}`,
      ),
    },
  },
  spec: {
    type: 'NodePort',
    ports: [{ port: 80, targetPort: 'http', protocol: 'TCP', name: 'http' }],
    selector: labels,
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

new k8s.networking.v1beta1.Ingress(`${name}-k8s-ingress`, {
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
              backend: {
                serviceName: k8sService.metadata.name,
                servicePort: 'http',
              },
            },
          ],
        },
      },
    ],
  },
});

const envVars = config.requireObject<Record<string, string>>('env');

const getDebeziumProps = async (): Promise<string> => {
  return (await readFile('./application.properties', 'utf-8'))
    .replace('%database_pass%', config.require('debeziumDbPass'))
    .replace('%database_user%', config.require('debeziumDbUser'))
    .replace('%database_dbname%', name)
    .replace('%hostname%', envVars.typeormHost)
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
