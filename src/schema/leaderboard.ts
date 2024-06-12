import { IResolvers } from '@graphql-tools/utils';
import { Context } from '../Context';
import { traceResolvers } from './trace';

// TODO: Rename this file

export const typeDefs = /* GraphQL */ ``;

export const resolvers: IResolvers<unknown, Context> = traceResolvers({
  Query: {},
});
