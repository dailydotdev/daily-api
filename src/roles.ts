export enum Roles {
  Moderator = 'moderator',
}

export enum SourceMemberRoles {
  Admin = 'admin',
  Moderator = 'moderator',
  Member = 'member',
  Blocked = 'blocked',
}

export enum OrganizationMemberRole {
  Owner = 'owner',
  Admin = 'admin',
  Member = 'member',
}

export const organizationRoleHierarchy = [
  OrganizationMemberRole.Owner,
  OrganizationMemberRole.Admin,
  OrganizationMemberRole.Member,
];

export const sourceRoleRank: Record<SourceMemberRoles, number> = {
  admin: 10,
  moderator: 5,
  member: 0,
  blocked: -1,
};

export const sourceRoleRankKeys = Object.keys(sourceRoleRank);

export const rankToSourceRole = Object.entries(sourceRoleRank).reduce(
  (acc, [key, value]) => {
    acc[value] = key as SourceMemberRoles;

    return acc;
  },
  {} as Record<number, SourceMemberRoles>,
);

export const isRoleAtLeast = (
  userRole: string,
  requiredRole: string,
  hierarchy: string[],
): boolean => {
  const userRoleIndex = hierarchy.indexOf(userRole);
  const requiredRoleIndex = hierarchy.indexOf(requiredRole);

  const roleNotFound = userRoleIndex === -1 || requiredRoleIndex === -1;

  // If either role is not found, we cannot determine the hierarchy,
  // and must deny access
  if (roleNotFound) {
    return false;
  }

  // If the user role is found, we check if it is at least the required role
  // by comparing their indices in the hierarchy
  const isPermitted = userRoleIndex <= requiredRoleIndex;

  return isPermitted;
};
