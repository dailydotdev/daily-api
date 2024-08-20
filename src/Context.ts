import { opentelemetry } from './telemetry';
import {
  DataSource,
  EntitySchema,
  ObjectLiteral,
  ObjectType,
  Repository,
} from 'typeorm';
import { FastifyRequest, FastifyBaseLogger } from 'fastify';
import { GraphQLDatabaseLoader } from '@mando75/typeorm-graphql-loader';
import { Roles } from './roles';
import { DataLoaderService } from './dataLoaderService';
import { ContentLanguage } from './types';

const validLanguages = Object.values(ContentLanguage);

export class Context {
  req: FastifyRequest;
  con: DataSource;
  loader: GraphQLDatabaseLoader;
  dataLoader: DataLoaderService;
  contentLanguage: ContentLanguage;

  constructor(req: FastifyRequest, con: DataSource) {
    this.req = req;
    this.con = con;
    this.loader = new GraphQLDatabaseLoader(con);
    this.dataLoader = new DataLoaderService({ ctx: this });

    const contentLanguageHeader = req.headers['content-language'];

    this.contentLanguage = validLanguages.includes(
      contentLanguageHeader as ContentLanguage,
    )
      ? (contentLanguageHeader as ContentLanguage)
      : ContentLanguage.English;
  }

  get service(): boolean {
    return !!this.req.service;
  }

  get userId(): string | undefined {
    return this.req.userId;
  }

  get trackingId(): string | undefined {
    return this.req.trackingId;
  }

  get premium(): boolean {
    return !!this.req.premium;
  }

  get roles(): Roles[] {
    return this.req.roles ?? [];
  }

  get log(): FastifyBaseLogger {
    return this.req.log;
  }

  get span(): opentelemetry.Span | undefined {
    return this.req.span;
  }

  getRepository<Entity extends ObjectLiteral>(
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

export type BaseContext = Omit<Context, 'userId' | 'trackingId'>;

export type AuthContext = BaseContext & {
  userId: string;
  trackingId: string;
};
