import { expectSuccessfulBackground } from '../helpers';
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

it('should remove from mailing list', async () => {
  await expectSuccessfulBackground(worker, { id: '1', email: 'lee@daily.dev' });
  expect(getContactIdByEmail).toBeCalledTimes(1);
  expect(removeUserContact).toBeCalledTimes(1);
  expect(jest.mocked(removeUserContact).mock.calls[0]).toMatchSnapshot();
});
