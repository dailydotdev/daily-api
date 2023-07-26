import { PostType, FreeformPost } from '../entity';
import { NotificationBuilder } from './builder';
import { NotificationIcon } from './icons';
import {
  notificationsLink,
  scoutArticleLink,
  squadCreateLink,
  subscribeNotificationsLink,
} from '../common';
import {
  NotificationBaseContext,
  NotificationCommentContext,
  NotificationCommenterContext,
  NotificationDoneByContext,
  NotificationPostContext,
  NotificationSourceContext,
  NotificationSourceMemberRoleContext,
  NotificationSourceRequestContext,
  NotificationSubmissionContext,
  NotificationUpvotersContext,
} from './types';
import { UPVOTE_TITLES } from '../workers/notifications/utils';
import { checkHasMention } from '../common/markdown';
import { NotificationType } from './common';

const systemTitle = () => undefined;

export const notificationTitleMap: Record<
  NotificationType,
  (ctx: NotificationBaseContext) => string | undefined
> = {
  community_picks_failed: systemTitle,
  community_picks_succeeded: () =>
    `<b>Community Picks:</b> a link you scouted was accepted and is now <span class="text-theme-color-cabbage">live</span> on the daily.dev feed!`,
  community_picks_granted: () =>
    `<b>Community Picks:</b> You have earned enough reputation to <span class="text-theme-color-cabbage">scout and submit</span> links.`,
  article_picked: () =>
    `Congrats! <b>Your post</b> got <span class="text-theme-color-cabbage">listed</span> on the daily.dev feed!`,
  article_new_comment: (ctx: NotificationCommenterContext) =>
    `<b>${ctx.commenter.name}</b> <span class="text-theme-color-blueCheese">commented</span> on your post.`,
  article_upvote_milestone: (
    ctx: NotificationPostContext & NotificationUpvotersContext,
  ) =>
    UPVOTE_TITLES[ctx.upvotes] ??
    `<b>You rock!</b> Your post <span class="text-theme-color-avocado">earned ${ctx.upvotes} upvotes!</span>`,
  article_report_approved: systemTitle,
  article_analytics: systemTitle,
  source_approved: (
    ctx: NotificationSourceRequestContext & NotificationSourceContext,
  ) =>
    `<b>The source you suggested was</b> <span class="text-theme-color-cabbage">approved!</span> Posts from ${ctx.source.name} will start appearing in the daily.dev feed in the next few days!`,
  source_rejected: systemTitle,
  comment_mention: (ctx: NotificationCommenterContext) =>
    `<b>${ctx.commenter.name}</b> <span class="text-theme-color-blueCheese">mentioned you</span> in a comment.`,
  comment_reply: (ctx: NotificationCommenterContext) =>
    `<b>${ctx.commenter.name}</b> <span class="text-theme-color-blueCheese">replied</span> to your comment.`,
  comment_upvote_milestone: (
    ctx: NotificationCommentContext & NotificationUpvotersContext,
  ) =>
    UPVOTE_TITLES[ctx.upvotes] ??
    `<b>You rock!</b> Your comment <span class="text-theme-color-avocado">earned ${ctx.upvotes} upvotes!</span>`,
  squad_access: () =>
    `Congratulations! You got access to <span class="text-theme-color-cabbage">Squad beta.</span>`,
  squad_post_added: (
    ctx: NotificationPostContext & NotificationDoneByContext,
  ) =>
    `<b>${ctx.doneBy.name}</b> shared a new post on <b>${ctx.source.name}</b>`,
  squad_member_joined: (
    ctx: NotificationSourceContext & NotificationDoneByContext,
  ) =>
    `Your squad <b>${ctx.source.name}</b> is <span class="text-theme-color-cabbage">growing</span>! Welcome <b>${ctx.doneBy.name}</b> to the squad with a comment.`,
  squad_new_comment: (ctx: NotificationCommenterContext) =>
    `<b>${ctx.commenter.name}</b> <span class="text-theme-color-blueCheese">commented</span> on your post on <b>${ctx.source.name}</b>.`,
  squad_reply: (ctx: NotificationCommenterContext) =>
    `<b>${ctx.commenter.name}</b> <span class="text-theme-color-blueCheese">replied</span> to your comment on <b>${ctx.source.name}</b>.`,
  squad_post_viewed: (
    ctx: NotificationPostContext & NotificationDoneByContext,
  ) =>
    `<b>${ctx.doneBy.name}</b> <span class="text-theme-color-cabbage">viewed</span> your post on <b>${ctx.source.name}</b>.`,
  squad_blocked: (ctx: NotificationSourceContext) =>
    `You are no longer part of <b>${ctx.source.name}</b>`,
  squad_subscribe_to_notification: (ctx: NotificationSourceContext) =>
    `Congrats on your first post on <b>${ctx.source.name}</b>. Subscribe to get updates about activity in your squad.`,
  promoted_to_admin: (ctx: NotificationSourceContext) =>
    `Congratulations! You are now an <span class="text-theme-color-cabbage">admin</span> of <b>${ctx.source.name}</b>`,
  demoted_to_member: (ctx: NotificationSourceMemberRoleContext) =>
    `You are no longer a <span class="text-theme-color-cabbage">${ctx.role}</span> in <b>${ctx.source.name}</b>`,
  promoted_to_moderator: (ctx: NotificationSourceContext) =>
    `You are now a <span class="text-theme-color-cabbage">moderator</span> in <b>${ctx.source.name}</b>`,
  post_mention: (ctx: NotificationPostContext & NotificationDoneByContext) =>
    `<b>${ctx.doneBy.username}</b> <span class="text-theme-color-cabbage">mentioned you</span> on a post in <b>${ctx.source.name}</b>.`,
};

