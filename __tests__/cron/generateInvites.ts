import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { expectSuccessfulCron, saveFixtures } from '../helpers';
import {
  CampaignType,
  Feature,
  FeatureType,
  FeatureValue,
  Invite,
  User,
} from '../../src/entity';
import { usersFixture } from '../fixture/user';
import cron from '../../src/cron/generateInvites';
import pino from 'pino';

let con: DataSource;
const oldDate = new Date();
oldDate.setDate(oldDate.getDate() - 8);

const featuresFixture: Partial<Feature>[] = [
  // invalid for invite, createdAt not within threshold
  {
    feature: FeatureType.Search,
    userId: '1',
    value: FeatureValue.Allow,
  },

  // invalid for invite, feature blocked
  {
    feature: FeatureType.Search,
    userId: '2',
    value: FeatureValue.Block,
  },

  // invalid for invite, old date, but feature blocked
  {
    feature: FeatureType.Squad,
    userId: '1',
    value: FeatureValue.Block,
    createdAt: oldDate,
  },

  // invalid for invite, old date, but already has invite
  {
    feature: FeatureType.Search,
    userId: '3',
    value: FeatureValue.Allow,
    createdAt: oldDate,
  },

  // valid for invite
  {
    feature: FeatureType.Squad,
    userId: '2',
    value: FeatureValue.Allow,
    createdAt: oldDate,
  },
  {
    feature: FeatureType.Search,
    userId: '4',
    value: FeatureValue.Allow,
    createdAt: oldDate,
  },
  {
    feature: FeatureType.Squad,
    userId: '3',
    value: FeatureValue.Allow,
    createdAt: oldDate,
  },
];

const invitesFixture: Partial<Invite>[] = [
  {
    token: 'foo',
    campaign: CampaignType.Search,
    userId: '3',
  },
];
beforeAll(async () => {
  con = await createOrGetConnection();
});

describe('generateInvites cron', () => {
  beforeEach(async () => {
    jest.resetAllMocks();

    await saveFixtures(con, User, usersFixture);
    await saveFixtures(con, Feature, featuresFixture);
    await saveFixtures(con, Invite, invitesFixture);
  });

  it('should insert invites for the correct features', async () => {
    await expectSuccessfulCron(cron);

    const invites = await con.getRepository(Invite).find();
    expect(invites.length).toEqual(4);
    expect(
      invites.map(({ campaign, userId }) => ({ campaign, userId })),
    ).toEqual(
      expect.arrayContaining([
        {
          campaign: CampaignType.Search,
          userId: '3',
        },
        {
          campaign: CampaignType.Search,
          userId: '4',
        },
        {
          campaign: FeatureType.Squad,
          userId: '2',
        },
        {
          campaign: FeatureType.Squad,
          userId: '3',
        },
      ]),
    );
  });

  it('should log invites count', async () => {
    const logger = pino();
    const infoSpy = jest.spyOn(logger, 'info');
    await expectSuccessfulCron(cron, logger);
    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy).toHaveBeenCalledWith({ count: 3 }, 'invites generated');
  });
});
