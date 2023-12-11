import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { saveFixtures } from '../helpers';
import {
  ArticlePost,
  Comment,
  Post,
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
