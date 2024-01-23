import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import worker from '../../src/workers/personalizedDigestEmail';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { Post, Source, User, UserPersonalizedDigest } from '../../src/entity';
import { usersFixture } from '../fixture/user';
import { postsFixture } from '../fixture/post';
import { sourcesFixture } from '../fixture/source';
import { sendEmail } from '../../src/common';
import nock from 'nock';
import { subDays } from 'date-fns';

jest.mock('../../src/common', () => ({
  ...(jest.requireActual('../../src/common') as Record<string, unknown>),
  sendEmail: jest.fn(),
  createEemailBatchId: jest.fn(),
}));

let con: DataSource;
let nockScope: nock.Scope;
let nockBody: Record<string, string> = {};

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
  nock.cleanAll();
  nockBody = {};

  await saveFixtures(con, User, usersFixture);
  await con.getRepository(UserPersonalizedDigest).clear();
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, Post, postsFixture);
  await con.getRepository(UserPersonalizedDigest).save({
    userId: '1',
  });

  const mockedPostIds = postsFixture
    .slice(0, 5)
    .map((post) => ({ post_id: post.id }));

  nockScope = nock('http://localhost:6000')
    .post('/feed.json', (body) => {
      nockBody = body;

      return true;
    })
    .reply(200, {
      data: mockedPostIds,
      rows: mockedPostIds.length,
    });
});

