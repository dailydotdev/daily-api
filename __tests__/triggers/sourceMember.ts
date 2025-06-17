import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { saveFixtures } from '../helpers';
import { Source, SourceType, User, Feed } from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { usersFixture } from '../fixture/user';
import { ContentPreferenceSource } from '../../src/entity/contentPreference/ContentPreferenceSource';
import {
  ContentPreferenceStatus,
  ContentPreferenceType,
} from '../../src/entity/contentPreference/types';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, User, usersFixture);
  await saveFixtures(con, Source, sourcesFixture);

  await con.getRepository(Feed).save([
    { id: '1', userId: '1' },
    { id: '2', userId: '2' },
  ]);
});

describe('trigger increment_source_members_count', () => {
  it('should increment source members count when user follows source', async () => {
    const repo = con.getRepository(Source);
    await repo.update({ id: 'a' }, { type: SourceType.Squad });
    const source = await repo.findOneByOrFail({ id: 'a' });
    expect(source.flags.totalMembers).toEqual(undefined);

    await con.getRepository(ContentPreferenceSource).insert({
      referenceId: 'a',
      userId: '1',
      type: ContentPreferenceType.Source,
      feedId: '1',
      sourceId: 'a',
      status: ContentPreferenceStatus.Follow,
    });

    const increment = await repo.findOneByOrFail({ id: 'a' });
    expect(increment.flags.totalMembers).toEqual(1);
  });

  it('should increment source members count when user subscribes to source', async () => {
    const repo = con.getRepository(Source);
    await repo.update({ id: 'a' }, { type: SourceType.Squad });
    const source = await repo.findOneByOrFail({ id: 'a' });
    expect(source.flags.totalMembers).toEqual(undefined);

    await con.getRepository(ContentPreferenceSource).insert({
      referenceId: 'a',
      userId: '1',
      type: ContentPreferenceType.Source,
      feedId: '1',
      sourceId: 'a',
      status: ContentPreferenceStatus.Subscribed,
    });

    const increment = await repo.findOneByOrFail({ id: 'a' });
    expect(increment.flags.totalMembers).toEqual(1);
  });

  it('should not increment source members count when user blocks source on insert', async () => {
    const repo = con.getRepository(Source);
    await repo.update({ id: 'a' }, { type: SourceType.Squad });
    const source = await repo.findOneByOrFail({ id: 'a' });
    expect(source.flags.totalMembers).toEqual(undefined);

    await con.getRepository(ContentPreferenceSource).insert({
      referenceId: 'a',
      userId: '1',
      type: ContentPreferenceType.Source,
      feedId: '1',
      sourceId: 'a',
      status: ContentPreferenceStatus.Blocked,
    });

    const unchanged = await repo.findOneByOrFail({ id: 'a' });
    expect(unchanged.flags.totalMembers).toEqual(undefined);
  });

  it('should not change count when user switches between follow and subscribed', async () => {
    const repo = con.getRepository(Source);
    await repo.update({ id: 'a' }, { type: SourceType.Squad });
    const source = await repo.findOneByOrFail({ id: 'a' });
    expect(source.flags.totalMembers).toEqual(undefined);

    await con.getRepository(ContentPreferenceSource).insert({
      referenceId: 'a',
      userId: '1',
      type: ContentPreferenceType.Source,
      feedId: '1',
      sourceId: 'a',
      status: ContentPreferenceStatus.Follow,
    });

    const afterFollow = await repo.findOneByOrFail({ id: 'a' });
    expect(afterFollow.flags.totalMembers).toEqual(1);

    await con.getRepository(ContentPreferenceSource).update(
      {
        referenceId: 'a',
        userId: '1',
        type: ContentPreferenceType.Source,
        feedId: '1',
      },
      { status: ContentPreferenceStatus.Subscribed },
    );

    const afterSubscribed = await repo.findOneByOrFail({ id: 'a' });
    expect(afterSubscribed.flags.totalMembers).toEqual(1);

    await con.getRepository(ContentPreferenceSource).update(
      {
        referenceId: 'a',
        userId: '1',
        type: ContentPreferenceType.Source,
        feedId: '1',
      },
      { status: ContentPreferenceStatus.Follow },
    );

    const backToFollow = await repo.findOneByOrFail({ id: 'a' });
    expect(backToFollow.flags.totalMembers).toEqual(1);
  });

  it('should increment count when user changes from blocked to follow', async () => {
    const repo = con.getRepository(Source);
    await repo.update({ id: 'a' }, { type: SourceType.Squad });
    const source = await repo.findOneByOrFail({ id: 'a' });
    expect(source.flags.totalMembers).toEqual(undefined);

    await con.getRepository(ContentPreferenceSource).insert({
      referenceId: 'a',
      userId: '1',
      type: ContentPreferenceType.Source,
      feedId: '1',
      sourceId: 'a',
      status: ContentPreferenceStatus.Blocked,
    });

    const afterBlocked = await repo.findOneByOrFail({ id: 'a' });
    expect(afterBlocked.flags.totalMembers).toEqual(undefined);

    await con.getRepository(ContentPreferenceSource).update(
      {
        referenceId: 'a',
        userId: '1',
        type: ContentPreferenceType.Source,
        feedId: '1',
      },
      { status: ContentPreferenceStatus.Follow },
    );

    const afterFollow = await repo.findOneByOrFail({ id: 'a' });
    expect(afterFollow.flags.totalMembers).toEqual(1);
  });
});

