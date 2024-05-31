import { ForbiddenError, ValidationError } from 'apollo-server-errors';
import { IResolvers } from '@graphql-tools/utils';
import { ConnectionArguments } from 'graphql-relay';
import { traceResolverObject } from './trace';
import { Context } from '../Context';
import {
  createSharePost,
  generateMemberToken,
  Source,
  SourceFeed,
  SourceFlagsPublic,
  SourceMember,
  SourceMemberFlagsPublic,
  SquadPublicRequest,
  SquadPublicRequestStatus,
  SquadSource,
  User,
} from '../entity';
import { SourceType } from '../entity/Source';
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
} from 'typeorm';
import { GQLUser } from './users';
import { Connection } from 'graphql-relay/index';
import { createDatePageGenerator } from '../common/datePageGenerator';
import { FileUpload } from 'graphql-upload/GraphQLUpload';
import { randomUUID } from 'crypto';
import {
  createSquadWelcomePost,
  getSourceLink,
  updateFlagsStatement,
  uploadSquadImage,
} from '../common';
import { toGQLEnum } from '../common/utils';
import { GraphQLResolveInfo } from 'graphql';
import {
  SourcePermissionErrorKeys,
  SourceRequestErrorMessage,
  TypeOrmError,
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
import { SourceTagView } from '../entity/SourceTagView';
import { TrendingSource } from '../entity/TrendingSource';
import { PopularSource } from '../entity/PopularSource';
import { PopularVideoSource } from '../entity/PopularVideoSource';

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
    URL for inviting and referring new users
    """
    referralUrl: String
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

  type SourceMemberFlagsPublic {
    """
    Whether the source posts are hidden from feed for member
    """
    hideFeedPosts: Boolean
    """
    Whether the source pinned posts are collapsed or not
    """
    collapsePinnedPosts: Boolean
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
    ): SourceConnection!

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
      Role required for members to post
      """
      memberPostingRole: String
      """
      Role required for members to invite
      """
      memberInviteRole: String
      """
      Whether the Squad should change its privacy
      """
      isPrivate: Boolean
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
}

const memberPermissions = [
  SourcePermissions.View,
  SourcePermissions.Post,
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
];
const adminPermissions = [
  ...moderatorPermissions,
  SourcePermissions.MemberRoleUpdate,
  SourcePermissions.PostLimit,
  SourcePermissions.Delete,
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
  member: SourceMember,
  permission: SourcePermissions,
  validateRankAgainstId?: string,
): Promise<boolean> => {
  if (permission === SourcePermissions.View && !source.private) {
    if (sourceTypesWithMembers.includes(source.type)) {
      const isMemberBlocked = member?.role === SourceMemberRoles.Blocked;
      const canAccess = !isMemberBlocked;

      return canAccess;
    }

    return true;
  }

  if (!member) {
    return false;
  }

  const sourceId = source.id;
  const repo = ctx.getRepository(SourceMember);
  const validateRankAgainst = await (requireGreaterAccessPrivilege[permission]
    ? repo.findOneByOrFail({ sourceId, userId: validateRankAgainstId })
    : Promise.resolve(null));

  return hasPermissionCheck(source, member, permission, validateRankAgainst);
};

export const canPostToSquad = (
  ctx: Context,
  squad: SquadSource,
  sourceMember: SourceMember,
): boolean => {
  if (!sourceMember) {
    return false;
  }

  return sourceRoleRank[sourceMember.role] >= squad.memberPostingRank;
};

const validateSquadData = async (
  {
    handle,
    name,
    description,
    memberPostingRole,
    memberInviteRole,
  }: Pick<SquadSource, 'handle' | 'name' | 'description'> & {
    memberPostingRole?: SourceMemberRoles;
    memberInviteRole?: SourceMemberRoles;
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
      permission === SourcePermissions.Post &&
      !canPostToSquad(ctx, source, sourceMember)
    ) {
      throw new ForbiddenError('Posting not allowed!');
    }

    return source;
  }
  throw new ForbiddenError('Access denied!');
};

const sourceByFeed = async (feed: string, ctx: Context): Promise<GQLSource> => {
  const res = await ctx.con
    .createQueryBuilder()
    .select('source.*')
    .from(Source, 'source')
    .innerJoin(SourceFeed, 'sf', 'source.id = sf."sourceId"')
    .where('sf.feed = :feed and source.private = false', { feed })
    .getRawOne();
  return res ? sourceToGQL(res) : null;
};

const membershipsPageGenerator = createDatePageGenerator<
  GQLSourceMember,
  'createdAt'
>({
  key: 'createdAt',
});

const sourcePageGenerator = offsetPageGenerator<GQLSource>(100, 500);

type CreateSquadArgs = {
  name: string;
  handle: string;
  description?: string;
  image?: FileUpload;
  postId?: string;
  commentary?: string;
  memberPostingRole?: SourceMemberRoles;
  memberInviteRole?: SourceMemberRoles;
};

