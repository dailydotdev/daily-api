import { IResolvers } from '@graphql-tools/utils';
import { ValidationError } from 'apollo-server-errors';
import { traceResolvers } from './trace';
import { AuthContext, BaseContext, Context } from '../Context';
import graphorm from '../graphorm';
import { offsetPageGenerator, GQLEmptyResponse } from './common';
import { UserWorkspacePhoto } from '../entity/user/UserWorkspacePhoto';
import { ContentImage, ContentImageUsedByType } from '../entity/ContentImage';
import {
  addUserWorkspacePhotoSchema,
  reorderUserWorkspacePhotoSchema,
  type AddUserWorkspacePhotoInput,
  type ReorderUserWorkspacePhotoInput,
} from '../common/schema/userWorkspacePhoto';
import { NEW_ITEM_POSITION } from '../common/constants';

const MAX_WORKSPACE_PHOTOS = 5;

interface GQLUserWorkspacePhoto {
  id: string;
  userId: string;
  image: string;
  position: number;
  createdAt: Date;
}

export const typeDefs = /* GraphQL */ `
  type UserWorkspacePhoto {
    id: ID!
    image: String!
    position: Int!
    createdAt: DateTime!
  }

  type UserWorkspacePhotoEdge {
    node: UserWorkspacePhoto!
    cursor: String!
  }

  type UserWorkspacePhotoConnection {
    pageInfo: PageInfo!
    edges: [UserWorkspacePhotoEdge!]!
  }

  input AddUserWorkspacePhotoInput {
    image: String!
  }

  input ReorderUserWorkspacePhotoInput {
    id: ID!
    position: Int!
  }

  extend type Query {
    """
    Get a user's workspace photos
    """
    userWorkspacePhotos(
      userId: ID!
      first: Int
      after: String
    ): UserWorkspacePhotoConnection!
  }

  extend type Mutation {
    """
    Add a workspace photo to the user's profile (max 5)
    """
    addUserWorkspacePhoto(
      input: AddUserWorkspacePhotoInput!
    ): UserWorkspacePhoto! @auth

    """
    Delete a user's workspace photo
    """
    deleteUserWorkspacePhoto(id: ID!): EmptyResponse! @auth

    """
    Reorder user's workspace photos
    """
    reorderUserWorkspacePhotos(
      items: [ReorderUserWorkspacePhotoInput!]!
    ): [UserWorkspacePhoto!]! @auth
  }
`;

export const resolvers: IResolvers<unknown, BaseContext> = traceResolvers<
  unknown,
  BaseContext
>({
  Query: {
    userWorkspacePhotos: async (
      _,
      args: { userId: string; first?: number; after?: string },
      ctx: Context,
      info,
    ) => {
      const pageGenerator = offsetPageGenerator<GQLUserWorkspacePhoto>(50, 100);
      const page = pageGenerator.connArgsToPage({
        first: args.first,
        after: args.after,
      });

      return graphorm.queryPaginated<GQLUserWorkspacePhoto>(
        ctx,
        info,
        (nodeSize) => pageGenerator.hasPreviousPage(page, nodeSize),
        (nodeSize) => pageGenerator.hasNextPage(page, nodeSize),
        (node, index) =>
          pageGenerator.nodeToCursor(page, { first: args.first }, node, index),
        (builder) => {
          builder.queryBuilder
            .where(`"${builder.alias}"."userId" = :userId`, {
              userId: args.userId,
            })
            .orderBy(`"${builder.alias}"."position"`, 'ASC')
            .addOrderBy(`"${builder.alias}"."createdAt"`, 'ASC')
            .limit(page.limit)
            .offset(page.offset);
          return builder;
        },
        undefined,
        true,
      );
    },
  },

  Mutation: {
    addUserWorkspacePhoto: async (
      _,
      args: { input: AddUserWorkspacePhotoInput },
      ctx: AuthContext,
      info,
    ) => {
      const input = addUserWorkspacePhotoSchema.parse(args.input);

      // Check photo limit
      const existingCount = await ctx.con
        .getRepository(UserWorkspacePhoto)
        .count({ where: { userId: ctx.userId } });

      if (existingCount >= MAX_WORKSPACE_PHOTOS) {
        throw new ValidationError(
          `Maximum of ${MAX_WORKSPACE_PHOTOS} workspace photos allowed`,
        );
      }

      const userWorkspacePhoto = ctx.con
        .getRepository(UserWorkspacePhoto)
        .create({
          userId: ctx.userId,
          image: input.image,
          position: NEW_ITEM_POSITION,
        });

      await ctx.con.getRepository(UserWorkspacePhoto).save(userWorkspacePhoto);

      // Mark the ContentImage as used
      await ctx.con.getRepository(ContentImage).update(
        { url: input.image },
        {
          usedByType: ContentImageUsedByType.WorkspacePhoto,
          usedById: userWorkspacePhoto.id,
        },
      );

      return graphorm.queryOneOrFail(ctx, info, (builder) => {
        builder.queryBuilder.where(`"${builder.alias}"."id" = :id`, {
          id: userWorkspacePhoto.id,
        });
        return builder;
      });
    },

    deleteUserWorkspacePhoto: async (
      _,
      args: { id: string },
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      // Find the photo first to get the image URL
      const photo = await ctx.con
        .getRepository(UserWorkspacePhoto)
        .findOne({ where: { id: args.id, userId: ctx.userId } });

      if (!photo) {
        return { _: true };
      }

      // Delete the photo
      await ctx.con
        .getRepository(UserWorkspacePhoto)
        .delete({ id: args.id, userId: ctx.userId });

      // Delete the ContentImage record since we know the image is no longer needed
      await ctx.con.getRepository(ContentImage).delete({ url: photo.image });

      return { _: true };
    },

    reorderUserWorkspacePhotos: async (
      _,
      args: { items: ReorderUserWorkspacePhotoInput[] },
      ctx: AuthContext,
      info,
    ) => {
      const items = reorderUserWorkspacePhotoSchema.parse(args.items);
      const ids = items.map((i) => i.id);

      const whenClauses = items
        .map((item) => `WHEN id = '${item.id}' THEN ${item.position}`)
        .join(' ');

      await ctx.con
        .getRepository(UserWorkspacePhoto)
        .createQueryBuilder()
        .update()
        .set({ position: () => `CASE ${whenClauses} ELSE position END` })
        .where('id IN (:...ids)', { ids })
        .andWhere('"userId" = :userId', { userId: ctx.userId })
        .execute();

      return graphorm.query(ctx, info, (builder) => {
        builder.queryBuilder
          .where(`"${builder.alias}"."id" IN (:...ids)`, { ids })
          .andWhere(`"${builder.alias}"."userId" = :userId`, {
            userId: ctx.userId,
          })
          .orderBy(`"${builder.alias}"."position"`, 'ASC');
        return builder;
      });
    },
  },
});
