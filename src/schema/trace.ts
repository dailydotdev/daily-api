import {
  IFieldResolver,
  MergeInfo,
  IResolvers,
  IResolverObject,
} from 'apollo-server-fastify';
import { GraphQLResolveInfo } from 'graphql';
import { isFunction, isObject } from 'lodash';
import { Context } from '../Context';

export function traceResolver<TSource, TArgs, TReturn>(
  next: IFieldResolver<TSource, Context, TArgs>,
): IFieldResolver<TSource, Context, TArgs> {
  return async (
    source: TSource,
    args: TArgs,
    context: Context,
    info: GraphQLResolveInfo & {
      mergeInfo: MergeInfo;
    },
  ): Promise<TReturn> => {
    const name = `${info.parentType.name}.${info.fieldName}`;
    const childSpan = context.span.createChildSpan({ name });
    childSpan.addLabel('/graphql/parent', info.parentType.name);
    childSpan.addLabel('/graphql/field', info.fieldName);
    childSpan.addLabel('/graphql/operation/name', info.operation.name);
    childSpan.addLabel('/graphql/operation/type', info.operation.operation);
    try {
      const res = await next(source, args, context, info);
      childSpan.endSpan();
      return res;
    } catch (err) {
      childSpan.endSpan();
      throw err;
    }
  };
}

function traceResolverObject<TSource, TArgs>(
  object: IResolverObject<TSource, Context, TArgs>,
): IResolverObject<TSource, Context, TArgs> {
  for (const prop in object) {
    const value = object[prop];
    if (isFunction(value)) {
      object[prop] = traceResolver(value);
    }
  }
  return object;
}

export function traceResolvers<TSource>(
  resolvers: IResolvers<TSource, Context>,
): IResolvers<TSource, Context> {
  for (const prop in resolvers) {
    const value = resolvers[prop];
    if (isObject(value)) {
      resolvers[prop] = traceResolverObject(value as IResolverObject);
    }
  }
  return resolvers;
}
