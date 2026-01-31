import { expectSuccessfulTypedBackground, saveFixtures } from '../../helpers';
import { storeCandidateApplicationScore as worker } from '../../../src/workers/opportunity/storeCandidateApplicationScore';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../../src/db';
import { User, Organization } from '../../../src/entity';
import { OpportunityMatch } from '../../../src/entity/OpportunityMatch';
import { Opportunity } from '../../../src/entity/opportunities/Opportunity';
import { usersFixture } from '../../fixture';
import {
  datasetLocationsFixture,
  opportunitiesFixture,
  organizationsFixture,
} from '../../fixture/opportunity';
import { ApplicationScored } from '@dailydotdev/schema';
import { DatasetLocation } from '../../../src/entity/dataset/DatasetLocation';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

describe('storeCandidateApplicationScore worker', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    await saveFixtures(con, DatasetLocation, datasetLocationsFixture);
    await saveFixtures(con, Organization, organizationsFixture);
    await saveFixtures(con, User, usersFixture);
    await saveFixtures(con, Opportunity, opportunitiesFixture);
  });

  it('should successfully store candidate application score', async () => {
    const applicationScoreData = new ApplicationScored({
      userId: '1',
      opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      score: 85,
      description: 'Strong candidate with relevant experience',
    });

    await expectSuccessfulTypedBackground<'gondul.v1.candidate-application-scored'>(
      worker,
      applicationScoreData,
    );

    const match = await con.getRepository(OpportunityMatch).findOne({
      where: {
        userId: '1',
        opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      },
    });

    expect(match).toBeDefined();
    expect(match?.applicationRank).toEqual({
      score: 85,
      description: 'Strong candidate with relevant experience',
    });
  });

  it('should upsert existing opportunity match', async () => {
    await con.getRepository(OpportunityMatch).save({
      userId: '1',
      opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      applicationRank: {
        score: 60,
        description: 'Previous score',
        selfApplied: true,
      },
    });

    const updatedScoreData = new ApplicationScored({
      userId: '1',
      opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      score: 90,
      description: 'Updated score after review',
    });

    await expectSuccessfulTypedBackground<'gondul.v1.candidate-application-scored'>(
      worker,
      updatedScoreData,
    );

    const match = await con.getRepository(OpportunityMatch).findOne({
      where: {
        userId: '1',
        opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      },
    });

    expect(match).toBeDefined();
    expect(match?.applicationRank).toEqual({
      score: 90,
      description: 'Updated score after review',
      selfApplied: true,
    });
  });

  it('should warn and return early when userId is missing', async () => {
    const applicationScoreData = new ApplicationScored({
      userId: '',
      opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      score: 85,
      description: 'Test description',
    });

    await expect(
      expectSuccessfulTypedBackground<'gondul.v1.candidate-application-scored'>(
        worker,
        applicationScoreData,
      ),
    ).rejects.toThrow(
      'Missing userId or opportunityId in candidate application score',
    );

    const matches = await con.getRepository(OpportunityMatch).find();
    expect(matches).toHaveLength(0);
  });

  it('should warn and return early when opportunityId is missing', async () => {
    const applicationScoreData = new ApplicationScored({
      userId: '1',
      opportunityId: '',
      score: 85,
      description: 'Test description',
    });

    await expect(
      expectSuccessfulTypedBackground<'gondul.v1.candidate-application-scored'>(
        worker,
        applicationScoreData,
      ),
    ).rejects.toThrow(
      'Missing userId or opportunityId in candidate application score',
    );

    const matches = await con.getRepository(OpportunityMatch).find();
    expect(matches).toHaveLength(0);
  });

  it('should handle invalid score values by throwing validation error', async () => {
    const applicationScoreData = new ApplicationScored({
      userId: '1',
      opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      score: 150,
      description: 'Test description',
    });

    await expect(
      expectSuccessfulTypedBackground<'gondul.v1.candidate-application-scored'>(
        worker,
        applicationScoreData,
      ),
    ).rejects.toThrow();

    const matches = await con.getRepository(OpportunityMatch).find();
    expect(matches).toHaveLength(0);
  });

  it('should parse binary message correctly', () => {
    const testData = new ApplicationScored({
      userId: '1',
      opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      score: 85,
      description: 'Strong candidate with relevant experience',
    });

    const binaryData = testData.toBinary();
    const mockMessage = { data: Buffer.from(binaryData) };

    const parsedData = worker.parseMessage!(mockMessage);

    expect(parsedData.userId).toBe('1');
    expect(parsedData.opportunityId).toBe(
      '550e8400-e29b-41d4-a716-446655440001',
    );
    expect(parsedData.score).toBe(85);
    expect(parsedData.description).toBe(
      'Strong candidate with relevant experience',
    );
  });

  it('should have correct subscription name', () => {
    expect(worker.subscription).toBe('api.store-candidate-application-score');
  });
});
