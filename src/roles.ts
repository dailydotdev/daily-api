export enum Roles {
  Moderator = 'moderator',
}

export enum SourceMemberRoles {
  Owner = 'owner',
  Moderator = 'moderator',
  Member = 'member',
}

export const sourceRoleRank: Record<SourceMemberRoles, number> = {
  owner: 10,
  moderator: 5,
  member: 0,
};

export const sourceRoleRankKeys = Object.keys(sourceRoleRank);
