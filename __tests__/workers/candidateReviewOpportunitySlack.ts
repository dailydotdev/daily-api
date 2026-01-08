import { expectSuccessfulTypedBackground, saveFixtures } from '../helpers';
import worker from '../../src/workers/candidateReviewOpportunitySlack';
import { OpportunityMatch } from '../../src/entity/OpportunityMatch';
import { User } from '../../src/entity';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { webhooks } from '../../src/common/slack';
import { OpportunityMatchStatus } from '../../src/entity/opportunities/types';
import { OpportunityJob } from '../../src/entity/opportunities/OpportunityJob';
import { Organization } from '../../src/entity/Organization';
import {
  organizationsFixture,
  opportunitiesFixture,
  datasetLocationsFixture,
} from '../fixture/opportunity';
import { usersFixture } from '../fixture/user';
import { DatasetLocation } from '../../src/entity/dataset/DatasetLocation';
import type { PubSubSchema } from '../../src/common/typedPubsub';

const mockRecruiterSend = jest
  .spyOn(webhooks.recruiter, 'send')
  .mockResolvedValue(undefined);

let con: DataSource;

beforeAll(async () => {
  jest.clearAllMocks();
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, DatasetLocation, datasetLocationsFixture);
  await saveFixtures(con, Organization, organizationsFixture);
  await saveFixtures(con, OpportunityJob, opportunitiesFixture);
  await saveFixtures(con, User, usersFixture);
});

describe('candidateReviewOpportunitySlack worker', () => {
  it('should send slack notification with accept/reject buttons', async () => {
    const match = {
      opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      userId: '1',
      status: OpportunityMatchStatus.CandidateReview,
      screening: [{ screening: 'Favorite language?', answer: 'TypeScript' }],
      applicationRank: { score: 85 },
      createdAt: new Date('2023-01-05'),
      updatedAt: new Date('2023-01-05'),
    };
    await saveFixtures(con, OpportunityMatch, [match]);

    const eventData: PubSubSchema['api.v1.candidate-review-opportunity'] = {
      opportunityId: match.opportunityId,
      userId: match.userId,
      opportunityTitle: 'Senior Full Stack Developer',
      organizationName: 'Daily Dev Inc',
      candidateUsername: 'idoshamun',
      candidateName: 'Ido',
      matchScore: 85,
      screening: [{ question: 'Favorite language?', answer: 'TypeScript' }],
      cvSummary: null,
      salaryExpectation: null,
      location: null,
      keywords: ['typescript', 'react'],
    };

    await expectSuccessfulTypedBackground<'api.v1.candidate-review-opportunity'>(
      worker,
      eventData,
    );

    expect(mockRecruiterSend).toHaveBeenCalledTimes(1);
    const call = mockRecruiterSend.mock.calls[0][0];
    expect(call.blocks).toBeDefined();
    // Verify it has action buttons
    const actionsBlock = call.blocks.find(
      (b: { type: string }) => b.type === 'actions',
    );
    expect(actionsBlock).toBeDefined();
    expect(actionsBlock.elements).toHaveLength(2);
    expect(actionsBlock.elements[0].action_id).toBe('candidate_review_accept');
    expect(actionsBlock.elements[1].action_id).toBe('candidate_review_reject');
  });
});
