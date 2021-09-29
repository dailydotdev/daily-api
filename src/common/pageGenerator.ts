import { GraphORMBuilder } from './../graphorm/graphorm';
import { GraphQLResolveInfo } from 'graphql';
import { Context } from './../Context';
import { Connection, ConnectionArguments } from 'graphql-relay';
import graphorm from '../graphorm';
import { Page, PageGenerator } from '../schema/common';
import { getCursorFromAfter } from './pagination';
import { base64 } from './base64';

export interface GQLPage extends Page {
  timestamp?: Date;
}

export interface GQLDatePageGeneratorConfig {
  maxSize?: number;
}

export interface GQLDatePageGeneratorEntity {
  createdAt: Date;
}

const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_MAX_SIZE = 100;

export function createDatePageGenerator({
  maxSize = DEFAULT_MAX_SIZE,
}: GQLDatePageGeneratorConfig): PageGenerator<
  GQLDatePageGeneratorEntity,
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
    nodeToCursor: (_, __, node) => base64(`time:${node.createdAt.getTime()}`),
    hasNextPage: (page, nodesSize) => page.limit === nodesSize,
    hasPreviousPage: (page) => !!page.timestamp,
  };
}

export type GQLDatePageGeneratorType = PageGenerator<
  GQLDatePageGeneratorEntity,
  ConnectionArguments,
  GQLPage
>;

export class GQLDatePageGenerator {
  #pageGenerator: GQLDatePageGeneratorType;

  constructor(props: GQLDatePageGeneratorConfig = {}) {
    this.#pageGenerator = createDatePageGenerator(props);
  }

  get pageGenerator(): GQLDatePageGeneratorType {
    return this.#pageGenerator;
  }

  createPageGenerator(props: GQLDatePageGeneratorConfig = {}) {
    this.#pageGenerator = createDatePageGenerator(props);
  }

  queryPaginated<
    TEntity extends GQLDatePageGeneratorEntity,
    TArgs extends ConnectionArguments,
  >(
    ctx: Context,
    info: GraphQLResolveInfo,
    args: TArgs,
    query?: (builder: GraphORMBuilder) => GraphORMBuilder,
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
        const builder = (query && query(defaultBuilder)) || defaultBuilder;

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
  }
}

export default PageGenerator;
