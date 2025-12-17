import { expectSuccessfulTypedBackground, saveFixtures } from '../../helpers';
import { storeCandidateOpportunityMatch as worker } from '../../../src/workers/opportunity/storeCandidateOpportunityMatch';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../../src/db';
import { OpportunityMatch } from '../../../src/entity/OpportunityMatch';
import { User, Organization, Alerts } from '../../../src/entity';
import { Opportunity } from '../../../src/entity/opportunities/Opportunity';
import { usersFixture } from '../../fixture';
import {
  datasetLocationsFixture,
  opportunitiesFixture,
  organizationsFixture,
} from '../../fixture/opportunity';
import { MatchedCandidate } from '@dailydotdev/schema';
import { DatasetLocation } from '../../../src/entity/dataset/DatasetLocation';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

describe('storeCandidateOpportunityMatch worker', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    await saveFixtures(con, DatasetLocation, datasetLocationsFixture);
    await saveFixtures(con, Organization, organizationsFixture);
    await saveFixtures(con, User, usersFixture);
    await saveFixtures(con, Opportunity, opportunitiesFixture);
  });

  it('should handle the correct schema format', async () => {
    const matchData = new MatchedCandidate({
      userId: '1',
      opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      matchScore: 85,
      reasoning: 'Strong technical background and relevant experience',
      reasoningShort: 'Strong technical background',
    });

    await expectSuccessfulTypedBackground<'gondul.v1.candidate-opportunity-match'>(
      worker,
      matchData,
    );

    const savedMatch = await con.getRepository(OpportunityMatch).findOne({
      where: {
        userId: '1',
        opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      },
    });

    expect(savedMatch).toBeDefined();
    expect(savedMatch!.description.reasoning).toBe(
      'Strong technical background and relevant experience',
    );
    expect(savedMatch!.description.reasoningShort).toBe(
      'Strong technical background',
    );
    expect(savedMatch!.description.matchScore).toBe(85);
  });

  it('should log warning when userId is missing', async () => {
    const matchData = new MatchedCandidate({
      userId: '',
      opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      matchScore: 85,
      reasoning: 'Strong technical background',
    });

    await expect(
      expectSuccessfulTypedBackground<'gondul.v1.candidate-opportunity-match'>(
        worker,
        matchData,
      ),
    ).rejects.toThrow(
      'Missing userId or opportunityId in candidate opportunity match',
    );

    // Verify no match was inserted
    const matches = await con.getRepository(OpportunityMatch).find({
      where: { opportunityId: '550e8400-e29b-41d4-a716-446655440001' },
    });
    expect(matches).toHaveLength(0);
  });

  it('should log warning when opportunityId is missing', async () => {
    const matchData = new MatchedCandidate({
      userId: '1',
      opportunityId: '',
      matchScore: 85,
      reasoning: 'Strong technical background',
    });

    await expect(
      expectSuccessfulTypedBackground<'gondul.v1.candidate-opportunity-match'>(
        worker,
        matchData,
      ),
    ).rejects.toThrow(
      'Missing userId or opportunityId in candidate opportunity match',
    );

    // Verify no match was inserted
    const matches = await con.getRepository(OpportunityMatch).find({
      where: { userId: '1' },
    });
    expect(matches).toHaveLength(0);
  });

  it('should parse binary message correctly', () => {
    const testData = new MatchedCandidate({
      userId: '1',
      opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      matchScore: 85,
      reasoning: 'Strong technical background and relevant experience',
      reasoningShort: 'Strong technical background',
    });

    // Create a binary representation
    const binaryData = testData.toBinary();
    const mockMessage = { data: Buffer.from(binaryData) };

    const parsedData = worker.parseMessage!(mockMessage);

    expect(parsedData.userId).toBe('1');
    expect(parsedData.opportunityId).toBe(
      '550e8400-e29b-41d4-a716-446655440001',
    );
    expect(parsedData.matchScore).toBe(85);
    expect(parsedData.reasoning).toBe(
      'Strong technical background and relevant experience',
    );
    expect(parsedData.reasoningShort).toBe('Strong technical background');
  });

  it('should update alerts with opportunityId when match is stored', async () => {
    const matchData = new MatchedCandidate({
      userId: '1',
      opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      matchScore: 85,
      reasoning: 'Strong technical background and relevant experience',
    });

    await expectSuccessfulTypedBackground<'gondul.v1.candidate-opportunity-match'>(
      worker,
      matchData,
    );

    expect(await con.getRepository(Alerts).findOneBy({ userId: '1' })).toEqual(
      expect.objectContaining({
        opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      }),
    );
  });

  it('should not overwrite alerts with opportunityId when match is stored', async () => {
    await saveFixtures(con, Alerts, [
      { userId: '1', opportunityId: '550e8400-e29b-41d4-a716-446655440002' },
    ]);
    const matchData = new MatchedCandidate({
      userId: '1',
      opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      matchScore: 85,
      reasoning: 'Strong technical background and relevant experience',
    });

    await expectSuccessfulTypedBackground<'gondul.v1.candidate-opportunity-match'>(
      worker,
      matchData,
    );

    expect(await con.getRepository(Alerts).findOneBy({ userId: '1' })).toEqual(
      expect.objectContaining({
        opportunityId: '550e8400-e29b-41d4-a716-446655440002',
      }),
    );
  });
});
