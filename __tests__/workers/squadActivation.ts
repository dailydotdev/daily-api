import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import worker from '../../src/workers/squadActivation';
import {
  Source,
  SourceMember,
  SourceMemberRoles,
  User,
} from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { usersFixture } from '../fixture/user';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, User, usersFixture);
  await saveFixtures(con, Source, sourcesFixture);
  await con.getRepository(Source).update({ id: 'a' }, { active: false });
  await con.getRepository(SourceMember).save([
    {
      sourceId: 'a',
      userId: '1',
      role: SourceMemberRoles.Member,
      referralToken: 'rt',
    },
    {
      sourceId: 'a',
      userId: '2',
      role: SourceMemberRoles.Member,
      referralToken: 'rt2',
    },
  ]);
});

it('should not do anything if source is not a squad', async () => {
  await expectSuccessfulBackground(worker, {
    sourceMember: {
      sourceId: 'a',
      userId: '2',
      role: SourceMemberRoles.Member,
      referralToken: 'rt2',
    },
  });
  const source = await con.getRepository(Source).findOneBy({ id: 'a' });
  expect(source.active).toEqual(false);
});

it('should not do anything if source has not enough members', async () => {
  await con.getRepository(Source).update(
    { id: 'b' },
    {
      active: false,
      type: 'squad',
    },
  );
  await expectSuccessfulBackground(worker, {
    sourceMember: {
      sourceId: 'b',
      userId: '2',
      role: SourceMemberRoles.Member,
      referralToken: 'rt2',
    },
  });
  const source = await con.getRepository(Source).findOneBy({ id: 'b' });
  expect(source.active).toEqual(false);
});

it('should activate squad once it reaches enough members', async () => {
  await con.getRepository(Source).update({ id: 'a' }, { type: 'squad' });
  await expectSuccessfulBackground(worker, {
    sourceMember: {
      sourceId: 'a',
      userId: '2',
      role: SourceMemberRoles.Member,
      referralToken: 'rt2',
    },
  });
  const source = await con.getRepository(Source).findOneBy({ id: 'a' });
  expect(source.active).toEqual(true);
});
