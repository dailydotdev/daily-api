import nock from 'nock';
import { expectSuccessfulBackground } from '../helpers';
import { sendEmail, User as GatewayUser } from '../../src/common';
import worker from '../../src/workers/sourceRequestSubmittedMail';

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

it('should send mail when the source request is submitted', async () => {
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
    userId: '1',
    createdAt: 1601187916999999,
    sourceName: 'Demo',
    sourceUrl: 'https://demo.com/sitemap.xml',
  });
  expect(sendEmail).toBeCalledTimes(1);
  expect(jest.mocked(sendEmail).mock.calls[0]).toMatchSnapshot();
});
