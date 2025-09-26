import { expectSuccessfulTypedBackground, saveFixtures } from '../../helpers';
import { storeCandidateOpportunityMatch as worker } from '../../../src/workers/opportunity/storeCandidateOpportunityMatch';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../../src/db';
import { OpportunityMatch } from '../../../src/entity/OpportunityMatch';
import {
  User,
  Organization,
  Alerts,
  Feature,
  FeatureType,
} from '../../../src/entity';
import { Opportunity } from '../../../src/entity/opportunities/Opportunity';
import { usersFixture } from '../../fixture';
import {
  opportunitiesFixture,
  organizationsFixture,
} from '../../fixture/opportunity';
import { MatchedCandidate } from '@dailydotdev/schema';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

describe('storeCandidateOpportunityMatch worker', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    await saveFixtures(con, Organization, organizationsFixture);
    await saveFixtures(con, User, usersFixture);
    await saveFixtures(con, Opportunity, opportunitiesFixture);

    await con.getRepository(Feature).insert({
      userId: '1',
      feature: FeatureType.Team,
      value: 1,
    });
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

    await expectSuccessfulTypedBackground<'gondul.v1.candidate-opportunity-match'>(
      worker,
      matchData,
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

    await expectSuccessfulTypedBackground<'gondul.v1.candidate-opportunity-match'>(
      worker,
      matchData,
    );

    // Verify no match was inserted
    const matches = await con.getRepository(OpportunityMatch).find({
      where: { userId: '1' },
    });
    expect(matches).toHaveLength(0);
  });

  it('should log warning when both userId and opportunityId are missing', async () => {
    const matchData = new MatchedCandidate({
      userId: '',
      opportunityId: '',
      matchScore: 85,
      reasoning: 'Strong technical background',
    });

    await expectSuccessfulTypedBackground<'gondul.v1.candidate-opportunity-match'>(
      worker,
      matchData,
    );

    // Verify no match was inserted
    const matches = await con.getRepository(OpportunityMatch).find();
    expect(matches).toHaveLength(0);
  });

  it('should handle FK_opportunity_match_opportunity_id and log error', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    // Use non-existent opportunity ID
    const matchData = new MatchedCandidate({
      userId: '1',
      opportunityId: '660e8400-e29b-41d4-a716-446655440001',
      matchScore: 85,
      reasoning: 'Strong technical background',
    });

    // This should not throw due to the FK_opportunity_match_opportunity_id handling
    await expectSuccessfulTypedBackground<'gondul.v1.candidate-opportunity-match'>(
      worker,
      matchData,
    );

    consoleSpy.mockRestore();
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

  it('should have correct subscription name', () => {
    expect(worker.subscription).toBe('api.store-candidate-opportunity-match');
  });

  it('should re-throw non-EntityNotFoundError errors', async () => {
    // Mock the repository to throw a different error
    const mockRepo = {
      upsert: jest
        .fn()
        .mockRejectedValue(new Error('Database connection failed')),
    };

    // Mock the manager that transaction callback will receive
    const mockManager = {
      getRepository: jest.fn().mockReturnValue(mockRepo),
    };

    // Mock the connection's transaction method to invoke the callback with our mock manager
    const originalTransaction = con.transaction;
    con.transaction = jest.fn(
      async (cb: (manager: unknown) => Promise<void>) => {
        return cb(mockManager);
      },
    );

    const originalGetRepository = con.getRepository;
    con.getRepository = jest.fn().mockReturnValue(mockRepo);

    const matchData = new MatchedCandidate({
      userId: '1',
      opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      matchScore: 85,
      reasoning: 'Strong technical background',
    });

    // This should re-throw the error since it's not an EntityNotFoundError
    await expect(
      expectSuccessfulTypedBackground<'gondul.v1.candidate-opportunity-match'>(
        worker,
        matchData,
      ),
    ).rejects.toThrow('Database connection failed');

    // Restore original method
    con.transaction = originalTransaction;
    con.getRepository = originalGetRepository;
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
