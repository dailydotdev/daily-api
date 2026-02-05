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
import { OpportunityMatchStatus } from '../../../src/entity/opportunities/types';

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

  describe('re-match handling', () => {
    it('should reset a candidate_rejected match to pending on re-match', async () => {
      // Create initial match with candidate_rejected status
      await con.getRepository(OpportunityMatch).save({
        userId: '1',
        opportunityId: '550e8400-e29b-41d4-a716-446655440001',
        status: OpportunityMatchStatus.CandidateRejected,
        description: {
          matchScore: 75,
          reasoning: 'Initial reasoning',
          reasoningShort: 'Initial short',
        },
        feedback: [{ screening: 'test', answer: 'initial answer' }],
        history: [],
      });

      const matchData = new MatchedCandidate({
        userId: '1',
        opportunityId: '550e8400-e29b-41d4-a716-446655440001',
        matchScore: 90,
        reasoning: 'Updated reasoning for re-match',
        reasoningShort: 'Updated short',
      });

      await expectSuccessfulTypedBackground<'gondul.v1.candidate-opportunity-match'>(
        worker,
        matchData,
      );

      const updatedMatch = await con.getRepository(OpportunityMatch).findOne({
        where: {
          userId: '1',
          opportunityId: '550e8400-e29b-41d4-a716-446655440001',
        },
      });

      expect(updatedMatch).toBeDefined();
      expect(updatedMatch!.status).toBe(OpportunityMatchStatus.Pending);
      expect(updatedMatch!.description.matchScore).toBe(90);
      expect(updatedMatch!.description.reasoning).toBe(
        'Updated reasoning for re-match',
      );
      expect(updatedMatch!.feedback).toEqual([]);
    });

    it('should archive previous state to history on re-match', async () => {
      await con.getRepository(OpportunityMatch).save({
        userId: '1',
        opportunityId: '550e8400-e29b-41d4-a716-446655440001',
        status: OpportunityMatchStatus.CandidateRejected,
        description: {
          matchScore: 75,
          reasoning: 'Initial reasoning',
          reasoningShort: 'Initial short',
        },
        feedback: [{ screening: 'salary', answer: 'too low' }],
        history: [],
      });

      const matchData = new MatchedCandidate({
        userId: '1',
        opportunityId: '550e8400-e29b-41d4-a716-446655440001',
        matchScore: 85,
        reasoning: 'Re-match reasoning',
        reasoningShort: 'Re-match short',
      });

      await expectSuccessfulTypedBackground<'gondul.v1.candidate-opportunity-match'>(
        worker,
        matchData,
      );

      const updatedMatch = await con.getRepository(OpportunityMatch).findOne({
        where: {
          userId: '1',
          opportunityId: '550e8400-e29b-41d4-a716-446655440001',
        },
      });

      expect(updatedMatch!.history).toHaveLength(1);
      expect(updatedMatch!.history[0]).toMatchObject({
        status: OpportunityMatchStatus.CandidateRejected,
        feedback: [{ screening: 'salary', answer: 'too low' }],
        description: {
          matchScore: 75,
          reasoning: 'Initial reasoning',
          reasoningShort: 'Initial short',
        },
      });
      expect(updatedMatch!.history[0].archivedAt).toBeDefined();
    });

    it('should update alerts with hasSeenOpportunity=false on re-match', async () => {
      await saveFixtures(con, Alerts, [
        {
          userId: '1',
          opportunityId: '550e8400-e29b-41d4-a716-446655440001',
          flags: { hasSeenOpportunity: true },
        },
      ]);

      await con.getRepository(OpportunityMatch).save({
        userId: '1',
        opportunityId: '550e8400-e29b-41d4-a716-446655440001',
        status: OpportunityMatchStatus.CandidateRejected,
        description: {
          matchScore: 75,
          reasoning: 'Initial',
          reasoningShort: 'Initial',
        },
        feedback: [],
        history: [],
      });

      const matchData = new MatchedCandidate({
        userId: '1',
        opportunityId: '550e8400-e29b-41d4-a716-446655440001',
        matchScore: 85,
        reasoning: 'Re-match',
        reasoningShort: 'Re-match',
      });

      await expectSuccessfulTypedBackground<'gondul.v1.candidate-opportunity-match'>(
        worker,
        matchData,
      );

      const alerts = await con.getRepository(Alerts).findOneBy({ userId: '1' });
      expect(alerts!.flags!.hasSeenOpportunity).toBe(false);
    });

    it('should append to history on multiple re-matches', async () => {
      await con.getRepository(OpportunityMatch).save({
        userId: '1',
        opportunityId: '550e8400-e29b-41d4-a716-446655440001',
        status: OpportunityMatchStatus.CandidateRejected,
        description: {
          matchScore: 80,
          reasoning: 'Second reasoning',
          reasoningShort: 'Second short',
        },
        feedback: [{ screening: 'location', answer: 'too far' }],
        history: [
          {
            status: OpportunityMatchStatus.CandidateRejected,
            feedback: [{ screening: 'salary', answer: 'too low' }],
            description: {
              matchScore: 75,
              reasoning: 'First reasoning',
              reasoningShort: 'First short',
            },
            archivedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      });

      const matchData = new MatchedCandidate({
        userId: '1',
        opportunityId: '550e8400-e29b-41d4-a716-446655440001',
        matchScore: 90,
        reasoning: 'Third reasoning',
        reasoningShort: 'Third short',
      });

      await expectSuccessfulTypedBackground<'gondul.v1.candidate-opportunity-match'>(
        worker,
        matchData,
      );

      const updatedMatch = await con.getRepository(OpportunityMatch).findOne({
        where: {
          userId: '1',
          opportunityId: '550e8400-e29b-41d4-a716-446655440001',
        },
      });

      expect(updatedMatch!.history).toHaveLength(2);
      expect(updatedMatch!.history[0].description!.matchScore).toBe(75);
      expect(updatedMatch!.history[1].description!.matchScore).toBe(80);
    });

    it('should not reset match if status is not candidate_rejected', async () => {
      await con.getRepository(OpportunityMatch).save({
        userId: '1',
        opportunityId: '550e8400-e29b-41d4-a716-446655440001',
        status: OpportunityMatchStatus.CandidateAccepted,
        description: {
          matchScore: 75,
          reasoning: 'Initial',
          reasoningShort: 'Initial',
        },
        feedback: [{ screening: 'test', answer: 'answer' }],
        history: [],
      });

      const matchData = new MatchedCandidate({
        userId: '1',
        opportunityId: '550e8400-e29b-41d4-a716-446655440001',
        matchScore: 90,
        reasoning: 'Updated',
        reasoningShort: 'Updated',
      });

      await expectSuccessfulTypedBackground<'gondul.v1.candidate-opportunity-match'>(
        worker,
        matchData,
      );

      const match = await con.getRepository(OpportunityMatch).findOne({
        where: {
          userId: '1',
          opportunityId: '550e8400-e29b-41d4-a716-446655440001',
        },
      });

      // Status and feedback should remain unchanged (only description updates via upsert)
      expect(match!.status).toBe(OpportunityMatchStatus.CandidateAccepted);
      expect(match!.feedback).toEqual([
        { screening: 'test', answer: 'answer' },
      ]);
      expect(match!.history).toEqual([]);
    });
  });
});