describe('trigger blocked_source_members_count', () => {
  it('should decrement source members count when user changes from follow to blocked', async () => {
    const repo = con.getRepository(Source);
    await repo.update({ id: 'a' }, { type: SourceType.Squad });

    await con.getRepository(ContentPreferenceSource).insert({
      referenceId: 'a',
      userId: '1',
      type: ContentPreferenceType.Source,
      feedId: '1',
      sourceId: 'a',
      status: ContentPreferenceStatus.Follow,
    });

    const increment = await repo.findOneByOrFail({ id: 'a' });
    expect(increment.flags.totalMembers).toEqual(1);

    await con.getRepository(ContentPreferenceSource).update(
      {
        referenceId: 'a',
        userId: '1',
        type: ContentPreferenceType.Source,
        feedId: '1',
      },
      { status: ContentPreferenceStatus.Blocked },
    );

    const decrement = await repo.findOneByOrFail({ id: 'a' });
    expect(decrement.flags.totalMembers).toEqual(0);
  });

  it('should decrement source members count when user changes from subscribed to blocked', async () => {
    const repo = con.getRepository(Source);
    await repo.update({ id: 'a' }, { type: SourceType.Squad });

    await con.getRepository(ContentPreferenceSource).insert({
      referenceId: 'a',
      userId: '1',
      type: ContentPreferenceType.Source,
      feedId: '1',
      sourceId: 'a',
      status: ContentPreferenceStatus.Subscribed,
    });

    const increment = await repo.findOneByOrFail({ id: 'a' });
    expect(increment.flags.totalMembers).toEqual(1);

    await con.getRepository(ContentPreferenceSource).update(
      {
        referenceId: 'a',
        userId: '1',
        type: ContentPreferenceType.Source,
        feedId: '1',
      },
      { status: ContentPreferenceStatus.Blocked },
    );

    const decrement = await repo.findOneByOrFail({ id: 'a' });
    expect(decrement.flags.totalMembers).toEqual(0);
  });
});

