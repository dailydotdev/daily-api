import { ApolloServer, Config } from 'apollo-server-fastify';
import { buildSchema } from 'type-graphql';
import { NotificationResolver, SourceResolver } from './resolver';
import { ResolverTracing } from './middleware';

export default async function (config: Config): Promise<ApolloServer> {
  const schema = await buildSchema({
    resolvers: [NotificationResolver, SourceResolver],
    emitSchemaFile: !process.env.NODE_ENV,
    globalMiddlewares: [ResolverTracing],
    validate: false,
  });
  return new ApolloServer({
    schema,
    ...config,
  });
}
