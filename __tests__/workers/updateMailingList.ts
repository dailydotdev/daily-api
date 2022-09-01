import { expectSuccessfulBackground } from '../helpers';
import { updateUserContact, getContactIdByEmail } from '../../src/common';
import worker from '../../src/workers/updateMailingList';
import { gatewayUsersFixture } from '../fixture/user';

jest.mock('../../src/common', () => ({
  ...(jest.requireActual('../../src/common') as Record<string, unknown>),
  updateUserContact: jest.fn(),
  getContactIdByEmail: jest.fn(),
}));

beforeEach(() => {
  jest.resetAllMocks();
});

it('should remove from mailing list', async () => {
  await expectSuccessfulBackground(worker, {
    newProfile: {
      ...gatewayUsersFixture[0],
      email: 'lee@daily.dev',
      acceptedMarketing: false,
    },
    user: { ...gatewayUsersFixture[0], acceptedMarketing: true },
  });
  expect(getContactIdByEmail).toBeCalledTimes(1);
  expect(updateUserContact).toBeCalledTimes(1);
  expect(jest.mocked(updateUserContact).mock.calls[0]).toMatchSnapshot();
});

it('should update mailing list', async () => {
  await expectSuccessfulBackground(worker, {
    newProfile: {
      ...gatewayUsersFixture[0],
      email: 'lee@daily.dev',
      acceptedMarketing: true,
    },
    user: gatewayUsersFixture[0],
  });
  expect(updateUserContact).toBeCalledTimes(1);
  expect(jest.mocked(updateUserContact).mock.calls[0]).toMatchSnapshot();
});
