import {
  Comment,
  Notification,
  NotificationAttachment,
  NotificationAvatar,
  Post,
  Source,
  SourceRequest,
  Submission,
  User,
} from '../entity';
import { ChangeObject } from '../types';
import { DeepPartial } from 'typeorm';

export type Reference<T> = ChangeObject<T> | T;

export type NotificationBundle = {
  notification: DeepPartial<Notification>;
  avatars?: DeepPartial<NotificationAvatar>[];
  attachments?: DeepPartial<NotificationAttachment>[];
};

export type NotificationBaseContext = { userId: string };
export type NotificationSubmissionContext = NotificationBaseContext & {
  submission: Pick<Submission, 'id'>;
};
export type NotificationPostContext = NotificationBaseContext & {
  post: Reference<Post>;
};

export type NotificationCommentContext = NotificationPostContext & {
  comment: Reference<Comment>;
};

export type NotificationCommenterContext = NotificationCommentContext & {
  commenter: Reference<User>;
};

export type NotificationUpvotersContext = NotificationBaseContext & {
  upvotes: number;
  upvoters: Reference<User>[];
};

export type NotificationSourceRequestContext = NotificationBaseContext & {
  sourceRequest: Reference<SourceRequest>;
};

export type NotificationSourceContext = NotificationBaseContext & {
  source: Reference<Source>;
};
