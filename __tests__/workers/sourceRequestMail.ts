import { expectSuccessfulBackground } from '../helpers';
import { NotificationReason, sendEmail } from '../../src/common';
import worker from '../../src/workers/sourceRequestMail';
import { usersFixture } from '../fixture/user';
import { DataSource } from 'typeorm';
import { User } from '../../src/entity';
import createOrGetConnection from '../../src/db';

jest.mock('../../src/common/mailing', () => ({
  ...(jest.requireActual('../../src/common/mailing') as Record<
    string,
    unknown
  >),
  sendEmail: jest.fn(),
}));

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await con.getRepository(User).save([usersFixture[0]]);
});

it('should send mail when the source request is submitted', async () => {
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
