import { expectSuccessfulTypedBackground, saveFixtures } from '../../helpers';
import { organizationUserRemoved as worker } from '../../../src/workers/organization/organizationUserRemoved';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../../src/db';
import { Feed, Organization, User } from '../../../src/entity';

import { usersFixture } from '../../fixture/user';
import { typedWorkers } from '../../../src/workers';
import {
  CioTransactionalMessageTemplateId,
  sendEmail,
} from '../../../src/common';
import { SubscriptionCycles } from '../../../src/paddle';
import { SubscriptionStatus } from '../../../src/common/plus';
import {
  ContentPreferenceOrganization,
  ContentPreferenceOrganizationStatus,
} from '../../../src/entity/contentPreference/ContentPreferenceOrganization';
import { OrganizationMemberRole } from '../../../src/roles';
import { logger } from '../../../src/logger';

jest.mock('../../../src/common', () => ({
  ...(jest.requireActual('../../../src/common') as Record<string, unknown>),
  sendEmail: jest.fn(),
}));

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

describe('organizationUserRemoved worker', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    await saveFixtures(con, User, usersFixture);

    await saveFixtures(con, Organization, [
      {
        id: '8d02f0a0-6c44-40e9-9c40-80bc8e8cc2e8',
        seats: 1,
        name: 'Organization 1',
        subscriptionFlags: {
          cycle: SubscriptionCycles.Yearly,
          status: SubscriptionStatus.Active,
        },
      },
      {
        id: '2b243220-ca5a-44c5-957e-47743243e995',
        seats: 1,
        name: 'Organization 2',
        subscriptionFlags: {
          cycle: SubscriptionCycles.Yearly,
          status: SubscriptionStatus.Active,
        },
      },
    ]);

    await con.getRepository(Feed).save([
      {
        id: '1',
        userId: '1',
      },
      {
        id: '2',
        userId: '2',
      },
    ]);

    await con.getRepository(ContentPreferenceOrganization).save([
      {
        userId: '1',
        referenceId: '8d02f0a0-6c44-40e9-9c40-80bc8e8cc2e8',
        organizationId: '8d02f0a0-6c44-40e9-9c40-80bc8e8cc2e8',
        feedId: '1',
        status: ContentPreferenceOrganizationStatus.Plus,
        flags: {
          role: OrganizationMemberRole.Owner,
          referralToken: 'ref-token-1',
        },
      },
      {
        userId: '2',
        referenceId: '8d02f0a0-6c44-40e9-9c40-80bc8e8cc2e8',
        organizationId: '8d02f0a0-6c44-40e9-9c40-80bc8e8cc2e8',
        feedId: '2',
        status: ContentPreferenceOrganizationStatus.Plus,
        flags: {
          role: OrganizationMemberRole.Member,
          referralToken: 'ref-token-2',
        },
      },
      {
        userId: '2',
        referenceId: '2b243220-ca5a-44c5-957e-47743243e995',
        organizationId: '2b243220-ca5a-44c5-957e-47743243e995',
        feedId: '2',
        status: ContentPreferenceOrganizationStatus.Plus,
        flags: {
          role: OrganizationMemberRole.Member,
          referralToken: 'ref-token-2',
        },
      },
    ]);
  });

  it('should be registered', () => {
    const registeredWorker = typedWorkers.find(
      (item) => item.subscription === worker.subscription,
    );

    expect(registeredWorker).toBeDefined();
  });

  it('should do nothing if organization not found', async () => {
    const warnSpy = jest.spyOn(logger, 'error');

    await expectSuccessfulTypedBackground(worker, {
      organizationId: '87b79108-d258-42d2-b38a-4a02974746cc',
      memberId: '1',
    });

    expect(sendEmail).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      {
        organizationId: '87b79108-d258-42d2-b38a-4a02974746cc',
      },
      'Organization not found',
    );
  });

  it('should do nothing if user not found', async () => {
    const warnSpy = jest.spyOn(logger, 'error');

    await expectSuccessfulTypedBackground(worker, {
      organizationId: '8d02f0a0-6c44-40e9-9c40-80bc8e8cc2e8',
      memberId: '87b79108-d258-42d2-b38a-4a02974746cc',
    });

    expect(sendEmail).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      {
        userId: '87b79108-d258-42d2-b38a-4a02974746cc',
      },
      'User not found',
    );
  });

  it('should send email when user is removed from organization', async () => {
    const user = usersFixture[0];

    await expectSuccessfulTypedBackground(worker, {
      organizationId: '8d02f0a0-6c44-40e9-9c40-80bc8e8cc2e8',
      memberId: '1',
    });

    expect(sendEmail).toHaveBeenCalled();
    expect(sendEmail).toHaveBeenCalledWith({
      send_to_unsubscribed: false,
      transactional_message_id:
        CioTransactionalMessageTemplateId.OrganizationMemberRemoved,
      message_data: {
        organization: {
          name: 'Organization 1',
        },
      },
      identifiers: {
        id: user.id,
      },
      to: user.email,
    });
  });
});
