import {
  Arg,
  Authorized,
  Ctx,
  Field,
  InputType,
  Mutation,
  Query,
  Resolver,
} from 'type-graphql';
import { Context } from '../Context';
import { Settings } from '../entity';

@InputType()
export class UpdateSettingsInput implements Partial<Settings> {
  @Field({
    description: 'Preferred theme',
    nullable: true,
  })
  theme?: string;

  @Field({
    description: 'Whether to enable card animations',
    nullable: true,
  })
  enableCardAnimations?: boolean;

  @Field({
    description: 'Whether to show top sites for quick navigation',
    nullable: true,
  })
  showTopSites?: boolean;

  @Field({
    description: 'Whether to enable insane mode',
    nullable: true,
  })
  insaneMode?: boolean;

  @Field({
    description: 'Whether to enable insane mode for Daily Go',
    nullable: true,
  })
  appInsaneMode?: boolean;

  @Field({
    description: 'Spaciness level for the layout',
    nullable: true,
  })
  spaciness?: string;

  @Field({
    description: 'Whether to show unread posts only',
    nullable: true,
  })
  showOnlyUnreadPosts?: boolean;
}

@Resolver()
export class SettingsResolver {
  @Query(() => Settings, { description: 'Get the user settings' })
  @Authorized()
  async userSettings(@Ctx() ctx: Context): Promise<Settings> {
    return ctx.getRepository(Settings).findOneOrFail(ctx.userId);
  }

  @Mutation(() => Settings, { description: 'Update the user settings' })
  @Authorized()
  async updateUserSettings(
    @Arg('data') data: UpdateSettingsInput,
    @Ctx() ctx: Context,
  ): Promise<Settings> {
    const repo = ctx.getRepository(Settings);
    const settings = await repo.findOne(ctx.userId);
    if (!settings) {
      return repo.save(repo.merge(repo.create(data), { userId: ctx.userId }));
    }
    return repo.save(repo.merge(settings, data));
  }
}
