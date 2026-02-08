import { DeepPartial } from 'typeorm';
import {
  ArticlePost,
  Comment,
  KeywordFlags,
  NotificationAttachmentType,
  NotificationAttachmentV2,
  NotificationAvatarV2,
  NotificationV2,
  Post,
  PostType,
  Source,
  SourceRequest,
  SourceType,
  SquadPublicRequest,
  Submission,
  User,
  type UserTopReader,
} from '../entity';
import {
  emptyImage,
  getDiscussionLink,
  getOrganizationPermalink,
  getSourceLink,
  getUserPermalink,
  pickImageUrl,
} from '../common';
import { markdownToTxt } from 'markdown-to-txt';
import {
  NotificationBundleV2,
  NotificationStreakContext,
  Reference,
  type NotificationBoostContext,
  type NotificationCampaignContext,
  type NotificationOrganizationContext,
  type NotificationUserTopReaderContext,
} from './types';
import { NotificationIcon } from './icons';
import { SourceMemberRoles } from '../roles';
import { NotificationType } from './common';
import { SourcePostModeration } from '../entity/SourcePostModeration';
import { fallbackImages } from '../config';
import type { UserTransaction } from '../entity/user/UserTransaction';

const MAX_COMMENT_LENGTH = 320;

export const simplifyComment = (comment: string): string => {
  if (!comment) return '';
  const simplified = markdownToTxt(comment);
  return simplified.length <= MAX_COMMENT_LENGTH
    ? simplified
    : `${simplified.substring(0, MAX_COMMENT_LENGTH - 3)}...`;
};

const roleToIcon: Record<SourceMemberRoles, NotificationIcon> = {
  [SourceMemberRoles.Blocked]: NotificationIcon.Block,
  [SourceMemberRoles.Member]: NotificationIcon.Bell,
  [SourceMemberRoles.Moderator]: NotificationIcon.User,
  [SourceMemberRoles.Admin]: NotificationIcon.Star,
};

const postTypeToAttachmentType = {
  [PostType.VideoYouTube]: NotificationAttachmentType.Video,
  [PostType.Article]: NotificationAttachmentType.Post,
};

export class NotificationBuilder {
  notification: DeepPartial<Omit<NotificationV2, 'attachments' | 'avatars'>> =
    {};
  avatars: DeepPartial<NotificationAvatarV2>[] = [];
  attachments: DeepPartial<NotificationAttachmentV2>[] = [];
  userIds: string[] = [];

  constructor(type: NotificationType, userIds: string[]) {
    this.notification = { type, public: true };
    this.userIds = userIds;
  }

  static new(type: NotificationType, userIds: string[]): NotificationBuilder {
    return new NotificationBuilder(type, userIds);
  }

  buildV2(): NotificationBundleV2 {
    return {
      notification: this.notification,
      userIds: this.userIds,
      avatars: this.avatars,
      attachments: this.attachments,
    };
  }

  systemNotification(): NotificationBuilder {
    return this.enrichNotification({
      icon: 'system',
      title: 'System',
      targetUrl: 'system',
      public: false,
    });
  }

  referenceSubmission(submission: Pick<Submission, 'id'>): NotificationBuilder {
    return this.enrichNotification({
      referenceId: submission.id,
      referenceType: 'submission',
    });
  }

  referencePost(post: Reference<Post>): NotificationBuilder {
    return this.enrichNotification({
      referenceId: post.id,
      referenceType: 'post',
    });
  }

  referencePostModeration(
    post: Reference<SourcePostModeration>,
  ): NotificationBuilder {
    return this.enrichNotification({
      referenceId: post.id,
      referenceType: 'post_moderation',
    });
  }

  referenceSource(source: Reference<Source>): NotificationBuilder {
    return this.enrichNotification({
      referenceId: source.id,
      referenceType: 'source',
    });
  }

  referenceStreak(
    streak: NotificationStreakContext['streak'],
  ): NotificationBuilder {
    return this.enrichNotification({
      referenceId: streak.userId,
      referenceType: 'streak',
    });
  }

  referenceComment(comment: Reference<Comment>): NotificationBuilder {
    return this.enrichNotification({
      referenceId: comment.id,
      referenceType: 'comment',
    });
  }

  referenceSystem(): NotificationBuilder {
    return this.enrichNotification({
      referenceId: 'system',
      referenceType: 'system',
      // v2 will fail for uniqueness if we don't set this
      uniqueKey: Date.now().toString(),
    });
  }

