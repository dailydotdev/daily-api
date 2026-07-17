import type { Span } from '@opentelemetry/api';
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
import { remoteConfig } from './remoteConfig';
import { getGeo } from './common/geo';

export class Context {
  req: FastifyRequest;
  con: DataSource;
  loader: GraphQLDatabaseLoader;
  dataLoader: DataLoaderService;
  contentLanguage: ContentLanguage | null;
  private _region?: string;

  constructor(req: FastifyRequest, con: DataSource) {
    this.req = req;
    this.con = con;
    this.loader = new GraphQLDatabaseLoader(con);
    this.dataLoader = new DataLoaderService({ ctx: this });

    const contentLanguageHeader = req.headers['content-language'];
    const validLanguages = Object.keys(remoteConfig.validLanguages || {});

    this.contentLanguage = validLanguages.includes(
      contentLanguageHeader as ContentLanguage,
    )
      ? (contentLanguageHeader as ContentLanguage)
      : null;
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

  get isTeamMember(): boolean {
    return !!this.req.isTeamMember;
  }

  get roles(): Roles[] {
    return this.req.roles ?? [];
  }

  get log(): FastifyBaseLogger {
    return this.req.log;
  }

  get span(): Span | null {
    return this.req.opentelemetry().span;
  }

  get isPlus(): boolean {
    return !!this.req.isPlus;
  }

  get region(): string {
    if (typeof this._region === 'undefined') {
      this._region = getGeo({ ip: this.req.ip }).country ?? '';
    }
    return this._region;
  }

  getRepository<Entity extends ObjectLiteral>(
    target: ObjectType<Entity> | EntitySchema<Entity> | string,
  ): Repository<Entity> {
    return this.con.getRepository(target);
  }

  get requestMeta(): RequestMeta {
    return {
      userId: this.req.userId || 'unknown',
      trackingId: this.req.trackingId || 'unknown',
      userAgent: this.req.headers['user-agent'] || 'unknown',
      ip: this.req.ip || 'unknown',
      origin: this.req.headers.origin || 'unknown',
      referer: this.req.headers.referer || 'unknown',
      acceptLanguage: this.req.headers['accept-language'] || 'unknown',
    };
  }
}

export type RequestMeta = {
  userId: string;
  trackingId: string;
  userAgent: string;
  ip: string;
  origin: string;
  referer: string;
  acceptLanguage: string;
};

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
