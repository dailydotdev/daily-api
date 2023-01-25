import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import worker from '../../src/workers/squadFeatureAccess';
import {
  Feature,
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
});

const sourceMember = {
  sourceId: 'a',
  userId: '1',
  role: SourceMemberRoles.Member,
  referralToken: 'rt2',
};

it('should give user squad access if added to a source', async () => {
  await expectSuccessfulBackground(worker, {
    sourceMember,
  });
  const feature = await con.getRepository(Feature).countBy({ userId: '1' });
  expect(feature).toEqual(1);
});

it('should not give user squad access if already existing', async () => {
  await con.getRepository(SourceMember).insert({
    ...sourceMember,
  });
  await expectSuccessfulBackground(worker, {
    sourceMember,
  });
  const feature = await con.getRepository(Feature).countBy({ userId: '1' });
  expect(feature).toEqual(1);
});
