import { DeepPartial } from 'typeorm';
import { Notification } from '../../src/entity';
import { NotificationType } from '../../src/notifications/common';
import { NotificationV2 } from '../../src/entity/notifications/NotificationV2';

const now = new Date(2021, 4, 2);

export const notificationFixture: DeepPartial<Notification> = {
  userId: '1',
  createdAt: now,
  icon: 'icon',
  title: 'notification #1',
  description: 'description',
  targetUrl: 'https://daily.dev',
  type: NotificationType.CommentMention,
  public: true,
};

export const notificationV2Fixture: DeepPartial<NotificationV2> = {
  createdAt: now,
  icon: 'icon',
  title: 'notification #1',
  description: 'description',
  targetUrl: 'https://daily.dev',
  type: NotificationType.CommentMention,
  public: true,
};
