import {
  IFieldResolver,
  IResolvers,
  IObjectTypeResolver,
} from '@graphql-tools/utils';
import { GraphQLResolveInfo } from 'graphql';
import { isFunction, isObject } from 'lodash';
import { BaseContext } from '../Context';
import { counters } from '../telemetry';

export function traceResolver<
  TSource,
  TArgs,
  TContext extends BaseContext,
  TReturn,
>(
  next: IFieldResolver<TSource, TContext, TArgs>,
): IFieldResolver<TSource, TContext, TArgs> {
  return async (
    source: TSource,
    args: TArgs,
    context: TContext,
    info: GraphQLResolveInfo,
  ): Promise<TReturn> => {
    if (context?.span && context?.span?.isRecording()) {
      context.span.setAttributes({
        ['graphql.operation.name']: info.operation?.name?.value,
        ['graphql.operation.type']: info.operation.operation,
        ['graphql.variableValues']: JSON.stringify(info.variableValues),
      });
    }

    counters?.api?.graphqlOperations?.add(1, {
      ['graphql.field.name']: info.fieldName,
      ['graphql.operation.name']: info.operation?.name?.value,
    });

    return next(source, args, context, info);
  };
}

export function traceResolverObject<
  TSource,
  TArgs,
  TContext extends BaseContext,
>(
  object: IObjectTypeResolver<TSource, TContext, TArgs>,
): IObjectTypeResolver<TSource, TContext, TArgs> {
  for (const prop in object) {
    const value = object[prop];
    if (isFunction(value)) {
      object[prop] = traceResolver(value);
    }
  }
  return object;
}

export function traceResolvers<TSource, TContext extends BaseContext>(
  resolvers: IResolvers<TSource, TContext>,
): IResolvers<TSource, TContext> {
  for (const prop in resolvers) {
    const value = resolvers[prop];
    if (isObject(value)) {
      resolvers[prop] = traceResolverObject(value as IObjectTypeResolver);
    }
  }
  return resolvers;
}
