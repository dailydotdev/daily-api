import { Cron } from './cron';

const cron: Cron = {
  name: 'refresh-user-subscriptions',
  handler: async (con) => {
    await con.query(
      `refresh materialized view concurrently shaped_ai_user_subscriptions`,
      [],
    );
  },
};

export default cron;
