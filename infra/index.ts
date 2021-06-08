import * as gcp from '@pulumi/gcp';
import * as k8s from '@pulumi/kubernetes';
import { Input } from '@pulumi/pulumi';
import {
  addIAMRolesToServiceAccount,
  createEnvVarsFromSecret,
  getCloudRunPubSubInvoker,
  location,
  serviceAccountToMember,
  config,
  k8sServiceAccountToIdentity,
  Secret,
} from './helpers';
import { workers } from './workers';
import { crons } from './crons';
import * as pulumi from '@pulumi/pulumi';

const name = 'api';

const imageTag = config.require('tag');

const vpcConnector = new gcp.vpcaccess.Connector(`${name}-vpc-e2`, {
  name: `${name}-vpc-e2`,
  region: location,
  network: 'default',
  ipCidrRange: '10.6.0.0/28',
  minInstances: 2,
  maxInstances: 10,
  machineType: 'e2-standard-4',
});

// Create service account and grant permissions
const serviceAccount = new gcp.serviceaccount.Account(`${name}-sa`, {
  accountId: `daily-${name}`,
  displayName: `daily-${name}`,
});

const iamMembers = addIAMRolesToServiceAccount(
  name,
  [
    { name: 'profiler', role: 'roles/cloudprofiler.agent' },
    { name: 'trace', role: 'roles/cloudtrace.agent' },
    { name: 'secret', role: 'roles/secretmanager.secretAccessor' },
    { name: 'pubsub', role: 'roles/pubsub.editor' },
  ],
  serviceAccount,
);

// Provision Redis (Memorystore)
const redis = new gcp.redis.Instance(`${name}-redis`, {
  name: `${name}-redis`,
  tier: 'STANDARD_HA',
  memorySizeGb: 1,
  region: location,
  authEnabled: true,
  redisVersion: 'REDIS_5_0',
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
const k8sServiceAccount = new k8s.core.v1.ServiceAccount(`${name}-k8s-sa`, {
  metadata: {
    namespace,
    name,
    annotations: {
      'iam.gke.io/gcp-service-account': serviceAccount.email,
    },
  },
});

const migrationJob = new k8s.batch.v1.Job(
  `${name}-migration`,
  {
    metadata: {
      name: `${name}-migration`,
      namespace,
    },
    spec: {
      completions: 1,
      template: {
        spec: {
          containers: [
            {
              name: 'app',
              image,
              args: ['node', './node_modules/typeorm/cli.js', 'migration:run'],
              env: secrets,
            },
          ],
          serviceAccountName: k8sServiceAccount.metadata.name,
          restartPolicy: 'Never',
        },
      },
    },
  },
  { deleteBeforeReplace: true },
);

// Deploy to Cloud Run (foreground & background)
const service = new gcp.cloudrun.Service(
  name,
  {
    name,
    autogenerateRevisionName: true,
    location,
    traffics: [{ latestRevision: true, percent: 100 }],
    template: {
      metadata: {
        annotations: {
          'run.googleapis.com/vpc-access-connector': vpcConnector.name,
          'run.googleapis.com/vpc-access-egress': 'private-ranges-only',
          'autoscaling.knative.dev/minScale': '1',
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
        containerConcurrency: 250,
      },
    },
  },
  { dependsOn: [...iamMembers, redis, migrationJob] },
);

const bgService = new gcp.cloudrun.Service(
  `${name}-background`,
  {
    name: `${name}-background`,
    autogenerateRevisionName: true,
    location,
    traffics: [{ latestRevision: true, percent: 100 }],
    template: {
      metadata: {
        annotations: {
          'run.googleapis.com/vpc-access-connector': vpcConnector.name,
          'run.googleapis.com/vpc-access-egress': 'private-ranges-only',
        },
      },
      spec: {
        serviceAccountName: serviceAccount.email,
        containers: [
          {
            image,
            resources: { limits: { cpu: '1', memory: '256Mi' } },
            envs: [...secrets, { name: 'MODE', value: 'background' }],
          },
        ],
      },
    },
  },
  { dependsOn: [...iamMembers, redis, migrationJob] },
);

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

// Create Pub/Sub subscriptions
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

// Create Cloud Scheduler tasks
crons.map((cron) => {
  const uri = bgServiceUrl.apply(
    (url) => `${url}/${cron.endpoint ?? cron.name}`,
  );
  return new gcp.cloudscheduler.Job(`${name}-job-${cron.name}`, {
    name: `${name}-${cron.name}`,
    schedule: cron.schedule,
    httpTarget: {
      uri,
      httpMethod: 'POST',
      oidcToken: {
        serviceAccountEmail: cloudRunPubSubInvoker.email,
        audience: uri,
      },
      headers: cron.headers,
      body: cron.body
        ? Buffer.from(cron.body, 'utf8').toString('base64')
        : undefined,
    },
  });
});

new gcp.serviceaccount.IAMBinding(`${name}-k8s-iam-binding`, {
  role: 'roles/iam.workloadIdentityUser',
  serviceAccountId: serviceAccount.id,
  members: [k8sServiceAccountToIdentity(k8sServiceAccount)],
});

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
