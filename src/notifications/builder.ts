import { DeepPartial } from 'typeorm';
import {
  ArticlePost,
  Comment,
  Notification,
  NotificationAttachment,
  NotificationAvatar,
  NotificationType,
  Post,
  PostType,
  Source,
  SourceRequest,
  SourceType,
  Submission,
  User,
} from '../entity';
import { getDiscussionLink, getSourceLink, pickImageUrl } from '../common';
import { getUserPermalink } from '../schema/users';
import { markdownToTxt } from 'markdown-to-txt';
import { NotificationBundle, Reference } from './types';
import { NotificationIcon } from './icons';

const MAX_COMMENT_LENGTH = 320;

export const simplifyComment = (comment: string): string => {
  const simplified = markdownToTxt(comment);
  return simplified.length <= MAX_COMMENT_LENGTH
    ? simplified
    : `${simplified.substring(0, MAX_COMMENT_LENGTH - 3)}...`;
};

export class NotificationBuilder {
  notification: DeepPartial<Notification> = {};
  avatars: DeepPartial<NotificationAvatar>[] = [];
  attachments: DeepPartial<NotificationAttachment>[] = [];

  constructor(type: NotificationType, userId: string) {
    this.notification = { type, userId, public: true };
  }

  static new(type: NotificationType, userId: string): NotificationBuilder {
    return new NotificationBuilder(type, userId);
  }

  build(): NotificationBundle {
    return {
      notification: this.notification,
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

  referenceSource(source: Reference<Source>): NotificationBuilder {
    return this.enrichNotification({
      referenceId: source.id,
      referenceType: 'source',
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

  icon(icon: NotificationIcon): NotificationBuilder {
    return this.enrichNotification({ icon });
  }

  title(title: string): NotificationBuilder {
    return this.enrichNotification({ title });
  }

  description(description: string): NotificationBuilder {
    return this.enrichNotification({ description });
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

  attachmentPost(post: Reference<Post>): NotificationBuilder {
    this.attachments.push({
      order: this.attachments.length,
      type: 'post',
      image: (post as ArticlePost)?.image || pickImageUrl(post),
      title: post.title,
      referenceId: post.id,
    });
    return this;
  }

  avatarSource(source: Reference<Source>): NotificationBuilder {
    this.avatars.push({
      order: this.avatars.length,
      type: 'source',
      referenceId: source.id,
      image: source.image,
      name: source.name,
      targetUrl: getSourceLink(source),
    });
    return this;
  }

  avatarManyUsers(users: Reference<User>[]): NotificationBuilder {
    const newAvatars = users.map(
      (user, i): DeepPartial<NotificationAvatar> => ({
        order: i + this.avatars.length,
        type: 'user',
        referenceId: user.id,
        image: user.image,
        name: user.name,
        targetUrl: getUserPermalink(user),
      }),
    );
    this.avatars = this.avatars.concat(newAvatars);
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

  uniqueKey(key: string): NotificationBuilder {
    return this.enrichNotification({ uniqueKey: key });
  }

  objectPost(
    post: Reference<Post>,
    source: Reference<Source>,
    sharedPost?: Reference<Post>,
    addSquadAvatar = true,
  ) {
    let newBuilder = this.referencePost(post).targetPost(post);
    if (source.type === SourceType.Squad && addSquadAvatar) {
      newBuilder = newBuilder.avatarSource(source);
    }
    if (post.type === PostType.Share) {
      newBuilder = newBuilder
        .description(simplifyComment(post.title))
        .attachmentPost(sharedPost);
    } else {
      newBuilder = newBuilder.attachmentPost(post);
    }
    return newBuilder;
  }

  private enrichNotification(
    addition: DeepPartial<Notification>,
  ): NotificationBuilder {
    this.notification = { ...this.notification, ...addition };
    return this;
  }
}
