import {
  BookmarkActivities,
  createActivities,
} from '../../../src/temporal/notifications/activities';
import createOrGetConnection from '../../../src/db';
import { DataSource } from 'typeorm';
import { Bookmark, MachineSource, Post, User } from '../../../src/entity';
import { saveFixtures } from '../../helpers';
import { sourcesFixture, usersFixture } from '../../fixture';
import { postsFixture } from '../../fixture/post';
import { triggerTypedEvent } from '../../../src/common';
import { MockActivityEnvironment } from '@temporalio/testing';

let activities: BookmarkActivities;
let con: DataSource;
let env: MockActivityEnvironment;

jest.mock('../../../src/common', () => ({
  ...(jest.requireActual('../../../src/common') as Record<string, unknown>),
  triggerTypedEvent: jest.fn(),
}));

beforeEach(async () => {
  con = await createOrGetConnection();
  await saveFixtures(con, User, usersFixture);
  await saveFixtures(con, MachineSource, sourcesFixture);
  await saveFixtures(con, Post, postsFixture);
  env = new MockActivityEnvironment();
  activities = createActivities({ con });
});

describe('validateBookmark activity', () => {
  it('should return true if the bookmark still exists', async () => {
    const bookmark = { userId: '1', postId: 'p1' };

    await con.getRepository(Bookmark).save(bookmark);

    const result = await env.run(activities.validateBookmark, bookmark);

    expect(result).toBeTruthy();
  });

  it('should return false if the bookmark does not exists', async () => {
    const bookmark = { userId: '1', postId: 'p1' };

    const result = await env.run(activities.validateBookmark, bookmark);

    expect(result).toBeFalsy();
  });
});

describe('sendBookmarkReminder activity', () => {
  it('should send a pubsub event', async () => {
    await env.run(activities.sendBookmarkReminder, {
      userId: '1',
      postId: 'p1',
    });
    expect(triggerTypedEvent).toHaveBeenCalledWith(
      expect.anything(),
      'api.v1.post-bookmark-reminder',
      { userId: '1', postId: 'p1' },
    );
  });
});
