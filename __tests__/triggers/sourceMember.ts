import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { saveFixtures } from '../helpers';
import { Source, SourceMember, SourceType, User } from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { SourceMemberRoles } from '../../src/roles';
import { usersFixture } from '../fixture/user';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, User, usersFixture);
  await saveFixtures(con, Source, sourcesFixture);
});

describe('trigger increment_squad_members_count', () => {
  it('should increment squad members count', async () => {
    const repo = con.getRepository(Source);
    await repo.update({ id: 'a' }, { type: SourceType.Squad });
    const source = await repo.findOneByOrFail({ id: 'a' });
    expect(source.flags.totalMembers).toEqual(undefined);

    await con.getRepository(SourceMember).insert({
      sourceId: 'a',
      userId: '1',
      role: SourceMemberRoles.Member,
      referralToken: 'tk1',
    });

    const increment = await repo.findOneByOrFail({ id: 'a' });
    expect(increment.flags.totalMembers).toEqual(1);
  });

  // reason being, in the future we might start doing approvals for members, and the status can become `pending`
  // also that, before becoming an admin, user starts as a member when joining
  it('should not increment squad members count on new user if role not a `member`', async () => {
    const repo = con.getRepository(Source);
    await repo.update({ id: 'a' }, { type: SourceType.Squad });
    const source = await repo.findOneByOrFail({ id: 'a' });
    expect(source.flags.totalMembers).toEqual(undefined);

    await con.getRepository(SourceMember).insert({
      sourceId: 'a',
      userId: '1',
      role: SourceMemberRoles.Member,
      referralToken: 'tk1',
    });

    const increment = await repo.findOneByOrFail({ id: 'a' });
    expect(increment.flags.totalMembers).toEqual(1);

    await con.getRepository(SourceMember).insert({
      sourceId: 'a',
      userId: '2',
      role: SourceMemberRoles.Blocked,
      referralToken: 'tk2',
    });

    const unchanged = await repo.findOneByOrFail({ id: 'a' });
    expect(unchanged.flags.totalMembers).toEqual(1);
  });

  it('should not increment squad members count when user just switched roles', async () => {
    const repo = con.getRepository(Source);
    await repo.update({ id: 'a' }, { type: SourceType.Squad });
    const source = await repo.findOneByOrFail({ id: 'a' });
    expect(source.flags.totalMembers).toEqual(undefined);

    await con.getRepository(SourceMember).insert({
      sourceId: 'a',
      userId: '1',
      role: SourceMemberRoles.Member,
      referralToken: 'tk1',
    });

    const increment = await repo.findOneByOrFail({ id: 'a' });
    expect(increment.flags.totalMembers).toEqual(1);

    await con.getRepository(SourceMember).update(
      {
        sourceId: 'a',
        userId: '1',
      },
      { role: SourceMemberRoles.Admin },
    );

    const unchanged = await repo.findOneByOrFail({ id: 'a' });
    expect(unchanged.flags.totalMembers).toEqual(1);
  });
});

describe('trigger decrement_squad_members_count', () => {
  it('should decrement squad members count when row is deleted', async () => {
    const repo = con.getRepository(Source);
    await repo.update({ id: 'a' }, { type: SourceType.Squad });
    await con.getRepository(SourceMember).insert({
      sourceId: 'a',
      userId: '1',
      role: SourceMemberRoles.Member,
      referralToken: 'tk1',
    });

    const increment = await repo.findOneByOrFail({ id: 'a' });
    expect(increment.flags.totalMembers).toEqual(1);

    await con.getRepository(SourceMember).delete({ sourceId: 'a' });

    const decrement = await repo.findOneByOrFail({ id: 'a' });
    expect(decrement.flags.totalMembers).toEqual(0);
  });

  it('should decrement squad members count when a user becomes blocked', async () => {
    const repo = con.getRepository(Source);
    await repo.update({ id: 'a' }, { type: SourceType.Squad });
    await con.getRepository(SourceMember).insert({
      sourceId: 'a',
      userId: '1',
      role: SourceMemberRoles.Member,
      referralToken: 'tk1',
    });

    const increment = await repo.findOneByOrFail({ id: 'a' });
    expect(increment.flags.totalMembers).toEqual(1);

    await con
      .getRepository(SourceMember)
      .update(
        { sourceId: 'a', userId: '1' },
        { role: SourceMemberRoles.Blocked },
      );
    const decrement = await repo.findOneByOrFail({ id: 'a' });
    expect(decrement.flags.totalMembers).toEqual(0);
  });

  it('should not decrement squad members count when row is deleted when user was blocked already', async () => {
    const repo = con.getRepository(Source);
    await repo.update({ id: 'a' }, { type: SourceType.Squad });
    await con.getRepository(SourceMember).insert({
      sourceId: 'a',
      userId: '1',
      role: SourceMemberRoles.Member,
      referralToken: 'tk1',
    });

    const increment = await repo.findOneByOrFail({ id: 'a' });
    expect(increment.flags.totalMembers).toEqual(1);

    await con
      .getRepository(SourceMember)
      .update(
        { sourceId: 'a', userId: '1' },
        { role: SourceMemberRoles.Blocked },
      );
    const decrement = await repo.findOneByOrFail({ id: 'a' });
    expect(decrement.flags.totalMembers).toEqual(0);

    await con.getRepository(SourceMember).delete({});

    const unchanged = await repo.findOneByOrFail({ id: 'a' });
    expect(unchanged.flags.totalMembers).toEqual(0);
  });
});
