import type { FastifyInstance } from 'fastify';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import appFunc from '../../../src';
import createOrGetConnection from '../../../src/db';
import { saveFixtures } from '../../helpers';
import { User } from '../../../src/entity/user/User';
import { ContributionAction } from '../../../src/entity/contribution/ContributionAction';
import { ContributionActionCategory } from '../../../src/entity/contribution/ContributionActionCategory';
import { ContributionActionLink } from '../../../src/entity/contribution/ContributionActionLink';
import { ContributionBlockedUser } from '../../../src/entity/contribution/ContributionBlockedUser';
import { ContributionCause } from '../../../src/entity/contribution/ContributionCause';
import {
  ContributionPayment,
  ContributionPaymentStatus,
} from '../../../src/entity/contribution/ContributionPayment';
import { ContributionPaymentAllocation } from '../../../src/entity/contribution/ContributionPaymentAllocation';
import {
  ContributionRewardTier,
  ContributionRewardType,
} from '../../../src/entity/contribution/ContributionRewardTier';
import { ContributionSponsor } from '../../../src/entity/contribution/ContributionSponsor';
import {
  ContributionSubmission,
  ContributionSubmissionStatus,
} from '../../../src/entity/contribution/ContributionSubmission';
import { UserContributionCausePreference } from '../../../src/entity/contribution/UserContributionCausePreference';
import {
  UserContributionReward,
  UserContributionRewardStatus,
} from '../../../src/entity/contribution/UserContributionReward';

let app: FastifyInstance;
let con: DataSource;

const serviceHeaders = {
  authorization: `Service ${process.env.ACCESS_SECRET}`,
  'content-type': 'application/json',
};
const serviceAuthHeaders = {
  authorization: `Service ${process.env.ACCESS_SECRET}`,
};
const userId = '99999999-9999-4999-8999-999999999998';
const secondUserId = '99999999-9999-4999-8999-999999999997';
const categoryId = '11111111-1111-4111-8111-111111111111';
const actionId = '22222222-2222-4222-8222-222222222222';
const causeId = '33333333-3333-4333-8333-333333333333';
const secondCauseId = '33333333-3333-4333-8333-333333333334';
const inactiveCauseId = '33333333-3333-4333-8333-333333333335';
const tierId = '44444444-4444-4444-8444-444444444444';
const submissionId = '55555555-5555-4555-8555-555555555555';
const secondSubmissionId = '55555555-5555-4555-8555-555555555556';
const paidSubmissionId = '55555555-5555-4555-8555-555555555557';
const paymentId = '66666666-6666-4666-8666-666666666666';

beforeAll(async () => {
  app = await appFunc();
  con = await createOrGetConnection();
  return app.ready();
});

beforeEach(async () => {
  await saveFixtures(con, User, [
    { id: userId, reputation: 10 },
    { id: secondUserId, reputation: 10 },
  ]);
});

afterAll(() => app.close());

const seedContributionConfig = async () => {
  await saveFixtures(con, ContributionActionCategory, [
    {
      id: categoryId,
      title: 'Social',
    },
  ]);
  await saveFixtures(con, ContributionAction, [
    {
      id: actionId,
      categoryId,
      title: 'Post on X',
      points: 10,
      evidence: {},
    },
  ]);
  await saveFixtures(con, ContributionCause, [
    {
      id: causeId,
      title: 'Open source',
      sortOrder: 1,
    },
    {
      id: secondCauseId,
      title: 'Education',
      sortOrder: 2,
    },
    {
      id: inactiveCauseId,
      title: 'Inactive',
      active: false,
      sortOrder: 3,
    },
  ]);
  await saveFixtures(con, ContributionRewardTier, [
    {
      id: tierId,
      title: 'Call',
      thresholdPoints: 100,
      rewardType: ContributionRewardType.Call,
      metadata: {},
    },
  ]);
};

