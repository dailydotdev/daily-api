import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import {
  getContactIdByEmail,
  addUserToContacts,
  LIST_DRIP_CAMPAIGN,
} from '../../src/common';
import worker from '../../src/workers/sourceSquadCreatedMailing';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import {
  SourceType,
  SquadSource,
  SourceMember,
  User,
  Source,
} from '../../src/entity';
import { SourceMemberRoles } from '../../src/roles';
import { usersFixture } from '../fixture/user';
import { createSource } from '../fixture/source';

jest.mock('../../src/common', () => ({
  ...(jest.requireActual('../../src/common') as Record<string, unknown>),
  getContactIdByEmail: jest.fn(),
  addUserToContacts: jest.fn(),
}));

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

const usersFixtureWithMarketing = usersFixture.map((item) => ({
  ...item,
  acceptedMarketing: true,
}));

beforeEach(async () => {
  jest.resetAllMocks();

  await saveFixtures(con, User, usersFixtureWithMarketing);
  await con
    .getRepository(SquadSource)
    .save([
      createSource(
        'squadMemberJoinedMailing_squad1',
        'squadMemberJoinedMailing_squad1',
        'http://c.com',
        SourceType.Squad,
      ),
    ]);
  await con.getRepository(SourceMember).save({
    sourceId: 'squadMemberJoinedMailing_squad1',
    userId: '2',
    referralToken: 'squadMemberJoinedMailing_rt1',
    role: SourceMemberRoles.Admin,
  });
  await con.getRepository(SourceMember).save({
    sourceId: 'squadMemberJoinedMailing_squad1',
    userId: '1',
    referralToken: 'squadMemberJoinedMailing_rt2',
    role: SourceMemberRoles.Admin,
  });
});

describe('squadMemberJoinedMailing worker', () => {
  it('should add owner to drip campaign mailing list', async () => {
    const source = await con.getRepository(Source).findOneBy({
      id: 'squadMemberJoinedMailing_squad1',
    });
    const user = await con.getRepository(User).findOneBy({ id: '2' });

    await expectSuccessfulBackground(worker, {
      source,
    });
    expect(getContactIdByEmail).toBeCalledTimes(1);
    expect(getContactIdByEmail).toBeCalledWith('tsahi@daily.dev');
    expect(addUserToContacts).toBeCalledTimes(1);
    expect(addUserToContacts).toBeCalledWith(
      user,
      [LIST_DRIP_CAMPAIGN],
      undefined,
    );
  });

  it('should skip adding to mailing list when no members', async () => {
    await con.getRepository(SourceMember).delete({
      sourceId: 'squadMemberJoinedMailing_squad1',
    });
    const source = await con.getRepository(Source).findOneBy({
      id: 'squadMemberJoinedMailing_squad1',
    });

    await expectSuccessfulBackground(worker, {
      source,
    });
    expect(getContactIdByEmail).toBeCalledTimes(0);
    expect(addUserToContacts).toBeCalledTimes(0);
  });
});
