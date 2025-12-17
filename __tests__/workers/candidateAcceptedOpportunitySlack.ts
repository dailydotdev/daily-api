import { expectSuccessfulTypedBackground, saveFixtures } from '../helpers';
import worker from '../../src/workers/candidateAcceptedOpportunitySlack';
import { OpportunityMatch } from '../../src/entity/OpportunityMatch';
import { User } from '../../src/entity';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { webhooks } from '../../src/common/slack';
import { OpportunityMatchStatus } from '../../src/entity/opportunities/types';
import { CandidateAcceptedOpportunityMessage } from '@dailydotdev/schema';
import { OpportunityJob } from '../../src/entity/opportunities/OpportunityJob';
import { Organization } from '../../src/entity/Organization';
import {
  organizationsFixture,
  opportunitiesFixture,
  datasetLocationsFixture,
} from '../fixture/opportunity';
import { usersFixture } from '../fixture/user';
import { DatasetLocation } from '../../src/entity/dataset/DatasetLocation';

// Spy on the webhooks.recruiter.send method
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

describe('candidateAcceptedOpportunitySlack worker', () => {
  it('should send a slack notification when a candidate accepts an opportunity', async () => {
    const match = {
      opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      userId: '1',
      status: OpportunityMatchStatus.CandidateAccepted,
      description: { reasoning: 'Great fit for the role' },
      createdAt: new Date('2023-01-05'),
      updatedAt: new Date('2023-01-05'),
    };

    await saveFixtures(con, OpportunityMatch, [match]);

    const eventData = new CandidateAcceptedOpportunityMessage({
      opportunityId: match.opportunityId,
      userId: match.userId,
      createdAt: BigInt(Math.floor(match.createdAt.getTime() / 1000)),
      updatedAt: BigInt(Math.floor(match.updatedAt.getTime() / 1000)),
    });

    await expectSuccessfulTypedBackground<'api.v1.candidate-accepted-opportunity'>(
      worker,
      eventData,
    );

    expect(mockRecruiterSend).toHaveBeenCalledWith({
      text: 'Candidate accepted opportunity!',
      attachments: [
        {
          title: 'Senior Full Stack Developer',
          title_link: `${process.env.COMMENTS_PREFIX}/jobs/550e8400-e29b-41d4-a716-446655440001`,
          fields: [
            {
              title: 'User',
              value: 'idoshamun',
            },
            {
              title: 'User ID',
              value: '1',
            },
            {
              title: 'Opportunity ID',
              value: '550e8400-e29b-41d4-a716-446655440001',
            },
          ],
          color: '#1DDC6F',
        },
      ],
    });
  });

  it('should handle when user has no username', async () => {
    const match = {
      opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      userId: '2',
      status: OpportunityMatchStatus.CandidateAccepted,
      description: { reasoning: 'Great fit for the role' },
      createdAt: new Date('2023-01-05'),
      updatedAt: new Date('2023-01-05'),
    };

    await saveFixtures(con, OpportunityMatch, [match]);

    const eventData = new CandidateAcceptedOpportunityMessage({
      opportunityId: match.opportunityId,
      userId: match.userId,
      createdAt: BigInt(Math.floor(match.createdAt.getTime() / 1000)),
      updatedAt: BigInt(Math.floor(match.updatedAt.getTime() / 1000)),
    });

    await expectSuccessfulTypedBackground<'api.v1.candidate-accepted-opportunity'>(
      worker,
      eventData,
    );

    expect(mockRecruiterSend).toHaveBeenCalledWith({
      text: 'Candidate accepted opportunity!',
      attachments: [
        {
          title: 'Senior Full Stack Developer',
          title_link: `${process.env.COMMENTS_PREFIX}/jobs/550e8400-e29b-41d4-a716-446655440001`,
          fields: [
            {
              title: 'User',
              value: 'tsahidaily',
            },
            {
              title: 'User ID',
              value: '2',
            },
            {
              title: 'Opportunity ID',
              value: '550e8400-e29b-41d4-a716-446655440001',
            },
          ],
          color: '#1DDC6F',
        },
      ],
    });
  });

  it('should not send notification when match is not found', async () => {
    const eventData = new CandidateAcceptedOpportunityMessage({
      opportunityId: '550e8400-e29b-41d4-a716-446655440999',
      userId: '1',
      createdAt: BigInt(Math.floor(Date.now() / 1000)),
      updatedAt: BigInt(Math.floor(Date.now() / 1000)),
    });

    await expectSuccessfulTypedBackground<'api.v1.candidate-accepted-opportunity'>(
      worker,
      eventData,
    );

    expect(mockRecruiterSend).not.toHaveBeenCalled();
  });

  it('should handle different opportunities', async () => {
    const match = {
      opportunityId: '550e8400-e29b-41d4-a716-446655440002',
      userId: '3',
      status: OpportunityMatchStatus.CandidateAccepted,
      description: { reasoning: 'Excellent candidate' },
      createdAt: new Date('2023-01-06'),
      updatedAt: new Date('2023-01-06'),
    };

    await saveFixtures(con, OpportunityMatch, [match]);

    const eventData = new CandidateAcceptedOpportunityMessage({
      opportunityId: match.opportunityId,
      userId: match.userId,
      createdAt: BigInt(Math.floor(match.createdAt.getTime() / 1000)),
      updatedAt: BigInt(Math.floor(match.updatedAt.getTime() / 1000)),
    });

    await expectSuccessfulTypedBackground<'api.v1.candidate-accepted-opportunity'>(
      worker,
      eventData,
    );

    expect(mockRecruiterSend).toHaveBeenCalledWith({
      text: 'Candidate accepted opportunity!',
      attachments: [
        {
          title: 'Frontend Developer',
          title_link: `${process.env.COMMENTS_PREFIX}/jobs/550e8400-e29b-41d4-a716-446655440002`,
          fields: [
            {
              title: 'User',
              value: 'nimroddaily',
            },
            {
              title: 'User ID',
              value: '3',
            },
            {
              title: 'Opportunity ID',
              value: '550e8400-e29b-41d4-a716-446655440002',
            },
          ],
          color: '#1DDC6F',
        },
      ],
    });
  });
});
