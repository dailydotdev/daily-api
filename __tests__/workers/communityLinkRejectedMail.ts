import nock from 'nock';
import { expectSuccessfulBackground } from '../helpers';
import { sendEmail, User as GatewayUser } from '../../src/common';
import worker from '../../src/workers/communityLinkRejectedMail';
import { SubmissionStatus } from '../../src/entity';
import { gatewayUsersFixture } from '../fixture/user';

jest.mock('../../src/common/mailing', () => ({
  ...(jest.requireActual('../../src/common/mailing') as Record<
    string,
    unknown
  >),
  sendEmail: jest.fn(),
}));

beforeEach(async () => {
  jest.resetAllMocks();
});

const mockUsersMe = (user: GatewayUser): nock.Scope =>
  nock(process.env.GATEWAY_URL)
    .get('/v1/users/me')
    .matchHeader('authorization', `Service ${process.env.GATEWAY_SECRET}`)
    .matchHeader('user-id', user.id)
    .matchHeader('logged-in', 'true')
    .reply(200, user);

it('should send mail when the submission status is rejected', async () => {
  const mockedUsers: GatewayUser[] = [gatewayUsersFixture[0]];
  mockedUsers.forEach(mockUsersMe);
  await expectSuccessfulBackground(worker, {
    url: 'http://sample.abc.com',
    userId: '1',
    createdAt: 1601187916999999,
    status: SubmissionStatus.Rejected,
  });
  expect(sendEmail).toBeCalledTimes(1);
  expect(jest.mocked(sendEmail).mock.calls[0]).toMatchSnapshot();
});
