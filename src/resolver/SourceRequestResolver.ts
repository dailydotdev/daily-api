import {
  Arg,
  Authorized,
  Ctx,
  Field,
  Info,
  InputType,
  Mutation,
  Resolver,
} from 'type-graphql';
import { SourceRequest } from '../entity';
import { Context } from '../Context';
import { IsUrl } from 'class-validator';
import { fetchUserInfo } from '../users';
import {
  RelayedQuery,
  RelayLimitOffset,
  RelayLimitOffsetArgs,
} from 'auto-relay';
import { Roles } from '../authChecker';
import { GraphQLResolveInfo } from 'graphql';
import { getRelayNodeInfo } from '../pagination';

@InputType()
export class RequestSourceInput implements Partial<SourceRequest> {
  @Field({ description: 'URL to the source website' })
  @IsUrl({}, { message: 'Must be a valid URL' })
  sourceUrl: string;
}

@Resolver()
export class SourceRequestResolver {
  @Mutation(() => SourceRequest)
  @Authorized()
  async requestSource(
    @Arg('data') data: RequestSourceInput,
    @Ctx() ctx: Context,
  ): Promise<SourceRequest> {
    const info = await fetchUserInfo(ctx.userId);
    const sourceReq = new SourceRequest();
    sourceReq.sourceUrl = data.sourceUrl;
    sourceReq.userId = ctx.userId;
    sourceReq.userName = info.name;
    sourceReq.userEmail = info.email;
    return ctx.getRepository(SourceRequest).save(sourceReq);
  }

  @RelayedQuery(() => SourceRequest, {
    description: 'Get all pending source requests',
  })
  @Authorized(Roles.Moderator)
  async pendingSourceRequests(
    @Ctx() ctx: Context,
    @RelayLimitOffset() { limit, offset }: RelayLimitOffsetArgs,
    @Info() info: GraphQLResolveInfo,
  ): Promise<[number, SourceRequest[]]> {
    const [rows, total] = await ctx.loader.loadManyPaginated<SourceRequest>(
      SourceRequest,
      { closed: false },
      getRelayNodeInfo(info),
      {
        limit,
        offset,
      },
      { order: { '"createdAt"': 'ASC' } },
    );
    return [total, rows];
  }
}
