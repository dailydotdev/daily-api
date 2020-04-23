import { ApolloServer, Config } from 'apollo-server-fastify';
import { buildSchema } from 'type-graphql';
import { NotificationResolver } from './resolver';
import { ResolverTracing } from './middleware';

export default async function (config: Config): Promise<ApolloServer> {
  const schema = await buildSchema({
    resolvers: [NotificationResolver],
    emitSchemaFile: !process.env.NODE_ENV,
    globalMiddlewares: [ResolverTracing],
  });
  return new ApolloServer({
    schema,
    ...config,
  });
}
