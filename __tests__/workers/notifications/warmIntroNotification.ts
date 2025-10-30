import { DataSource } from 'typeorm';
import { warmIntroNotification as worker } from '../../../src/workers/notifications/warmIntroNotification';
import createOrGetConnection from '../../../src/db';

import { Feature, FeatureType, Organization, User } from '../../../src/entity';
import { OpportunityJob } from '../../../src/entity/opportunities/OpportunityJob';
import { OpportunityUser } from '../../../src/entity/opportunities/user';
import { OpportunityUserType } from '../../../src/entity/opportunities/types';
import { OpportunityType, OpportunityState } from '@dailydotdev/schema';
import { usersFixture } from '../../fixture';
import { workers } from '../../../src/workers';
import { invokeTypedNotificationWorker, saveFixtures } from '../../helpers';
import { NotificationType } from '../../../src/notifications/common';
import type { NotificationWarmIntroContext } from '../../../src/notifications';
import { WarmIntro } from '@dailydotdev/schema';
import { OpportunityMatch } from '../../../src/entity/OpportunityMatch';

let con: DataSource;

describe('warmIntroNotification worker', () => {
  beforeAll(async () => {
    con = await createOrGetConnection();
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    await saveFixtures(con, User, usersFixture);
    await con.getRepository(Feature).insert({
      userId: '1',
      feature: FeatureType.Team,
      value: 1,
    });
  });

  it('should be registered', () => {
    const registeredWorker = workers.find(
      (item) => item.subscription === worker.subscription,
    );

    expect(registeredWorker).toBeDefined();
  });

  it('should send notification with all required fields', async () => {
    const organization = await con.getRepository(Organization).save({
      id: 'e34d0a84-89ea-4ba3-ba6e-1b8fe9ac952f',
      name: 'Test Organization',
      image: 'https://example.com/org.png',
    });

    const opportunity = await con.getRepository(OpportunityJob).save({
      id: '123e4567-e89b-12d3-a456-426614174000',
      type: OpportunityType.JOB,
      state: OpportunityState.LIVE,
      title: 'Software Engineer',
      tldr: 'Great opportunity',
      content: {},
      meta: {},
      organizationId: organization.id,
      location: [],
    });

    const recruiterUser = await con.getRepository(User).save({
      id: 'recruiter123',
      name: 'John Recruiter',
      email: 'recruiter@test.com',
    });

    await con.getRepository(OpportunityUser).save({
      opportunityId: opportunity.id,
      userId: recruiterUser.id,
      type: OpportunityUserType.Recruiter,
    });

    const result =
      await invokeTypedNotificationWorker<'gondul.v1.warm-intro-generated'>(
        worker,
        new WarmIntro({
          userId: '1',
          opportunityId: '123e4567-e89b-12d3-a456-426614174000',
          description: 'This is a warm introduction based on your profile',
        }),
      );

    expect(result!.length).toEqual(1);
    expect(result![0].type).toEqual(NotificationType.WarmIntro);

    const context = result![0].ctx as NotificationWarmIntroContext;

    expect(context.userIds).toEqual(['1']);
    expect(context.opportunityId).toEqual(
      '123e4567-e89b-12d3-a456-426614174000',
    );
    expect(context.description).toEqual(
      'This is a warm introduction based on your profile',
    );
    expect(context.recruiter).toEqual(
      expect.objectContaining({
        id: 'recruiter123',
        name: 'John Recruiter',
        email: 'recruiter@test.com',
      }),
    );
    expect(context.organization).toEqual(
      expect.objectContaining({
        id: 'e34d0a84-89ea-4ba3-ba6e-1b8fe9ac952f',
        name: 'Test Organization',
        image: 'https://example.com/org.png',
      }),
    );
  });

  it('should handle missing recruiter gracefully', async () => {
    const organization = await con.getRepository(Organization).save({
      id: 'org456',
      name: 'Another Organization',
      image: 'https://example.com/another-org.png',
    });

    await con.getRepository(OpportunityJob).save({
      id: '123e4567-e89b-12d3-a456-426614174001',
      type: OpportunityType.JOB,
      state: OpportunityState.LIVE,
      title: 'Backend Developer',
      tldr: 'Great backend role',
      content: {},
      meta: {},
      organizationId: organization.id,
      location: [],
    });

    const result =
      await invokeTypedNotificationWorker<'gondul.v1.warm-intro-generated'>(
        worker,
        new WarmIntro({
          userId: '1',
          opportunityId: '123e4567-e89b-12d3-a456-426614174001',
          description: 'Introduction without recruiter',
        }),
      );

    expect(result!.length).toEqual(1);
    expect(result![0].type).toEqual(NotificationType.WarmIntro);

    const context = result![0].ctx as NotificationWarmIntroContext;

    expect(context.userIds).toEqual(['1']);
    expect(context.opportunityId).toEqual(
      '123e4567-e89b-12d3-a456-426614174001',
    );
    expect(context.description).toEqual('Introduction without recruiter');
    expect(context.recruiter).toBeUndefined();
    expect(context.organization).toEqual(
      expect.objectContaining({
        id: 'org456',
        name: 'Another Organization',
      }),
    );
  });

  it('should return undefined when opportunity not found', async () => {
    const result =
      await invokeTypedNotificationWorker<'gondul.v1.warm-intro-generated'>(
        worker,
        new WarmIntro({
          userId: '1',
          opportunityId: '123e4567-e89b-12d3-a456-426614174005',
          description: 'This should fail',
        }),
      );

    expect(result).toBeUndefined();
  });

  it('should handle missing optional description', async () => {
    const organization = await con.getRepository(Organization).save({
      id: 'org789',
      name: 'Test Org',
    });

    await con.getRepository(OpportunityJob).save({
      id: '123e4567-e89b-12d3-a456-426614174006',
      type: OpportunityType.JOB,
      state: OpportunityState.LIVE,
      title: 'Frontend Developer',
      tldr: 'Frontend role',
      content: {},
      meta: {},
      organizationId: organization.id,
      location: [],
    });

    const result =
      await invokeTypedNotificationWorker<'gondul.v1.warm-intro-generated'>(
        worker,
        new WarmIntro({
          userId: '1',
          opportunityId: '123e4567-e89b-12d3-a456-426614174006',
        }),
      );

    expect(result!.length).toEqual(1);
    expect(result![0].type).toEqual(NotificationType.WarmIntro);

    const context = result![0].ctx as NotificationWarmIntroContext;

    expect(context.userIds).toEqual(['1']);
    expect(context.opportunityId).toEqual(
      '123e4567-e89b-12d3-a456-426614174006',
    );
    expect(context.description).toBe('');
  });

  it('should convert markdown description to HTML in applicationRank', async () => {
    const organization = await con.getRepository(Organization).save({
      id: 'org999',
      name: 'Test Company',
    });

    const opportunity = await con.getRepository(OpportunityJob).save({
      id: '123e4567-e89b-12d3-a456-426614174007',
      type: OpportunityType.JOB,
      state: OpportunityState.LIVE,
      title: 'React Engineer',
      tldr: 'Senior React position',
      content: {},
      meta: {},
      organizationId: organization.id,
      location: [],
    });

    // Create OpportunityMatch to be updated by the worker
    await con.getRepository(OpportunityMatch).save({
      userId: '1',
      opportunityId: opportunity.id,
      applicationRank: {},
    });

    const markdownDescription = `We're excited to introduce you both! This connection was made possible through daily.dev, where both sides opted in after careful consideration.\n\n**Ole-Martin**, meet your applicant—a developer who's expressed strong interest in group management and leadership opportunities. After reviewing their profile, we believe they bring valuable experience that aligns with the collaborative and team-oriented nature of this React engineering role.\n\n**To our applicant**, meet Ole-Martin, a Software Engineer at the company. Ole-Martin and the team are looking for someone with 5+ years of React experience to lead frontend initiatives, optimize performance, and work closely with cross-functional teams. While the role is technically focused, it offers significant opportunities to influence architecture decisions and collaborate across the organization—areas where leadership and team coordination are essential.\n\nWe've facilitated this introduction because we see strong potential for alignment between your background and what the team needs. From here, we'll step back and let Ole-Martin take the lead on next steps.\n\nLooking forward to seeing where this conversation goes!`;

    await invokeTypedNotificationWorker<'gondul.v1.warm-intro-generated'>(
      worker,
      new WarmIntro({
        userId: '1',
        opportunityId: opportunity.id,
        description: markdownDescription,
      }),
    );

    const match = await con.getRepository(OpportunityMatch).findOne({
      where: {
        userId: '1',
        opportunityId: opportunity.id,
      },
    });

    expect(match).toBeDefined();
    expect(match!.applicationRank).toBeDefined();
    expect(match!.applicationRank.warmIntro).toBeDefined();

    const htmlContent = match!.applicationRank.warmIntro;

    // Verify markdown was converted to HTML
    expect(htmlContent).toContain('<p>');
    expect(htmlContent).toContain('<strong>Ole-Martin</strong>');
    expect(htmlContent).toContain('<strong>To our applicant</strong>');
    expect(htmlContent).not.toContain('**Ole-Martin**');
    expect(htmlContent).not.toContain('**To our applicant**');
  });
});
