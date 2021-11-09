import { GraphORMBuilder } from '../graphorm/graphorm';
import { GraphQLResolveInfo } from 'graphql';
import { Context } from '../Context';
import { Connection, ConnectionArguments } from 'graphql-relay';
import graphorm from '../graphorm';
import { Page, PageGenerator } from '../schema/common';
import { getCursorFromAfter } from './pagination';
import { base64 } from './base64';

export interface GQLPage extends Page {
  timestamp?: Date;
}

export interface GQLDatePageGeneratorConfig<
  TEntity extends Record<TKey, Date>,
  TKey extends keyof TEntity,
> {
  maxSize?: number;
  key: TKey;
}

const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_MAX_SIZE = 100;

export function createDatePageGenerator<
  TEntity extends Record<TKey, Date>,
  TKey extends keyof TEntity,
>({
  maxSize = DEFAULT_MAX_SIZE,
  key,
}: GQLDatePageGeneratorConfig<TEntity, TKey>): PageGenerator<
  TEntity,
  ConnectionArguments,
  GQLPage
> {
  return {
    connArgsToPage: ({ first, after }: ConnectionArguments) => {
      const cursor = getCursorFromAfter(after);
      const limit = Math.min(first || DEFAULT_PAGE_SIZE, maxSize);
      if (cursor) {
        return { limit, timestamp: new Date(parseInt(cursor)) };
      }
      return { limit };
    },
    nodeToCursor: (_, __, node) => base64(`time:${node[key].getTime()}`),
    hasNextPage: (page, nodesSize) => page.limit === nodesSize,
    hasPreviousPage: (page) => !!page.timestamp,
  };
}

export type GQLDatePageGeneratorType<
  TEntity extends Record<TKey, Date>,
  TKey extends keyof TEntity,
> = PageGenerator<TEntity, ConnectionArguments, GQLPage>;

export interface QueryOptions {
  queryBuilder?: (builder: GraphORMBuilder) => GraphORMBuilder;
  orderByKey?: 'ASC' | 'DESC';
}

class GQLDatePageGenerator<
  TEntity extends Record<TKey, Date>,
  TKey extends keyof TEntity,
> {
  #config: GQLDatePageGeneratorConfig<TEntity, TKey>;
  #pageGenerator: GQLDatePageGeneratorType<TEntity, TKey>;

  constructor(props: GQLDatePageGeneratorConfig<TEntity, TKey>) {
    this.#config = props;
    this.#pageGenerator = createDatePageGenerator(props);
  }

  get pageGenerator(): GQLDatePageGeneratorType<TEntity, TKey> {
    return this.#pageGenerator;
  }

  createPageGenerator(props: GQLDatePageGeneratorConfig<TEntity, TKey>): void {
    this.#pageGenerator = createDatePageGenerator(props);
  }

  queryPaginated<TArgs extends ConnectionArguments>(
    ctx: Context,
    info: GraphQLResolveInfo,
    args: TArgs,
    { queryBuilder, orderByKey = 'ASC' }: QueryOptions = {},
  ): Promise<Connection<TEntity>> {
    const page = this.#pageGenerator.connArgsToPage(args);

    return graphorm.queryPaginated(
      ctx,
      info,
      (nodeSize) => this.#pageGenerator.hasPreviousPage(page, nodeSize),
      (nodeSize) => this.#pageGenerator.hasNextPage(page, nodeSize),
      (node, index) =>
        this.#pageGenerator.nodeToCursor(page, args, node, index),
      (defaultBuilder) => {
        const { key } = this.#config;
        const builder =
          (queryBuilder && queryBuilder(defaultBuilder)) || defaultBuilder;
        const orderCondition = orderByKey === 'DESC' ? '<' : '>';

        builder.queryBuilder.addOrderBy(
          `${builder.alias}."${key}"`,
          orderByKey,
        );
        builder.queryBuilder.limit(page.limit);

        if (page.timestamp) {
          builder.queryBuilder = builder.queryBuilder.andWhere(
            `${builder.alias}."${key}" ${orderCondition} :timestamp`,
            { timestamp: page.timestamp },
          );
        }
        return builder;
      },
    );
  }
}

export default GQLDatePageGenerator;
