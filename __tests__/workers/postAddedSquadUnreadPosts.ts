import { expectSuccessfulTypedBackground, saveFixtures } from '../helpers';
import { postAddedSquadUnreadPostsWorker as worker } from '../../src/workers/postAddedSquadUnreadPosts';
import {
  Source,
  SourceMember,
  SourceType,
  User,
  type ArticlePost,
} from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { DataSource, JsonContains, Or } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { typedWorkers } from '../../src/workers';
import { usersFixture } from '../fixture/user';

import { SourceMemberRoles } from '../../src/roles';
import { randomUUID } from 'crypto';
import type { ChangeObject } from '../../src/types';

let con: DataSource;

beforeAll(async () => {
  jest.clearAllMocks();
  con = await createOrGetConnection();
});

describe('postAddedSquadUnreadPosts worker', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    await saveFixtures(con, Source, sourcesFixture);
    await con
      .getRepository(Source)
      .update({ id: 'a' }, { type: SourceType.Squad });

    await saveFixtures(con, User, usersFixture);

    const now = new Date(2025, 8, 5);
    await con.getRepository(SourceMember).save([
      {
        userId: '1',
        sourceId: 'a',
        role: SourceMemberRoles.Member,
        referralToken: 'rt',
        createdAt: new Date(now.getTime() + 0),
      },
      {
        userId: '2',
        sourceId: 'a',
        role: SourceMemberRoles.Member,
        referralToken: randomUUID(),
        createdAt: new Date(now.getTime() + 1000),
      },
      {
        userId: '2',
        sourceId: 'b',
        role: SourceMemberRoles.Member,
        referralToken: randomUUID(),
        createdAt: new Date(now.getTime() + 2000),
      },
      {
        userId: '3',
        sourceId: 'b',
        role: SourceMemberRoles.Member,
        referralToken: randomUUID(),
        createdAt: new Date(now.getTime() + 3000),
      },
    ]);
  });

  it('should be registered', () => {
    const registeredWorker = typedWorkers.find(
      (item) => item.subscription === worker.subscription,
    );

    expect(registeredWorker).toBeDefined();
  });

  it('should not update hasUnreadPosts flag on source members when source is not a squad', async () => {
    const beforeResult = await con.getRepository(SourceMember).countBy({
      sourceId: 'b',
      flags: Or(
        JsonContains({
          hasUnreadPosts: false,
        }),
        JsonContains({
          hasUnreadPosts: true,
        }),
      ),
    });

    expect(beforeResult).toBe(0);

    await expectSuccessfulTypedBackground(worker, {
      post: {
        sourceId: 'b',
      } as ChangeObject<ArticlePost>,
    });

    const afterResult = await con.getRepository(SourceMember).countBy({
      sourceId: 'b',
      flags: Or(
        JsonContains({
          hasUnreadPosts: false,
        }),
        JsonContains({
          hasUnreadPosts: true,
        }),
      ),
    });

    expect(afterResult).toBe(0);
  });

  it('should update hasUnreadPosts flag on source members when source is a squad', async () => {
    const beforeResult = await con.getRepository(SourceMember).countBy({
      sourceId: 'a',
      flags: Or(
        JsonContains({
          hasUnreadPosts: false,
        }),
        JsonContains({
          hasUnreadPosts: true,
        }),
      ),
    });

    expect(beforeResult).toBe(0);

    await expectSuccessfulTypedBackground(worker, {
      post: {
        sourceId: 'a',
      } as ChangeObject<ArticlePost>,
    });

    const afterResult = await con.getRepository(SourceMember).countBy({
      sourceId: 'a',
      flags: Or(
        JsonContains({
          hasUnreadPosts: false,
        }),
        JsonContains({
          hasUnreadPosts: true,
        }),
      ),
    });

    expect(afterResult).toBe(2);
  });
});
