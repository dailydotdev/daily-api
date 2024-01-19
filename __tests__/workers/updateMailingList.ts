import nock from 'nock';
import worker from '../../src/workers/updateMailingList';
import { ChangeObject } from '../../src/types';
import { expectSuccessfulBackground } from '../helpers';
import { User } from '../../src/entity';
import { updateUserContactLists } from '../../src/common';

jest.mock('../../src/common', () => ({
  ...(jest.requireActual('../../src/common') as Record<string, unknown>),
  updateUserContactLists: jest.fn(),
}));

beforeEach(async () => {
  jest.clearAllMocks();
  nock.cleanAll();
  process.env.SENDGRID_API_KEY = 'wolololo';
});

describe('updateMailingList', () => {
  type ObjectType = Partial<User>;
  const base: ChangeObject<ObjectType> = {
    id: '404',
    username: 'inactive_user',
    name: 'Inactive user',
    infoConfirmed: false,
  };

  it('should update user contact list if user is regular user', async () => {
    const before: ChangeObject<ObjectType> = { ...base, id: '1' };
    const after: ChangeObject<ObjectType> = { ...before, infoConfirmed: true };
    await expectSuccessfulBackground(worker, {
      newProfile: after,
      user: before,
    });
    expect(updateUserContactLists).toHaveBeenCalledTimes(1);
  });

  it('should not update user contact list if user is ghost user', async () => {
    const before: ChangeObject<ObjectType> = base;
    const after: ChangeObject<ObjectType> = { ...before, infoConfirmed: true };
    await expectSuccessfulBackground(worker, {
      newProfile: after,
      user: before,
    });
    expect(updateUserContactLists).toHaveBeenCalledTimes(0);
  });
});
