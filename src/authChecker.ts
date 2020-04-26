import { AuthChecker } from 'type-graphql';
import { Context } from './Context';

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

  const userRoles = await context.getRoles();
  return roles.findIndex((r) => userRoles.indexOf(r) > -1) > -1;
};
