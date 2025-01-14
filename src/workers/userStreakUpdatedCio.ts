import { DEFAULT_TIMEZONE, ghostUser } from '../common';
import { TypedWorker } from './worker';
import { cio, identifyUserStreak } from '../cio';
import { getUserReadHistory } from '../schema/users';
import { subDays } from 'date-fns';
import { User } from '../entity';
import { formatInTimeZone } from 'date-fns-tz';

const worker: TypedWorker<'api.v1.user-streak-updated'> = {
  subscription: 'api.user-streak-updated-cio',
  handler: async (message, con) => {
    if (!process.env.CIO_SITE_ID) {
      return;
    }

    const {
      data: { streak },
    } = message;

    if (!streak.userId || streak.userId === ghostUser.id) {
      return;
    }

    const user: Pick<User, 'timezone'> | null = await con
      .getRepository(User)
      .findOne({
        select: ['timezone'],
        where: {
          id: streak.userId,
        },
      });

    if (!user) {
      return;
    }

    const readHistory = await getUserReadHistory({
      con,
      userId: streak.userId,
      before: new Date(),
      after: subDays(new Date(), 7),
    });
    const readHistoryDates = readHistory.flatMap((item) =>
      formatInTimeZone(
        item.date,
        user.timezone || DEFAULT_TIMEZONE,
        'yyyy-MM-dd',
      ),
    );

    const lastSevenDays = [...Array(7)].reduce((acc, _, i) => {
      const dateOfWeek = subDays(new Date(), 6 - i);

      const dStamp = formatInTimeZone(
        dateOfWeek,
        user.timezone || DEFAULT_TIMEZONE,
        'yyyy-MM-dd',
      );
      const day = formatInTimeZone(
        dateOfWeek,
        user.timezone || DEFAULT_TIMEZONE,
        'iiiiii',
      );
      acc.push({
        day,
        read: readHistoryDates.includes(dStamp),
      });
      return acc;
    }, []);

    const userStreakData = {
      ...streak,
      lastSevenDays,
    };

    await identifyUserStreak({
      cio,
      data: userStreakData,
    });
  },
};

export default worker;
