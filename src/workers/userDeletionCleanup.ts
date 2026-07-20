import type { DataSource } from 'typeorm';
import { In } from 'typeorm';
import type { FastifyBaseLogger } from 'fastify';
import { TypedWorker } from './worker';
import { UserInterest } from '../entity/UserInterest';
import { Source } from '../entity/Source';
import {
  Alerts,
  Bookmark,
  BookmarkList,
  Comment,
  CommentMention,
  DevCard,
  Feed,
  Feature,
  Invite,
  Post,
  PostReport,
  ReputationEvent,
  Settings,
  SourceDisplay,
  SourceMember,
  SourceRequest,
  SourceUser,
  View,
} from '../entity';
import { DigestPost } from '../entity/posts/DigestPost';
import { PostMention } from '../entity/posts/PostMention';
import { SourcePostModeration } from '../entity/SourcePostModeration';
import { UserAction } from '../entity/user/UserAction';
import { UserAchievement } from '../entity/user/UserAchievement';
import { UserComment } from '../entity/user/UserComment';
import { UserCompany } from '../entity/UserCompany';
import { UserExperience } from '../entity/user/experiences/UserExperience';
import { UserGear } from '../entity/user/UserGear';
import { HotTake } from '../entity/user/HotTake';
import { UserHotTake } from '../entity/user/UserHotTake';
import { UserIntegration } from '../entity/UserIntegration';
import { UserMarketingCta } from '../entity/user/UserMarketingCta';
import { UserPersonalizedDigest } from '../entity/user/UserPersonalizedDigest';
import { UserPost } from '../entity/user/UserPost';
import { UserStack } from '../entity/user/UserStack';
import { UserStreak } from '../entity/user/UserStreak';
import { UserStreakAction } from '../entity/user/UserStreakAction';
import { UserTopReader } from '../entity/user/UserTopReader';
import { UserTransaction } from '../entity/user/UserTransaction';
import { UserWorkspacePhoto } from '../entity/user/UserWorkspacePhoto';
import { NotificationPreference } from '../entity/notifications/NotificationPreference';
import { ContentPreferenceUser } from '../entity/contentPreference/ContentPreferenceUser';
import { OpportunityMatch } from '../entity/OpportunityMatch';
import { OpportunityUser } from '../entity/opportunities/user';
import { Campaign } from '../entity/campaign/Campaign';
import { Feedback } from '../entity/Feedback';
import { ClaimableItem } from '../entity/ClaimableItem';
import { PersonalAccessToken } from '../entity/PersonalAccessToken';
import { Submission } from '../entity/Submission';
import { SquadPublicRequest } from '../entity/SquadPublicRequest';
import { SourceStack } from '../entity/sources/SourceStack';
import { CommentReport } from '../entity/CommentReport';
import { SourceReport } from '../entity/sources/SourceReport';
import { UserReport } from '../entity/UserReport';
import { UserQuest } from '../entity/user/UserQuest';
import { UserQuestProfile } from '../entity/user/UserQuestProfile';
import { UserCandidatePreference } from '../entity/user/UserCandidatePreference';
import { UserCandidateKeyword } from '../entity/user/UserCandidateKeyword';
import { UserCandidateAnswer } from '../entity/user/UserCandidateAnswer';
import { User } from '../entity/user/User';
import { ghostUser } from '../common/utils';
import {
  deleteEmploymentAgreementByUserId,
  deleteResumeByUserId,
} from '../common/googleCloud';
import { logger } from '../logger';

const BATCH_SIZE = 1000;

const batchDelete = async ({
  con,
  table,
  column,
  userId,
  log,
}: {
  con: DataSource;
  table: string;
  column: string;
  userId: string;
  log: FastifyBaseLogger;
}) => {
  let totalDeleted = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const result = await con.query(
      `DELETE FROM "${table}" WHERE ctid IN (
        SELECT ctid FROM "${table}" WHERE "${column}" = $1 LIMIT ${BATCH_SIZE}
      )`,
      [userId],
    );
    const affected = result?.[1] ?? 0;
    totalDeleted += affected;
    if (affected < BATCH_SIZE) {
      break;
    }
  }
  if (totalDeleted > 0) {
    log.debug({ table, totalDeleted, userId }, 'batch deleted rows');
  }
};

