import { TypedNotificationWorker } from '../worker';
import { NotificationType } from '../../notifications/common';
import { HotTake } from '../../entity/user/HotTake';
import { UserHotTake } from '../../entity/user/UserHotTake';
import { User } from '../../entity/user/User';
import { UserVote } from '../../types';
import { getUserPermalink } from '../../common';
import { type NotificationHotTakeUpvoteContext } from '../../notifications';
import { HOT_TAKE_UPVOTE_MILESTONES } from '../../notifications/generate';

export const hotTakeUpvoteMilestone: TypedNotificationWorker<'hot-take-upvoted'> =
  {
    subscription: 'api.hot-take-upvote-milestone-notification',
    handler: async ({ hotTakeId, userId }, con) => {
      const hotTake = await con
        .getRepository(HotTake)
        .findOne({ where: { id: hotTakeId } });
      if (
        !hotTake ||
        hotTake.userId === userId ||
        !HOT_TAKE_UPVOTE_MILESTONES.includes(hotTake.upvotes.toString())
      ) {
        return;
      }

      const owner = await con
        .getRepository(User)
        .findOne({ where: { id: hotTake.userId } });
      if (!owner) {
        return;
      }

      const upvotes = await con.getRepository(UserHotTake).find({
        where: { hotTakeId: hotTake.id, vote: UserVote.Up },
        take: 5,
        order: { votedAt: 'desc' },
        relations: ['user'],
      });
      const upvoters = await Promise.all(upvotes.map((upvote) => upvote.user));

      const targetUrl = `${getUserPermalink(owner)}#hot-takes`;

      const ctx: NotificationHotTakeUpvoteContext = {
        userIds: [hotTake.userId],
        upvoters,
        upvotes: hotTake.upvotes,
        hotTakeId: hotTake.id,
        hotTakeTitle: hotTake.title,
        targetUrl,
      };

      return [{ type: NotificationType.HotTakeUpvoteMilestone, ctx }];
    },
  };
