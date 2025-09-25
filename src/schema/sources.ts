import { ForbiddenError, ValidationError } from 'apollo-server-errors';
import { IResolvers } from '@graphql-tools/utils';
import { ConnectionArguments } from 'graphql-relay';
import { AuthContext, BaseContext, Context } from '../Context';
import {
  BRIEFING_SOURCE,
  createSharePost,
  NotificationPreferenceSource,
  REPUTATION_THRESHOLD,
  Source,
  SourceFeed,
  SourceFlagsPublic,
  SourceMember,
  SourceMemberFlagsPublic,
  SquadSource,
  User,
} from '../entity';
import { SourceType, SourceUser } from '../entity/Source';
import {
  SourceMemberRoles,
  sourceRoleRank,
  sourceRoleRankKeys,
} from '../roles';
import { GQLEmptyResponse, offsetPageGenerator } from './common';
import graphorm from '../graphorm';
import {
  DataSource,
  DeepPartial,
  EntityManager,
  EntityNotFoundError,
  FindOptionsWhere,
  In,
  Not,
  Raw,
} from 'typeorm';
import { GQLUser } from './users';
import { Connection } from 'graphql-relay/index';
// @ts-expect-error - no types
import { FileUpload } from 'graphql-upload/GraphQLUpload';
import { randomUUID } from 'crypto';
import {
  createSquadWelcomePost,
  getSourceLink,
  mapCloudinaryUrl,
  updateFlagsStatement,
  uploadSquadHeaderImage,
  uploadSquadImage,
} from '../common';
import { toGQLEnum } from '../common/utils';
import { GraphQLResolveInfo } from 'graphql';
import {
  SourcePermissionErrorKeys,
  SourceRequestErrorMessage,
  TypeOrmError,
  TypeORMQueryFailedError,
} from '../errors';
import {
  descriptionRegex,
  isNullOrUndefined,
  nameRegex,
  validateRegex,
  ValidateRegex,
} from '../common/object';
import { validateAndTransformHandle } from '../common/handles';
import { QueryBuilder } from '../graphorm/graphorm';
import type { GQLTagResults } from './tags';
import { MIN_SEARCH_QUERY_LENGTH } from './tags';
import { SourceTagView } from '../entity/SourceTagView';
import { TrendingSource } from '../entity/TrendingSource';
import { PopularSource } from '../entity/PopularSource';
import { PopularVideoSource } from '../entity/PopularVideoSource';
import { EntityTarget } from 'typeorm/common/EntityTarget';
import { traceResolvers } from './trace';
import { SourceCategory } from '../entity/sources/SourceCategory';
import { validate } from 'uuid';
import { ContentPreferenceStatus } from '../entity/contentPreference/types';
import { ContentPreferenceSource } from '../entity/contentPreference/ContentPreferenceSource';
import {
  cleanContentNotificationPreference,
  entityToNotificationTypeMap,
} from '../common/contentPreference';
import { getSearchLimit } from '../common/search';
import {
  SourcePostModeration,
  SourcePostModerationStatus,
} from '../entity/SourcePostModeration';
import { remoteConfig } from '../remoteConfig';
import { GQLCommentAwardArgs } from './comments';
import { UserTransaction } from '../entity/user/UserTransaction';
import { UserVote } from '../types';