export const generateNotificationMap: Record<
  NotificationType,
  (
    builder: NotificationBuilder,
    ctx: NotificationBaseContext,
  ) => NotificationBuilder
> = {
  community_picks_failed: (builder, ctx: NotificationSubmissionContext) =>
    builder.systemNotification().referenceSubmission(ctx.submission),
  community_picks_succeeded: (builder, ctx: NotificationPostContext) =>
    builder
      .icon(NotificationIcon.CommunityPicks)
      .objectPost(ctx.post, ctx.source, ctx.sharedPost),
  community_picks_granted: (builder) =>
    builder
      .referenceSystem()
      .icon(NotificationIcon.DailyDev)
      .description(`<u>Submit your first post now!</u>`)
      .targetUrl(scoutArticleLink),
  article_picked: (builder, ctx: NotificationPostContext) =>
    builder
      .icon(NotificationIcon.DailyDev)
      .objectPost(ctx.post, ctx.source, ctx.sharedPost),
  article_new_comment: (builder, ctx: NotificationCommenterContext) =>
    builder
      .referenceComment(ctx.comment)
      .icon(NotificationIcon.Comment)
      .descriptionComment(ctx.comment)
      .targetPost(ctx.post, ctx.comment)
      .avatarManyUsers([ctx.commenter]),
  article_upvote_milestone: (
    builder,
    ctx: NotificationPostContext & NotificationUpvotersContext,
  ) =>
    builder
      .objectPost(ctx.post, ctx.source, ctx.sharedPost)
      .upvotes(ctx.upvotes, ctx.upvoters),
  article_report_approved: (builder, ctx: NotificationPostContext) =>
    builder.referencePost(ctx.post).systemNotification(),
  article_analytics: (builder, ctx: NotificationPostContext) =>
    builder.referencePost(ctx.post).systemNotification(),
  source_approved: (
    builder,
    ctx: NotificationSourceRequestContext & NotificationSourceContext,
  ) =>
    builder
      .referenceSourceRequest(ctx.sourceRequest)
      .icon(NotificationIcon.DailyDev)
      .targetSource(ctx.source)
      .avatarSource(ctx.source),
  source_rejected: (builder, ctx: NotificationSourceRequestContext) =>
    builder.systemNotification().referenceSourceRequest(ctx.sourceRequest),
  comment_mention: (builder, ctx: NotificationCommenterContext) =>
    builder
      .referenceComment(ctx.comment)
      .icon(NotificationIcon.Comment)
      .descriptionComment(ctx.comment)
      .targetPost(ctx.post, ctx.comment)
      .avatarManyUsers([ctx.commenter]),
  post_mention: (
    builder,
    ctx: NotificationPostContext<FreeformPost> & NotificationDoneByContext,
  ) =>
    builder
      .referencePost(ctx.post)
      .icon(NotificationIcon.Comment)
      .description(
        checkHasMention(ctx.post.title ?? '', ctx.doneTo.username)
          ? ctx.post.title
          : ctx.post.content,
        true,
      )
      .targetPost(ctx.post)
      .avatarManyUsers([ctx.doneBy]),
  comment_reply: (builder, ctx: NotificationCommenterContext) =>
    builder
      .referenceComment(ctx.comment)
      .icon(NotificationIcon.Comment)
      .descriptionComment(ctx.comment)
      .targetPost(ctx.post, ctx.comment)
      .avatarManyUsers([ctx.commenter]),
  comment_upvote_milestone: (
    builder,
    ctx: NotificationCommentContext & NotificationUpvotersContext,
  ) =>
    builder
      .referenceComment(ctx.comment)
      .upvotes(ctx.upvotes, ctx.upvoters)
      .descriptionComment(ctx.comment)
      .targetPost(ctx.post, ctx.comment),
  squad_access: (builder) =>
    builder
      .referenceSystem()
      .icon(NotificationIcon.DailyDev)
      .description(`Create your new Squad`)
      .targetUrl(squadCreateLink),
  squad_post_added: (
    builder,
    ctx: NotificationPostContext & NotificationDoneByContext,
  ) =>
    builder
      .icon(NotificationIcon.Bell)
      .objectPost(ctx.post, ctx.source, ctx.sharedPost)
      .avatarManyUsers([ctx.doneBy]),
  squad_member_joined: (
    builder,
    ctx: NotificationPostContext & NotificationDoneByContext,
  ) =>
    builder
      .icon(NotificationIcon.Bell)
      .referencePost(ctx.post)
      .targetPost(ctx.post)
      .avatarSource(ctx.source)
      .avatarManyUsers([ctx.doneBy])
      .uniqueKey(ctx.doneBy.id)
      .setTargetUrlParameter(
        ctx.post.type === PostType.Welcome
          ? [
              [
                'comment',
                `@${ctx.doneBy.username} welcome to ${ctx.source.name}!`,
              ],
            ]
          : [],
      ),
  squad_new_comment: (builder, ctx: NotificationCommenterContext) =>
    builder
      .referenceComment(ctx.comment)
      .icon(NotificationIcon.Comment)
      .descriptionComment(ctx.comment)
      .targetPost(ctx.post, ctx.comment)
      .avatarSource(ctx.source)
      .avatarManyUsers([ctx.commenter]),
  squad_reply: (builder, ctx: NotificationCommenterContext) =>
    builder
      .referenceComment(ctx.comment)
      .icon(NotificationIcon.Comment)
      .descriptionComment(ctx.comment)
      .targetPost(ctx.post, ctx.comment)
      .avatarSource(ctx.source)
      .avatarManyUsers([ctx.commenter]),
  squad_post_viewed: (
    builder,
    ctx: NotificationPostContext & NotificationDoneByContext,
  ) =>
    builder
      .icon(NotificationIcon.View)
      .objectPost(ctx.post, ctx.source, ctx.sharedPost)
      .avatarManyUsers([ctx.doneBy])
      .uniqueKey(ctx.doneBy.id),
  squad_blocked: (builder, ctx: NotificationSourceContext) =>
    builder
      .targetUrl(process.env.COMMENTS_PREFIX)
      .avatarSource(ctx.source)
      .icon(NotificationIcon.Block)
      .referenceSource(ctx.source),
  squad_subscribe_to_notification: (builder, ctx: NotificationSourceContext) =>
    builder
      .targetUrl(subscribeNotificationsLink)
      .avatarSource(ctx.source)
      .icon(NotificationIcon.Bell)
      .referenceSource(ctx.source),
  promoted_to_admin: (builder, ctx: NotificationSourceContext) =>
    builder
      .avatarSource(ctx.source)
      .icon(NotificationIcon.Star)
      .referenceSource(ctx.source)
      .targetUrl(notificationsLink)
      .setTargetUrlParameter([
        ['promoted', 'true'],
        ['sid', ctx.source.handle],
      ]),
  demoted_to_member: (builder, ctx: NotificationSourceMemberRoleContext) =>
    builder
      .avatarSource(ctx.source)
      .sourceMemberRole(ctx.role)
      .referenceSource(ctx.source)
      .targetSource(ctx.source),
  promoted_to_moderator: (builder, ctx: NotificationSourceContext) =>
    builder
      .avatarSource(ctx.source)
      .icon(NotificationIcon.User)
      .referenceSource(ctx.source)
      .targetUrl(notificationsLink)
      .setTargetUrlParameter([
        ['promoted', 'true'],
        ['sid', ctx.source.handle],
      ]),
};
