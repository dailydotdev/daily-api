import { Connection, EntitySchema, ObjectType, Repository } from 'typeorm';
import { FastifyRequest, Logger } from 'fastify';
import { RootSpan } from '@google-cloud/trace-agent/build/src/plugin-types';
import { GraphQLDatabaseLoader } from '@mando75/typeorm-graphql-loader';
import { Roles } from './roles';

export class Context {
  req: FastifyRequest;
  con: Connection;
  loader: GraphQLDatabaseLoader;

  constructor(req: FastifyRequest, con: Connection) {
    this.req = req;
    this.con = con;
    this.loader = new GraphQLDatabaseLoader(con);
  }

  get userId(): string | null {
    return this.req.userId;
  }

  get trackingId(): string | null {
    return this.req.cookies.da2;
  }

  get premium(): boolean {
    return this.req.premium;
  }

  get roles(): Roles[] {
    return this.req.roles ?? [];
  }

  get log(): Logger {
    return this.req.log;
  }

  get span(): RootSpan {
    return this.req.span;
  }

  getRepository<Entity>(
    target: ObjectType<Entity> | EntitySchema<Entity> | string,
  ): Repository<Entity> {
    return this.con.getRepository(target);
  }
}
