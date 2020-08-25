import { mock, MockProxy } from 'jest-mock-extended';
import fastify, { FastifyRequest, Logger } from 'fastify';
import fastifyStatic from 'fastify-static';
import { Connection, DeepPartial, ObjectType } from 'typeorm';
import request from 'supertest';
import {
  RootSpan,
  Span,
} from '@google-cloud/trace-agent/build/src/plugin-types';
import { GraphQLFormattedError } from 'graphql';
import { ApolloServerTestClient } from 'apollo-server-testing';
import { Context } from '../src/Context';
import { Message } from '@google-cloud/pubsub';
import { base64 } from '../src/common';
import { join } from 'path';
import http from 'http';

export class MockContext extends Context {
  mockSpan: MockProxy<RootSpan> & RootSpan;
  mockUserId: string | null;
  mockPremium: boolean;
  logger: Logger;

  constructor(con: Connection, userId: string = null, premium = false) {
    super(mock<FastifyRequest>(), con);
    this.mockSpan = mock<RootSpan>();
    this.mockSpan.createChildSpan.mockImplementation(() => mock<Span>());
    this.mockUserId = userId;
    this.mockPremium = premium;
    this.logger = mock<Logger>();
  }

  get span(): RootSpan {
    return this.mockSpan;
  }

  get userId(): string | null {
    return this.mockUserId;
  }

  get premium(): boolean | null {
    return this.mockPremium;
  }

  get log(): Logger {
    return this.logger;
  }
}

export const authorizeRequest = (
  req: request.Test,
  userId = '1',
): request.Test =>
  req
    .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
    .set('user-id', userId)
    .set('logged-in', 'true');

export type Mutation = {
  mutation: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  variables?: { [name: string]: any };
};

export const testMutationError = async (
  client: ApolloServerTestClient,
  mutation: Mutation,
  callback: (errors: readonly GraphQLFormattedError[]) => void | Promise<void>,
): Promise<void> => {
  const res = await client.mutate(mutation);
  return callback(res.errors);
};

export const testMutationErrorCode = async (
  client: ApolloServerTestClient,
  mutation: Mutation,
  code: string,
): Promise<void> =>
  testMutationError(client, mutation, (errors) => {
    expect(errors.length).toEqual(1);
    expect(errors[0].extensions.code).toEqual(code);
  });

export type Query = {
  query: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  variables?: { [name: string]: any };
};

export const testQueryError = async (
  client: ApolloServerTestClient,
  query: Query,
  callback: (errors: readonly GraphQLFormattedError[]) => void | Promise<void>,
): Promise<void> => {
  const res = await client.query(query);
  return callback(res.errors);
};

export const testQueryErrorCode = async (
  client: ApolloServerTestClient,
  query: Query,
  code: string,
): Promise<void> =>
  testQueryError(client, query, (errors) => {
    expect(errors.length).toEqual(1);
    expect(errors[0].extensions.code).toEqual(code);
  });

export async function saveFixtures<Entity>(
  con: Connection,
  target: ObjectType<Entity>,
  entities: DeepPartial<Entity>[],
): Promise<void> {
  await con
    .getRepository(target)
    .save(entities.map((e) => con.getRepository(target).create(e)));
}

export const mockMessage = (data: object): Message => {
  const message = new Message(null, {
    message: {
      data: Buffer.from(base64(JSON.stringify(data)), 'base64'),
    },
  });
  message.ack = jest.fn();
  message.nack = jest.fn();
  return message;
};

export const setupStaticServer = async (
  rss?: string,
): Promise<fastify.FastifyInstance> => {
  const app = fastify({ logger: false });
  app.register(fastifyStatic, {
    root: join(__dirname, 'fixture'),
    prefix: '/',
    setHeaders(res: http.ServerResponse, path: string): void {
      if (rss && path.indexOf(rss) > -1) {
        res.setHeader('content-type', 'application/rss+xml');
      }
    },
  });
  if (rss) {
    app.get('/rss.xml', (req, res) => {
      res.sendFile(rss);
    });
  }
  await app.listen(6789);
  return app;
};
