import { expectSuccessfulTypedBackground, saveFixtures } from '../helpers';
import worker from '../../src/workers/opportunityInReviewSlack';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { webhooks } from '../../src/common/slack';
import { OpportunityJob } from '../../src/entity/opportunities/OpportunityJob';
import { Organization } from '../../src/entity/Organization';
import {
  organizationsFixture,
  opportunitiesFixture,
  datasetLocationsFixture,
} from '../fixture/opportunity';
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
});

describe('opportunityInReviewSlack worker', () => {
  it('should send a slack notification when an opportunity is submitted for review', async () => {
    const eventData = {
      opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      organizationId: '550e8400-e29b-41d4-a716-446655440000',
      title: 'Senior Full Stack Developer',
    };

    await expectSuccessfulTypedBackground<'api.v1.opportunity-in-review'>(
      worker,
      eventData,
    );

    expect(mockRecruiterSend).toHaveBeenCalledWith({
      text: 'New opportunity submitted for review!',
      attachments: [
        {
          title: 'Senior Full Stack Developer',
          title_link: `${process.env.COMMENTS_PREFIX}/jobs/550e8400-e29b-41d4-a716-446655440001`,
          fields: [
            {
              title: 'Organization',
              value: 'Daily Dev Inc',
            },
            {
              title: 'Opportunity ID',
              value: '550e8400-e29b-41d4-a716-446655440001',
            },
          ],
          color: '#FFB800',
        },
      ],
    });
  });

  it('should not send notification when organization is not found', async () => {
    const eventData = {
      opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      organizationId: 'non-existent-org-id',
      title: 'Senior Full Stack Developer',
    };

    await expectSuccessfulTypedBackground<'api.v1.opportunity-in-review'>(
      worker,
      eventData,
    );

    expect(mockRecruiterSend).not.toHaveBeenCalled();
  });

  it('should handle different opportunities and organizations', async () => {
    const eventData = {
      opportunityId: '550e8400-e29b-41d4-a716-446655440002',
      organizationId: 'ed487a47-6f4d-480f-9712-f48ab29db27c',
      title: 'Frontend Developer',
    };

    await expectSuccessfulTypedBackground<'api.v1.opportunity-in-review'>(
      worker,
      eventData,
    );

    expect(mockRecruiterSend).toHaveBeenCalledWith({
      text: 'New opportunity submitted for review!',
      attachments: [
        {
          title: 'Frontend Developer',
          title_link: `${process.env.COMMENTS_PREFIX}/jobs/550e8400-e29b-41d4-a716-446655440002`,
          fields: [
            {
              title: 'Organization',
              value: 'Yearly Dev Inc',
            },
            {
              title: 'Opportunity ID',
              value: '550e8400-e29b-41d4-a716-446655440002',
            },
          ],
          color: '#FFB800',
        },
      ],
    });
  });

  it('should include opportunity title from the event data', async () => {
    const eventData = {
      opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      organizationId: '550e8400-e29b-41d4-a716-446655440000',
      title: 'Backend Engineer - Node.js',
    };

    await expectSuccessfulTypedBackground<'api.v1.opportunity-in-review'>(
      worker,
      eventData,
    );

    expect(mockRecruiterSend).toHaveBeenCalledWith({
      text: 'New opportunity submitted for review!',
      attachments: [
        {
          title: 'Backend Engineer - Node.js',
          title_link: `${process.env.COMMENTS_PREFIX}/jobs/550e8400-e29b-41d4-a716-446655440001`,
          fields: [
            {
              title: 'Organization',
              value: 'Daily Dev Inc',
            },
            {
              title: 'Opportunity ID',
              value: '550e8400-e29b-41d4-a716-446655440001',
            },
          ],
          color: '#FFB800',
        },
      ],
    });
  });

  it('should handle webhook send failures gracefully', async () => {
    mockRecruiterSend.mockRejectedValueOnce(new Error('Slack API error'));

    const eventData = {
      opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      organizationId: '550e8400-e29b-41d4-a716-446655440000',
      title: 'Senior Full Stack Developer',
    };

    // Should not throw error
    await expectSuccessfulTypedBackground<'api.v1.opportunity-in-review'>(
      worker,
      eventData,
    );

    expect(mockRecruiterSend).toHaveBeenCalled();
  });
});
