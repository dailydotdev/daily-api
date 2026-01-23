import { AuthenticationError, ForbiddenError } from 'apollo-server-errors';
import type { EntityManager } from 'typeorm';
import { OpportunityUser } from '../../entity/opportunities/user';
import { OpportunityUserType } from '../../entity/opportunities/types';
import { ConflictError, NotFoundError } from '../../errors';
import { Opportunity } from '../../entity/opportunities/Opportunity';
import { OpportunityMatch } from '../../entity/OpportunityMatch';
import { OpportunityState } from '@dailydotdev/schema';

export enum OpportunityPermissions {
  Edit = 'opportunity_edit',
  UpdateState = 'opportunity_update_state',
  ViewDraft = 'opportunity_view_draft',
  CreateSlackChannel = 'opportunity_create_slack_channel',
  Apply = 'opportunity_apply',
}

export const ensureOpportunityPermissions = async ({
  con,
  userId,
  opportunityId,
  permission,
  isTeamMember,
}: {
  con: EntityManager;
  userId: string;
  permission: OpportunityPermissions;
  opportunityId: string;
  isTeamMember?: boolean;
}) => {
  if (!userId) {
    throw new AuthenticationError('Authentication required!');
  }

  if (!opportunityId) {
    throw new NotFoundError('Not found!');
  }

  // Team members have access to all opportunities
  if (isTeamMember) {
    return;
  }

  if (permission === OpportunityPermissions.Apply) {
    const existingMatch = await con.getRepository(OpportunityMatch).exists({
      where: { opportunityId, userId },
    });

    if (existingMatch) {
      throw new ConflictError('You have already applied to this opportunity');
    }

    return;
  }

  if (
    [
      OpportunityPermissions.Edit,
      OpportunityPermissions.UpdateState,
      OpportunityPermissions.ViewDraft,
      OpportunityPermissions.CreateSlackChannel,
    ].includes(permission)
  ) {
    const opportunityUserQb = con
      .getRepository(OpportunityUser)
      .createQueryBuilder('ou')
      .select('ou.type', 'userType')
      .where('"userId" = :userId', { userId })
      .andWhere('"opportunityId" = :opportunityId', { opportunityId })
      .andWhere('ou.type = :type', { type: OpportunityUserType.Recruiter });

    if (permission === OpportunityPermissions.Edit) {
      opportunityUserQb
        .innerJoin(Opportunity, 'o', 'o.id = ou."opportunityId"')
        .addSelect('o.state', 'state');
    }

    const opportunityUser = await opportunityUserQb.getRawOne<{
      userType: OpportunityUserType;
      state?: OpportunityState;
    }>();

    if (opportunityUser) {
      if (
        permission === OpportunityPermissions.Edit &&
        opportunityUser.state !== OpportunityState.DRAFT
      ) {
        throw new ConflictError(
          'Only opportunities in draft state can be edited',
        );
      }

      return;
    }
  }

  throw new ForbiddenError('Access denied!');
};
