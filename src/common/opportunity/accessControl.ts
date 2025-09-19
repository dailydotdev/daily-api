import { AuthenticationError, ForbiddenError } from 'apollo-server-errors';
import type { EntityManager } from 'typeorm';
import { OpportunityUser } from '../../entity/opportunities/user';
import { OpportunityUserType } from '../../entity/opportunities/types';
import { NotFoundError } from '../../errors';

export enum OpportunityPermissions {
  Edit = 'opportunity_edit',
}

export const ensureOpportunityPermissions = async ({
  con,
  userId,
  opportunityId,
  permission,
}: {
  con: EntityManager;
  userId: string;
  permission: OpportunityPermissions;
  opportunityId: string;
}) => {
  if (!userId) {
    throw new AuthenticationError('Authentication required!');
  }

  if (!opportunityId) {
    throw new NotFoundError('Not found!');
  }

  if ([OpportunityPermissions.Edit].includes(permission)) {
    const opportunityUser = await con.getRepository(OpportunityUser).findOne({
      where: {
        userId,
        type: OpportunityUserType.Recruiter,
        opportunityId,
      },
    });

    if (opportunityUser) {
      return;
    }
  }

  throw new ForbiddenError('Access denied!');
};
