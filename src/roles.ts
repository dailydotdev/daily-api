export enum Roles {
  Moderator = 'moderator',
}

export enum SourceMemberRoles {
  Owner = 'owner',
  Moderator = 'moderator',
  Member = 'member',
  Blocked = 'blocked',
}

export const sourceRoleRank: Record<SourceMemberRoles, number> = {
  owner: 10,
  moderator: 5,
  member: 0,
  blocked: -1,
};

export const sourceRoleRankKeys = Object.keys(sourceRoleRank);
