import {
  IFieldResolver,
  IResolvers,
  IObjectTypeResolver,
} from '@graphql-tools/utils';
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
    info: GraphQLResolveInfo,
  ): Promise<TReturn> => {
    if (context?.span) {
      context.span.setAttributes({
        ['graphql.operation.name']: info.operation?.name?.value,
        ['graphql.operation.type']: info.operation.operation,
        ['graphql.variableValues']: JSON.stringify(info.variableValues),
      });

      context.metricGraphqlCounter.add(1, {
        ['graphql.field.name']: info.fieldName,
        ['graphql.operation.name']: info.operation?.name?.value,
        ['graphql.operation.type']: info.operation?.operation,
      });
    }
    return next(source, args, context, info);
  };
}

export function traceResolverObject<TSource, TArgs>(
  object: IObjectTypeResolver<TSource, Context, TArgs>,
): IObjectTypeResolver<TSource, Context, TArgs> {
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
      resolvers[prop] = traceResolverObject(value as IObjectTypeResolver);
    }
  }
  return resolvers;
}