  referenceSourceRequest(
    sourceRequest: Reference<SourceRequest>,
  ): NotificationBuilder {
    return this.enrichNotification({
      referenceId: sourceRequest.id,
      referenceType: 'source_request',
    });
  }

  referenceSquadRequest(
    squadRequest: Reference<SquadPublicRequest>,
  ): NotificationBuilder {
    return this.enrichNotification({
      referenceId: squadRequest.id,
      referenceType: 'squad_request',
    });
  }

  referenceUserTopReader(
    userTopReader: Reference<UserTopReader>,
  ): NotificationBuilder {
    return this.enrichNotification({
      referenceId: userTopReader.id,
      referenceType: 'user_top_reader',
    });
  }

  referenceTransaction(
    transaction: Reference<UserTransaction>,
  ): NotificationBuilder {
    return this.enrichNotification({
      referenceId: transaction.id,
      referenceType: 'transaction',
    });
  }

  referenceOrganization(
    organization: NotificationOrganizationContext['organization'],
  ): NotificationBuilder {
    return this.enrichNotification({
      referenceId: organization.id,
      referenceType: 'organization',
    });
  }

  referenceBoost(ctx: NotificationBoostContext): NotificationBuilder {
    return this.enrichNotification({
      referenceId: ctx.campaignId,
      referenceType: 'boost',
    });
  }

  referenceCampaign(ctx: NotificationCampaignContext): NotificationBuilder {
    return this.enrichNotification({
      referenceId: ctx.campaign.id,
      referenceType: 'campaign',
    });
  }

  referenceOpportunity(opportunityId: string): NotificationBuilder {
    return this.enrichNotification({
      referenceId: opportunityId,
      referenceType: 'opportunity',
    });
  }

  referenceUser(user: Reference<User>): NotificationBuilder {
    return this.enrichNotification({
      referenceId: user.id,
      referenceType: 'user',
    });
  }

  referenceFeedback(feedbackId: string): NotificationBuilder {
    return this.enrichNotification({
      referenceId: feedbackId,
      referenceType: 'feedback',
    });
  }

  referenceAchievement(achievementId: string): NotificationBuilder {
    return this.enrichNotification({
      referenceId: achievementId,
      referenceType: 'achievement',
    });
  }

  icon(icon: NotificationIcon): NotificationBuilder {
    return this.enrichNotification({ icon });
  }

  title(title: string): NotificationBuilder {
    return this.enrichNotification({ title });
  }

  description(description: string, simplified?: boolean): NotificationBuilder {
    if (!simplified) {
      return this.enrichNotification({ description });
    }

    return this.enrichNotification({
      description: simplifyComment(description),
    });
  }

  targetUrl(targetUrl: string): NotificationBuilder {
    return this.enrichNotification({ targetUrl });
  }

  targetPost(
    post: Reference<Post>,
    comment?: Reference<Comment>,
  ): NotificationBuilder {
    return this.enrichNotification({
      targetUrl: getDiscussionLink(post.id, comment?.id),
    });
  }

  targetSource(source: Reference<Source>): NotificationBuilder {
    return this.enrichNotification({
      targetUrl: getSourceLink(source),
    });
  }

  targetSourceModeration(source?: Reference<Source>): NotificationBuilder {
    return this.enrichNotification({
      targetUrl: source
        ? `${process.env.COMMENTS_PREFIX}/squads/moderate?handle=${source.handle}`
        : `${process.env.COMMENTS_PREFIX}/squads/moderate`,
    });
  }

  targetUser(user: Reference<User>): NotificationBuilder {
    return this.enrichNotification({
      targetUrl: `${process.env.COMMENTS_PREFIX}/${user.username || user.id}`,
    });
  }

  setTargetUrlParameter(params: Array<[string, string]>) {
    if (!this.notification.targetUrl) {
      throw new Error('There is currently no target URL');
    }

    const url = new URL(this.notification.targetUrl);
    params.forEach(([key, value]) => url.searchParams.set(key, value));

    return this.enrichNotification({
      targetUrl: url.href,
    });
  }

  attachmentPost(post: Reference<Post>): NotificationBuilder {
    const type =
      postTypeToAttachmentType[
        post.type as keyof typeof postTypeToAttachmentType
      ] ?? NotificationAttachmentType.Post;

    this.attachments.push({
      type,
      image: (post as ArticlePost)?.image || pickImageUrl(post),
      title: post.title ?? '',
      referenceId: post.id,
    });
    return this;
  }

