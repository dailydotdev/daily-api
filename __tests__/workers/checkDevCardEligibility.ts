import { Connection, getConnection } from 'typeorm';
import { FastifyInstance } from 'fastify';
import nock from 'nock';

import appFunc from '../../src/background';
import worker from '../../src/workers/checkDevCardEligibility';
import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import { Post, Source, User, View } from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { postsFixture } from '../fixture/post';
import { redisClient } from '../../src/redis';
import { notifyDevCardEligible } from '../../src/common';
import { mocked } from 'ts-jest/utils';

let con: Connection;
let app: FastifyInstance;

jest.mock('../../src/common', () => ({
  ...(jest.requireActual('../../src/common') as Record<string, unknown>),
  notifyDevCardEligible: jest.fn(),
}));

beforeAll(async () => {
  con = await getConnection();
  app = await appFunc();
  return app.ready();
});

beforeEach(async () => {
  jest.clearAllMocks();
  nock.cleanAll();
  await redisClient.del(`flagsmith:flags-u1`);
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, Post, postsFixture);
  await con.getRepository(User).save({
    id: 'u1',
    name: 'Ido',
    image: 'https://daily.dev/image.jpg',
    devcardEligible: false,
  });
});

const mockFeatureFlagForUser = (
  userId: string,
  featureName: string,
  enabled: boolean,
  value?: unknown,
): nock.Scope =>
  nock('https://api.flagsmith.com')
    .get(`/api/v1/identities/?identifier=${userId}`)
    .reply(200, {
      flags: [
        {
          feature: { name: featureName },
          enabled,
          feature_state_value: value,
        },
      ],
    });

it('should ignore anonymous views', async () => {
  await expectSuccessfulBackground(app, worker, {
    postId: 'p1',
    userId: 'u2',
    referer: 'referer',
    agent: 'agent',
    ip: '127.0.0.1',
  });
  expect(notifyDevCardEligible).toBeCalledTimes(0);
});

it('should ignore users who already eligible for devcard', async () => {
  await con.getRepository(User).update({ id: 'u1' }, { devcardEligible: true });
  await expectSuccessfulBackground(app, worker, {
    postId: 'p1',
    userId: 'u1',
    referer: 'referer',
    agent: 'agent',
    ip: '127.0.0.1',
  });
  expect(notifyDevCardEligible).toBeCalledTimes(0);
});

it('should ignore users who have the eligibility feature turned off', async () => {
  mockFeatureFlagForUser('u1', 'feat_limit_dev_card', false);
  await expectSuccessfulBackground(app, worker, {
    postId: 'p1',
    userId: 'u1',
    referer: 'referer',
    agent: 'agent',
    ip: '127.0.0.1',
  });
  const user = await con.getRepository(User).findOne('u1');
  expect(user.devcardEligible).toEqual(false);
  expect(notifyDevCardEligible).toBeCalledTimes(0);
});

it('should ignore users with limit equals zero', async () => {
  mockFeatureFlagForUser('u1', 'feat_limit_dev_card', true, 0);
  await expectSuccessfulBackground(app, worker, {
    postId: 'p1',
    userId: 'u1',
    referer: 'referer',
    agent: 'agent',
    ip: '127.0.0.1',
  });
  const user = await con.getRepository(User).findOne('u1');
  expect(user.devcardEligible).toEqual(false);
  expect(notifyDevCardEligible).toBeCalledTimes(0);
});

it('should ignore users who did not reach their limit', async () => {
  mockFeatureFlagForUser('u1', 'feat_limit_dev_card', true, 2);
  await con.getRepository(View).save([
    {
      postId: 'p1',
      userId: 'u1',
      referer: 'referer',
      agent: 'agent',
      ip: '127.0.0.1',
    },
    {
      postId: 'p2',
      userId: 'u1',
      referer: 'referer',
      agent: 'agent',
      ip: '127.0.0.1',
    },
  ]);
  await expectSuccessfulBackground(app, worker, {
    postId: 'p1',
    userId: 'u1',
    referer: 'referer',
    agent: 'agent',
    ip: '127.0.0.1',
  });
  const user = await con.getRepository(User).findOne('u1');
  expect(user.devcardEligible).toEqual(true);
  expect(mocked(notifyDevCardEligible).mock.calls[0].slice(1)).toEqual(['u1']);
});
