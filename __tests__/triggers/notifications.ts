import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { saveFixtures } from '../helpers';
import {
  ArticlePost,
  Comment,
  NotificationAttachmentType,
  NotificationAttachmentV2,
  Post,
  PostType,
  Source,
  SourceType,
  User,
} from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { postsFixture } from '../fixture/post';
import { usersFixture } from '../fixture/user';
import { NotificationAvatarV2 } from '../../src/entity/notifications/NotificationAvatarV2';
import { NotificationV2 } from '../../src/entity/notifications/NotificationV2';
import { NotificationType } from '../../src/notifications/common';
import {
  NotificationPostContext,
  NotificationUpvotersContext,
  Reference,
  generateNotificationV2,
  storeNotificationBundleV2,
} from '../../src/notifications';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, ArticlePost, postsFixture);
  await saveFixtures(con, User, usersFixture);
});

describe('update_source_avatar', () => {
  it('should do nothing if no avatar', async () => {
    await con
      .getRepository(Source)
      .update(sourcesFixture[0].id, { name: 'Test' });
    const actual = await con.getRepository(NotificationAvatarV2).find();
    expect(actual.length).toEqual(0);
  });

  it('should update existing avatar', async () => {
    await con.getRepository(NotificationAvatarV2).insert({
      type: 'source',
      referenceId: sourcesFixture[0].id,
      targetUrl: '',
      name: '',
      image: '',
    });
    await con
      .getRepository(Source)
      .update(sourcesFixture[0].id, { name: 'Test' });
    const actual = await con.getRepository(NotificationAvatarV2).find();
    expect(actual).toEqual([
      {
        id: expect.any(String),
        image: 'http://image.com/a',
        name: 'Test',
        referenceId: 'a',
        targetUrl: 'http://localhost:5002/sources/a',
        type: 'source',
      },
    ]);
  });

  it('should support squads', async () => {
    await con.getRepository(NotificationAvatarV2).insert({
      type: 'source',
      referenceId: sourcesFixture[0].id,
      targetUrl: '',
      name: '',
      image: '',
    });
    await con
      .getRepository(Source)
      .update(sourcesFixture[0].id, { name: 'Test', type: SourceType.Squad });
    const actual = await con.getRepository(NotificationAvatarV2).find();
    expect(actual).toEqual([
      {
        id: expect.any(String),
        image: 'http://image.com/a',
        name: 'Test',
        referenceId: 'a',
        targetUrl: 'http://localhost:5002/squads/a',
        type: 'source',
      },
    ]);
  });
});

describe('update_user_avatar', () => {
  it('should do nothing if no avatar', async () => {
    await con.getRepository(User).update(usersFixture[0].id, { name: 'Test' });
    const actual = await con.getRepository(NotificationAvatarV2).find();
    expect(actual.length).toEqual(0);
  });

  it('should update existing avatar', async () => {
    await con.getRepository(NotificationAvatarV2).insert({
      type: 'user',
      referenceId: usersFixture[0].id,
      targetUrl: '',
      name: '',
      image: '',
    });
    await con.getRepository(User).update(usersFixture[0].id, { name: 'Test' });
    const actual = await con.getRepository(NotificationAvatarV2).find();
    expect(actual).toEqual([
      {
        id: expect.any(String),
        image: 'https://daily.dev/ido.jpg',
        name: 'Test',
        referenceId: '1',
        targetUrl: 'http://localhost:5002/idoshamun',
        type: 'user',
      },
    ]);
  });
});

describe('delete_post_notifications', () => {
  beforeEach(async () => {
    await con.getRepository(NotificationV2).insert([
      {
        type: NotificationType.ArticleUpvoteMilestone,
        public: true,
        targetUrl: '',
        referenceId: postsFixture[0].id,
        referenceType: 'post',
        icon: '',
        description: '',
        title: '',
      },
      {
        type: NotificationType.ArticleUpvoteMilestone,
        public: true,
        targetUrl: '',
        referenceId: postsFixture[1].id,
        referenceType: 'post',
        icon: '',
        description: '',
        title: '',
      },
    ]);
  });

  it('should do nothing if post is not deleted', async () => {
    await con.getRepository(Post).update(postsFixture[0].id, { title: 'Test' });
    const actual = await con.getRepository(NotificationV2).find();
    expect(actual.length).toEqual(2);
  });

  it('should delete relevant notifications', async () => {
    await con.getRepository(Post).update(postsFixture[0].id, { deleted: true });
    const actual = await con.getRepository(NotificationV2).find();
    expect(actual.length).toEqual(1);
    expect(actual[0].referenceId).toEqual(postsFixture[1].id);
  });
});