export interface GQLSourceCategory {
  id: string;
  title: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface GQLUserAward {
  vote: UserVote;
  votedAt: Date | null;
  awarded: boolean;
}

export interface GQLSource {
  id: string;
  type: SourceType;
  name: string;
  handle: string;
  image?: string;
  private: boolean;
  public: boolean;
  members?: Connection<GQLSourceMember>;
  currentMember?: GQLSourceMember;
  privilegedMembers?: GQLSourceMember[];
  referralUrl?: string;
  flags?: SourceFlagsPublic;
  description?: string;
  moderationRequired?: boolean;
  moderationPostCount?: number;
}

export interface GQLSourceMember {
  source: GQLSource;
  user: GQLUser;
  role: SourceMemberRoles;
  createdAt: Date;
  referralToken: string;
  flags?: SourceMemberFlagsPublic;
}

interface UpdateMemberRoleArgs {
  sourceId: string;
  memberId: string;
  role: SourceMemberRoles;
}

interface SourceMemberArgs extends ConnectionArguments {
  sourceId: string;
  query?: string;
  role?: SourceMemberRoles;
}

export const typeDefs = /* GraphQL */ `
  """
  flags property of Source entity
  """
  type SourceFlagsPublic {
    featured: Boolean
    totalViews: Int
    totalPosts: Int
    totalUpvotes: Int
    totalMembers: Int
    totalAwards: Int
    campaignId: String
  }

  type SourceCategory {
    id: ID!
    slug: String!
    title: String!
    enabled: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime
  }

  """
  Source to discover posts from (usually blogs)
  """
  type Source {
    """
    Short unique string to identify the source
    """
    id: ID!

    """
    Date of when the source was created
    """
    createdAt: DateTime

    """
    Some properties can be stored as an object, and the flag contains the source stats
    """
    flags: SourceFlagsPublic

    """
    Source type (machine/squad)
    """
    type: String!

    """
    Name of the source
    """
    name: String!

    """
    URL to an avatar image of the source
    """
    image: String!

    """
    Whether the source is public
    """
    public: Boolean

    """
    URL to an header image of the source
    """
    headerImage: String

    """
    Accent color that applies to the source
    """
    color: String

    """
    Whether the source is active or not (applicable for squads)
    """
    active: Boolean

    """
    Source handle (applicable for squads)
    """
    handle: String!

    """
    Source description
    """
    description: String

    """
    Source members
    """
    members: SourceMemberConnection

    """
    URL to the source page
    """
    permalink: String!

    """
    Number of members in the source
    """
    membersCount: Int!

    """
    Logged-in member object
    """
    currentMember: SourceMember

    """
    Privileged members
    """
    privilegedMembers: [SourceMember]

    """
    Role required for members to post
    """
    memberPostingRole: String

    """
    Role required for members to invite
    """
    memberInviteRole: String

    """
    Enable post moderation for the squad
    """
    moderationRequired: Boolean

    """
    Count of post waiting for moderation
    """
    moderationPostCount: Int

    """
    URL for inviting and referring new users
    """
    referralUrl: String

    """
    Category that the source/squad belongs to
    """
    category: SourceCategory
  }

  type SourceConnection {
    pageInfo: PageInfo!
    edges: [SourceEdge!]!
  }

  type SourceEdge {
    node: Source!

    """
    Used in \`before\` and \`after\` args
    """
    cursor: String!
  }

  type SourceCategoryConnection {
    pageInfo: PageInfo!
    edges: [SourceCategoryEdge!]!
  }

  type SourceCategoryEdge {
    node: SourceCategory!

    """
    Used in \`before\` and \`after\` args
    """
    cursor: String!
  }

  type SourceMemberFlagsPublic {
    """
    Whether the source posts are hidden from feed for member
    """
    hideFeedPosts: Boolean
    """
    Whether the source pinned posts are collapsed or not
    """
    collapsePinnedPosts: Boolean
    """
    Whether the source has unread posts for member
    """
    hasUnreadPosts: Boolean
  }

  type SourceMember {
    """
    Relevant user who is part of the source
    """
    user: User!
    """
    Source the user belongs to
    """
    source: Source!
    """
    Role of this user in the source
    """
    role: String!
    """
    Token to be used for inviting new squad members
    """
    referralToken: String
    """
    Numerical representation of the user's role
    """
    roleRank: Int
    """
    User squad permissions
    """
    permissions: [String]

    """
    All the flags for source member
    """
    flags: SourceMemberFlagsPublic
  }

  type SourceMemberConnection {
    pageInfo: PageInfo!
    edges: [SourceMemberEdge!]!
  }

  type SourceMemberEdge {
    node: SourceMember!

    """
    Used in \`before\` and \`after\` args
    """
    cursor: String!
  }

  type TagResults {
    """
    Results
    """
    hits: [Tag]!
  }

  ${toGQLEnum(SourceType, 'SourceType')}

  type UserSourceEdge {
    node: UserTransaction!
    """
    Used in before and after args
    """
    cursor: String!
  }
  type UserSourceConnection {
    pageInfo: PageInfo!
    edges: [UserSourceEdge!]!
    """
    The original query in case of a search operation
    """
    query: String
  }

  type SourceBalance {
    amount: Int!
  }

  extend type Query {
    """
    Get all available sources
    """
    sources(
      """
      Paginate after opaque cursor
      """
      after: String

      """
      Paginate first
      """
      first: Int

      """
      Fetch public Squads
      """
      filterOpenSquads: Boolean

      """
      Add filter for featured sources
      """
      featured: Boolean

      """
      Filter by category
      """
      categoryId: String

      """
      Sort by the number of members count in descending order
      """
      sortByMembersCount: Boolean
    ): SourceConnection!

    """
    Get available sources for given query
    """
    searchSources(
      """
      Search query
      """
      query: String!

      """
      Limit the number of sources returned
      """
      limit: Int
    ): [Source] @cacheControl(maxAge: 600)

    """
    Get source recommendation based on given tags
    """
    sourceRecommendationByTags(
      """
      Tags to recommend sources for
      """
      tags: [String]!

      """
      Limit the number of sources returned
      """
      limit: Int
    ): [Source] @cacheControl(maxAge: 600)

    """
    Get the most recent sources
    """
    mostRecentSources(
      """
      Limit the number of sources returned
      """
      limit: Int
    ): [Source] @cacheControl(maxAge: 600)

    """
    Get the most trending sources
    """
    trendingSources(
      """
      Limit the number of sources returned
      """
      limit: Int
    ): [Source] @cacheControl(maxAge: 600)

    """
    Get the most popular sources
    """
    popularSources(
      """
      Limit the number of sources returned
      """
      limit: Int
    ): [Source] @cacheControl(maxAge: 600)

    """
    Get top video sources
    """
    topVideoSources(
      """
      Limit the number of sources returned
      """
      limit: Int
    ): [Source] @cacheControl(maxAge: 600)

    """
    Get the source that matches the feed
    """
    sourceByFeed(feed: String!): Source @auth

    """
    Get top sources covering this tag
    """
    sourcesByTag(
      """
      Tag for which you want to find top sources
      """
      tag: String!

      """
      Exclude these sources
      """
      excludeSources: [String]

      """
      Paginate after opaque cursor
      """
      after: String

      """
      Paginate first
      """
      first: Int
    ): SourceConnection!

    """
    Get sources similar to this source
    """
    similarSources(
      """
      Source to find similar sources for
      """
      sourceId: ID!

      """
      Exclude these sources
      """
      excludeSources: [String]

      """
      Paginate after opaque cursor
      """
      after: String

      """
      Paginate first
      """
      first: Int
    ): SourceConnection!

    """
    Get source by ID
    """
    source(id: ID!): Source

    """
    Get source members
    """
    sourceMembers(
      """
      Source ID
      """
      sourceId: ID!

      """
      Paginate after opaque cursor
      """
      after: String

      """
      Paginate first
      """
      first: Int

      """
      Should return users with this specific role only
      """
      role: String

      """
      Property to utilize for searching members
      """
      query: String
    ): SourceMemberConnection!

    """
    Get the logged in user source memberships
    """
    mySourceMemberships(
      """
      Paginate after opaque cursor
      """
      after: String

      """
      Paginate first
      """
      first: Int

      """
      Source type (machine/squad)
      """
      type: SourceType
    ): SourceMemberConnection! @auth

    """
    Get user's public source memberships
    """
    publicSourceMemberships(
      """
      User ID
      """
      userId: ID!

      """
      Paginate after opaque cursor
      """
      after: String

      """
      Paginate first
      """
      first: Int
    ): SourceMemberConnection!

    """
    Get source member by referral token
    """
    sourceMemberByToken(token: String!): SourceMember!

    """
    Get related tags for a source
    """
    relatedTags(sourceId: ID!): TagResults!

    """
    Check if source handle already exists
    """
    sourceHandleExists(handle: String!): Boolean! @auth

    """
    Fetch details of a single category
    """
    sourceCategory(id: String!): SourceCategory!

    """
    Fetch all source categories
    """
    sourceCategories(
      """
      Paginate after opaque cursor
      """
      after: String

      """
      Paginate first
      """
      first: Int
    ): SourceCategoryConnection!

    """
    Get Source Awards by source id
    """
    sourceAwards(
      """
      Id of the relevant source to return Awards
      """
      id: ID!
      """
      Paginate after opaque cursor
      """
      after: String
      """
      Paginate first
      """
      first: Int
    ): UserSourceConnection!

    """
    Get Source Awards count
    """
    sourceAwardsTotal(
      """
      Id of the relevant source to return Awards
      """
      id: ID!
    ): SourceBalance!
  }

  extend type Mutation {
    """
    Creates a new squad
    """
    createSquad(
      """
      Name for the squad
      """
      name: String!
      """
      Unique handle
      """
      handle: String!
      """
      Description for the squad (max 250 chars)
      """
      description: String
      """
      Avatar image for the squad
      """
      image: Upload
      """
      First post to share in the squad
      """
      postId: ID
      """
      Commentary for the first share
      """
      commentary: String
      """
      Role required for members to post
      """
      memberPostingRole: String
      """
      Role required for members to invite
      """
      memberInviteRole: String
      """
      Enable post moderation for the squad
      """
      moderationRequired: Boolean
      """
      Whether the Squad should be private or not
      """
      isPrivate: Boolean
      """
      The category for which the squad belongs to
      """
      categoryId: ID
    ): Source! @auth

    """
    Edit a squad
    """
    editSquad(
      """
      Source to edit
      """
      sourceId: ID!
      """
      Name for the squad
      """
      name: String!
      """
      Unique handle
      """
      handle: String!
      """
      Description for the squad (max 250 chars)
      """
      description: String
      """
      Avatar image for the squad
      """
      image: Upload
      """
      Cover image used in Squads directory
      """
      headerImage: Upload
      """
      Role required for members to post
      """
      memberPostingRole: String
      """
      Role required for members to invite
      """
      memberInviteRole: String
      """
      Enable post moderation for the squad
      """
      moderationRequired: Boolean
      """
      Whether the Squad should be private or not
      """
      isPrivate: Boolean
      """
      The category for which the squad belongs to
      """
      categoryId: ID
    ): Source! @auth

    """
    Set the source member's current role
    """
    updateMemberRole(
      """
      Relevant source the user to update role is a member of
      """
      sourceId: ID!

      """
      Member to update
      """
      memberId: ID!

      """
      Role to update the user to
      """
      role: String!
    ): EmptyResponse! @auth

    """
    Unblock a removed member with blocked role
    """
    unblockMember(
      """
      Relevant source the user to update role is a member of
      """
      sourceId: ID!

      """
      Member to update
      """
      memberId: ID!
    ): EmptyResponse! @auth

    """
    Adds the logged-in user as member to the source
    """
    joinSource(
      """
      Source to join
      """
      sourceId: ID!
      """
      Referral token (required for private squads)
      """
      token: String
    ): Source! @auth

    """
    Deletes a squad
    """
    deleteSource(
      """
      Source to delete
      """
      sourceId: ID!
    ): EmptyResponse! @auth

    """
    Removes the logged-in user as a member from the source
    """
    leaveSource(
      """
      Source to leave
      """
      sourceId: ID!
    ): EmptyResponse! @auth

    """
    Hide source posts from feed for member
    """
    hideSourceFeedPosts(
      """
      Source id to hide posts from
      """
      sourceId: ID!
    ): EmptyResponse! @auth

    """
    Show source posts on feed for member
    """
    showSourceFeedPosts(
      """
      Source id to show posts on feed
      """
      sourceId: ID!
    ): EmptyResponse! @auth

    """
    Collapse source pinned posts
    """
    collapsePinnedPosts(
      """
      Source id to collapse posts in
      """
      sourceId: ID!
    ): EmptyResponse! @auth

    """
    Expand source pinned posts
    """
    expandPinnedPosts(
      """
      Source id to expand posts in
      """
      sourceId: ID!
    ): EmptyResponse! @auth

    """
    Clear unread posts flag for user
    """
    clearUnreadPosts(
      """
      Source id to clear unread posts in
      """
      sourceId: ID!
    ): EmptyResponse! @auth
  }
`;

const sourceToGQL = (source: Source): GQLSource => ({
  ...source,
  public: !source.private,
  members: undefined,
});

export enum SourcePermissions {
  CommentDelete = 'comment_delete',
  View = 'view',
  ViewBlockedMembers = 'view_blocked_members',
  WelcomePostEdit = 'welcome_post_edit',
  Post = 'post',
  PostRequest = 'post_request',
  PostPin = 'post_pin',
  PostLimit = 'post_limit',
  PostDelete = 'post_delete',
  MemberRemove = 'member_remove',
  MemberUnblock = 'member_unblock',
  MemberRoleUpdate = 'member_role_update',
  Invite = 'invite',
  Leave = 'leave',
  Delete = 'delete',
  Edit = 'edit',
  ConnectSlack = 'connect_slack',
  ModeratePost = 'moderate_post',
  BoostSquad = 'boost_squad',
}

const memberPermissions = [
  SourcePermissions.View,
  SourcePermissions.Post,
  SourcePermissions.PostRequest,
  SourcePermissions.Leave,
  SourcePermissions.Invite,
];
const moderatorPermissions = [
  ...memberPermissions,
  SourcePermissions.CommentDelete,
  SourcePermissions.PostDelete,
  SourcePermissions.PostPin,
  SourcePermissions.MemberRemove,
  SourcePermissions.Edit,
  SourcePermissions.MemberUnblock,
  SourcePermissions.ViewBlockedMembers,
  SourcePermissions.WelcomePostEdit,
  SourcePermissions.ModeratePost,
  SourcePermissions.BoostSquad,
];
const adminPermissions = [
  ...moderatorPermissions,
  SourcePermissions.MemberRoleUpdate,
  SourcePermissions.PostLimit,
  SourcePermissions.Delete,
  SourcePermissions.ConnectSlack,
];

export const roleSourcePermissions: Record<
  SourceMemberRoles,
  SourcePermissions[]
> = {
  admin: adminPermissions,
  moderator: moderatorPermissions,
  member: memberPermissions,
  blocked: [],
};

const requireGreaterAccessPrivilege: Partial<
  Record<SourcePermissions, boolean>
> = {
  [SourcePermissions.MemberRemove]: true,
};

type BaseSourceMember = Pick<SourceMember, 'role'>;

export const hasGreaterAccessCheck = (
  loggedUser: BaseSourceMember,
  member: BaseSourceMember,
) => {
  if (loggedUser.role === SourceMemberRoles.Admin) {
    return;
  }

  const memberRank = sourceRoleRank[member.role];
  const loggedUserRank = sourceRoleRank[loggedUser.role];
  const hasGreaterAccess = loggedUserRank > memberRank;

  if (!hasGreaterAccess) {
    throw new ForbiddenError('Access denied!');
  }
};

const hasPermissionCheck = (
  source: Source | GQLSource,
  member: BaseSourceMember,
  permission: SourcePermissions,
  validateRankAgainst?: BaseSourceMember,
) => {
  if (validateRankAgainst) {
    hasGreaterAccessCheck(member, validateRankAgainst);
  }

  const rolePermissions = roleSourcePermissions[member.role];

  return rolePermissions?.includes?.(permission);
};

export const sourceTypesWithMembers = ['squad'];

export const canAccessSource = async (
  ctx: Context,
  source: Source,
  member: SourceMember | null,
  permission: SourcePermissions,
  validateRankAgainstId?: string,
): Promise<boolean> => {
  if (permission === SourcePermissions.View && !source.private) {
    if (sourceTypesWithMembers.includes(source.type)) {
      const isMemberBlocked = member?.role === SourceMemberRoles.Blocked;
      return !isMemberBlocked;
    }

    return true;
  }

  if (!member) {
    return false;
  }

  const sourceId = source.id;
  const repo = ctx.con.getRepository(SourceMember);
  const validateRankAgainst = await (requireGreaterAccessPrivilege[permission]
    ? repo.findOneByOrFail({ sourceId, userId: validateRankAgainstId })
    : Promise.resolve(undefined));

  return hasPermissionCheck(source, member, permission, validateRankAgainst);
};

export const canModeratePosts = async (
  ctx: Context,
  moderationIds: string[],
): Promise<boolean> => {
  const posts = await ctx.con.getRepository(SourcePostModeration).find({
    where: { id: In(moderationIds) },
    select: ['sourceId'],
  });

  if (!posts.length) {
    return false;
  }

  const sourceIds = Array.from(new Set(posts.map((p) => p.sourceId)));

  const memberships = await ctx.con.getRepository(SourceMember).find({
    where: {
      sourceId: In(sourceIds),
      userId: ctx.userId,
    },
    select: ['role'],
  });

  if (!memberships.length || memberships.length !== sourceIds.length) {
    return false;
  }

  return memberships.every(
    (m) => sourceRoleRank[m.role] >= sourceRoleRank.moderator,
  );
};

export const isPrivilegedMember = async (
  ctx: Context,
  sourceId: string,
): Promise<boolean> => {
  const sourceMember = await ctx.con
    .getRepository(SourceMember)
    .findOneBy({ sourceId: sourceId, userId: ctx.userId });

  if (!sourceMember)
    throw new ForbiddenError(SourceRequestErrorMessage.ACCESS_DENIED);

  return sourceRoleRank[sourceMember.role] >= sourceRoleRank.moderator;
};

type PostPermissions = SourcePermissions.Post | SourcePermissions.PostRequest;

export const canPostToSquad = (
  squad: SquadSource,
  sourceMember: SourceMember | null,
  permission: PostPermissions = SourcePermissions.Post,
): boolean => {
  if (!sourceMember) {
    return false;
  }

  const memberRank = sourceRoleRank[sourceMember.role];

  if (squad.moderationRequired) {
    if (memberRank === sourceRoleRank.member) {
      return permission === SourcePermissions.PostRequest;
    }
  }

  return memberRank >= squad.memberPostingRank;
};

const validateSquadData = async (
  {
    handle,
    name,
    description,
    memberPostingRole,
    memberInviteRole,
    categoryId,
  }: Pick<SquadSource, 'handle' | 'name' | 'description' | 'categoryId'> & {
    memberPostingRole?: SourceMemberRoles;
    memberInviteRole?: SourceMemberRoles;
    moderationRequired?: boolean;
  },
  entityManager: DataSource | EntityManager,
  handleChanged = true,
): Promise<string> => {
  if (handleChanged) {
    handle = await validateAndTransformHandle(handle, 'handle', entityManager);
  }
  const regexParams: ValidateRegex[] = [
    ['name', name, nameRegex, true],
    ['description', description, descriptionRegex, false],
  ];

  validateRegex(regexParams);

  if (categoryId) {
    const isValid = validate(categoryId);

    if (!isValid) {
      throw new ValidationError('Invalid category ID');
    }

    await entityManager
      .getRepository(SourceCategory)
      .findOneByOrFail({ id: categoryId });
  }

  if (
    typeof memberPostingRole !== 'undefined' &&
    !sourceRoleRankKeys.includes(memberPostingRole)
  ) {
    throw new ValidationError('Invalid member posting role');
  }

  if (
    typeof memberInviteRole !== 'undefined' &&
    !sourceRoleRankKeys.includes(memberInviteRole)
  ) {
    throw new ValidationError('Invalid member invite role');
  }

  return handle;
};

const postPermissions = [SourcePermissions.Post, SourcePermissions.PostRequest];

export const ensureSourcePermissions = async (
  ctx: Context,
  sourceId: string | undefined,
  permission: SourcePermissions = SourcePermissions.View,
  validateRankAgainstId?: string,
): Promise<Source> => {
  if (sourceId) {
    const source = await ctx.con
      .getRepository(Source)
      .findOneByOrFail([{ id: sourceId }, { handle: sourceId }]);

    if (
      source.id === BRIEFING_SOURCE &&
      permission === SourcePermissions.ConnectSlack
    ) {
      return source;
    }

    const sourceMember = ctx.userId
      ? await ctx.con
          .getRepository(SourceMember)
          .findOneBy({ sourceId: source.id, userId: ctx.userId })
      : null;

    const canAccess = await canAccessSource(
      ctx,
      source,
      sourceMember,
      permission,
      validateRankAgainstId,
    );

    if (!canAccess) {
      throw new ForbiddenError('Access denied!');
    }

    if (
      source.type === SourceType.Squad &&
      postPermissions.includes(permission) &&
      !canPostToSquad(
        source as SquadSource,
        sourceMember,
        permission as PostPermissions,
      )
    ) {
      throw new ForbiddenError('Posting not allowed!');
    }

    return source;
  }
  throw new ForbiddenError('Access denied!');
};

export const ensureUserSourceExists = async (
  userId: string,
  con: DataSource,
) => {
  const source = await con.getRepository(SourceUser).findOneBy({
    id: userId,
    userId,
  });
  if (source) {
    return;
  }

  return con.transaction(async (entityManager) => {
    const user = await entityManager
      .getRepository(User)
      .findOneByOrFail({ id: userId });

    await entityManager
      .createQueryBuilder()
      .insert()
      .into(SourceUser)
      .values({
        id: user.id,
        userId: user.id,
        handle: user.id,
        name: user.id,
        type: SourceType.User,
        private: false,
        flags: {
          publicThreshold:
            user.reputation >= REPUTATION_THRESHOLD && !user.flags.vordr,
          vordr: user.flags.vordr ?? false,
        },
      })
      .orIgnore()
      .execute();

    const referralToken = randomUUID();

    await entityManager
      .createQueryBuilder()
      .insert()
      .into(SourceMember)
      .values({
        sourceId: user.id,
        userId: user.id,
        role: SourceMemberRoles.Admin,
        referralToken: referralToken,
      })
      .orIgnore()
      .execute();

    await entityManager
      .createQueryBuilder()
      .insert()
      .into(ContentPreferenceSource)
      .values({
        referenceId: user.id,
        userId: user.id,
        status: ContentPreferenceStatus.Subscribed,
        feedId: user.id,
        sourceId: user.id,
        flags: {
          role: SourceMemberRoles.Admin,
          referralToken: referralToken,
        },
      })
      .orIgnore()
      .execute();
  });
};

const sourceByFeed = async (
  feed: string,
  ctx: Context,
): Promise<GQLSource | null> => {
  const res = await ctx.con
    .createQueryBuilder()
    .select('source.*')
    .from(Source, 'source')
    .innerJoin(SourceFeed, 'sf', 'source.id = sf."sourceId"')
    .where('sf.feed = :feed and source.private = false', { feed })
    .getRawOne();
  return res ? sourceToGQL(res) : null;
};

const membershipsPageGenerator = offsetPageGenerator<GQLSourceMember>(100, 500);

const sourcePageGenerator = offsetPageGenerator<GQLSource>(100, 500);

const categoriesPageGenerator = offsetPageGenerator<GQLSourceCategory>(15, 50);

interface SquadInputArgs {
  name: string;
  handle: string;
  description?: string;
  image?: FileUpload;
  memberPostingRole?: SourceMemberRoles;
  memberInviteRole?: SourceMemberRoles;
  moderationRequired?: boolean;
  isPrivate?: boolean;
  categoryId?: string;
}

interface SquadCreateInputArgs extends SquadInputArgs {
  postId?: string;
  commentary?: string;
}

interface SquadEditInputArgs extends SquadInputArgs {
  sourceId: string;
  headerImage?: FileUpload;
}

const getSourceById = async (
  ctx: Context,
  info: GraphQLResolveInfo,
  id: string,
): Promise<GQLSource> => {
  const res = await graphorm.query<GQLSource>(ctx, info, (builder) => {
    builder.queryBuilder = builder.queryBuilder
      .andWhere('(id = :id or handle = :id)', { id })
      .limit(1);
    return builder;
  });
  if (!res.length) {
    throw new EntityNotFoundError(Source, 'not found');
  }
  return res[0];
};

export const addNewSourceMember = async (
  con: DataSource | EntityManager,
  member: Omit<DeepPartial<SourceMember>, 'referralToken'>,
): Promise<void> => {
  const contentPreference = await con
    .getRepository(ContentPreferenceSource)
    .findOneBy({
      userId: member.userId,
      referenceId: member.sourceId,
    });

  const referralToken = contentPreference?.flags.referralToken || randomUUID();

  await con.getRepository(SourceMember).insert({
    ...member,
    referralToken,
  });

  await con.getRepository(ContentPreferenceSource).upsert(
    con.getRepository(ContentPreferenceSource).create({
      userId: member.userId,
      referenceId: member.sourceId,
      sourceId: member.sourceId,
      feedId: member.userId,
      status: ContentPreferenceStatus.Subscribed,
      flags: {
        ...member.flags,
        role: member.role,
        referralToken,
      },
    }),
    {
      conflictPaths: ['referenceId', 'userId', 'type', 'feedId'],
    },
  );
};

export const removeSourceMember = async ({
  con,
  userId,
  sourceId,
}: {
  con: DataSource | EntityManager;
  userId: string;
  sourceId: string;
}): Promise<void> => {
  await con.transaction(async (entityManager) => {
    await entityManager.getRepository(SourceMember).delete({
      sourceId,
      userId,
    });

    await entityManager.getRepository(ContentPreferenceSource).delete({
      userId: userId,
      referenceId: sourceId,
    });

    await cleanContentNotificationPreference({
      entityManager: con,
      id: sourceId,
      notificationTypes: entityToNotificationTypeMap.source,
      notficationEntity: NotificationPreferenceSource,
      userId,
    });
  });
  return;
};

export const getPermissionsForMember = (
  member: Pick<SourceMember, 'role'>,
  source: Partial<Pick<SquadSource, 'memberPostingRank' | 'memberInviteRank'>>,
): SourcePermissions[] => {
  const permissions =
    roleSourcePermissions[member.role] ?? roleSourcePermissions.member;
  const memberRank =
    sourceRoleRank[member.role] ?? sourceRoleRank[SourceMemberRoles.Member];
  const permissionsToRemove: SourcePermissions[] = [];

  if (source.memberPostingRank && memberRank < source.memberPostingRank) {
    permissionsToRemove.push(SourcePermissions.Post);
  }

  if (source.memberInviteRank && memberRank < source.memberInviteRank) {
    permissionsToRemove.push(SourcePermissions.Invite);
  }

  if (permissionsToRemove.length > 0) {
    return permissions.filter((item) => !permissionsToRemove.includes(item));
  }

  return permissions;
};

interface SourcesArgs extends ConnectionArguments {
  filterOpenSquads?: boolean;
  categoryId?: string;
  featured?: boolean;
  sortByMembersCount?: boolean;
}

interface SourcesByType extends ConnectionArguments {
  type?: SourceType;
}

interface SourcesByTag extends ConnectionArguments {
  tag: string;
  excludeSources?: string[];
}

interface SimilarSources extends ConnectionArguments {
  sourceId: string;
  excludeSources?: string[];
}

const updateHideFeedPostsFlag = async (
  ctx: Context,
  sourceId: string,
  value: boolean,
): Promise<GQLEmptyResponse> => {
  await ensureSourcePermissions(ctx, sourceId, SourcePermissions.View);

  await ctx.con.transaction(async (entityManager) => {
    await entityManager.getRepository(SourceMember).update(
      { sourceId, userId: ctx.userId },
      {
        flags: updateFlagsStatement<SourceMember>({
          hideFeedPosts: value,
        }),
      },
    );

    await entityManager.getRepository(ContentPreferenceSource).update(
      { referenceId: sourceId, userId: ctx.userId },
      {
        flags: updateFlagsStatement<ContentPreferenceSource>({
          hideFeedPosts: value,
        }),
      },
    );
  });

  return { _: true };
};

const togglePinnedPosts = async (
  ctx: Context,
  sourceId: string,
  value: boolean,
): Promise<GQLEmptyResponse> => {
  await ensureSourcePermissions(ctx, sourceId, SourcePermissions.View);

  await ctx.con.transaction(async (entityManager) => {
    await entityManager.getRepository(SourceMember).update(
      { sourceId, userId: ctx.userId },
      {
        flags: updateFlagsStatement<SourceMember>({
          collapsePinnedPosts: value,
        }),
      },
    );

    await entityManager.getRepository(ContentPreferenceSource).update(
      { referenceId: sourceId, userId: ctx.userId },
      {
        flags: updateFlagsStatement<SourceMember>({
          collapsePinnedPosts: value,
        }),
      },
    );
  });

  return { _: true };
};

const getFormattedSources = async <Entity>(
  entity: EntityTarget<Entity>,
  args: { limit?: number },
  ctx: Context,
  info: GraphQLResolveInfo,
): Promise<GQLSource[]> => {
  const { limit = 10 } = args;

  return await graphorm.query(
    ctx,
    info,
    (builder) => {
      builder.queryBuilder
        .innerJoin(
          ctx.con.getMetadata(entity).tableName,
          'ts',
          `ts."sourceId" = ${builder.alias}.id`,
        )
        .orderBy('r', 'DESC')
        .limit(limit);
      return builder;
    },
    true,
  );
};

const paginateSourceMembers = (
  query: (builder: QueryBuilder, alias: string) => QueryBuilder,
  args: ConnectionArguments,
  ctx: Context,
  info: GraphQLResolveInfo,
): Promise<Connection<GQLSourceMember>> => {
  const page = membershipsPageGenerator.connArgsToPage(args);
  return graphorm.queryPaginated(
    ctx,
    info,
    (nodeSize) => membershipsPageGenerator.hasPreviousPage(page, nodeSize),
    (nodeSize) => membershipsPageGenerator.hasNextPage(page, nodeSize),
    (node, index) =>
      membershipsPageGenerator.nodeToCursor(page, args, node, index),
    (builder) => {
      builder.queryBuilder = query(builder.queryBuilder, builder.alias);
      builder.queryBuilder.limit(page.limit).offset(page.offset);
      return builder;
    },
    undefined,
    true,
  );
};

export const resolvers: IResolvers<unknown, BaseContext> = traceResolvers<
  unknown,
  BaseContext
>({
  Query: {
    sourceCategory: async (
      _,
      { id }: { id: string },
      ctx: Context,
      info,
    ): Promise<GQLSourceCategory> =>
      graphorm.queryOneOrFail(ctx, info, (builder) => ({
        ...builder,
        queryBuilder: builder.queryBuilder
          .where(`CAST("${builder.alias}".id AS text) = :id`, { id })
          .orWhere(`${builder.alias}.slug = :id`, { id }),
      })),
    sourceCategories: async (
      _,
      args,
      ctx: Context,
      info,
    ): Promise<Connection<GQLSourceCategory>> => {
      const page = categoriesPageGenerator.connArgsToPage(args);

      return graphorm.queryPaginated(
        ctx,
        info,
        (nodeSize) => categoriesPageGenerator.hasPreviousPage(page, nodeSize),
        (nodeSize) => categoriesPageGenerator.hasNextPage(page, nodeSize),
        (node, index) =>
          categoriesPageGenerator.nodeToCursor(page, args, node, index),
        (builder) => {
          builder.queryBuilder
            .orderBy(`${builder.alias}.priority`, 'ASC')
            .limit(page.limit)
            .offset(page.offset);

          return builder;
        },
        undefined,
        true,
      );
    },
    sourceAwards: async (
      _,
      args: GQLCommentAwardArgs,
      ctx: Context,
      info,
    ): Promise<Connection<GQLUserAward>> => {
      await ensureSourcePermissions(ctx, args.id);

      const pageGenerator = offsetPageGenerator<GQLUserAward>(20, 100);
      const page = pageGenerator.connArgsToPage(args);

      return graphorm.queryPaginated(
        ctx,
        info,
        (nodeSize) => pageGenerator.hasPreviousPage(page, nodeSize),
        (nodeSize) => pageGenerator.hasNextPage(page, nodeSize),
        (node, index) => pageGenerator.nodeToCursor(page, args, node, index),
        (builder) => {
          builder.queryBuilder.andWhere(
            `${builder.alias}.flags->>'sourceId' = :sourceId`,
            {
              sourceId: args.id,
            },
          );

          builder.queryBuilder.limit(page.limit).offset(page.offset);

          return builder;
        },
        undefined,
        true,
      );
    },
    sourceAwardsTotal: async (
      _,
      args: GQLCommentAwardArgs,
      ctx: Context,
    ): Promise<{ amount: number }> => {
      await ensureSourcePermissions(ctx, args.id);

      const result = await ctx.con
        .getRepository(UserTransaction)
        .createQueryBuilder()
        .select('COALESCE(SUM(value), 0)', 'amount')
        .where(`flags->>'sourceId' = :sourceId`, { sourceId: args.id })
        .getRawOne();

      return result;
    },
    sources: async (
      _,
      args: SourcesArgs,
      ctx: Context,
      info,
    ): Promise<Connection<GQLSource>> => {
      const filter: FindOptionsWhere<Source> = { active: true };

      if (args.filterOpenSquads) {
        filter.type = SourceType.Squad;
        filter.private = false;
      }

      if (args.categoryId) {
        filter.categoryId = args.categoryId;
      }

      const page = sourcePageGenerator.connArgsToPage(args);
      return graphorm.queryPaginated(
        ctx,
        info,
        (nodeSize) => sourcePageGenerator.hasPreviousPage(page, nodeSize),
        (nodeSize) => sourcePageGenerator.hasNextPage(page, nodeSize),
        (node, index) =>
          sourcePageGenerator.nodeToCursor(page, args, node, index),
        (builder) => {
          builder.queryBuilder
            .andWhere(filter)
            .limit(page.limit)
            .offset(page.offset);

          if (args.filterOpenSquads) {
            builder.queryBuilder.andWhere(
              `(${builder.alias}.flags->'publicThreshold')::boolean IS TRUE`,
            );
          }

          if (!isNullOrUndefined(args.featured)) {
            builder.queryBuilder.andWhere(
              `COALESCE((${builder.alias}.flags->'featured')::boolean, FALSE) = :featured`,
              { featured: args.featured },
            );
          }

          if (args.sortByMembersCount) {
            builder.queryBuilder.orderBy(
              `(${builder.alias}.flags->>'totalMembers')::integer`,
              'DESC',
            );
          }

          return builder;
        },
        undefined,
        true,
      );
    },
    sourcesByTag: async (
      _,
      args: SourcesByTag,
      ctx: Context,
      info,
    ): Promise<Connection<GQLSource>> => {
      const alwaysExcludeSources = ['unknown', 'community', 'collections'];
      const excludedSources = args?.excludeSources
        ? [...alwaysExcludeSources, ...args?.excludeSources]
        : alwaysExcludeSources;
      const filter: FindOptionsWhere<Source> = {
        active: true,
        private: false,
        id: Not(In(excludedSources)),
      };

      const page = sourcePageGenerator.connArgsToPage(args);
      return graphorm.queryPaginated(
        ctx,
        info,
        (nodeSize) => sourcePageGenerator.hasPreviousPage(page, nodeSize),
        (nodeSize) => sourcePageGenerator.hasNextPage(page, nodeSize),
        (node, index) =>
          sourcePageGenerator.nodeToCursor(page, args, node, index),
        (builder) => {
          builder.queryBuilder
            .addSelect('count')
            .innerJoin(
              SourceTagView,
              'stv',
              `stv.tag = :tag AND stv.sourceId = "${builder.alias}".id`,
              {
                tag: args.tag,
              },
            )
            .andWhere(filter)
            .orderBy('count', 'DESC')
            .limit(page.limit);
          return builder;
        },
        undefined,
        true,
      );
    },
    similarSources: async (
      _,
      args: SimilarSources,
      ctx: Context,
      info,
    ): Promise<Connection<GQLSource>> => {
      const alwaysExcludeSources = ['unknown', 'community', 'collections'];
      const excludedSources = args?.excludeSources
        ? [...alwaysExcludeSources, ...args?.excludeSources]
        : alwaysExcludeSources;
      const filter: FindOptionsWhere<Source> = {
        active: true,
        private: false,
        id: Not(In(excludedSources)),
      };

      const subQuery = await ctx.con.query(
        `with s as (
            SELECT *, row_number() over (partition by "sourceId" order by count desc) rn
            FROM source_tag_view
        )
        SELECT s2."sourceId"
        FROM s s1
        JOIN s s2 on s1.tag = s2.tag and s1."sourceId" != s2."sourceId"
        WHERE s1."sourceId" = $1 and s1.rn <= 10 and s2.rn <= 10
        GROUP BY 1
        ORDER BY count(*) desc
        LIMIT 6`,
        [args?.sourceId],
      );

      const page = sourcePageGenerator.connArgsToPage(args);
      return graphorm.queryPaginated(
        ctx,
        info,
        (nodeSize) => sourcePageGenerator.hasPreviousPage(page, nodeSize),
        (nodeSize) => sourcePageGenerator.hasNextPage(page, nodeSize),
        (node, index) =>
          sourcePageGenerator.nodeToCursor(page, args, node, index),
        (builder) => {
          builder.queryBuilder
            .andWhere('id IN (:...subQuery)', {
              subQuery:
                subQuery.length > 0
                  ? subQuery.map((s: { sourceId: string }) => s.sourceId)
                  : ['NULL'],
            })
            .andWhere(filter)
            .limit(page.limit);
          return builder;
        },
        undefined,
        true,
      );
    },
    searchSources: async (
      source,
      { query, limit = 5 }: { query: string; limit: number },
      ctx: Context,
      info,
    ): Promise<GQLSource[]> => {
      if (query.length < MIN_SEARCH_QUERY_LENGTH) {
        return [];
      }

      return await graphorm.query<GQLSource>(
        ctx,
        info,
        (builder) => {
          builder.queryBuilder
            .where(`name ILIKE :query OR handle ILIKE :query`, {
              query: `%${query}%`,
            })
            .andWhere({ active: true, private: false })
            .limit(getSearchLimit({ limit }));
          return builder;
        },
        true,
      );
    },
    sourceRecommendationByTags: async (
      source,
      { tags, limit = 10 }: { tags: string[]; limit: number },
      ctx: Context,
      info,
    ): Promise<GQLSource[]> => {
      const excludedSources = ['unknown', 'community', 'collections'];
      const rawSources = await ctx.con.getRepository(SourceTagView).find({
        where: { tag: In(tags), sourceId: Not(In(excludedSources)) },
        select: ['sourceId'],
        order: { count: 'DESC' },
      });

      const filter: FindOptionsWhere<Source> = {
        active: true,
        private: false,
      };

      const rawSourcesIds = rawSources.map(({ sourceId }) => sourceId);
      const idsStr = rawSources.length
        ? rawSources.map(({ sourceId }) => `'${sourceId}'`).join(',')
        : `'nosuchid'`;
      return graphorm.query(
        ctx,
        info,
        (builder) => {
          builder.queryBuilder
            .andWhere(filter)
            .andWhere('id IN (:...ids)', {
              ids: rawSourcesIds,
            })
            .orderBy(`array_position(array[${idsStr}], ${builder.alias}.id)`)
            .limit(getSearchLimit({ limit }));
          return builder;
        },
        true,
      );
    },
    mostRecentSources: async (
      _,
      args,
      ctx: Context,
      info,
    ): Promise<GQLSource[]> => {
      const { limit = 10 } = args;
      return await graphorm.query(
        ctx,
        info,
        (builder) => {
          builder.queryBuilder
            .where({ active: true, type: SourceType.Machine })
            .orderBy('"createdAt"', 'DESC')
            .limit(limit);
          return builder;
        },
        true,
      );
    },
    trendingSources: async (
      _,
      args,
      ctx: Context,
      info,
    ): Promise<GQLSource[]> =>
      getFormattedSources(TrendingSource, args, ctx, info),
    popularSources: async (_, args, ctx: Context, info): Promise<GQLSource[]> =>
      getFormattedSources(PopularSource, args, ctx, info),
    topVideoSources: async (
      _,
      args,
      ctx: Context,
      info,
    ): Promise<GQLSource[]> =>
      getFormattedSources(PopularVideoSource, args, ctx, info),
    sourceByFeed: async (
      _,
      { feed }: { feed: string },
      ctx: AuthContext,
    ): Promise<GQLSource | null> => sourceByFeed(feed, ctx),
    source: async (
      _,
      { id }: { id: string },
      ctx: Context,
      info,
    ): Promise<GQLSource> => {
      await ensureSourcePermissions(ctx, id);
      const source = await getSourceById(ctx, info, id);

      if (!source.moderationRequired || !source.currentMember) {
        return source;
      }

      const isModerator =
        sourceRoleRank[source.currentMember.role] >= sourceRoleRank.moderator;
      const status = SourcePostModerationStatus.Pending;
      const query: FindOptionsWhere<SourcePostModeration> = {
        status,
        sourceId: source.id,
      };

      if (isModerator) {
        query.flags = Raw(() => `(flags->>'vordr')::boolean IS NOT TRUE`);
      } else {
        query.createdById = ctx.userId;
      }

      const moderationPostCount = await ctx.con
        .getRepository(SourcePostModeration)
        .countBy(query);

      return { ...source, moderationPostCount };
    },
    sourceHandleExists: async (
      _,
      { handle }: { handle: string },
      ctx: AuthContext,
    ) => {
      try {
        const transformed = await validateAndTransformHandle(
          handle,
          'handle',
          ctx.con,
        );
        const source = await ctx.getRepository(Source).findOne({
          where: { handle: transformed },
          select: ['id'],
        });
        return !!source;
      } catch (err) {
        if (
          err instanceof ValidationError &&
          err.message.indexOf('invalid') < 0
        ) {
          return true;
        }
        throw err;
      }
    },
    sourceMembers: async (
      _,
      { role, sourceId, query, ...args }: SourceMemberArgs,
      ctx: Context,
      info,
    ): Promise<Connection<GQLSourceMember>> => {
      const permission =
        role === SourceMemberRoles.Blocked
          ? SourcePermissions.ViewBlockedMembers
          : SourcePermissions.View;

      await ensureSourcePermissions(ctx, sourceId, permission);
      return paginateSourceMembers(
        (queryBuilder, alias) => {
          queryBuilder = queryBuilder.andWhere(
            `${alias}."sourceId" = :source`,
            {
              source: sourceId,
            },
          );

          if (
            typeof graphorm.mappings?.SourceMember.fields?.roleRank.select ===
            'string'
          ) {
            queryBuilder = queryBuilder.addOrderBy(
              graphorm.mappings.SourceMember.fields?.roleRank.select,
              'DESC',
            );
          }

          queryBuilder = queryBuilder.addOrderBy(
            `${alias}."createdAt"`,
            'DESC',
          );

          if (query) {
            queryBuilder = queryBuilder
              .innerJoin(User, 'u', `${alias}."userId" = u.id`)
              .andWhere(`(u.name ILIKE :name OR u.username ILIKE :name)`, {
                name: `${query}%`,
              });
          }

          if (role) {
            if (role === SourceMemberRoles.Moderator) {
              // We should include both Moderator and Admin now
              queryBuilder = queryBuilder.andWhere(
                `${alias}."role" IN (:...roles)`,
                {
                  roles: [SourceMemberRoles.Moderator, SourceMemberRoles.Admin],
                },
              );
            } else {
              queryBuilder = queryBuilder.andWhere(`${alias}."role" = :role`, {
                role,
              });
            }
          } else if (
            typeof graphorm.mappings?.SourceMember.fields?.roleRank.select ===
            'string'
          ) {
            queryBuilder = queryBuilder.andWhere(
              `${graphorm.mappings.SourceMember.fields.roleRank.select} >= 0`,
            );
          }
          return queryBuilder;
        },
        args,
        ctx,
        info,
      );
    },
    mySourceMemberships: async (
      _,
      args: SourcesByType,
      ctx: AuthContext,
      info,
    ): Promise<Connection<GQLSourceMember>> => {
      const { type, ...connectionArgs } = args;

      return paginateSourceMembers(
        (queryBuilder, alias) => {
          queryBuilder = queryBuilder.andWhere(`${alias}."userId" = :userId`, {
            userId: ctx.userId,
          });

          if (
            typeof graphorm.mappings?.SourceMember.fields?.roleRank.select ===
            'string'
          ) {
            queryBuilder = queryBuilder.andWhere(
              `${graphorm.mappings.SourceMember.fields.roleRank.select} >= 0`,
            );
          }

          queryBuilder = queryBuilder.addOrderBy(
            `${alias}."createdAt"`,
            'DESC',
          );

          if (type) {
            queryBuilder = queryBuilder
              .innerJoin(Source, 's', `${alias}."sourceId" = s.id`)
              .andWhere(`s."type" = :type`, {
                type,
              });
          }
          return queryBuilder;
        },
        connectionArgs,
        ctx,
        info,
      );
    },
    publicSourceMemberships: async (
      _,
      { userId, ...args }: { userId: string } & ConnectionArguments,
      ctx: Context,
      info,
    ): Promise<Connection<GQLSourceMember>> => {
      return paginateSourceMembers(
        (queryBuilder, alias) => {
          queryBuilder = queryBuilder.andWhere(`${alias}."userId" = :userId`, {
            userId,
          });

          if (
            typeof graphorm.mappings?.SourceMember.fields?.roleRank.select ===
            'string'
          ) {
            queryBuilder = queryBuilder
              .andWhere(
                `${graphorm.mappings.SourceMember.fields.roleRank.select} >= 0`,
              )
              .addOrderBy(
                graphorm.mappings.SourceMember.fields.roleRank.select,
                'DESC',
              );
          }

          return queryBuilder
            .addOrderBy(`${alias}."createdAt"`, 'DESC')
            .innerJoin(Source, 's', `${alias}."sourceId" = s.id`)
            .andWhere('s.private = false')
            .andWhere('s.type != :type', {
              type: SourceType.User,
            });
        },
        args,
        ctx,
        info,
      );
    },
    sourceMemberByToken: async (
      _,
      { token }: { token: string },
      ctx: AuthContext,
      info,
    ): Promise<GQLSourceMember> => {
      const res = await graphorm.query<GQLSourceMember>(
        ctx,
        info,
        (builder) => {
          builder.queryBuilder = builder.queryBuilder
            .andWhere({ referralToken: token })
            .limit(1);
          return builder;
        },
        true,
      );
      if (!res.length) {
        throw new EntityNotFoundError(SourceMember, 'not found');
      }
      return res[0];
    },
    relatedTags: async (
      _,
      { sourceId },
      ctx: Context,
    ): Promise<GQLTagResults> => {
      const keywords = await ctx.con
        .createQueryBuilder()
        .from(SourceTagView, 'stv')
        .where({ sourceId })
        .orderBy('count', 'DESC')
        .limit(6)
        .getRawMany();

      return {
        hits: keywords.map(({ tag }) => ({ name: tag })),
      };
    },
  },
  Mutation: {
    createSquad: async (
      _,
      {
        name,
        handle: inputHandle,
        commentary,
        image,
        postId,
        description,
        memberPostingRole = SourceMemberRoles.Member,
        memberInviteRole = SourceMemberRoles.Member,
        moderationRequired,
        isPrivate = true,
        categoryId,
      }: SquadCreateInputArgs,
      ctx: AuthContext,
      info,
    ): Promise<GQLSource> => {
      const user = await ctx.con
        .getRepository(User)
        .findOneOrFail({ where: { id: ctx.userId }, select: ['reputation'] });
      if (
        remoteConfig.vars.blockedCountries?.includes(ctx.region) &&
        user.reputation < REPUTATION_THRESHOLD
      ) {
        throw new ForbiddenError('Squads are not available at the moment');
      }

      const handle = await validateSquadData(
        {
          handle: inputHandle,
          name,
          description,
          memberPostingRole,
          memberInviteRole,
          categoryId,
        },
        ctx.con,
      );
      try {
        const sourceId = await ctx.con.transaction(async (entityManager) => {
          const id = randomUUID();
          const repo = entityManager.getRepository(SquadSource);
          const source = repo.create({
            id,
            name,
            handle,
            active: true,
            description,
            private: isPrivate,
            memberPostingRank: sourceRoleRank[memberPostingRole],
            memberInviteRank: sourceRoleRank[memberInviteRole],
            moderationRequired,
          });

          if (!isNullOrUndefined(isPrivate) && !isPrivate) {
            source.categoryId = categoryId;
          }

          await repo.insert(source);
          // Add the logged-in user as admin
          await addNewSourceMember(entityManager, {
            sourceId: id,
            userId: ctx.userId,
            role: SourceMemberRoles.Admin,
          });
          await createSquadWelcomePost(entityManager, source, ctx.userId);

          if (postId) {
            // Create the first post of the squad
            await createSharePost({
              con: entityManager,
              ctx,
              args: {
                authorId: ctx.userId,
                postId,
                commentary,
                sourceId: id,
              },
            });
          }

          if (image) {
            const { createReadStream } = await image;
            const stream = createReadStream();
            const { url: imageUrl } = await uploadSquadImage(id, stream);
            await repo.update({ id }, { image: imageUrl });
          }
          return id;
        });
        return getSourceById(ctx, info, sourceId);
      } catch (originalError) {
        const err = originalError as TypeORMQueryFailedError;

        if (err.code === TypeOrmError.DUPLICATE_ENTRY) {
          if (err.message.indexOf('source_handle') > -1) {
            throw new ValidationError(
              JSON.stringify({ handle: 'handle is already used' }),
            );
          }
        }
        throw err;
      }
    },
    editSquad: async (
      _,
      {
        sourceId,
        name,
        handle: inputHandle,
        image,
        headerImage,
        description,
        memberPostingRole,
        memberInviteRole,
        moderationRequired,
        isPrivate,
        categoryId,
      }: SquadEditInputArgs,
      ctx: AuthContext,
      info,
    ): Promise<GQLSource> => {
      const source = await ensureSourcePermissions(
        ctx,
        sourceId,
        SourcePermissions.Edit,
      );

      if (source.type !== SourceType.Squad) {
        throw new ForbiddenError(
          'Access denied! You do not have permission for this action!',
        );
      }

      const handle = await validateSquadData(
        {
          handle: inputHandle,
          name,
          description,
          memberPostingRole,
          memberInviteRole,
          categoryId,
        },
        ctx.con,
        inputHandle !== source.handle,
      );

      const updates: Partial<SquadSource> = {
        name,
        handle,
        description,
        memberPostingRank: memberPostingRole
          ? sourceRoleRank[memberPostingRole]
          : undefined,
        memberInviteRank: memberInviteRole
          ? sourceRoleRank[memberInviteRole]
          : undefined,
        moderationRequired,
      };

      if (!isNullOrUndefined(isPrivate)) {
        if (!isPrivate) {
          updates.categoryId = categoryId;
        }

        if (source.private !== isPrivate) {
          updates.private = isPrivate;
        }
      }

      try {
        if (image) {
          const { createReadStream } = await image;
          const stream = createReadStream();
          const { url: imageUrl } = await uploadSquadImage(sourceId, stream);
          updates.image = imageUrl;
        }

        if (headerImage) {
          const { createReadStream } = await headerImage;
          const stream = createReadStream();
          const { url: imageUrl } = await uploadSquadHeaderImage(
            `cover_${sourceId}`,
            stream,
          );
          updates.headerImage = imageUrl;
        }

        await ctx.con
          .getRepository(SquadSource)
          .update({ id: sourceId }, updates);

        return getSourceById(ctx, info, sourceId);
      } catch (originalError) {
        const err = originalError as TypeORMQueryFailedError;

        if (err.code === TypeOrmError.DUPLICATE_ENTRY) {
          if (err.message.indexOf('source_handle') > -1) {
            throw new ValidationError(
              JSON.stringify({ handle: 'handle is already used' }),
            );
          }
        }
        throw err;
      }
    },
    deleteSource: async (
      _,
      { sourceId }: { sourceId: string },
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      const source = await ensureSourcePermissions(
        ctx,
        sourceId,
        SourcePermissions.Delete,
      );

      if (source.type !== SourceType.Squad) {
        throw new ForbiddenError(
          'Access denied! You do not have permission for this action!',
        );
      }

      await ctx.con.getRepository(Source).delete({
        id: sourceId,
      });
      return { _: true };
    },
    leaveSource: async (
      _,
      { sourceId }: { sourceId: string },
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      const source = await ensureSourcePermissions(
        ctx,
        sourceId,
        SourcePermissions.Leave,
      );

      if (source.type !== SourceType.Squad) {
        throw new ForbiddenError(
          'Access denied! You do not have permission for this action!',
        );
      }

      await removeSourceMember({
        con: ctx.con,
        userId: ctx.userId,
        sourceId,
      });
      return { _: true };
    },
    updateMemberRole: async (
      _,
      { sourceId, memberId, role }: UpdateMemberRoleArgs,
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      let source: Source;

      if (role === SourceMemberRoles.Blocked) {
        source = await ensureSourcePermissions(
          ctx,
          sourceId,
          SourcePermissions.MemberRemove,
          memberId,
        );
      } else {
        source = await ensureSourcePermissions(
          ctx,
          sourceId,
          SourcePermissions.MemberRoleUpdate,
        );

        if (!Object.values(SourceMemberRoles).includes(role)) {
          throw new ValidationError('Role does not exist!');
        }
      }

      if (source.type !== SourceType.Squad) {
        throw new ForbiddenError(
          'Access denied! You do not have permission for this action!',
        );
      }

      await ctx.con.transaction(async (entityManager) => {
        await entityManager
          .getRepository(SourceMember)
          .update({ sourceId, userId: memberId }, { role });

        const isBlock = role === SourceMemberRoles.Blocked;

        await entityManager.getRepository(ContentPreferenceSource).update(
          { userId: memberId, referenceId: sourceId },
          {
            status: isBlock ? ContentPreferenceStatus.Blocked : undefined,
            flags: updateFlagsStatement<ContentPreferenceSource>({
              role,
            }),
          },
        );

        if (isBlock) {
          await cleanContentNotificationPreference({
            ctx,
            entityManager,
            id: sourceId,
            notificationTypes: entityToNotificationTypeMap.source,
            notficationEntity: NotificationPreferenceSource,
            userId: memberId,
          });
        }
      });

      return { _: true };
    },
    unblockMember: async (
      _,
      { sourceId, memberId }: UpdateMemberRoleArgs,
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      const source = await ensureSourcePermissions(
        ctx,
        sourceId,
        SourcePermissions.MemberUnblock,
      );

      if (source.type !== SourceType.Squad) {
        throw new ForbiddenError(
          'Access denied! You do not have permission for this action!',
        );
      }

      await ctx.con.transaction(async (entityManager) => {
        await entityManager
          .getRepository(SourceMember)
          .delete({ sourceId, userId: memberId });

        await entityManager.getRepository(ContentPreferenceSource).delete({
          userId: memberId,
          referenceId: sourceId,
        });
      });

      return { _: true };
    },
    joinSource: async (
      _,
      { sourceId, token }: { sourceId: string; token: string },
      ctx: AuthContext,
      info,
    ): Promise<GQLSource> => {
      const source = await ctx.con
        .getRepository(Source)
        .findOneByOrFail({ id: sourceId });

      if (source.type !== SourceType.Squad) {
        throw new ForbiddenError(
          'Access denied! You do not have permission for this action!',
        );
      }

      if (source.private) {
        if (!token) {
          throw new ForbiddenError(
            'Access denied! You do not have permission for this action!',
          );
        }

        const member = await ctx.con
          .getRepository(SourceMember)
          .findOneBy({ referralToken: token });

        if (!member) {
          throw new ForbiddenError(
            'Access denied! You do not have permission for this action!',
          );
        }

        const memberRank =
          sourceRoleRank[member.role] ??
          sourceRoleRank[SourceMemberRoles.Member];
        const squadSource = source as SquadSource;

        if (memberRank < squadSource.memberInviteRank) {
          throw new ForbiddenError(SourcePermissionErrorKeys.InviteInvalid);
        }
      }

      try {
        await ctx.con.transaction(async (entityManager) => {
          await addNewSourceMember(entityManager, {
            sourceId,
            userId: ctx.userId,
            role: SourceMemberRoles.Member,
          });

          await entityManager
            .getRepository(Source)
            .update({ id: sourceId }, { active: true });
        });
      } catch (originalError) {
        const err = originalError as TypeORMQueryFailedError;

        if (err?.code !== TypeOrmError.DUPLICATE_ENTRY) {
          throw err;
        }
      }

      return getSourceById(ctx, info, sourceId);
    },
    hideSourceFeedPosts: async (
      _,
      { sourceId }: { sourceId: string },
      ctx: AuthContext,
    ) => {
      return updateHideFeedPostsFlag(ctx, sourceId, true);
    },
    showSourceFeedPosts: async (
      _,
      { sourceId }: { sourceId: string },
      ctx: AuthContext,
    ) => {
      return updateHideFeedPostsFlag(ctx, sourceId, false);
    },
    collapsePinnedPosts: async (
      _,
      { sourceId }: { sourceId: string },
      ctx: AuthContext,
    ) => {
      return togglePinnedPosts(ctx, sourceId, true);
    },
    expandPinnedPosts: async (
      _,
      { sourceId }: { sourceId: string },
      ctx: AuthContext,
    ) => {
      return togglePinnedPosts(ctx, sourceId, false);
    },
    clearUnreadPosts: async (
      _,
      { sourceId }: { sourceId: string },
      ctx: AuthContext,
    ) => {
      const source = await ensureSourcePermissions(ctx, sourceId);

      const result = await ctx.con.getRepository(SourceMember).update(
        { sourceId: source.id, userId: ctx.userId },
        {
          flags: updateFlagsStatement<SourceMember>({
            hasUnreadPosts: false,
          }),
        },
      );

      return {
        _: !!result.affected,
      };
    },
  },
  Source: {
    image: (source: GQLSource): GQLSource['image'] =>
      mapCloudinaryUrl(source.image),
    permalink: (source: GQLSource): string => getSourceLink(source),
    referralUrl: async (
      source: GQLSource,
      _,
      ctx: Context,
    ): Promise<string | null> => {
      if (!ctx.userId) {
        return null;
      }

      if (source.type !== SourceType.Squad) {
        return null;
      }

      const referralUrl = await ctx.dataLoader.referralUrl.load({
        source,
        userId: ctx.userId,
      });

      return referralUrl;
    },
  },
});
