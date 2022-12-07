import { NotificationType } from '../entity';
import { NotificationBuilder } from './builder';
import { NotificationIcon } from './icons';
import { scoutArticleLink } from '../common';
import {
  NotificationBaseContext,
  NotificationCommentContext,
  NotificationCommenterContext,
  NotificationPostContext,
  NotificationSourceContext,
  NotificationSourceRequestContext,
  NotificationSubmissionContext,
  NotificationUpvotersContext,
} from './types';

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
      .referencePost(ctx.post)
      .icon(NotificationIcon.CommunityPicks)
      .title(
        `<b>Community picks:</b> An article you Scouted was accepted and is now <span class="text-theme-color-cabbage">live</span> on the daily.dev feed!`,
      )
      .targetPost(ctx.post)
      .attachmentPost(ctx.post),
  community_picks_granted: (builder) =>
    builder
      .referenceSystem()
      .icon(NotificationIcon.DailyDev)
      .title(
        `<b>Community picks:</b> You have earned enough reputation to <span class="text-theme-color-cabbage">Scout and submit</span> articles.`,
      )
      .description(`<u>Submit your first article now!</u>`)
      //TODO: validate with web team that this is going to be supported!
      .targetUrl(scoutArticleLink),
  article_picked: (builder, ctx: NotificationPostContext) =>
    builder
      .referencePost(ctx.post)
      .icon(NotificationIcon.DailyDev)
      .title(
        `Congratulations! <b>Your article</b> got <span class="text-theme-color-cabbage">listed</span> on the daily.dev feed!`,
      )
      .targetPost(ctx.post)
      .attachmentPost(ctx.post),
  article_new_comment: (builder, ctx: NotificationCommenterContext) =>
    builder
      .referenceComment(ctx.comment)
      .icon(NotificationIcon.Comment)
      .title(
        `<b>${ctx.commenter.name}</b> posted a <span class="text-theme-color-blueCheese">comment</span> on your article.`,
      )
      .descriptionComment(ctx.comment)
      .targetPost(ctx.post, ctx.comment)
      .avatarManyUsers([ctx.commenter]),
  article_upvote_milestone: (
    builder,
    ctx: NotificationPostContext & NotificationUpvotersContext,
  ) =>
    builder
      .referencePost(ctx.post)
      .upvotes(ctx.upvotes, ctx.upvoters)
      .title(
        `<b>You rock!</b> Your article <span class="text-theme-color-avocado">earned ${ctx.upvotes} upvotes!</span>`,
      )
      .targetPost(ctx.post)
      .attachmentPost(ctx.post),
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
      .title(
        `<b>The source you requested was</b> <span class="text-theme-color-cabbage">approved!</span> Articles from ${ctx.source.name} will start appearing in the daily.dev feed in the next few days!`,
      )
      .targetSource(ctx.source)
      .avatarSource(ctx.source),
  source_rejected: (builder, ctx: NotificationSourceRequestContext) =>
    builder.systemNotification().referenceSourceRequest(ctx.sourceRequest),
  comment_mention: (builder, ctx: NotificationCommenterContext) =>
    builder
      .referenceComment(ctx.comment)
      .icon(NotificationIcon.Comment)
      .title(
        `<b>${ctx.commenter.name}</b> <span class="text-theme-color-blueCheese">mentioned you</span> in a comment.`,
      )
      .descriptionComment(ctx.comment)
      .targetPost(ctx.post, ctx.comment)
      .avatarManyUsers([ctx.commenter]),
  comment_reply: (builder, ctx: NotificationCommenterContext) =>
    builder
      .referenceComment(ctx.comment)
      .icon(NotificationIcon.Comment)
      .title(
        `<b>${ctx.commenter.name}</b> <span class="text-theme-color-blueCheese">replied</span> to your comment.`,
      )
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
      .title(
        `<b>You rock!</b> Your comment <span class="text-theme-color-avocado">earned ${ctx.upvotes} upvotes!</span>`,
      )
      .descriptionComment(ctx.comment)
      .targetPost(ctx.post, ctx.comment),
};
