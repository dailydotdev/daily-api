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

  // If either role is not found in the hierarchy, or the user's role is below the required role
  if (
    userRoleIndex === -1 ||
    requiredRoleIndex === -1 ||
    userRoleIndex > requiredRoleIndex
  ) {
    return false;
  }

  // User's role is at or above the required role
  return true;
};
