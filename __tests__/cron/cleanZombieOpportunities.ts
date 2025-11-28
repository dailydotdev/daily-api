import { cleanZombieOpportunities as cron } from '../../src/cron/cleanZombieOpportunities';
import { expectSuccessfulCron, saveFixtures } from '../helpers';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { crons } from '../../src/cron/index';
import {
  opportunitiesFixture,
  organizationsFixture,
} from '../fixture/opportunity';
import { randomUUID } from 'node:crypto';
import { OpportunityJob } from '../../src/entity/opportunities/OpportunityJob';
import { subDays } from 'date-fns';
import { Organization } from '../../src/entity/Organization';
import { Opportunity } from '../../src/entity/opportunities/Opportunity';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.clearAllMocks();

  await saveFixtures(con, Organization, organizationsFixture);

  await saveFixtures(
    con,
    OpportunityJob,
    opportunitiesFixture.map((opportunity) => {
      return {
        ...opportunity,
        id: randomUUID(),
      };
    }),
  );

  await saveFixtures(
    con,
    OpportunityJob,
    opportunitiesFixture.map((opportunity) => {
      return {
        ...opportunity,
        id: randomUUID(),
        organizationId: null,
        flags: { anonUserId: randomUUID() },
        createdAt: subDays(new Date(), 3),
      };
    }),
  );

  await saveFixtures(
    con,
    OpportunityJob,
    opportunitiesFixture.map((opportunity) => {
      return {
        ...opportunity,
        id: randomUUID(),
        organizationId: null,
        flags: { anonUserId: randomUUID() },
        createdAt: subDays(new Date(), 1),
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

    const zombieOpportunitiesCount = opportunities.filter((opportunity) => {
      return (
        !(opportunity as OpportunityJob).organizationId &&
        opportunity.flags?.anonUserId &&
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