describe('personalizedDigestEmail worker', () => {
  it('should generate personalized digest for user with subscription', async () => {
    const personalizedDigest = await con
      .getRepository(UserPersonalizedDigest)
      .findOneBy({
        userId: '1',
      });

    expect(personalizedDigest).toBeTruthy();
    expect(personalizedDigest!.lastSendDate).toBeNull();

    await expectSuccessfulBackground(worker, {
      personalizedDigest,
      generationTimestamp: Date.now(),
      emailBatchId: 'test-email-batch-id',
    });

    const personalizedDigestAfterWorker = await con
      .getRepository(UserPersonalizedDigest)
      .findOneBy({
        userId: '1',
      });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const emailData = (sendEmail as jest.Mock).mock.calls[0][0];
    expect(emailData).toMatchSnapshot({
      sendAt: expect.any(Number),
    });

    expect(nockScope.isDone()).toBe(true);
    expect(nockBody).toMatchSnapshot({
      date_from: expect.any(String),
      date_to: expect.any(String),
    });

    const dateFrom = new Date(nockBody.date_from);
    const dateTo = new Date(nockBody.date_to);
    expect(dateFrom.getTime()).toBeLessThan(dateTo.getTime());
    expect(dateFrom.getDay()).toBe(personalizedDigest!.preferredDay);
    expect(dateFrom.getHours()).toBe(personalizedDigest!.preferredHour);
    expect(dateFrom.getTimezoneOffset()).toBe(0);

    expect(personalizedDigestAfterWorker!.lastSendDate).not.toBeNull();
  });

  it('should generate personalized digest for user in timezone ahead UTC', async () => {
    await con.getRepository(UserPersonalizedDigest).save({
      userId: '1',
      preferredTimezone: 'America/Phoenix',
    });

    const personalizedDigest = await con
      .getRepository(UserPersonalizedDigest)
      .findOneBy({
        userId: '1',
      });

    expect(personalizedDigest).toBeTruthy();

    await expectSuccessfulBackground(worker, {
      personalizedDigest,
      generationTimestamp: Date.now(),
      emailBatchId: 'test-email-batch-id',
    });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const emailData = (sendEmail as jest.Mock).mock.calls[0][0];
    expect(emailData).toMatchSnapshot({
      sendAt: expect.any(Number),
    });
    const sentAtDate = new Date(emailData.sendAt * 1000);
    expect(sentAtDate.getDay()).toBe(personalizedDigest!.preferredDay);
    expect(sentAtDate.getHours()).toBe(personalizedDigest!.preferredHour + 7);
    expect(sentAtDate.getTimezoneOffset()).toBe(0);

    expect(nockScope.isDone()).toBe(true);
    expect(nockBody).toMatchSnapshot({
      date_from: expect.any(String),
      date_to: expect.any(String),
    });

    const dateFrom = new Date(nockBody.date_from);
    const dateTo = new Date(nockBody.date_to);
    expect(dateFrom.getTime()).toBeLessThan(dateTo.getTime());
    expect(dateFrom.getDay()).toBe(personalizedDigest!.preferredDay);
    expect(dateFrom.getHours()).toBe(personalizedDigest!.preferredHour + 7);
    expect(dateFrom.getTimezoneOffset()).toBe(0);
  });

  it('should generate personalized digest for user in timezone behind UTC', async () => {
    await con.getRepository(UserPersonalizedDigest).save({
      userId: '1',
      preferredTimezone: 'Asia/Dhaka',
    });

    const personalizedDigest = await con
      .getRepository(UserPersonalizedDigest)
      .findOneBy({
        userId: '1',
      });

    expect(personalizedDigest).toBeTruthy();

    await expectSuccessfulBackground(worker, {
      personalizedDigest,
      generationTimestamp: Date.now(),
      emailBatchId: 'test-email-batch-id',
    });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const emailData = (sendEmail as jest.Mock).mock.calls[0][0];
    expect(emailData).toMatchSnapshot({
      sendAt: expect.any(Number),
    });
    const sentAtDate = new Date(emailData.sendAt * 1000);
    expect(sentAtDate.getDay()).toBe(personalizedDigest!.preferredDay);
    expect(sentAtDate.getHours()).toBe(personalizedDigest!.preferredHour - 6);
    expect(sentAtDate.getTimezoneOffset()).toBe(0);

    expect(nockScope.isDone()).toBe(true);
    expect(nockBody).toMatchSnapshot({
      date_from: expect.any(String),
      date_to: expect.any(String),
    });

    const dateFrom = new Date(nockBody.date_from);
    const dateTo = new Date(nockBody.date_to);
    expect(dateFrom.getTime()).toBeLessThan(dateTo.getTime());
    expect(dateFrom.getDay()).toBe(personalizedDigest!.preferredDay);
    expect(dateFrom.getHours()).toBe(personalizedDigest!.preferredHour - 6);
    expect(dateFrom.getTimezoneOffset()).toBe(0);
  });

  it('should generate personalized digest for user with no name set', async () => {
    const personalizedDigest = await con
      .getRepository(UserPersonalizedDigest)
      .findOneBy({
        userId: '1',
      });

    await saveFixtures(
      con,
      User,
      usersFixture.map((item) => ({
        ...item,
        name: null as unknown,
      })),
    );

    expect(personalizedDigest).toBeTruthy();

    await expectSuccessfulBackground(worker, {
      personalizedDigest,
      generationTimestamp: Date.now(),
      emailBatchId: 'test-email-batch-id',
    });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const emailData = (sendEmail as jest.Mock).mock.calls[0][0];
    expect(emailData.to.name).toEqual('idoshamun');
  });

  it('should not generate personalized digest for user that did not confirm their info', async () => {
    const personalizedDigest = await con
      .getRepository(UserPersonalizedDigest)
      .findOneBy({
        userId: '1',
      });

    await saveFixtures(
      con,
      User,
      usersFixture.map((item) => ({
        ...item,
        infoConfirmed: false,
      })),
    );

    expect(personalizedDigest).toBeTruthy();

    await expectSuccessfulBackground(worker, {
      personalizedDigest,
      generationTimestamp: Date.now(),
      emailBatchId: 'test-email-batch-id',
    });

    expect(sendEmail).toHaveBeenCalledTimes(0);
  });

  it('should set parameters based on variation', async () => {
    const personalizedDigest = await con
      .getRepository(UserPersonalizedDigest)
      .findOneBy({
        userId: '1',
      });
    personalizedDigest!.variation = 2;

    await expectSuccessfulBackground(worker, {
      personalizedDigest,
      generationTimestamp: Date.now(),
      emailBatchId: 'test-email-batch-id',
    });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const emailData = (sendEmail as jest.Mock).mock.calls[0][0];
    expect(emailData).toMatchSnapshot({
      sendAt: expect.any(Number),
    });
  });

  it('should not generate personalized digest for user if lastSendDate is in the same day as current date', async () => {
    const personalizedDigest = await con
      .getRepository(UserPersonalizedDigest)
      .findOneBy({
        userId: '1',
      });

    await con.getRepository(UserPersonalizedDigest).save({
      userId: '1',
      lastSendDate: new Date(),
    });

    await expectSuccessfulBackground(worker, {
      personalizedDigest,
      generationTimestamp: Date.now(),
      emailBatchId: 'test-email-batch-id',
    });

    expect(sendEmail).toHaveBeenCalledTimes(0);
  });

  it('should generate personalized digest for user if lastSendDate is in the past', async () => {
    const personalizedDigest = await con
      .getRepository(UserPersonalizedDigest)
      .findOneBy({
        userId: '1',
      });

    await con.getRepository(UserPersonalizedDigest).save({
      userId: '1',
      lastSendDate: subDays(new Date(), 7),
    });

    await expectSuccessfulBackground(worker, {
      personalizedDigest,
      generationTimestamp: Date.now(),
      emailBatchId: 'test-email-batch-id',
    });

    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it('should revert lastSendDate if send email throws error', async () => {
    const personalizedDigest = await con
      .getRepository(UserPersonalizedDigest)
      .findOneBy({
        userId: '1',
      });

    (sendEmail as jest.Mock).mockRejectedValue(new Error('test error'));

    const lastSendDate = subDays(new Date(), 7);

    await con.getRepository(UserPersonalizedDigest).save({
      userId: '1',
      lastSendDate,
    });

    await expect(() => {
      return expectSuccessfulBackground(worker, {
        personalizedDigest,
        generationTimestamp: Date.now(),
        emailBatchId: 'test-email-batch-id',
      });
    }).rejects.toEqual(new Error('test error'));

    const personalizedDigestAfterWorker = await con
      .getRepository(UserPersonalizedDigest)
      .findOneBy({
        userId: '1',
      });

    expect(personalizedDigestAfterWorker?.lastSendDate?.toISOString()).toBe(
      lastSendDate.toISOString(),
    );
  });
});
