import { cleanZombieOpportunities as cron } from '../../src/cron/cleanZombieOpportunities';
import { expectSuccessfulCron, saveFixtures } from '../helpers';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { crons } from '../../src/cron/index';
import {
  datasetLocationsFixture,
  opportunitiesFixture,
  organizationsFixture,
} from '../fixture/opportunity';
import { randomUUID } from 'node:crypto';
import { OpportunityJob } from '../../src/entity/opportunities/OpportunityJob';
import { subDays } from 'date-fns';
import { Organization } from '../../src/entity/Organization';
import { DatasetLocation } from '../../src/entity/dataset/DatasetLocation';
import {
  ClaimableItem,
  ClaimableItemTypes,
} from '../../src/entity/ClaimableItem';
import { Opportunity } from '../../src/entity/opportunities/Opportunity';
import { OpportunityState } from '@dailydotdev/schema';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.clearAllMocks();

  await saveFixtures(con, DatasetLocation, datasetLocationsFixture);
  await saveFixtures(con, Organization, organizationsFixture);

  await saveFixtures(
    con,
    OpportunityJob,
    opportunitiesFixture.map((opportunity) => {
      return {
        ...opportunity,
        state: OpportunityState.DRAFT,
        id: randomUUID(),
      };
    }),
  );

  const opps1 = await con.getRepository(OpportunityJob).save(
    opportunitiesFixture.map((opportunity) => {
      return {
        ...opportunity,
        state: OpportunityState.DRAFT,
        id: randomUUID(),
        organizationId: null,
        createdAt: subDays(new Date(), 3),
      };
    }),
  );

  await saveFixtures(
    con,
    ClaimableItem,
    opps1.map((opportunity) => {
      return {
        identifier: randomUUID(),
        type: ClaimableItemTypes.Opportunity,
        flags: {
          opportunityId: opportunity.id,
        },
      };
    }),
  );

  const opps2 = await con.getRepository(OpportunityJob).save(
    opportunitiesFixture.map((opportunity) => {
      return {
        ...opportunity,
        state: OpportunityState.DRAFT,
        id: randomUUID(),
        organizationId: null,
        createdAt: subDays(new Date(), 1),
      };
    }),
  );

  await saveFixtures(
    con,
    ClaimableItem,
    opps2.map((opportunity) => {
      return {
        identifier: randomUUID(),
        type: ClaimableItemTypes.Opportunity,
        flags: {
          opportunityId: opportunity.id,
        },
      };
    }),
  );
});

describe('cleanZombieOpportunities cron', () => {
  it('should be registered', () => {
    const registeredWorker = crons.find((item) => item.name === cron.name);

    expect(registeredWorker).toBeDefined();
  });

  it('should clean created opportunities not updated for more then 2 days', async () => {
    const opportunities = await con.getRepository(Opportunity).find();

    expect(opportunities.length).toEqual(15);

    const claimableItems = await con.getRepository(ClaimableItem).find();

    const zombieOpportunitiesCount = opportunities.filter((opportunity) => {
      return (
        !(opportunity as OpportunityJob).organizationId &&
        claimableItems.some(
          (item) => item.flags.opportunityId === opportunity.id,
        ) &&
        opportunity.createdAt < subDays(new Date(), 2)
      );
    }).length;

    expect(zombieOpportunitiesCount).toEqual(5);

    await expectSuccessfulCron(cron);

    const opportunitiesCount = await con
      .getRepository(OpportunityJob)
      .createQueryBuilder()
      .getCount();

    expect(opportunitiesCount).toEqual(10);
  });
});
