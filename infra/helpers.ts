import * as pulumi from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';
import { Output } from '@pulumi/pulumi';
import * as k8s from '@pulumi/kubernetes';

function camelToUnderscore(key: string): string {
  const result = key.replace(/([A-Z])/g, ' $1');
  return result.split(' ').join('_').toUpperCase();
}

export const config = new pulumi.Config();
export const stack = pulumi.getStack();
export const location = gcp.config.region || 'us-central1';

export const infra = new pulumi.StackReference(`idoshamun/infra/${stack}`);

export type Secret = { name: string; value: string | Output<string> };

export function createEnvVarsFromSecret(
  prefix: string,
): pulumi.Input<Secret>[] {
  const envVars = config.requireObject<Record<string, string>>('env');
  return Object.keys(envVars).map(
    (key): pulumi.Input<Secret> => {
      const secret = new gcp.secretmanager.Secret(`${prefix}-secret-${key}`, {
        secretId: `${prefix}-secret-${key}`,
        replication: { automatic: true },
      });

      const version = new gcp.secretmanager.SecretVersion(
        `${prefix}-sv-${key}`,
        {
          enabled: true,
          secret: secret.name,
          secretData: envVars[key],
        },
      );
      return {
        name: camelToUnderscore(key),
        value: pulumi
          .all([secret.secretId, version.id])
          .apply(
            ([name, version]) =>
              `gcp:///${name}/${version.split('/').reverse()[0]}`,
          ),
      };
    },
  );
}

export function serviceAccountToMember(
  serviceAccount:
    | gcp.serviceaccount.Account
    | Output<gcp.serviceaccount.Account>,
): Output<string> {
  return serviceAccount.email.apply((email) => `serviceAccount:${email}`);
}

export type IAMRole = { name: string; role: string };

export function addIAMRolesToServiceAccount(
  prefix: string,
  roles: IAMRole[],
  serviceAccount: gcp.serviceaccount.Account,
): gcp.projects.IAMMember[] {
  const member = serviceAccountToMember(serviceAccount);
  return roles.map(
    (role) =>
      new gcp.projects.IAMMember(`${prefix}-iam-${role.name}`, {
        role: role.role,
        member,
      }),
  );
}

export function getCloudRunPubSubInvoker(): Output<gcp.serviceaccount.Account> {
  return infra.getOutput(
    'cloudRunPubSubInvoker',
  ) as Output<gcp.serviceaccount.Account>;
}

export function k8sServiceAccountToIdentity(
  serviceAccount: k8s.core.v1.ServiceAccount,
): Output<string> {
  return serviceAccount.metadata.apply(
    (metadata) =>
      `serviceAccount:${gcp.config.project}.svc.id.goog[${metadata.namespace}/${metadata.name}]`,
  );
}