describe('trigger decrement_source_members_count', () => {
  it('should decrement source members count when follow preference is deleted', async () => {
    const repo = con.getRepository(Source);
    await repo.update({ id: 'a' }, { type: SourceType.Squad });

    await con.getRepository(ContentPreferenceSource).insert({
      referenceId: 'a',
      userId: '1',
      type: ContentPreferenceType.Source,
      feedId: '1',
      sourceId: 'a',
      status: ContentPreferenceStatus.Follow,
    });

    const increment = await repo.findOneByOrFail({ id: 'a' });
    expect(increment.flags.totalMembers).toEqual(1);

    await con.getRepository(ContentPreferenceSource).delete({
      referenceId: 'a',
      userId: '1',
      type: ContentPreferenceType.Source,
      feedId: '1',
    });

    const decrement = await repo.findOneByOrFail({ id: 'a' });
    expect(decrement.flags.totalMembers).toEqual(0);
  });

  it('should decrement source members count when subscribed preference is deleted', async () => {
    const repo = con.getRepository(Source);
    await repo.update({ id: 'a' }, { type: SourceType.Squad });

    await con.getRepository(ContentPreferenceSource).insert({
      referenceId: 'a',
      userId: '1',
      type: ContentPreferenceType.Source,
      feedId: '1',
      sourceId: 'a',
      status: ContentPreferenceStatus.Subscribed,
    });

    const increment = await repo.findOneByOrFail({ id: 'a' });
    expect(increment.flags.totalMembers).toEqual(1);

    await con.getRepository(ContentPreferenceSource).delete({
      referenceId: 'a',
      userId: '1',
      type: ContentPreferenceType.Source,
      feedId: '1',
    });

    const decrement = await repo.findOneByOrFail({ id: 'a' });
    expect(decrement.flags.totalMembers).toEqual(0);
  });

  it('should not decrement source members count when blocked preference is deleted', async () => {
    const repo = con.getRepository(Source);
    await repo.update({ id: 'a' }, { type: SourceType.Squad });

    await con.getRepository(ContentPreferenceSource).insert({
      referenceId: 'a',
      userId: '1',
      type: ContentPreferenceType.Source,
      feedId: '1',
      sourceId: 'a',
      status: ContentPreferenceStatus.Follow,
    });

    const increment = await repo.findOneByOrFail({ id: 'a' });
    expect(increment.flags.totalMembers).toEqual(1);

    await con.getRepository(ContentPreferenceSource).update(
      {
        referenceId: 'a',
        userId: '1',
        type: ContentPreferenceType.Source,
        feedId: '1',
      },
      { status: ContentPreferenceStatus.Blocked },
    );

    const blocked = await repo.findOneByOrFail({ id: 'a' });
    expect(blocked.flags.totalMembers).toEqual(0);

    await con.getRepository(ContentPreferenceSource).delete({
      referenceId: 'a',
      userId: '1',
      type: ContentPreferenceType.Source,
      feedId: '1',
    });

    const unchanged = await repo.findOneByOrFail({ id: 'a' });
    expect(unchanged.flags.totalMembers).toEqual(0);
  });

  it('should handle multiple users correctly', async () => {
    const repo = con.getRepository(Source);
    await repo.update({ id: 'a' }, { type: SourceType.Squad });

    await con.getRepository(ContentPreferenceSource).insert([
      {
        referenceId: 'a',
        userId: '1',
        type: ContentPreferenceType.Source,
        feedId: '1',
        sourceId: 'a',
        status: ContentPreferenceStatus.Follow,
      },
      {
        referenceId: 'a',
        userId: '2',
        type: ContentPreferenceType.Source,
        feedId: '2',
        sourceId: 'a',
        status: ContentPreferenceStatus.Subscribed,
      },
    ]);

    const increment = await repo.findOneByOrFail({ id: 'a' });
    expect(increment.flags.totalMembers).toEqual(2);

    await con.getRepository(ContentPreferenceSource).delete({
      referenceId: 'a',
      userId: '1',
      type: ContentPreferenceType.Source,
      feedId: '1',
    });

    const decrementOne = await repo.findOneByOrFail({ id: 'a' });
    expect(decrementOne.flags.totalMembers).toEqual(1);

    await con.getRepository(ContentPreferenceSource).delete({
      referenceId: 'a',
      userId: '2',
      type: ContentPreferenceType.Source,
      feedId: '2',
    });

    const decrementAll = await repo.findOneByOrFail({ id: 'a' });
    expect(decrementAll.flags.totalMembers).toEqual(0);
  });

  it('should increment count when user changes from blocked to subscribed', async () => {
    const repo = con.getRepository(Source);
    await repo.update({ id: 'a' }, { type: SourceType.Squad });
    const source = await repo.findOneByOrFail({ id: 'a' });
    expect(source.flags.totalMembers).toEqual(undefined);

    await con.getRepository(ContentPreferenceSource).insert({
      referenceId: 'a',
      userId: '1',
      type: ContentPreferenceType.Source,
      feedId: '1',
      sourceId: 'a',
      status: ContentPreferenceStatus.Blocked,
    });

    const afterBlocked = await repo.findOneByOrFail({ id: 'a' });
    expect(afterBlocked.flags.totalMembers).toEqual(undefined);

    await con.getRepository(ContentPreferenceSource).update(
      {
        referenceId: 'a',
        userId: '1',
        type: ContentPreferenceType.Source,
        feedId: '1',
      },
      { status: ContentPreferenceStatus.Subscribed },
    );

    const afterSubscribed = await repo.findOneByOrFail({ id: 'a' });
    expect(afterSubscribed.flags.totalMembers).toEqual(1);
  });
});