describe('delete_comment_notifications', () => {
  beforeEach(async () => {
    await con.getRepository(Comment).insert({
      id: '1',
      userId: usersFixture[0].id,
      content: '',
      contentHtml: '',
      postId: postsFixture[0].id,
    });
    await con.getRepository(NotificationV2).insert([
      {
        type: NotificationType.CommentUpvoteMilestone,
        public: true,
        targetUrl: '',
        referenceId: '1',
        referenceType: 'comment',
        icon: '',
        description: '',
        title: '',
      },
      {
        type: NotificationType.CommentUpvoteMilestone,
        public: true,
        targetUrl: '',
        referenceId: '2',
        referenceType: 'comment',
        icon: '',
        description: '',
        title: '',
      },
    ]);
  });

  it('should do nothing if comment is not deleted', async () => {
    await con.getRepository(Comment).update('1', { content: 'Test' });
    const actual = await con.getRepository(NotificationV2).find();
    expect(actual.length).toEqual(2);
  });

  it('should delete relevant notifications', async () => {
    await con.getRepository(Comment).delete({ id: '1' });
    const actual = await con.getRepository(NotificationV2).find();
    expect(actual.length).toEqual(1);
    expect(actual[0].referenceId).toEqual('2');
  });
});

describe('update_post_notification_attachment', () => {
  const userId = '1';

  it('should update notification attachment when post type changes', async () => {
    await saveFixtures(con, User, usersFixture);
    await saveFixtures(con, Source, sourcesFixture);
    await saveFixtures(con, Post, postsFixture);

    const type = NotificationType.ArticleUpvoteMilestone;
    const ctx: NotificationPostContext & NotificationUpvotersContext = {
      userIds: [userId],
      source: sourcesFixture[0] as Reference<Source>,
      post: {
        ...postsFixture[0],
        type: PostType.Article,
      } as Reference<Post>,
      upvotes: 50,
      upvoters: [usersFixture[1], usersFixture[2]] as Reference<User>[],
    };
    const actual = generateNotificationV2(type, ctx);
    expect(actual.notification.type).toEqual(type);
    expect(actual.userIds).toEqual([userId]);
    expect(actual.attachments).toEqual([
      {
        image: 'https://daily.dev/image.jpg',
        referenceId: 'p1',
        title: 'P1',
        type: NotificationAttachmentType.Post,
      },
    ]);
    await storeNotificationBundleV2(con.createEntityManager(), actual);

    await con
      .getRepository(Post)
      .update({ id: 'p1' }, { type: PostType.VideoYouTube });

    const updated = await con
      .getRepository(NotificationAttachmentV2)
      .findOneBy({
        referenceId: 'p1',
      });

    expect(updated!.type).toEqual(NotificationAttachmentType.Video);
  });

  it('should update notification attachment when post image changes', async () => {
    await saveFixtures(con, User, usersFixture);
    await saveFixtures(con, Source, sourcesFixture);
    await saveFixtures(con, Post, postsFixture);

    const type = NotificationType.ArticleUpvoteMilestone;
    const ctx: NotificationPostContext & NotificationUpvotersContext = {
      userIds: [userId],
      source: sourcesFixture[0] as Reference<Source>,
      post: {
        ...postsFixture[0],
        type: PostType.Article,
      } as Reference<Post>,
      upvotes: 50,
      upvoters: [usersFixture[1], usersFixture[2]] as Reference<User>[],
    };
    const actual = generateNotificationV2(type, ctx);
    expect(actual.notification.type).toEqual(type);
    expect(actual.userIds).toEqual([userId]);
    expect(actual.attachments).toEqual([
      {
        image: 'https://daily.dev/image.jpg',
        referenceId: 'p1',
        title: 'P1',
        type: NotificationAttachmentType.Post,
      },
    ]);
    await storeNotificationBundleV2(con.createEntityManager(), actual);

    await con
      .getRepository(ArticlePost)
      .update({ id: 'p1' }, { image: 'https://daily.dev/image2.jpg' });

    const updated = await con
      .getRepository(NotificationAttachmentV2)
      .findOneBy({
        referenceId: 'p1',
      });

    expect(updated!.image).toEqual('https://daily.dev/image2.jpg');
  });
});
