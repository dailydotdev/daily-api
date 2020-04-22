import { mock } from 'jest-mock-extended';
import { FastifyRequest } from 'fastify';
import { Connection } from 'typeorm';
import { Context } from '../src/Context';

export class MockContext extends Context {
  constructor(con: Connection) {
    super(mock<FastifyRequest>(), con);
  }
}
