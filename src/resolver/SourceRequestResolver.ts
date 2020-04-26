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
export class UpdateSourceRequestInput implements Partial<SourceRequest> {
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

@InputType()
export class DeclineSourceRequestInput implements Partial<SourceRequest> {
  @Field({ description: 'Reason for not accepting this request' })
  reason: string;
}

@Resolver()
export class SourceRequestResolver {
  async partialUpdateSourceRequest(
    ctx: Context,
    id: string,
    data: Partial<SourceRequest>,
  ): Promise<SourceRequest> {
    const req = await ctx.getRepository(SourceRequest).findOneOrFail(id);
    partialUpdate(req, data);
    return ctx.getRepository(SourceRequest).save(req);
  }

  @Mutation(() => SourceRequest, { description: 'Request a new source' })
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

  @Mutation(() => SourceRequest, {
    description: 'Update the information of a source request',
  })
  @Authorized(Roles.Moderator)
  async updateSourceRequest(
    @Arg('id') id: string,
    @Arg('data') data: UpdateSourceRequestInput,
    @Ctx() ctx: Context,
  ): Promise<SourceRequest> {
    return this.partialUpdateSourceRequest(ctx, id, data);
  }

  @Mutation(() => SourceRequest, {
    description: 'Decline a source request',
  })
  @Authorized(Roles.Moderator)
  async declineSourceRequest(
    @Arg('id') id: string,
    @Arg('data') data: DeclineSourceRequestInput,
    @Ctx() ctx: Context,
  ): Promise<SourceRequest> {
    return this.partialUpdateSourceRequest(ctx, id, {
      approved: false,
      closed: true,
      ...data,
    });
  }

  @Mutation(() => SourceRequest, {
    description: "Approve a source request (but doesn't publish it)",
  })
  @Authorized(Roles.Moderator)
  async approveSourceRequest(
    @Arg('id') id: string,
    @Ctx() ctx: Context,
  ): Promise<SourceRequest> {
    return this.partialUpdateSourceRequest(ctx, id, {
      approved: true,
    });
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
