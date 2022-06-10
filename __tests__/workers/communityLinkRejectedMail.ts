import nock from 'nock';
import { mocked } from 'ts-jest/utils';
import { expectSuccessfulBackground } from '../helpers';
import { sendEmail, User as GatewayUser } from '../../src/common';
import worker from '../../src/workers/communityLinkRejectedMail';
import { SubmissionStatus } from '../../src/entity';

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
  const mockedUsers: GatewayUser[] = [
    {
      id: '1',
      email: 'lee@acme.com',
      name: 'Lee',
      image: 'https://daily.dev/lee.jpg',
      reputation: 5,
      permalink: 'https://daily.dev/lee',
    },
  ];
  mockedUsers.forEach(mockUsersMe);
  await expectSuccessfulBackground(worker, {
    url: 'http://sample.abc.com',
    userId: '1',
    createdAt: new Date(2020, 8, 27),
    status: SubmissionStatus.Rejected,
  });
  expect(sendEmail).toBeCalledTimes(1);
  expect(mocked(sendEmail).mock.calls[0]).toMatchSnapshot();
});