const worker: TypedWorker<'api.v1.user-deletion-requested'> = {
  subscription: 'api.user-deletion-cleanup',
  handler: async (message, con, log) => {
    const { userId } = message.data;

    const user = await con.getRepository(User).findOneBy({ id: userId });
    if (!user) {
      log.info({ userId }, 'user already deleted, skipping cleanup');
      return;
    }

    log.info({ userId }, 'starting user deletion cleanup');

    // Step 0: Clean up external resources
    await deleteResumeByUserId(userId);
    await deleteEmploymentAgreementByUserId({ userId, logger });

    // Step 1: Ghost user reassignment
    await con
      .getRepository(Comment)
      .update({ userId }, { userId: ghostUser.id });
    await con
      .getRepository(SourcePostModeration)
      .update({ createdById: userId }, { createdById: ghostUser.id });
    await con.transaction(async (manager) => {
      await manager
        .getRepository(PostMention)
        .createQueryBuilder()
        .delete()
        .where({ mentionedByUserId: userId })
        .andWhere(
          `EXISTS (
             SELECT 1 FROM post_mention t2
             WHERE t2."postId" = post_mention."postId"
               AND t2."mentionedUserId" = post_mention."mentionedUserId"
               AND t2."mentionedByUserId" = :ghostId
           )`,
          { ghostId: ghostUser.id },
        )
        .execute();
      await manager
        .getRepository(PostMention)
        .update(
          { mentionedByUserId: userId },
          { mentionedByUserId: ghostUser.id },
        );
    });
    await con.transaction(async (manager) => {
      await manager
        .getRepository(PostMention)
        .createQueryBuilder()
        .delete()
        .where({ mentionedUserId: userId })
        .andWhere(
          `EXISTS (
             SELECT 1 FROM post_mention t2
             WHERE t2."postId" = post_mention."postId"
               AND t2."mentionedByUserId" = post_mention."mentionedByUserId"
               AND t2."mentionedUserId" = :ghostId
           )`,
          { ghostId: ghostUser.id },
        )
        .execute();
      await manager
        .getRepository(PostMention)
        .update({ mentionedUserId: userId }, { mentionedUserId: ghostUser.id });
    });
    await con.transaction(async (manager) => {
      await manager
        .getRepository(CommentMention)
        .createQueryBuilder()
        .delete()
        .where({ commentByUserId: userId })
        .andWhere(
          `EXISTS (
             SELECT 1 FROM comment_mention t2
             WHERE t2."commentId" = comment_mention."commentId"
               AND t2."mentionedUserId" = comment_mention."mentionedUserId"
               AND t2."commentByUserId" = :ghostId
           )`,
          { ghostId: ghostUser.id },
        )
        .execute();
      await manager
        .getRepository(CommentMention)
        .update({ commentByUserId: userId }, { commentByUserId: ghostUser.id });
    });
    await con.transaction(async (manager) => {
      await manager
        .getRepository(CommentMention)
        .createQueryBuilder()
        .delete()
        .where({ mentionedUserId: userId })
        .andWhere(
          `EXISTS (
             SELECT 1 FROM comment_mention t2
             WHERE t2."commentId" = comment_mention."commentId"
               AND t2."commentByUserId" = comment_mention."commentByUserId"
               AND t2."mentionedUserId" = :ghostId
           )`,
          { ghostId: ghostUser.id },
        )
        .execute();
      await manager
        .getRepository(CommentMention)
        .update({ mentionedUserId: userId }, { mentionedUserId: ghostUser.id });
    });
    await con.transaction(async (manager) => {
      await manager
        .getRepository(ReputationEvent)
        .createQueryBuilder()
        .delete()
        .where({ grantToId: userId })
        .andWhere(
          `EXISTS (
             SELECT 1 FROM reputation_event t2
             WHERE t2."grantById" = reputation_event."grantById"
               AND t2."targetId" = reputation_event."targetId"
               AND t2."reason" = reputation_event."reason"
               AND t2."targetType" = reputation_event."targetType"
               AND t2."grantToId" = :ghostId
           )`,
          { ghostId: ghostUser.id },
        )
        .execute();
      await manager
        .getRepository(ReputationEvent)
        .update({ grantToId: userId }, { grantToId: ghostUser.id });
    });
    await con.transaction(async (manager) => {
      await manager
        .getRepository(ReputationEvent)
        .createQueryBuilder()
        .delete()
        .where({ grantById: userId })
        .andWhere(
          `EXISTS (
             SELECT 1 FROM reputation_event t2
             WHERE t2."grantToId" = reputation_event."grantToId"
               AND t2."targetId" = reputation_event."targetId"
               AND t2."reason" = reputation_event."reason"
               AND t2."targetType" = reputation_event."targetType"
               AND t2."grantById" = :ghostId
           )`,
          { ghostId: ghostUser.id },
        )
        .execute();
      await manager
        .getRepository(ReputationEvent)
        .update({ grantById: userId }, { grantById: ghostUser.id });
    });
    await con
      .getRepository(UserTransaction)
      .update({ senderId: userId }, { senderId: ghostUser.id });
    await con
      .getRepository(UserTransaction)
      .update({ receiverId: userId }, { receiverId: ghostUser.id });
    await con.getRepository(DigestPost).delete({ authorId: userId });
    // Manually set user source posts to ghost user
    await con
      .getRepository(Post)
      .update(
        { authorId: userId, sourceId: userId },
        { authorId: ghostUser.id, sourceId: ghostUser.id },
      );
    // Manually set shared post to 404 dummy user
    await con
      .getRepository(Post)
      .update({ authorId: userId }, { authorId: ghostUser.id });
    await con
      .getRepository(Post)
      .update({ scoutId: userId }, { scoutId: null });

    // Step 2: Delete child tables — large tables batched
    await batchDelete({
      con,
      table: 'user_notification',
      column: 'userId',
      userId,
      log,
    });
    await batchDelete({
      con,
      table: 'content_preference',
      column: 'userId',
      userId,
      log,
    });
    await con
      .getRepository(ContentPreferenceUser)
      .delete({ referenceUserId: userId });
    await con.getRepository(BookmarkList).delete({ userId });
    await con.getRepository(Bookmark).delete({ userId });

    // Step 2b: Delete child tables — medium tables
    await con.getRepository(UserPost).delete({ userId });
    await con.getRepository(UserAction).delete({ userId });
    await con.getRepository(UserComment).delete({ userId });
    await con.getRepository(Feed).delete({ userId });
    await con.getRepository(UserStreak).delete({ userId });
    await con.getRepository(Alerts).delete({ userId });
    await con.getRepository(Settings).delete({ userId });
    await con.getRepository(UserPersonalizedDigest).delete({ userId });
    await con.getRepository(UserMarketingCta).delete({ userId });
    await con.getRepository(SourceUser).delete({ userId });
    const agentSourceIds = (
      await con
        .getRepository(UserInterest)
        .createQueryBuilder('ui')
        .select('ui."sourceId"', 'sourceId')
        .where('ui."userId" = :userId', { userId })
        .andWhere('ui."sourceId" IS NOT NULL')
        .getRawMany<{ sourceId: string }>()
    ).map((row) => row.sourceId);
    if (agentSourceIds.length) {
      await con.getRepository(Source).delete({ id: In(agentSourceIds) });
    }
    await con.getRepository(SourceMember).delete({ userId });
    await con.getRepository(UserAchievement).delete({ userId });
    await con.getRepository(UserExperience).delete({ userId });
    await con.getRepository(DevCard).delete({ userId });
    await con.getRepository(UserQuest).delete({ userId });
    await con.getRepository(UserQuestProfile).delete({ userId });
    await con.getRepository(NotificationPreference).delete({ userId });
    await con.getRepository(Feature).delete({ userId });
    await con.getRepository(UserTopReader).delete({ userId });
    await con.getRepository(UserStreakAction).delete({ userId });
    await con.getRepository(UserCandidatePreference).delete({ userId });
    await con.getRepository(UserCandidateKeyword).delete({ userId });
    await con.getRepository(UserCandidateAnswer).delete({ userId });
    await con.getRepository(OpportunityMatch).delete({ userId });
    await con.getRepository(OpportunityUser).delete({ userId });
    await con.getRepository(Invite).delete({ userId });
    await con.getRepository(UserStack).delete({ userId });
    await con.getRepository(UserHotTake).delete({ userId });
    await con.getRepository(UserCompany).delete({ userId });
    await con.getRepository(PostReport).delete({ userId });
    await con.getRepository(CommentReport).delete({ userId });
    await con.getRepository(SourceReport).delete({ userId });
    await con.getRepository(UserReport).delete({ userId });
    await con.getRepository(PersonalAccessToken).delete({ userId });
    await con.getRepository(UserIntegration).delete({ userId });
    await con.getRepository(UserGear).delete({ userId });
    await con.getRepository(Campaign).delete({ userId });
    await con.getRepository(Feedback).delete({ userId });
    await con.getRepository(ClaimableItem).delete({ claimedById: userId });
    await con.getRepository(UserWorkspacePhoto).delete({ userId });
    await con.getRepository(HotTake).delete({ userId });
    await con.getRepository(SquadPublicRequest).delete({ requestorId: userId });
    await con.getRepository(SourceStack).delete({ createdById: userId });
    await con.getRepository(Submission).delete({ userId });
    await con.getRepository(View).delete({ userId });
    await con.getRepository(SourceDisplay).delete({ userId });
    await con.getRepository(SourceRequest).delete({ userId });
    // Legacy table without TypeORM entity
    await con.query('DELETE FROM comment_upvote WHERE "userId" = $1', [userId]);
    // Auth tables (ba_session may already be deleted by deleteUser, safe to re-run)
    await con.query('DELETE FROM ba_session WHERE "userId" = $1', [userId]);
    await con.query('DELETE FROM ba_account WHERE "userId" = $1', [userId]);

    // Step 3: Hard delete the user — triggers CDC user-deleted event
    await con.getRepository(User).delete(userId);

    log.info({ userId }, 'user deletion cleanup completed');
  },
};

export default worker;