type EditSquadArgs = {
  sourceId: string;
  name: string;
  handle: string;
  description?: string;
  image?: FileUpload;
  memberPostingRole?: SourceMemberRoles;
  memberInviteRole?: SourceMemberRoles;
  isPrivate?: boolean;
};

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

const addNewSourceMember = async (
  con: DataSource | EntityManager,
  member: Omit<DeepPartial<SourceMember>, 'referralToken'>,
): Promise<void> => {
  await con.getRepository(SourceMember).insert({
    ...member,
    referralToken: await generateMemberToken(),
  });
};

export const getPermissionsForMember = (
  member: Pick<SourceMember, 'role'>,
  source: Pick<SquadSource, 'memberPostingRank' | 'memberInviteRank'>,
): SourcePermissions[] => {
  const permissions =
    roleSourcePermissions[member.role] ?? roleSourcePermissions.member;
  const memberRank =
    sourceRoleRank[member.role] ?? sourceRoleRank[SourceMemberRoles.Member];
  const permissionsToRemove: SourcePermissions[] = [];

  if (memberRank < source.memberPostingRank) {
    permissionsToRemove.push(SourcePermissions.Post);
  }

  if (memberRank < source.memberInviteRank) {
    permissionsToRemove.push(SourcePermissions.Invite);
  }

  if (permissionsToRemove.length > 0) {
    return permissions.filter((item) => !permissionsToRemove.includes(item));
  }

  return permissions;
};

interface SourcesArgs extends ConnectionArguments {
  filterOpenSquads?: boolean;
  featured?: boolean;
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

  await ctx.con.getRepository(SourceMember).update(
    { sourceId, userId: ctx.userId },
    {
      flags: updateFlagsStatement<SourceMember>({
        hideFeedPosts: value,
      }),
    },
  );

  return { _: true };
};

const togglePinnedPosts = async (
  ctx: Context,
  sourceId: string,
  value: boolean,
): Promise<GQLEmptyResponse> => {
  await ensureSourcePermissions(ctx, sourceId, SourcePermissions.View);

  await ctx.con.getRepository(SourceMember).update(
    { sourceId, userId: ctx.userId },
    {
      flags: updateFlagsStatement<SourceMember>({
        collapsePinnedPosts: value,
      }),
    },
  );

  return { _: true };
};

