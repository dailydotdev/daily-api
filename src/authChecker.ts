import { AuthChecker } from 'type-graphql';
import { Context } from './Context';
import { fetchUserRoles } from './users';

export enum Roles {
  Moderator = 'moderator',
}

export const authChecker: AuthChecker<Context, Roles> = async (
  { context },
  roles,
) => {
  if (!context.userId) {
    return false;
  }
  if (!roles.length) {
    return true;
  }

  const userRoles = await fetchUserRoles(context.userId);
  return roles.findIndex((r) => userRoles.indexOf(r) > -1) > -1;
};
