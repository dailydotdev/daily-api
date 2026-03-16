import { Cron } from './cron';

export const cleanExpiredBetterAuthSessions: Cron = {
  name: 'clean-expired-better-auth-sessions',
  handler: async (con, logger) => {
    const result = await con.query(
      `DELETE FROM ba_session WHERE "expiresAt" < NOW()`,
    );

    const deleted = Array.isArray(result) ? result[1] : (result?.affected ?? 0);

    logger.info({ count: deleted }, 'cleaned expired BetterAuth sessions');
  },
};
