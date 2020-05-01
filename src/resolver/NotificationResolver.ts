import { Ctx, Query, Resolver, UseMiddleware } from 'type-graphql';
import { Notification } from '../entity';
import { Context } from '../Context';
import { ResolverTracing } from '../middleware';

@Resolver()
export class NotificationResolver {
  @Query(() => [Notification], {
    description: 'Get up to 5 latest notifications',
  })
  @UseMiddleware(ResolverTracing)
  latestNotifications(@Ctx() ctx: Context): Promise<Notification[]> {
    return ctx
      .getRepository(Notification)
      .find({ order: { timestamp: 'DESC' }, take: 5 });
  }
}
