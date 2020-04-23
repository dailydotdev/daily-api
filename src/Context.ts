import { Connection, EntitySchema, ObjectType, Repository } from 'typeorm';
import { FastifyRequest, Logger } from 'fastify';
import { GraphQLDatabaseLoader } from '@mando75/typeorm-graphql-loader';
import { RootSpan } from '@google-cloud/trace-agent/build/src/plugin-types';

export class Context {
  req: FastifyRequest;
  con: Connection;
  loader: GraphQLDatabaseLoader;

  constructor(req: FastifyRequest, con: Connection) {
    this.req = req;
    this.con = con;
    this.loader = new GraphQLDatabaseLoader(this.con);
  }

  get userId(): string | null {
    return this.req.userId;
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
