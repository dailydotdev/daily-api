import { ghostUser } from '../common';
import { TypedWorker } from './worker';
import { cio, identifyUserStreak } from '../cio';
import { getUserReadHistory } from '../schema/users';
import { subDays } from 'date-fns';

const days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const worker: TypedWorker<'api.v1.user-streak-updated'> = {
  subscription: 'api.user-streak-updated-cio',
  handler: async (message, con, log) => {
    if (!process.env.CIO_SITE_ID) {
      return;
    }

    const {
      data: { streak },
    } = message;

    if (!streak.userId || streak.userId === ghostUser.id) {
      return;
    }

    const readHistory = await getUserReadHistory({
      con,
      userId: streak.userId,
      before: new Date(),
      after: subDays(new Date(), 7),
    });
    const readHistoryDates = readHistory.flatMap((item) => item.date);

    const lastSevenDays = [...Array(7)].reduce((acc, _, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      acc.push({
        day: days[d.getDay()],
        read: readHistoryDates.includes(d.toISOString().split('T')[0]),
      });
      return acc;
    }, []);

    const userStreakData = {
      ...streak,
      lastSevenDays,
    };

    await identifyUserStreak(log, cio, userStreakData);
  },
};

export default worker;
