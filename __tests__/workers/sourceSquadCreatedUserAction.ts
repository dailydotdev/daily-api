import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import worker from '../../src/workers/sourceSquadCreatedUserAction';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import {
  SourceType,
  SquadSource,
  SourceMember,
  User,
  Source,
  UserAction,
  UserActionType,
} from '../../src/entity';
import { SourceMemberRoles } from '../../src/roles';
import { usersFixture } from '../fixture/user';
import { createSource } from '../fixture/source';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();

  await saveFixtures(con, User, usersFixture);
  await con
    .getRepository(SquadSource)
    .save([
      createSource(
        'sourceSquadCreatedUserAction_squad1',
        'sourceSquadCreatedUserAction_squad1',
        'http://c.com',
        SourceType.Squad,
      ),
    ]);
  await con.getRepository(SourceMember).save({
    sourceId: 'sourceSquadCreatedUserAction_squad1',
    userId: '2',
    referralToken: 'sourceSquadCreatedUserAction_rt1',
    role: SourceMemberRoles.Admin,
  });
  await con.getRepository(SourceMember).save({
    sourceId: 'sourceSquadCreatedUserAction_squad1',
    userId: '1',
    referralToken: 'sourceSquadCreatedUserAction_rt2',
    role: SourceMemberRoles.Admin,
  });
});

describe('sourceSquadCreatedUserAction worker', () => {
  it('should complete create squad user action', async () => {
    const source = await con.getRepository(Source).findOneBy({
      id: 'sourceSquadCreatedUserAction_squad1',
    });
    const user = await con.getRepository(User).findOneBy({ id: '2' });

    await expectSuccessfulBackground(worker, {
      source,
    });

    const action = await con.getRepository(UserAction).findOneBy({
      userId: user?.id,
      type: UserActionType.CreateSquad,
    });
    expect(action).toBeTruthy();
  });

  it('should not complete create squad user action if source is not a squad', async () => {
    await con.getRepository(Source).update(
      { id: 'sourceSquadCreatedUserAction_squad1' },
      {
        type: SourceType.Machine,
      },
    );
    const source = await con.getRepository(Source).findOneBy({
      id: 'sourceSquadCreatedUserAction_squad1',
    });
    const user = await con.getRepository(User).findOneBy({ id: '2' });

    await expectSuccessfulBackground(worker, {
      source,
    });

    const action = await con.getRepository(UserAction).findOneBy({
      userId: user?.id,
      type: UserActionType.CreateSquad,
    });
    expect(action).toBeFalsy();
  });
});