describe('private contribution routes', () => {
  it('requires service authorization', () => {
    return request(app.server)
      .post('/p/contributions/action-categories')
      .send({ title: 'Social' })
      .expect(404);
  });

  it('creates, updates, and deletes action categories', async () => {
    const { body } = await request(app.server)
      .post('/p/contributions/action-categories')
      .set(serviceHeaders)
      .send({ title: 'Social', sortOrder: 2 })
      .expect(201);

    await request(app.server)
      .patch(`/p/contributions/action-categories/${body.id}`)
      .set(serviceHeaders)
      .send({ title: 'Community', active: false, sortOrder: 3 })
      .expect(200);

    await con.getRepository(ContributionAction).save({
      id: actionId,
      categoryId: body.id,
      title: 'Post on Reddit',
      points: 20,
      evidence: {},
    });

    await request(app.server)
      .delete(`/p/contributions/action-categories/${body.id}`)
      .set(serviceAuthHeaders)
      .expect(200);

    const [category, action] = await Promise.all([
      con.getRepository(ContributionActionCategory).findOneBy({ id: body.id }),
      con.getRepository(ContributionAction).findOneByOrFail({ id: actionId }),
    ]);

    expect(category).toBeNull();
    expect(action.categoryId).toBeNull();
  });

  it('creates and updates actions, causes, and reward tiers', async () => {
    const { body: category } = await request(app.server)
      .post('/p/contributions/action-categories')
      .set(serviceHeaders)
      .send({ title: 'Social' })
      .expect(201);

    const { body: action } = await request(app.server)
      .post('/p/contributions/actions')
      .set(serviceHeaders)
      .send({
        categoryId: category.id,
        title: 'Post on Reddit',
        points: 20,
        evidence: { url: { required: true } },
        metadata: {
          platform: 'reddit',
          instructions: 'Submit the public post URL.',
          externalUrl: 'https://reddit.com/r/programming',
        },
        cooldownSeconds: 3600,
        maxPerUser: 3,
      })
      .expect(201);

    await request(app.server)
      .patch(`/p/contributions/actions/${action.id}`)
      .set(serviceHeaders)
      .send({ points: 25, active: false })
      .expect(200);

    const { body: cause } = await request(app.server)
      .post('/p/contributions/causes')
      .set(serviceHeaders)
      .send({
        title: 'Open source',
        url: 'https://daily.dev',
        description: 'Funds open source projects.',
        category: 'Open source',
        logoUrl: 'https://daily.dev/logo.png',
      })
      .expect(201);

    await request(app.server)
      .patch(`/p/contributions/causes/${cause.id}`)
      .set(serviceHeaders)
      .send({ title: 'Education', category: 'Education', active: false })
      .expect(200);

    const { body: sponsor } = await request(app.server)
      .post('/p/contributions/sponsors')
      .set(serviceHeaders)
      .send({
        name: 'Daily Corp',
        amountCents: 250000,
        url: 'https://daily.dev',
        logoUrl: 'https://daily.dev/logo.png',
        sortOrder: 1,
      })
      .expect(201);

    await request(app.server)
      .patch(`/p/contributions/sponsors/${sponsor.id}`)
      .set(serviceHeaders)
      .send({ amountCents: 100000, active: false })
      .expect(200);

    const { body: tier } = await request(app.server)
      .post('/p/contributions/reward-tiers')
      .set(serviceHeaders)
      .send({
        title: 'Call',
        thresholdPoints: 100,
        rewardType: ContributionRewardType.Call,
        metadata: { calendly: 'https://daily.dev' },
      })
      .expect(201);

    await request(app.server)
      .patch(`/p/contributions/reward-tiers/${tier.id}`)
      .set(serviceHeaders)
      .send({ thresholdPoints: 150, active: false })
      .expect(200);

    await expect(
      con.getRepository(ContributionAction).findOneByOrFail({ id: action.id }),
    ).resolves.toMatchObject({
      points: 25,
      active: false,
      metadata: {
        platform: 'reddit',
        instructions: 'Submit the public post URL.',
        externalUrl: 'https://reddit.com/r/programming',
      },
    });
    await expect(
      con.getRepository(ContributionCause).findOneByOrFail({ id: cause.id }),
    ).resolves.toMatchObject({
      title: 'Education',
      description: 'Funds open source projects.',
      category: 'Education',
      logoUrl: 'https://daily.dev/logo.png',
      active: false,
    });
    await expect(
      con
        .getRepository(ContributionSponsor)
        .findOneByOrFail({ id: sponsor.id }),
    ).resolves.toMatchObject({ amountCents: 100000, active: false });
    await expect(
      con
        .getRepository(ContributionRewardTier)
        .findOneByOrFail({ id: tier.id }),
    ).resolves.toMatchObject({ thresholdPoints: 150, active: false });

    await request(app.server)
      .delete(`/p/contributions/sponsors/${sponsor.id}`)
      .set(serviceAuthHeaders)
      .expect(200);

    await expect(
      con.getRepository(ContributionSponsor).findOneBy({ id: sponsor.id }),
    ).resolves.toBeNull();
  });

  it('manages action links individually and in bulk', async () => {
    await seedContributionConfig();

    const { body: link } = await request(app.server)
      .post(`/p/contributions/actions/${actionId}/links`)
      .set(serviceHeaders)
      .send({ url: 'https://stackoverflow.com/q/1', label: 'Question 1' })
      .expect(201);

    const { body: bulk } = await request(app.server)
      .post(`/p/contributions/actions/${actionId}/links/bulk`)
      .set(serviceHeaders)
      .send({
        links: [
          { url: 'https://stackoverflow.com/q/2' },
          { url: 'https://stackoverflow.com/q/3', sortOrder: 5 },
        ],
      })
      .expect(201);

    expect(bulk.count).toBe(2);

    await request(app.server)
      .patch(`/p/contributions/links/${link.id}`)
      .set(serviceHeaders)
      .send({ label: 'Updated', active: false })
      .expect(200);

    await request(app.server)
      .delete(`/p/contributions/links/${bulk.links[0].id}`)
      .set(serviceAuthHeaders)
      .expect(200);

    const links = await con
      .getRepository(ContributionActionLink)
      .find({ where: { actionId }, order: { url: 'ASC' } });

    expect(links).toHaveLength(2);
    expect(links).toMatchObject([
      { url: 'https://stackoverflow.com/q/1', label: 'Updated', active: false },
      { url: 'https://stackoverflow.com/q/3', sortOrder: 5 },
    ]);
  });

  it('returns 404 when managing links for a missing action or link', async () => {
    await request(app.server)
      .post(`/p/contributions/actions/${actionId}/links`)
      .set(serviceHeaders)
      .send({ url: 'https://stackoverflow.com/q/1' })
      .expect(404);

    await request(app.server)
      .patch(`/p/contributions/links/${actionId}`)
      .set(serviceHeaders)
      .send({ label: 'Updated' })
      .expect(404);
  });

  it('reviews submissions, fulfills rewards, and blocks users', async () => {
    await seedContributionConfig();
    await saveFixtures(con, ContributionPayment, [
      {
        id: paymentId,
        status: ContributionPaymentStatus.Finalized,
        totalPoints: 10,
        amountCents: 1000,
      },
    ]);
    await saveFixtures(con, ContributionSubmission, [
      {
        id: submissionId,
        userId,
        actionId,
        status: ContributionSubmissionStatus.Flagged,
        awardedPoints: 10,
        evidence: {},
      },
      {
        id: paidSubmissionId,
        userId,
        actionId,
        paymentId,
        status: ContributionSubmissionStatus.Approved,
        awardedPoints: 10,
        evidence: {},
      },
    ]);
    await saveFixtures(con, UserContributionReward, [
      {
        userId,
        tierId,
        status: UserContributionRewardStatus.Claimed,
        claimedAt: new Date(),
      },
    ]);

    await request(app.server)
      .patch(`/p/contributions/submissions/${submissionId}/review`)
      .set(serviceHeaders)
      .send({
        status: ContributionSubmissionStatus.Approved,
        awardedPoints: 15,
        flags: { reviewed: true },
        reviewedBy: secondUserId,
      })
      .expect(200);

    await request(app.server)
      .patch(`/p/contributions/submissions/${paidSubmissionId}/review`)
      .set(serviceHeaders)
      .send({ status: ContributionSubmissionStatus.Rejected })
      .expect(400);

    await request(app.server)
      .patch(`/p/contributions/rewards/${userId}/${tierId}/fulfill`)
      .set(serviceHeaders)
      .send({})
      .expect(200);

    await request(app.server)
      .post('/p/contributions/blocked-users')
      .set(serviceHeaders)
      .send({ userId, reason: 'abuse' })
      .expect(201);

    await request(app.server)
      .delete(`/p/contributions/blocked-users/${userId}`)
      .set(serviceAuthHeaders)
      .expect(200);

    await expect(
      con
        .getRepository(ContributionSubmission)
        .findOneByOrFail({ id: submissionId }),
    ).resolves.toMatchObject({
      status: ContributionSubmissionStatus.Approved,
      awardedPoints: 15,
      flags: { reviewed: true },
      reviewedBy: secondUserId,
    });
    await expect(
      con.getRepository(UserContributionReward).findOneByOrFail({
        userId,
        tierId,
      }),
    ).resolves.toMatchObject({
      status: UserContributionRewardStatus.Fulfilled,
    });
    await expect(
      con.getRepository(ContributionBlockedUser).findOneBy({ userId }),
    ).resolves.toBeNull();
  });

  it('finalizes a payment cycle using cause preferences at payment time', async () => {
    await seedContributionConfig();
    await saveFixtures(con, UserContributionCausePreference, [
      {
        userId,
        causeId,
      },
      {
        userId,
        causeId: inactiveCauseId,
      },
    ]);
    await saveFixtures(con, ContributionSubmission, [
      {
        id: submissionId,
        userId,
        actionId,
        status: ContributionSubmissionStatus.Approved,
        awardedPoints: 30,
        evidence: {},
      },
      {
        id: secondSubmissionId,
        userId: secondUserId,
        actionId,
        status: ContributionSubmissionStatus.Approved,
        awardedPoints: 10,
        evidence: {},
      },
    ]);

    const { body } = await request(app.server)
      .post('/p/contributions/payments/finalize')
      .set(serviceHeaders)
      .send({ amountCents: 1000, createdBy: secondUserId })
      .expect(201);

    expect(body).toMatchObject({
      status: ContributionPaymentStatus.Finalized,
      totalPoints: 40,
      amountCents: 1000,
      createdBy: secondUserId,
    });

    const [submissions, allocations] = await Promise.all([
      con.getRepository(ContributionSubmission).find({
        select: ['id', 'paymentId'],
        order: { id: 'ASC' },
      }),
      con.getRepository(ContributionPaymentAllocation).find({
        select: ['userId', 'causeId', 'points', 'amountCents'],
        order: { userId: 'ASC', causeId: 'ASC' },
      }),
    ]);

    expect(submissions).toEqual([
      { id: submissionId, paymentId: body.id },
      { id: secondSubmissionId, paymentId: body.id },
    ]);
    expect(
      allocations.map(({ userId, causeId, points, amountCents }) => ({
        userId,
        causeId,
        points,
        amountCents,
      })),
    ).toEqual([
      {
        userId: secondUserId,
        causeId,
        points: 5,
        amountCents: 125,
      },
      {
        userId: secondUserId,
        causeId: secondCauseId,
        points: 5,
        amountCents: 125,
      },
      {
        userId,
        causeId,
        points: 30,
        amountCents: 750,
      },
    ]);
  });
});
