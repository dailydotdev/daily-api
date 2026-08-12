import { In, MoreThan } from 'typeorm';
import { formatInTimeZone } from 'date-fns-tz';
import { TypedNotificationWorker } from '../worker';
import { NotificationWorldDistrictLevelUpContext } from '../../notifications';
import { NotificationType } from '../../notifications/common';
import { Niche } from '../../entity/Niche';
import { User } from '../../entity/user/User';
import { UserAchievement } from '../../entity/user/UserAchievement';
import { WORLD_LEVEL_UP_NAMED_DISTRICTS } from '../../common/worldLadder';

/**
 * How recently an unlocked achievement holds this notification back.
 *
 * Achievements are the thing this actually competes with. Twenty-seven of the
 * seeded ones unlock at a target count of one — profile picture, cover,
 * location, five kinds of experience, first comment, first bookmark, first
 * share, joining a squad — so a new reader trips a run of them over their first
 * fortnight, each one arriving under the push heading "Level up!". A world
 * notification landing in the middle of that reads as more of the same, which
 * is the fastest way to make all of it ignorable.
 *
 * This is a burst detector, not a same-day interlock, and the difference
 * matters: the decision is made when the world cron runs, hours before either
 * notification is delivered, so an achievement unlocked LATER today cannot be
 * seen from here. What a lookback does catch is the reader who is mid-run, and
 * a reader who unlocked something yesterday is overwhelmingly likely to unlock
 * something today too. Once the run dries up — and it does, the low-hanging
 * achievements are finite — the world gets its turn.
 *
 * Suppressing spends nothing: no notification is created, so the reader's
 * weekly slot is still free for the next day their world grows.
 */
const ACHIEVEMENT_QUIET_HOURS = 24;

export const worldDistrictLevelUpNotification: TypedNotificationWorker<'api.v1.world-district-level-up'> =
  {
    subscription: 'api.world-district-level-up-notification',
    handler: async ({ userId, districts, total }, con) => {
      const user = await con
        .getRepository(User)
        .findOne({ select: ['id', 'username'], where: { id: userId } });

      if (!user) {
        return;
      }

      // Indexed on (userId, unlockedAt), so this is a range scan per reader.
      // Read off the achievement itself rather than off the notification it
      // produced: the unlock is the thing that competes, and the notification
      // table has no index that answers "for this user, since then" cheaply.
      const recentAchievement = await con
        .getRepository(UserAchievement)
        .findOne({
          select: ['achievementId'],
          where: {
            userId,
            unlockedAt: MoreThan(
              new Date(Date.now() - ACHIEVEMENT_QUIET_HOURS * 60 * 60 * 1000),
            ),
          },
        });

      if (recentAchievement) {
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
        handle: user.username || user.id,
        // The rate limit. `dedupKey` becomes the per-user notification unique
        // key, so a calendar week can only ever hold one of these — whatever a
        // reader's world does for the rest of it is theirs to discover by
        // opening it. ISO week in UTC so the bucket does not depend on where
        // the process happens to be running.
        dedupKey: formatInTimeZone(new Date(), 'Etc/UTC', "RRRR-'W'II"),
      };

      return [{ type: NotificationType.WorldDistrictLevelUp, ctx }];
    },
  };
