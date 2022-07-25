import nock from 'nock';
import { expectSuccessfulBackground } from '../helpers';
import {
  NotificationReason,
  sendEmail,
  User as GatewayUser,
} from '../../src/common';
import worker from '../../src/workers/sourceRequestMail';

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
    reason: NotificationReason.New,
    sourceRequest: {
      userId: '1',
      createdAt: 1601187916999999,
      sourceName: 'Demo',
      sourceUrl: 'https://demo.com/sitemap.xml',
    },
  });
  expect(sendEmail).toBeCalledTimes(1);
  expect(jest.mocked(sendEmail).mock.calls[0]).toMatchSnapshot();
});

it('should send mail when the source request is declined', async () => {
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
    reason: NotificationReason.Decline,
    sourceRequest: {
      userId: '1',
      createdAt: 1601187916999999,
      sourceName: 'Demo',
      sourceUrl: 'https://demo.com/sitemap.xml',
    },
  });
  expect(sendEmail).toBeCalledTimes(1);
  expect(jest.mocked(sendEmail).mock.calls[0]).toMatchSnapshot();
});

it('should send mail when the source request is declined and existed', async () => {
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
    reason: NotificationReason.Decline,
    sourceRequest: {
      userId: '1',
      createdAt: 1601187916999999,
      sourceName: 'Demo',
      sourceUrl: 'https://demo.com/sitemap.xml',
      reason: NotificationReason.Exists,
    },
  });
  expect(sendEmail).toBeCalledTimes(1);
  expect(jest.mocked(sendEmail).mock.calls[0]).toMatchSnapshot();
});

it('should send mail when the source request is approved', async () => {
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
    reason: NotificationReason.Approve,
    sourceRequest: {
      userId: '1',
      createdAt: 1601187916999999,
      sourceName: 'Demo',
      sourceUrl: 'https://demo.com/sitemap.xml',
    },
  });
  expect(sendEmail).toBeCalledTimes(1);
  expect(jest.mocked(sendEmail).mock.calls[0]).toMatchSnapshot();
});
