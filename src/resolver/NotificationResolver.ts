import { Ctx, Query, Resolver } from 'type-graphql';
import { Notification } from '../entity';
import { Context } from '../Context';

@Resolver()
export class NotificationResolver {
  @Query(() => [Notification], {
    description: 'Get up to 5 latest notifications',
  })
  latestNotifications(@Ctx() ctx: Context): Promise<Notification[]> {
    return ctx
      .getRepository(Notification)
      .find({ order: { timestamp: 'DESC' }, take: 5 });
  }
}
