import { opentelemetry } from './telemetry/opentelemetry';
import { DataSource, EntitySchema, ObjectType, Repository } from 'typeorm';
import { FastifyRequest, FastifyBaseLogger } from 'fastify';
import { GraphQLDatabaseLoader } from '@mando75/typeorm-graphql-loader';
import { Roles } from './roles';
import { DataLoaderService } from './dataLoaderService';

export class Context {
  req: FastifyRequest;
  con: DataSource;
  loader: GraphQLDatabaseLoader;
  dataLoader: DataLoaderService;
  metricGraphqlCounter: opentelemetry.Counter;
  rateLimitCouner: opentelemetry.Counter;

  constructor(req: FastifyRequest, con) {
    this.req = req;
    this.con = con;
    this.loader = new GraphQLDatabaseLoader(con);
    this.dataLoader = new DataLoaderService({ ctx: this });
    this.metricGraphqlCounter = opentelemetry.metrics
      .getMeter('graphql')
      .createCounter('graphql_operations', {
        description:
          'How many graphql operations have been performed, their operation type and name',
      });
    this.rateLimitCouner = opentelemetry.metrics
      .getMeter('graphql')
      .createCounter('rate_limit', {
        description: 'How many times a rate limit has been hit',
      });
  }

  get service(): boolean | null {
    return this.req.service;
  }

  get userId(): string | null {
    return this.req.userId;
  }

  get trackingId(): string | null {
    return this.req.trackingId;
  }

  get premium(): boolean {
    return this.req.premium;
  }

  get roles(): Roles[] {
    return this.req.roles ?? [];
  }

  get log(): FastifyBaseLogger {
    return this.req.log;
  }

  get span(): opentelemetry.Span {
    return this.req.span;
  }

  getRepository<Entity>(
    target: ObjectType<Entity> | EntitySchema<Entity> | string,
  ): Repository<Entity> {
    return this.con.getRepository(target);
  }
}

export type SubscriptionContext = {
  req: FastifyRequest;
  con: DataSource;
  log: FastifyBaseLogger;
  userId?: string;
};
