import { expectSuccessfulTypedBackground, saveFixtures } from '../helpers';
import worker from '../../src/workers/candidateReviewOpportunitySlack';
import { OpportunityMatch } from '../../src/entity/OpportunityMatch';
import { User } from '../../src/entity';
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

jest.spyOn(webhooks.recruiter, 'send').mockResolvedValue(undefined);

beforeEach(async () => {
  jest.clearAllMocks();
  const con = await createOrGetConnection();
  await saveFixtures(con, DatasetLocation, datasetLocationsFixture);
  await saveFixtures(con, Organization, organizationsFixture);
  await saveFixtures(con, OpportunityJob, opportunitiesFixture);
  await saveFixtures(con, User, usersFixture);
});

describe('candidateReviewOpportunitySlack worker', () => {
  it('should send slack notification with accept/reject buttons', async () => {
    const con = await createOrGetConnection();
    await saveFixtures(con, OpportunityMatch, [
      {
        opportunityId: '550e8400-e29b-41d4-a716-446655440001',
        userId: '1',
        status: OpportunityMatchStatus.CandidateReview,
        screening: [{ screening: 'Favorite language?', answer: 'TypeScript' }],
        applicationRank: { score: 85 },
      },
    ]);

    await expectSuccessfulTypedBackground(worker, {
      opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      userId: '1',
    });

    expect(webhooks.recruiter.send).toHaveBeenCalledTimes(1);
    const blocks = (webhooks.recruiter.send as jest.Mock).mock.calls[0][0]
      .blocks;
    const actions = blocks.find((b: { type: string }) => b.type === 'actions');
    expect(actions.elements).toHaveLength(2);
    expect(actions.elements[0].action_id).toBe('candidate_review_accept');
    expect(actions.elements[1].action_id).toBe('candidate_review_reject');
  });
});