const getFormattedSources = async (entity, args, ctx): Promise<GQLSource[]> => {
  const { limit = 10 } = args;
  /*
   * This is not best practice, but due to missing join/basetable support for graphORM we decided to leave it like this to ship faster
   * If you ever need child entities/graphORM magic this needs to change
   */
  return await ctx.con
    .createQueryBuilder()
    .select('s.*')
    .from(entity, 'ts')
    .innerJoin(Source, 's', 'ts."sourceId" = s.id')
    .orderBy('r', 'DESC')
    .limit(limit)
    .getRawMany();
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
      builder.queryBuilder.limit(page.limit);
      if (page.timestamp) {
        builder.queryBuilder = builder.queryBuilder.andWhere(
          `${builder.alias}."createdAt" < :timestamp`,
          { timestamp: page.timestamp },
        );
      }
      return builder;
    },
  );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const resolvers: IResolvers<any, Context> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Query: traceResolverObject<any, any>({
    sources: async (
      _,
      args: SourcesArgs,
      ctx,
      info,
    ): Promise<Connection<GQLSource>> => {
      const filter: FindOptionsWhere<Source> = { active: true };

      if (args.filterOpenSquads) {
        filter.type = SourceType.Squad;
        filter.private = false;
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

          if (!isNullOrUndefined(args.featured)) {
            builder.queryBuilder.andWhere(
              `(${builder.alias}.flags->'featured')::boolean = :featured`,
              {
                featured: args.featured,
              },
            );
          }

          return builder;
        },
      );
    },
    sourcesByTag: async (
      _,
      args: SourcesByTag,
      ctx,
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
      );
    },
    similarSources: async (
      _,
      args: SimilarSources,
      ctx,
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
                  ? subQuery.map((s) => s.sourceId)
                  : ['NULL'],
            })
            .andWhere(filter)
            .limit(page.limit);
          return builder;
        },
      );
    },
    mostRecentSources: async (_, args, ctx, info): Promise<GQLSource[]> => {
      const { limit = 10 } = args;
      return await graphorm.query(ctx, info, (builder) => {
        builder.queryBuilder
          .where({ active: true, type: SourceType.Machine })
          .orderBy('"createdAt"', 'DESC')
          .limit(limit);
        return builder;
      });
    },
    trendingSources: async (_, args, ctx): Promise<GQLSource[]> =>
      getFormattedSources(TrendingSource, args, ctx),
    popularSources: async (_, args, ctx): Promise<GQLSource[]> =>
      getFormattedSources(PopularSource, args, ctx),
    topVideoSources: async (_, args, ctx): Promise<GQLSource[]> =>
      getFormattedSources(PopularVideoSource, args, ctx),
    sourceByFeed: async (
      _,
      { feed }: { feed: string },
      ctx,
    ): Promise<GQLSource> => sourceByFeed(feed, ctx),
    source: async (
      _,
      { id }: { id: string },
      ctx,
      info,
    ): Promise<GQLSource> => {
      await ensureSourcePermissions(ctx, id);
      return getSourceById(ctx, info, id);
    },
    sourceHandleExists: async (_, { handle }: { handle: string }, ctx) => {
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
      ctx,
      info,
    ): Promise<Connection<GQLSourceMember>> => {
      const permission =
        role === SourceMemberRoles.Blocked
          ? SourcePermissions.ViewBlockedMembers
          : SourcePermissions.View;

      await ensureSourcePermissions(ctx, sourceId, permission);
      return paginateSourceMembers(
        (queryBuilder, alias) => {
          queryBuilder
            .andWhere(`${alias}."sourceId" = :source`, {
              source: sourceId,
            })
            .addOrderBy(
              graphorm.mappings.SourceMember.fields.roleRank.select as string,
              'DESC',
            )
            .addOrderBy(`${alias}."createdAt"`, 'DESC');

          if (query) {
            queryBuilder = queryBuilder
              .innerJoin(User, 'u', `${alias}."userId" = u.id`)
              .andWhere(`(u.name ILIKE :name OR u.username ILIKE :name)`, {
                name: `${query}%`,
              });
          }

          if (role) {
            queryBuilder = queryBuilder.andWhere(`${alias}.role = :role`, {
              role,
            });
          } else {
            queryBuilder = queryBuilder.andWhere(
              `${
                graphorm.mappings.SourceMember.fields.roleRank.select as string
              } >= 0`,
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
      ctx,
      info,
    ): Promise<Connection<GQLSourceMember>> => {
      const { type, ...connectionArgs } = args;

      return paginateSourceMembers(
        (queryBuilder, alias) => {
          queryBuilder
            .andWhere(`${alias}."userId" = :user`, { user: ctx.userId })
            .andWhere(
              `${
                graphorm.mappings.SourceMember.fields.roleRank.select as string
              } >= 0`,
            )
            .addOrderBy(`${alias}."createdAt"`, 'DESC');

          if (type) {
            queryBuilder
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
      ctx,
      info,
    ): Promise<Connection<GQLSourceMember>> => {
      return paginateSourceMembers(
        (queryBuilder, alias) => {
          return queryBuilder
            .andWhere(`${alias}."userId" = :user`, { user: userId })
            .andWhere(
              `${
                graphorm.mappings.SourceMember.fields.roleRank.select as string
              } >= 0`,
            )
            .addOrderBy(
              graphorm.mappings.SourceMember.fields.roleRank.select as string,
              'DESC',
            )
            .addOrderBy(`${alias}."createdAt"`, 'DESC')
            .innerJoin(Source, 's', `${alias}."sourceId" = s.id`)
            .andWhere('s.private = false');
        },
        args,
        ctx,
        info,
      );
    },
    sourceMemberByToken: async (
      _,
      { token }: { token: string },
      ctx,
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
      );
      if (!res.length) {
        throw new EntityNotFoundError(SourceMember, 'not found');
      }
      return res[0];
    },
    relatedTags: async (_, { sourceId }, ctx): Promise<GQLTagResults> => {
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
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Mutation: traceResolverObject<any, any>({
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
      }: CreateSquadArgs,
      ctx,
      info,
    ): Promise<GQLSource> => {
      const handle = await validateSquadData(
        {
          handle: inputHandle,
          name,
          description,
          memberPostingRole,
          memberInviteRole,
        },
        ctx.con,
      );
      try {
        const sourceId = await ctx.con.transaction(async (entityManager) => {
          const id = randomUUID();
          const repo = entityManager.getRepository(SquadSource);
          // Create a new source
          const source = repo.create({
            id,
            name,
            handle,
            active: true,
            description,
            private: true,
            memberPostingRank: sourceRoleRank[memberPostingRole],
            memberInviteRank: sourceRoleRank[memberInviteRole],
          });
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
            await createSharePost(
              entityManager,
              id,
              ctx.userId,
              postId,
              commentary,
            );
          }
          // Upload the image (if provided)
          if (image) {
            const { createReadStream } = await image;
            const stream = createReadStream();
            const { url: imageUrl } = await uploadSquadImage(id, stream);
            await repo.update({ id }, { image: imageUrl });
          }
          return id;
        });
        return getSourceById(ctx, info, sourceId);
      } catch (err) {
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
        description,
        memberPostingRole,
        memberInviteRole,
        isPrivate,
      }: EditSquadArgs,
      ctx,
      info,
    ): Promise<GQLSource> => {
      const current = await ensureSourcePermissions(
        ctx,
        sourceId,
        SourcePermissions.Edit,
      );
      const handle = await validateSquadData(
        {
          handle: inputHandle,
          name,
          description,
          memberPostingRole,
          memberInviteRole,
        },
        ctx.con,
        inputHandle !== current.handle,
      );

      const updates: Partial<SquadSource> = {
        name,
        handle,
        description,
        memberPostingRank: sourceRoleRank[memberPostingRole],
        memberInviteRank: sourceRoleRank[memberInviteRole],
      };

      if (!isNullOrUndefined(isPrivate) && current.private !== isPrivate) {
        const approved = await ctx.con
          .getRepository(SquadPublicRequest)
          .findOne({
            where: { sourceId, status: SquadPublicRequestStatus.Approved },
          });

        if (!approved) {
          throw new ValidationError(SourceRequestErrorMessage.SQUAD_INELIGIBLE);
        }

        updates.private = isPrivate;
      }

      try {
        const editedSourceId = await ctx.con.transaction(
          async (entityManager) => {
            const repo = entityManager.getRepository(SquadSource);

            // Update existing squad
            await repo.update({ id: sourceId }, updates);
            // Upload the image (if provided)
            if (image) {
              const { createReadStream } = await image;
              const stream = createReadStream();
              const { url: imageUrl } = await uploadSquadImage(
                sourceId,
                stream,
              );
              await repo.update({ id: sourceId }, { image: imageUrl });
            }
            return sourceId;
          },
        );
        return getSourceById(ctx, info, editedSourceId);
      } catch (err) {
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
      ctx,
    ): Promise<GQLEmptyResponse> => {
      await ensureSourcePermissions(ctx, sourceId, SourcePermissions.Delete);
      await ctx.con.getRepository(Source).delete({
        id: sourceId,
      });
      return { _: true };
    },
    leaveSource: async (
      _,
      { sourceId }: { sourceId: string },
      ctx,
    ): Promise<GQLEmptyResponse> => {
      await ensureSourcePermissions(ctx, sourceId, SourcePermissions.Leave);
      await ctx.con.getRepository(SourceMember).delete({
        sourceId,
        userId: ctx.userId,
      });
      return { _: true };
    },
    updateMemberRole: async (
      _,
      { sourceId, memberId, role }: UpdateMemberRoleArgs,
      ctx,
    ): Promise<GQLEmptyResponse> => {
      if (role === SourceMemberRoles.Blocked) {
        await ensureSourcePermissions(
          ctx,
          sourceId,
          SourcePermissions.MemberRemove,
          memberId,
        );
      } else {
        await ensureSourcePermissions(
          ctx,
          sourceId,
          SourcePermissions.MemberRoleUpdate,
        );

        if (!Object.values(SourceMemberRoles).includes(role)) {
          throw new ValidationError('Role does not exist!');
        }
      }

      await ctx.con
        .getRepository(SourceMember)
        .update({ sourceId, userId: memberId }, { role });

      return { _: true };
    },
    unblockMember: async (
      _,
      { sourceId, memberId }: UpdateMemberRoleArgs,
      ctx,
    ): Promise<GQLEmptyResponse> => {
      await ensureSourcePermissions(
        ctx,
        sourceId,
        SourcePermissions.MemberUnblock,
      );

      await ctx.con
        .getRepository(SourceMember)
        .delete({ sourceId, userId: memberId });

      return { _: true };
    },
    joinSource: async (
      _,
      { sourceId, token }: { sourceId: string; token: string },
      ctx,
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
      } catch (err) {
        if (err?.code !== TypeOrmError.DUPLICATE_ENTRY) {
          throw err;
        }
      }

      return getSourceById(ctx, info, sourceId);
    },
    hideSourceFeedPosts: async (_, { sourceId }: { sourceId: string }, ctx) => {
      return updateHideFeedPostsFlag(ctx, sourceId, true);
    },
    showSourceFeedPosts: async (_, { sourceId }: { sourceId: string }, ctx) => {
      return updateHideFeedPostsFlag(ctx, sourceId, false);
    },
    collapsePinnedPosts: async (_, { sourceId }: { sourceId: string }, ctx) => {
      return togglePinnedPosts(ctx, sourceId, true);
    },
    expandPinnedPosts: async (_, { sourceId }: { sourceId: string }, ctx) => {
      return togglePinnedPosts(ctx, sourceId, false);
    },
  }),
  Source: {
    permalink: (source: GQLSource): string => getSourceLink(source),
    referralUrl: async (source: GQLSource, _, ctx): Promise<string> => {
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
};
