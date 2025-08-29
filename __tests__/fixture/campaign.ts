import { Campaign, CampaignType, CampaignState } from '../../src/entity';
import { addDays } from 'date-fns';

export const campaignsFixture: Partial<Campaign>[] = [
  {
    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    creativeId: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
    referenceId: 'p1',
    userId: '1',
    type: CampaignType.Post,
    state: CampaignState.Active,
    createdAt: new Date(),
    updatedAt: new Date(),
    endedAt: addDays(new Date(), 7),
    flags: {
      budget: 1000,
      spend: 100,
    },
  },
  {
    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d481',
    creativeId: 'f47ac10b-58cc-4372-a567-0e02b2c3d482',
    referenceId: 'squad',
    userId: '1',
    type: CampaignType.Squad,
    state: CampaignState.Active,
    createdAt: new Date(),
    updatedAt: new Date(),
    endedAt: addDays(new Date(), 3),
    flags: {
      budget: 500,
      spend: 0,
    },
  },
  {
    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d483',
    creativeId: 'f47ac10b-58cc-4372-a567-0e02b2c3d484',
    referenceId: 'p2',
    userId: '2',
    type: CampaignType.Post,
    state: CampaignState.Completed,
    createdAt: addDays(new Date(), -10),
    updatedAt: new Date(),
    endedAt: addDays(new Date(), -3),
    flags: {
      budget: 2000,
      spend: 1500,
    },
  },
];
