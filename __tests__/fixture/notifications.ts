import { DeepPartial } from 'typeorm';
import { Notification } from '../../src/entity';

const now = new Date(2021, 4, 2);

export const notificationFixture: DeepPartial<Notification> = {
  userId: '1',
  createdAt: now,
  icon: 'icon',
  title: 'notification #1',
  description: 'description',
  targetUrl: 'https://daily.dev',
  type: 'comment_mention',
  public: true,
};
