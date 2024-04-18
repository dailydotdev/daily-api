import * as gcp from '@pulumi/gcp';
import * as k8s from '@pulumi/kubernetes';
import {readFile} from "fs/promises";
import * as pulumi from "@pulumi/pulumi";
import {all, Input, Output, ProviderResource} from "@pulumi/pulumi";
import {createHash} from "crypto";
import {input as inputs} from '@pulumi/kubernetes/types';
import {
  createServiceAccountAndGrantRoles,
  PodResources,
  stripCpuFromLimits
} from "@dailydotdev/pulumi-common";


type ClickhouseSyncArgs = {
  propsPath: string;
  propsVars: Record<string, Input<string>>;
  version?: string;
  limits?: PodResources;
  env?: Input<k8s.types.input.core.v1.EnvVar>[];
  disableHealthCheck?: boolean;
};


export function deployClickhouseSync(
  name: string,
  namespace: string | Input<string>,
  args: ClickhouseSyncArgs,
  {
    limits = {
      cpu: '1',
      memory: '1024Mi',
    },
    env = [],
    image = 'gcr.io/daily-ops/clickhouse-sink-docker:latest',
    resourcePrefix = '',
    provider,
    isAdhocEnv,
    disableHealthCheck,
  }: OptionalArgs = {},
): void {

  if (args.version) {
    image = `gcr.io/daily-ops/clickhouse-sink-docker:${args.version}`;
  }

  const propsVars = {
    ...args.propsVars,
  };

  const props = getProps(args.propsPath, propsVars);

  const {chsyncKey} = deployClickhouseSyncSharedDependencies(
    name,
    {resourcePrefix, isAdhocEnv},
  );

  deployClickhouseSyncKubernetesResources(
    name,
    namespace,
    props,
    chsyncKey,
    {
      limits,
      env,
      image,
      resourcePrefix,
      provider,
      isAdhocEnv,
      disableHealthCheck,
    },
  );
}


function getProps(
  propsPath: string,
  propsVars: Record<string, Input<string>>,
): Output<string> {
  const func = async (vars: Record<string, string>): Promise<string> => {
    const props = await readFile(propsPath, 'utf-8');
    return Object.keys(vars).reduce(
      (acc, key) => acc.replace(`%${key}%`, vars[key]),
      props,
    );
  };
  return all(propsVars).apply(func);
}

type OptionalArgs = {
  limits?: Input<PodResources>;
  env?: pulumi.Input<inputs.core.v1.EnvVar>[];
  image?: string;
  resourcePrefix?: string;
  provider?: ProviderResource;
  isAdhocEnv?: boolean;
  disableHealthCheck?: boolean;
};


function deployClickhouseSyncSharedDependencies(
  name: string,
  {
    resourcePrefix = '',
    isAdhocEnv,
  }: Pick<
    OptionalArgs,
    'resourcePrefix' | 'isAdhocEnv'
  > = {},
): {
  chsyncSa: gcp.serviceaccount.Account | undefined;
  chsyncKey: gcp.serviceaccount.Key | undefined;
} {
  if (isAdhocEnv) {
    return {chsyncKey: undefined, chsyncSa: undefined};
  }

  // i don't think we need it as we don't use pubsub
  const {serviceAccount: chsyncSa} = createServiceAccountAndGrantRoles(
    `${resourcePrefix}chsync-sa`,
    `${name}-chsync`,
    `${name}-chsync`,
    [],
    isAdhocEnv,
  );

  const chsyncKey = new gcp.serviceaccount.Key(
    `${resourcePrefix}chsync-sa-key`,
    {
      serviceAccountId: chsyncSa?.accountId || '',
    },
  );

  return {chsyncSa, chsyncKey};
}

function deployClickhouseSyncKubernetesResources(
  name: string,
  namespace: string | Input<string>,
  propsString: Output<string>,
  chsyncKey: gcp.serviceaccount.Key | undefined,
  {
    limits: requests = {
      cpu: '1',
      memory: '1024Mi',
    },
    env = [],
    image,
    resourcePrefix = '',
    provider,
    isAdhocEnv,
    disableHealthCheck,
  }: Pick<
    OptionalArgs,
    | 'limits'
    | 'env'
    | 'image'
    | 'resourcePrefix'
    | 'provider'
    | 'isAdhocEnv'
    | 'disableHealthCheck'
  > = {},
): void {
  const propsHash = propsString.apply((props) =>
    createHash('md5').update(props).digest('hex'),
  );

  const chsyncProps = new k8s.core.v1.Secret(
    `${resourcePrefix}chsync-props`,
    {
      metadata: {
        name: `${name}-chsync-props`,
        namespace,
      },
      data: {
        'config.yml': propsString.apply((str) =>
          Buffer.from(str).toString('base64'),
        ),
      },
    },
    {provider},
  );

  const labels: Input<{
    [key: string]: Input<string>;
  }> = {
    parent: name,
    app: 'chsync',
  };

  const volumes: k8s.types.input.core.v1.Volume[] = [
    {
      name: 'props',
      secret: {
        secretName: chsyncProps.metadata.name,
      },
    },
  ];
  const volumeMounts: k8s.types.input.core.v1.VolumeMount[] = [
    {name: 'props', mountPath: '/'},
  ];

  const initContainers: k8s.types.input.core.v1.Container[] = [];

  // If service account is provided
  if (chsyncKey) {
    const chsyncSecretSa = new k8s.core.v1.Secret(
      `${resourcePrefix}chsync-secret-sa`,
      {
        metadata: {
          name: `${name}-chsync-sa`,
          namespace,
        },
        data: {
          'key.json': chsyncKey?.privateKey || '',
        },
      },
      {provider},
    );
    volumes.push({
      name: 'service-account-key',
      secret: {
        secretName: chsyncSecretSa.metadata.name,
      },
    });
    volumeMounts.push({
      name: 'service-account-key',
      mountPath: '/var/secrets/google',
    });
  }

  let livenessProbe: k8s.types.input.core.v1.Probe | undefined;
  if (!disableHealthCheck) {
    livenessProbe = {
      httpGet: {path: '/q/health', port: 'http'},
      initialDelaySeconds: 60,
      periodSeconds: 30,
    };
  }

  new k8s.apps.v1.Deployment(
    `${resourcePrefix}chsync-deployment`,
    {
      metadata: {
        name: `${name}-chsync`,
        namespace,
      },
      spec: {
        replicas: 1,
        strategy: {
          type: 'Recreate',
        },
        selector: {matchLabels: labels},
        template: {
          metadata: {
            labels: {...labels, props: propsHash},
          },
          spec: {
            volumes,
            initContainers,
            containers: [
              {
                name: 'chsync',
                image,
                ports: [{name: 'http', containerPort: 8080, protocol: 'TCP'}],
                volumeMounts,
                env: [
                  {
                    name: 'GOOGLE_APPLICATION_CREDENTIALS',
                    value: '/var/secrets/google/key.json',
                  },
                  ...env,
                ],
                resources: !isAdhocEnv ? {
                  limits: stripCpuFromLimits(requests) as any,
                  requests: requests as any,
                } : undefined,
                livenessProbe,
              },
            ],
          },
        },
      },
    },
    {provider},
  );
}
