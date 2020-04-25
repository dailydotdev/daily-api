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
import { IsUrl } from 'class-validator';
import { GraphQLResolveInfo } from 'graphql';
import { Column } from 'typeorm';
import {
  RelayedQuery,
  RelayLimitOffset,
  RelayLimitOffsetArgs,
} from 'auto-relay';
import { fetchUserInfo, getRelayNodeInfo, partialUpdate } from '../common';
import { Context } from '../Context';
import { Roles } from '../authChecker';

@InputType()
export class RequestSourceInput implements Partial<SourceRequest> {
  @Field({ description: 'URL to the source website' })
  @IsUrl({}, { message: 'Must be a valid URL' })
  sourceUrl: string;
}

@InputType()
export class UpdateRequestSourceInput implements Partial<SourceRequest> {
  @Field({ description: 'URL to the source website' })
  @IsUrl({}, { message: 'Must be a valid URL' })
  sourceUrl?: string;

  @Field({
    description: 'Id for the future source',
    nullable: true,
  })
  sourceId?: string;

  @Column({ type: 'text', nullable: true })
  @Field({
    description: 'Name of the future source',
    nullable: true,
  })
  sourceName?: string;

  @Column({ type: 'text', nullable: true })
  @Field({
    description: 'URL for thumbnail image of the future source',
    nullable: true,
  })
  @IsUrl({}, { message: 'Must be a valid URL' })
  sourceImage?: string;

  @Column({ type: 'text', nullable: true })
  @Field({
    description: 'Twitter handle of the future source',
    nullable: true,
  })
  sourceTwitter?: string;

  @Column({ type: 'text', nullable: true })
  @Field({
    description: 'Feed (RSS/Atom) of the future source',
    nullable: true,
  })
  @IsUrl({}, { message: 'Must be a valid URL' })
  sourceFeed?: string;
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

  @Mutation(() => SourceRequest)
  @Authorized(Roles.Moderator)
  async updateRequestSource(
    @Arg('id') id: string,
    @Arg('data') data: UpdateRequestSourceInput,
    @Ctx() ctx: Context,
  ): Promise<SourceRequest> {
    const req = await ctx.getRepository(SourceRequest).findOneOrFail(id);
    partialUpdate(req, data);
    return ctx.getRepository(SourceRequest).save(req);
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
