import { expectSuccessfulTypedBackground } from '../helpers';
import { removeUserContact, getContactIdByEmail } from '../../src/common';
import worker from '../../src/workers/deleteUserFromMailingList';

jest.mock('../../src/common', () => ({
  ...(jest.requireActual('../../src/common') as Record<string, unknown>),
  removeUserContact: jest.fn(),
  getContactIdByEmail: jest.fn(),
}));

beforeEach(() => {
  jest.resetAllMocks();
});

describe('remove user from mailing list worker', () => {
  const OLD_ENV = { ...process.env };

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('should remove from mailing list', async () => {
    process.env.SENDGRID_API_KEY = 'key';
    await expectSuccessfulTypedBackground(worker, {
      id: '1',
      email: 'lee@daily.dev',
      kratosUser: true,
    });
    expect(getContactIdByEmail).toBeCalledTimes(1);
    expect(removeUserContact).toBeCalledTimes(1);
  });
});
