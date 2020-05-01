import {
  Arg,
  Authorized,
  Ctx,
  Field,
  ForbiddenError,
  ID,
  Info,
  InputType,
  Mutation,
  Resolver,
  UseMiddleware,
} from 'type-graphql';
import { Source, SourceDisplay, SourceFeed, SourceRequest } from '../entity';
import { IsUrl } from 'class-validator';
import { GraphQLResolveInfo } from 'graphql';
import { Column } from 'typeorm';
import {
  RelayedQuery,
  RelayLimitOffset,
  RelayLimitOffsetArgs,
} from 'auto-relay';
import { GraphQLUpload, FileUpload } from 'graphql-upload';
import { v4 as uuidv4 } from 'uuid';
import {
  addOrRemoveSuperfeedrSubscription,
  fetchUserInfo,
  getRelayNodeInfo,
  notifySourceRequest,
  partialUpdate,
  uploadLogo,
} from '../common';
import { Context } from '../Context';
import { Roles } from '../authChecker';
import { ResolverTracing } from '../middleware';

@InputType()
export class RequestSourceInput implements Partial<SourceRequest> {
  @Field({ description: 'URL to the source website' })
  @IsUrl({}, { message: 'Must be a valid URL' })
  sourceUrl: string;
}

@InputType()
export class UpdateSourceRequestInput implements Partial<SourceRequest> {
  @Field({ description: 'URL to the source website', nullable: true })
  @IsUrl({}, { message: 'Must be a valid URL' })
  sourceUrl?: string;

  @Field(() => ID, {
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

const findOrFail = async (ctx: Context, id: string): Promise<SourceRequest> => {
  const req = await ctx.getRepository(SourceRequest).findOneOrFail(id);
  if (req.closed) {
    throw new ForbiddenError();
  }
  return req;
};

const partialUpdateSourceRequest = async (
  ctx: Context,
  id: string,
  data: Partial<SourceRequest>,
): Promise<SourceRequest> => {
  const req = await findOrFail(ctx, id);
  partialUpdate(req, data);
  return ctx.getRepository(SourceRequest).save(req);
};

const createSourceFromRequest = (
  ctx: Context,
  req: SourceRequest,
): Promise<Source> =>
  ctx.con.manager.transaction(
    async (entityManager): Promise<Source> => {
      const source = new Source();
      source.id = req.sourceId;
      source.twitter = req.sourceTwitter;
      source.website = req.sourceUrl;
      await entityManager.save(source);

      const display = new SourceDisplay();
      display.name = req.sourceName;
      display.image = req.sourceImage;
      display.sourceId = source.id;

      const feed = new SourceFeed();
      feed.feed = req.sourceFeed;
      feed.sourceId = source.id;

      await Promise.all([
        entityManager.save(display),
        entityManager.save(feed),
      ]);

      return source;
    },
  );

@Resolver()
export class SourceRequestResolver {
  @Mutation(() => SourceRequest, { description: 'Request a new source' })
  @Authorized()
  @UseMiddleware(ResolverTracing)
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
    await ctx.getRepository(SourceRequest).save(sourceReq);
    await notifySourceRequest('new', sourceReq);
    return sourceReq;
  }

  @Mutation(() => SourceRequest, {
    description: 'Update the information of a source request',
  })
  @Authorized(Roles.Moderator)
  @UseMiddleware(ResolverTracing)
  async updateSourceRequest(
    @Arg('id') id: string,
    @Arg('data') data: UpdateSourceRequestInput,
    @Ctx() ctx: Context,
  ): Promise<SourceRequest> {
    return partialUpdateSourceRequest(ctx, id, data);
  }

  @Mutation(() => SourceRequest, {
    description: 'Decline a source request',
  })
  @Authorized(Roles.Moderator)
  @UseMiddleware(ResolverTracing)
  async declineSourceRequest(
    @Arg('id') id: string,
    @Arg('data') data: DeclineSourceRequestInput,
    @Ctx() ctx: Context,
  ): Promise<SourceRequest> {
    const req = await partialUpdateSourceRequest(ctx, id, {
      approved: false,
      closed: true,
      ...data,
    });
    await notifySourceRequest('decline', req);
    return req;
  }

  @Mutation(() => SourceRequest, {
    description: "Approve a source request (but doesn't publish it)",
  })
  @Authorized(Roles.Moderator)
  @UseMiddleware(ResolverTracing)
  async approveSourceRequest(
    @Arg('id') id: string,
    @Ctx() ctx: Context,
  ): Promise<SourceRequest> {
    const req = await partialUpdateSourceRequest(ctx, id, {
      approved: true,
    });
    await notifySourceRequest('approve', req);
    return req;
  }

  @Mutation(() => SourceRequest, {
    description: 'Publish a source request and turn it into a source',
  })
  @Authorized(Roles.Moderator)
  @UseMiddleware(ResolverTracing)
  async publishSourceRequest(
    @Arg('id') id: string,
    @Ctx() ctx: Context,
  ): Promise<SourceRequest> {
    const req = await findOrFail(ctx, id);
    if (
      !req.sourceId ||
      !req.sourceName ||
      !req.sourceImage ||
      !req.sourceFeed ||
      !req.approved
    ) {
      throw new ForbiddenError();
    }
    await createSourceFromRequest(ctx, req);
    req.closed = true;
    await ctx.getRepository(SourceRequest).save(req);
    await notifySourceRequest('publish', req);
    await addOrRemoveSuperfeedrSubscription(
      req.sourceFeed,
      req.sourceId,
      'subscribe',
    );
    ctx.log.info(
      {
        sourceRequest: req,
      },
      `published new source ${req.id}`,
    );
    return req;
  }

  @Mutation(() => SourceRequest, {
    description: 'Upload a logo to a source request',
  })
  @Authorized(Roles.Moderator)
  @UseMiddleware(ResolverTracing)
  async uploadSourceRequestLogo(
    @Arg('id') id: string,
    @Arg('file', () => GraphQLUpload) file: FileUpload,
    @Ctx() ctx: Context,
  ): Promise<SourceRequest> {
    const req = await findOrFail(ctx, id);
    const { createReadStream } = await file;
    const stream = createReadStream();
    const name = uuidv4().replace(/-/g, '');
    const img = await uploadLogo(name, stream);
    ctx.log.info(
      {
        sourceRequest: req,
        img,
      },
      'uploaded image for source request',
    );
    req.sourceImage = img;
    return ctx.getRepository(SourceRequest).save(req);
  }

  @RelayedQuery(() => SourceRequest, {
    description: 'Get all pending source requests',
  })
  @Authorized(Roles.Moderator)
  @UseMiddleware(ResolverTracing)
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
