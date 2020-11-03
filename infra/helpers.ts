import * as pulumi from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';
import * as inputs from '@pulumi/gcp/types/input';

function camelToUnderscore(key: string): string {
  const result = key.replace(/([A-Z])/g, ' $1');
  return result.split(' ').join('_').toUpperCase();
}

export const config = new pulumi.Config();
export const stack = pulumi.getStack();
export const location = gcp.config.region || 'us-central1';

export const infra = new pulumi.StackReference(`idoshamun/infra/${stack}`);

export function createEnvVarsFromSecret(
  prefix: string,
): pulumi.Input<inputs.cloudrun.ServiceTemplateSpecContainerEnv>[] {
  const envVars = config.requireObject<Record<string, string>>('env');
  return Object.keys(envVars).map(
    (key): pulumi.Input<inputs.cloudrun.ServiceTemplateSpecContainerEnv> => {
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
  serviceAccount: gcp.serviceaccount.Account,
): pulumi.Output<string> {
  return serviceAccount.email.apply((email) => `serviceAccount:${email}`);
}

export type IAMRole = { name: string; role: string };

export function addIAMRolesToServiceAccount(
  prefix: string,
  roles: IAMRole[],
  serviceAccount: gcp.serviceaccount.Account,
): void {
  const member = serviceAccountToMember(serviceAccount);
  roles.forEach(
    (role) =>
      new gcp.projects.IAMMember(`${prefix}-iam-${role.name}`, {
        role: role.role,
        member,
      }),
  );
}
