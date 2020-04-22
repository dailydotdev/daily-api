import { Connection, EntitySchema, ObjectType, Repository } from 'typeorm';
import { Request } from './Request';
import { Logger } from 'fastify';

export class Context {
  req: Request;
  con: Connection;

  constructor(req: Request, con: Connection) {
    this.req = req;
    this.con = con;
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
