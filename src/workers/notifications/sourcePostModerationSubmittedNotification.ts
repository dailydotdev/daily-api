import { generateTypedNotificationWorker } from './worker';
import { SourceMember } from '../../entity';
import { In } from 'typeorm';
import { SourceMemberRoles } from '../../roles';
import { NotificationType } from '../../notifications/common';
import { NotificationPostModerationContext } from '../../notifications';
import { SourcePostModerationStatus } from '../../entity/SourcePostModeration';
import { getPostModerationContext } from './utils';
import { logger } from '../../logger';
import { TypeORMQueryFailedError } from '../../errors';
import { queryReadReplica } from '../../common/queryReadReplica';

const worker =
  generateTypedNotificationWorker<'api.v1.source-post-moderation-submitted'>({
    subscription: 'api.source-post-moderation-submitted-notification',
    handler: async ({ post }, con) => {
      if (post.status !== SourcePostModerationStatus.Pending) {
        return;
      }

      try {
        const moderationCtx = await queryReadReplica(con, ({ queryRunner }) => {
          return getPostModerationContext(queryRunner.manager, post);
        });
        const mods = await queryReadReplica(con, ({ queryRunner }) => {
          return queryRunner.manager.getRepository(SourceMember).find({
            select: ['userId'],
            where: {
              sourceId: post.sourceId,
              role: In([SourceMemberRoles.Admin, SourceMemberRoles.Moderator]),
            },
          });
        });

        const ctx: NotificationPostModerationContext = {
          ...moderationCtx,
          userIds: mods.map((m) => m.userId),
        };

        return [{ type: NotificationType.SourcePostSubmitted, ctx }];
      } catch (err) {
        const error = err as TypeORMQueryFailedError;
        if (error?.name !== 'EntityNotFoundError') {
          logger.error(
            { err, post },
            'failed sending notification for squad post moderation submitted',
          );
        }
      }
    },
  });

export default worker;
