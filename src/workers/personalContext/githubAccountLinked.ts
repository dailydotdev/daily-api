import { TypedWorker } from '../worker';
import {
  PersonalContextSource,
  PersonalContextStatus,
  UserPersonalContext,
} from '../../entity/user/UserPersonalContext';
import { requestPersonalContext } from '../../common/personalContext/requestPersonalContext';
import { gitHubClient } from '../../integrations/github/clients';
import { remoteConfig } from '../../remoteConfig';

export const githubAccountLinkedWorker: TypedWorker<'api.v1.github-account-linked'> =
  {
    subscription: 'api.github-account-linked-personal-context',
    handler: async (message, con, logger) => {
      const {
        data: { userId },
      } = message;

      if (!remoteConfig.vars.personalContextEnabled) {
        return;
      }

      const [account] = await con.query(
        `SELECT "accountId", "accessToken" FROM ba_account WHERE "userId" = $1 AND "providerId" = 'github' LIMIT 1`,
        [userId],
      );

      if (!account?.accessToken) {
        return;
      }

      let login: string;
      try {
        ({ login } = await gitHubClient.getAuthenticatedUser(
          account.accessToken,
        ));
      } catch (err) {
        logger.error(
          { err, userId, provider: 'personal context' },
          'failed to resolve github login for personal context',
        );
        await con.getRepository(UserPersonalContext).upsert(
          {
            userId,
            source: PersonalContextSource.Github,
            sourceValue: account.accountId,
            verified: true,
            status: PersonalContextStatus.Error,
            error: err instanceof Error ? err.message : String(err),
            generatedAt: new Date(),
          },
          ['userId', 'source'],
        );
        return;
      }

      await requestPersonalContext({
        con,
        userId,
        source: PersonalContextSource.Github,
        value: login,
        verified: true,
      });
    },
  };