  avatarSource(source: Reference<Source>): NotificationBuilder {
    this.avatars.push({
      type: 'source',
      referenceId: source.id,
      image: source.image,
      name: source.name,
      targetUrl: getSourceLink(source),
    });
    return this;
  }

  avatarManySources(sources: Reference<Source>[]): NotificationBuilder {
    const newAvatars = sources.map(
      (source): DeepPartial<NotificationAvatarV2> => ({
        type: 'source',
        referenceId: source.id,
        image: source.image,
        name: source.name,
        targetUrl: getSourceLink(source),
      }),
    );
    this.avatars = this.avatars.concat(newAvatars);
    return this;
  }

  avatarUser(user: Reference<User>): NotificationBuilder {
    this.avatars.push({
      type: 'user',
      referenceId: user.id,
      image: user.image ?? fallbackImages.avatar,
      name: user.name || user.username,
      targetUrl: getUserPermalink(user),
    });

    return this;
  }

  avatarOrganization(
    organization: NotificationOrganizationContext['organization'],
  ): NotificationBuilder {
    this.avatars.push({
      type: 'organization',
      referenceId: organization.id,
      image: organization.image ?? fallbackImages.organization,
      name: organization.name,
      targetUrl: getOrganizationPermalink(organization),
    });
    return this;
  }

  avatarManyUsers(users: Reference<User>[]): NotificationBuilder {
    const newAvatars = users.map(
      (user): DeepPartial<NotificationAvatarV2> => ({
        type: 'user',
        referenceId: user.id,
        image: user.image ?? fallbackImages.avatar,
        name: user.name,
        targetUrl: getUserPermalink(user),
      }),
    );
    this.avatars = this.avatars.concat(newAvatars);
    return this;
  }

  avatarTopReaderBadge(
    ctx: NotificationUserTopReaderContext,
  ): NotificationBuilder {
    this.avatars.push({
      type: 'top_reader_badge',
      name: (ctx.keyword.flags as KeywordFlags)?.title || ctx.keyword.value,
      targetUrl: '',
      referenceId: ctx.userTopReader.id,
      image: emptyImage,
    });
    return this;
  }

  avatarBriefing(): NotificationBuilder {
    this.avatars.push({
      type: 'brief',
      name: 'Brief',
      targetUrl: '',
      referenceId: 'brief',
      image: emptyImage,
    });

    return this;
  }

  descriptionComment(comment: Reference<Comment>): NotificationBuilder {
    return this.enrichNotification({
      description: simplifyComment(comment.content),
    });
  }

  upvotes(upvotes: number, upvoters: Reference<User>[]): NotificationBuilder {
    return this.enrichNotification({
      uniqueKey: upvotes.toString(),
      icon: NotificationIcon.Upvote,
    }).avatarManyUsers(upvoters);
  }

  numTotalAvatars(numTotalAvatars: number): NotificationBuilder {
    return this.enrichNotification({
      numTotalAvatars: numTotalAvatars,
    });
  }

  sourceMemberRole(role: SourceMemberRoles): NotificationBuilder {
    return this.enrichNotification({
      uniqueKey: role.toString(),
      icon: roleToIcon[role],
    });
  }

  uniqueKey(key: string): NotificationBuilder {
    return this.enrichNotification({ uniqueKey: key });
  }

  objectPost(
    post: Reference<Post>,
    source: Reference<Source>,
    sharedPost?: Reference<Post> | null,
    addSquadAvatar = true,
  ) {
    let newBuilder = this.referencePost(post).targetPost(post);
    if (source.type === SourceType.Squad && addSquadAvatar) {
      newBuilder = newBuilder.avatarSource(source);
    }
    if (post.type === PostType.Share && sharedPost) {
      const sharedTitle = sharedPost.title?.length
        ? simplifyComment(sharedPost.title)
        : '';
      const title = post.title?.length
        ? simplifyComment(post.title)
        : sharedTitle;
      newBuilder = newBuilder.description(title).attachmentPost(sharedPost);
    } else {
      newBuilder = newBuilder.attachmentPost(post);
    }
    return newBuilder;
  }

  private enrichNotification(
    addition: DeepPartial<NotificationV2>,
  ): NotificationBuilder {
    this.notification = { ...this.notification, ...addition };
    return this;
  }
}
