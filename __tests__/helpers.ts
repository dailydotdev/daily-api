import { mock, MockProxy } from 'jest-mock-extended';
import { FastifyRequest } from 'fastify';
import { Connection } from 'typeorm';
import {
  RootSpan,
  Span,
} from '@google-cloud/trace-agent/build/src/plugin-types';
import { Context } from '../src/Context';

export class MockContext extends Context {
  mockSpan: MockProxy<RootSpan> & RootSpan;
  mockUserId?: string = null;

  constructor(con: Connection, userId: string = null) {
    super(mock<FastifyRequest>(), con);
    this.mockSpan = mock<RootSpan>();
    this.mockSpan.createChildSpan.mockImplementation(() => mock<Span>());
    this.mockUserId = userId;
  }

  get span(): RootSpan {
    return this.mockSpan;
  }

  get userId(): string | null {
    return this.mockUserId;
  }
}
