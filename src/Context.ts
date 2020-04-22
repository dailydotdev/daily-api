import { Connection, EntitySchema, ObjectType, Repository } from 'typeorm';
import { FastifyRequest, Logger } from 'fastify';
import { GraphQLDatabaseLoader } from '@mando75/typeorm-graphql-loader';

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

  getRepository<Entity>(
    target: ObjectType<Entity> | EntitySchema<Entity> | string,
  ): Repository<Entity> {
    return this.con.getRepository(target);
  }
}
