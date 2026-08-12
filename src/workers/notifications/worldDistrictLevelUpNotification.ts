import { In } from 'typeorm';
import { formatInTimeZone } from 'date-fns-tz';
import { TypedNotificationWorker } from '../worker';
import { NotificationWorldDistrictLevelUpContext } from '../../notifications';
import { NotificationType } from '../../notifications/common';
import { Niche } from '../../entity/Niche';
import { User } from '../../entity/user/User';
import { WORLD_LEVEL_UP_NAMED_DISTRICTS } from '../../common/worldLadder';
import { DEFAULT_TIMEZONE, secondsUntilNextHourInTimezone } from '../../common';

/**
 * The hour, in the reader's own timezone, this is allowed to reach a device.
 *
 * The world cron runs at 03:00 UTC, which is the middle of the night for a
 * large share of readers and the middle of the working day for the rest.
 * Neither is a moment to ask somebody to go and look at something.
 *
 * Evening rather than morning because 09:00 is the personalized digest's
 * default hour, and two pushes in the same hour compete with each other for the
 * same attention rather than adding up.
 */
const SEND_HOUR = 18;

export const worldDistrictLevelUpNotification: TypedNotificationWorker<'api.v1.world-district-level-up'> =
  {
    subscription: 'api.world-district-level-up-notification',
    handler: async ({ userId, districts, total }, con) => {
      const user = await con
        .getRepository(User)
        .findOne({ select: ['id', 'timezone'], where: { id: userId } });

      if (!user) {
        return;
      }

      const niches = await con.getRepository(Niche).find({
        select: ['id', 'title'],
        where: { id: In(districts.map(({ nicheId }) => nicheId)) },
      });
      const titles = new Map(niches.map(({ id, title }) => [id, title]));

      // The catalogue is curated and small, so a niche the cron saw hours ago
      // should still be here. When one is not, the district it named is gone
      // from the world too — so it is dropped from both the names and the
      // count, rather than being counted as growth the reader cannot find.
      const named = districts
        .filter(({ nicheId }) => titles.has(nicheId))
        .map(({ nicheId, level }) => ({
          nicheId,
          nicheTitle: titles.get(nicheId) as string,
          level,
        }));

      if (!named.length) {
        return;
      }

      const dropped = districts.length - named.length;

      const ctx: NotificationWorldDistrictLevelUpContext = {
        userIds: [userId],
        districts: named.slice(0, WORLD_LEVEL_UP_NAMED_DISTRICTS),
        total: Math.max(total - dropped, 1),
        // The rate limit. `dedupKey` becomes the per-user notification unique
        // key, so a calendar week can only ever hold one of these — whatever a
        // reader's world does for the rest of it is theirs to discover by
        // opening it. ISO week in UTC so the bucket does not depend on where
        // the process happens to be running.
        dedupKey: formatInTimeZone(new Date(), 'Etc/UTC', "RRRR-'W'II"),
        sendAtMs:
          Date.now() +
          secondsUntilNextHourInTimezone({
            hour: SEND_HOUR,
            timezone: user.timezone || DEFAULT_TIMEZONE,
          }) *
            1000,
      };

      return [{ type: NotificationType.WorldDistrictLevelUp, ctx }];
    },
  };
