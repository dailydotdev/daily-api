import { expectSuccessfulBackground } from '../helpers';
import { sendEmail } from '../../src/common';
import worker from '../../src/workers/communityLinkRejectedMail';
import { SubmissionStatus, User } from '../../src/entity';
import { usersFixture } from '../fixture/user';
import { Connection, getConnection } from 'typeorm';

jest.mock('../../src/common/mailing', () => ({
  ...(jest.requireActual('../../src/common/mailing') as Record<
    string,
    unknown
  >),
  sendEmail: jest.fn(),
}));

let con: Connection;

beforeAll(async () => {
  con = await getConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await con.getRepository(User).save([usersFixture[0]]);
});

it('should send mail when the submission status is rejected', async () => {
  await expectSuccessfulBackground(worker, {
    url: 'http://sample.abc.com',
    userId: '1',
    createdAt: 1601187916999999,
    status: SubmissionStatus.Rejected,
  });
  expect(sendEmail).toBeCalledTimes(1);
  expect(jest.mocked(sendEmail).mock.calls[0]).toMatchSnapshot();
});
