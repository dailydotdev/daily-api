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
