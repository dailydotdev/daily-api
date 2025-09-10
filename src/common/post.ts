import { DataSource, EntityManager, In, Not } from 'typeorm';
import {
  Comment,
  ConnectionManager,
  createExternalLink,
  createSharePost,
  ExternalLinkPreview,
  FreeformPost,
  generateTitleHtml,
  Post,
  PostOrigin,
  PostType,
  Source,
  SourceMember,
  SourceType,
  SquadSource,
  translateablePostFields,
  User,
  validateCommentary,
  WelcomePost,
  type PostTranslation,
  ArticlePost,
  preparePostForInsert,
} from '../entity';
import { ForbiddenError, ValidationError } from 'apollo-server-errors';
import { isValidHttpUrl, standardizeURL } from './links';
import { findMarkdownTag, markdown } from './markdown';
import { generateShortId } from '../ids';
import { GQLPost } from '../schema/posts';
// @ts-expect-error - no types
import { FileUpload } from 'graphql-upload/GraphQLUpload.js';
import { HttpError, retryFetchParse } from '../integrations/retry';
import { checkWithVordr, VordrFilterType } from './vordr';
import { AuthContext, type Context } from '../Context';
import { createHash } from 'node:crypto';
import { PostCodeSnippet } from '../entity/posts/PostCodeSnippet';
import { logger } from '../logger';
import { downloadJsonFile } from './googleCloud';
import {
  ContentLanguage,
  type ChangeObject,
  type I18nRecord,
  type PostCodeSnippetJsonFile,
} from '../types';
import { uniqueifyObjectArray } from './utils';
import {
  SourcePostModeration,
  SourcePostModerationStatus,
} from '../entity/SourcePostModeration';
import { mapCloudinaryUrl, uploadPostFile, UploadPreset } from './cloudinary';
import { getMentions } from '../schema/comments';
import type { ConnectionArguments } from 'graphql-relay';
import graphorm from '../graphorm';
import type { GraphQLResolveInfo } from 'graphql';
import { offsetPageGenerator } from '../schema/common';
import { SourceMemberRoles } from '../roles';
import { queryReadReplica } from './queryReadReplica';
import { PollOption } from '../entity/polls/PollOption';
import addDays from 'date-fns/addDays';
import { PollPost } from '../entity/posts/PollPost';

export type SourcePostModerationArgs = ConnectionArguments & {
  sourceId: string;
  status: SourcePostModerationStatus[];
};

export interface GQLSourcePostModeration {
  id: string;
  title?: string;
  content?: string;
  contentHtml?: string;
  image?: string;
  sourceId: string;
  sharedPostId?: string;
  status: SourcePostModerationStatus;
  createdAt: Date;
  updatedAt: Date;
  source: Source;
  post?: Post;
  postId?: string;
}

const POST_MODERATION_PAGE_SIZE = 15;
const sourcePostModerationPageGenerator =
  offsetPageGenerator<GQLSourcePostModeration>(POST_MODERATION_PAGE_SIZE, 50);

export const defaultImage = {
  urls:
    process.env.DEFAULT_IMAGE_URL?.split?.(',').map((x: string) =>
      mapCloudinaryUrl(x),
    ) ?? [],
  welcomePost:
    'https://media.daily.dev/image/upload/f_auto,q_auto/public/welcome_post',
};

// 1x1 transparent pixel, used in the places where we don't need an image, but it is required.
// E.g. in notifications, like the top reader badge.
export const emptyImage =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEUAAACnej3aAAAAAXRSTlMAQObYZgAAAApJREFUCNdjYAAAAAIAAeIhvDMAAAAASUVORK5CYII=';

export const pickImageUrl = (post: {
  createdAt: Date | string | number;
}): string =>
  defaultImage.urls[
    Math.floor(new Date(post.createdAt).getTime() / 1000) %
      defaultImage.urls.length
  ];

interface PostCommentersProps {
  limit?: number;
  userId?: string;
}

export const getPostCommenterIds = async (
  con: DataSource,
  postId: string,
  { userId, limit = 4 }: PostCommentersProps,
): Promise<string[]> => {
  let queryBuilder = con
    .getRepository(Comment)
    .createQueryBuilder('c')
    .select(`DISTINCT c."userId"`)
    .innerJoin(User, 'u', 'u.id = c."userId"')
    .where('c."postId" = :postId', { postId })
    .andWhere('u.username IS NOT NULL');

  if (userId) {
    queryBuilder = queryBuilder.andWhere('c."userId" != :userId', { userId });
  }

  if (limit) {
    queryBuilder = queryBuilder.limit(limit);
  }

  const result = await queryBuilder.getRawMany<Comment>();

  return result.map((comment) => comment.userId);
};

export const DEFAULT_POST_TITLE = 'No title';

export const postScraperOrigin = process.env.POST_SCRAPER_ORIGIN;

export const fetchLinkPreview = async (
  url: string,
): Promise<ExternalLinkPreview> => {
  if (!isValidHttpUrl(url)) {
    throw new ValidationError('URL is not valid');
  }

  try {
    return await retryFetchParse(`${postScraperOrigin}/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
  } catch (err) {
    if (err instanceof HttpError) {
      if (err.statusCode >= 400 && err.statusCode < 500) {
        throw new ValidationError('Bad request!');
      }
    }
    throw err;
  }
};

export const WELCOME_POST_TITLE =
  process.env.WELCOME_POST_TITLE ??
  'Hello World! Start your squad journey here';

const getWelcomeContent = ({
  name,
}: Pick<
  SquadSource,
  'name'
>) => `Welcome to ${name}, a dedicated space to collaborate, share knowledge, and discuss topics that matter to us!

Here are some of the things you can do in Squads:

* Say hi: Start by saying hi in the comments below so that we'll know you're here
* Create a new post: Share interesting links and your thoughts by creating a new post in the squad
* Interact with others: Comment and upvote on other members' posts and give feedback
* Personalize it: Customize your profile by adding a profile picture, bio, and links to your projects or social media
* Invite other developers you know and appreciate that you think can benefit from this squad

Now that you know what you can do in this squad, we've put together a code of conduct that we expect all of our squad members to follow:

1. Keep it relevant: Keep your posts and comments relevant to the topic of the Squad. Please refrain from spamming or promoting unrelated content.
2. Be respectful: Treat others the way you want to be treated. We do not tolerate hate speech, discrimination, or harassment of any kind.
3. Be constructive: Offer helpful feedback and constructive criticism rather than tearing others down.
4. Protect your privacy: Do not share personal information or sensitive data in Squads.

We hope you will find ${name} useful!`;

export const createSquadWelcomePost = async (
  con: DataSource | EntityManager,
  source: Pick<SquadSource, 'id' | 'name'>,
  adminId: string,
  args: Partial<FreeformPost> = {},
) => {
  const content = getWelcomeContent(source);
  const id = await generateShortId();

  return con.getRepository(WelcomePost).save({
    ...args,
    id,
    shortId: id,
    title: WELCOME_POST_TITLE,
    sourceId: source.id,
    authorId: adminId,
    content,
    contentHtml: markdown.render(content),
    image: defaultImage.welcomePost,
    banned: true,
    flags: {
      banned: true,
      private: true,
      visible: true,
      showOnFeed: false,
    },
    visible: true,
    private: true,
    pinnedAt: new Date(),
    visibleAt: new Date(),
    origin: PostOrigin.UserGenerated,
    showOnFeed: false,
  } as Partial<Post>);
};

export type EditablePost = Pick<
  FreeformPost,
  'title' | 'content' | 'image' | 'contentHtml' | 'flags'
>;

export type CreatePost = Pick<
  FreeformPost,
  'title' | 'content' | 'image' | 'contentHtml' | 'authorId' | 'sourceId' | 'id'
>;

interface CreateFreeformPostArgs {
  con: DataSource | EntityManager;
  ctx?: AuthContext;
  args: CreatePost;
}

interface CreatePollPostArgs {
  con: DataSource | EntityManager;
  ctx: AuthContext;
  args: {
    id: string;
    title: string;
    sourceId: string;
    authorId: string;
    duration?: number;
    pollOptions: PollOption[];
  };
}

export const createPollPost = async ({
  con,
  ctx,
  args,
}: CreatePollPostArgs) => {
  const { pollOptions, ...restArgs } = args;
  const { private: privacy } = await con.getRepository(Source).findOneByOrFail({
    id: restArgs.sourceId,
    type: In([SourceType.Squad, SourceType.User]),
  });

  const createdPost = con.getRepository(PollPost).create({
    ...restArgs,
    shortId: restArgs.id,
    endsAt: restArgs?.duration ? addDays(new Date(), restArgs.duration) : null,
    visible: true,
    private: privacy,
    visibleAt: new Date(),
    origin: PostOrigin.UserGenerated,
    flags: {
      visible: true,
      private: privacy,
    },
  });

  const vordrStatus = await checkWithVordr(
    {
      id: createdPost.id,
      type: VordrFilterType.Post,
      content: createdPost.title || '',
    },
    { con, userId: args.authorId, req: ctx?.req },
  );

  if (vordrStatus) {
    createdPost.banned = true;
    createdPost.showOnFeed = false;

    createdPost.flags = {
      ...createdPost.flags,
      banned: true,
      showOnFeed: false,
    };
  }

  createdPost.flags.vordr = vordrStatus;

  return con.transaction(async (entityManager) => {
    const savedPost = await entityManager
      .getRepository(PollPost)
      .save(createdPost);
    await entityManager.getRepository(PollOption).save(pollOptions);
    return savedPost;
  });
};

export const createFreeformPost = async ({
  con,
  args,
  ctx,
}: CreateFreeformPostArgs) => {
  const { private: privacy } = await con.getRepository(Source).findOneByOrFail({
    id: args.sourceId,
    type: In([SourceType.Squad, SourceType.User]),
  });

  let createdPost = con.getRepository(FreeformPost).create({
    ...args,
    shortId: args.id,
    visible: true,
    private: privacy,
    visibleAt: new Date(),
    origin: PostOrigin.UserGenerated,
    flags: {
      visible: true,
      private: privacy,
    },
  });

  // Apply vordr checks before saving
  createdPost = await preparePostForInsert(createdPost, {
    con,
    userId: args.authorId || undefined,
    req: ctx?.req,
  });

  return con.getRepository(FreeformPost).save(createdPost);
};

export type CreateSourcePostModeration = Omit<
  CreatePost,
  'authorId' | 'content' | 'contentHtml' | 'id'
> &
  Pick<
    SourcePostModeration,
    'titleHtml' | 'content' | 'type' | 'sharedPostId' | 'createdById'
  > & {
    contentHtml?: string;
    externalLink?: string | null;
    postId?: string;
  };

interface CreateSourcePostModerationProps {
  ctx: AuthContext;
  args: CreateSourcePostModeration;
}

export const createSourcePostModeration = async ({
  ctx,
  args,
}: CreateSourcePostModerationProps) => {
  const { con } = ctx;

  if (args.postId) {
    const post = await con
      .getRepository(Post)
      .findOneByOrFail({ id: args.postId });

    if (args.createdById !== post.authorId) {
      throw new ForbiddenError('Cannot edit posts created by other users');
    }
  }

  const newModerationEntry = con.getRepository(SourcePostModeration).create({
    ...args,
    status: SourcePostModerationStatus.Pending,
  });

  const content = `${args.title} ${args.content}`.trim();

  newModerationEntry.flags = {
    vordr: await checkWithVordr(
      {
        id: newModerationEntry.id,
        type: VordrFilterType.PostModeration,
        content,
      },
      { con, userId: ctx.userId, req: ctx.req },
    ),
  };

  return await con.getRepository(SourcePostModeration).save(newModerationEntry);
};

export interface CreateSourcePostModerationArgs
  extends Pick<EditPostArgs, 'title' | 'image'> {
  content?: string | null;
  imageUrl?: string;
  sourceId: string;
  sharedPostId?: string | null;
  externalLink?: string | null;
  type: PostType;
  postId?: string;
}

export interface EditPostArgs
  extends Pick<GQLPost, 'id' | 'title' | 'content'> {
  image: Promise<FileUpload>;
}

export interface CreatePostArgs
  extends Pick<EditPostArgs, 'title' | 'content' | 'image'> {
  sourceId: string;
}

export interface PollOptionInput {
  text: string;
  order: number;
}

export interface CreatePollPostProps
  extends Pick<CreatePostArgs, 'title' | 'sourceId'> {
  options: PollOptionInput[];
  duration: number;
}

const MAX_TITLE_LENGTH = 250;
const MAX_CONTENT_LENGTH = 10_000;

type ValidatePostArgs = Pick<EditPostArgs, 'title' | 'content'>;

export const validatePost = (
  args: ValidatePostArgs,
): Required<ValidatePostArgs> => {
  const title = args.title?.trim() ?? '';
  const content = args.content?.trim() ?? '';

  if (title.length > MAX_TITLE_LENGTH) {
    throw new ValidationError(
      `Title has a maximum length of ${MAX_TITLE_LENGTH} characters`,
    );
  }

  if (content.length > MAX_CONTENT_LENGTH) {
    throw new ValidationError(
      `Content has a maximum length of ${MAX_CONTENT_LENGTH} characters`,
    );
  }

  return { title, content };
};

export const submitArticleThreshold = parseInt(
  process.env.SUBMIT_ARTICLE_THRESHOLD,
);

export const insertCodeSnippets = async ({
  entityManager,
  post,
  codeSnippetsJson,
}: {
  entityManager: EntityManager;
  post: Pick<Post, 'id'>;
  codeSnippetsJson: PostCodeSnippetJsonFile;
}) => {
  const uniqueCodeSnippets = uniqueifyObjectArray(
    codeSnippetsJson.snippets,
    (codeSnippetsContent) => {
      const checksum = createHash('sha1');
      checksum.update(codeSnippetsContent);

      return checksum.digest('hex');
    },
    (codeSnippetContent, index, contentHash) => {
      return entityManager.getRepository(PostCodeSnippet).create({
        postId: post.id,
        contentHash,
        order: index,
        content: codeSnippetContent,
      });
    },
  );

  await entityManager.getRepository(PostCodeSnippet).delete({
    postId: post.id,
    contentHash: Not(
      In(uniqueCodeSnippets.map((snippet) => snippet.contentHash)),
    ),
  });

  await entityManager
    .getRepository(PostCodeSnippet)
    .upsert(uniqueCodeSnippets, {
      conflictPaths: ['postId', 'contentHash'],
    });
};

export const insertCodeSnippetsFromUrl = async ({
  entityManager,
  post,
  codeSnippetsUrl,
}: {
  entityManager: EntityManager;
  post: Pick<Post, 'id'>;
  codeSnippetsUrl: string | undefined;
}) => {
  try {
    if (!codeSnippetsUrl) {
      return;
    }

    const codeSnippetsJson = await downloadJsonFile<PostCodeSnippetJsonFile>({
      url: codeSnippetsUrl,
    });

    await insertCodeSnippets({ entityManager, post, codeSnippetsJson });
  } catch (err) {
    logger.error(
      { codeSnippetsUrl, postId: post.id, err },
      'failed to save code snippets from bucket',
    );

    throw err;
  }
};

type ModeratedPostCdc = ChangeObject<SourcePostModeration>;

export const updateModeratedPost = async (
  con: ConnectionManager,
  moderated: ModeratedPostCdc,
): Promise<ModeratedPostCdc | null> => {
  if (!moderated?.postId) {
    logger.error('unable to update moderated post', { moderated });
    return null;
  }

  const postParam = { id: moderated.postId };
  const repo = con.getRepository(Post);

  await repo.findOneOrFail({ select: ['id'], where: postParam });

  const updatedPost: Partial<FreeformPost> = {
    title: moderated.title,
    titleHtml: moderated.titleHtml,
  };

  if (moderated.content) {
    updatedPost.content = moderated.content;
    updatedPost.contentHtml = moderated.contentHtml!;
  }

  if (moderated.image) {
    updatedPost.image = moderated.image;
  }

  await repo.update(postParam, updatedPost);

  return moderated;
};

export const getExistingPost = async (
  manager: ConnectionManager,
  { url, canonicalUrl }: { url: string; canonicalUrl: string },
): Promise<Pick<Post, 'id' | 'deleted' | 'visible'> | null> =>
  manager
    .createQueryBuilder(Post, 'post')
    .select(['post.id', 'post.deleted', 'post.visible'])
    .where([{ canonicalUrl: canonicalUrl }, { url: url }])
    .getOne();

const extractPostIdOrSlugFromUrl = (url: string): string | undefined => {
  // Escape special regex characters in the prefixes
  const escapedUrlPrefix = process.env.URL_PREFIX.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&',
  );
  const escapedCommentsPrefix = process.env.COMMENTS_PREFIX.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&',
  );

  const regex = new RegExp(
    `^(?:${escapedUrlPrefix}/r/([^/?#]+)|${escapedCommentsPrefix}/posts/([^/?#]+))`,
  );

  const match = url.match(regex);
  return match ? match[1] || match[2] : undefined;
};

export const findPostByUrl = async <T extends keyof ArticlePost>(
  url: string,
  select: T[],
  con: ConnectionManager,
  returnDeleted = false,
): Promise<Pick<ArticlePost, T> | undefined> => {
  const { url: cleanUrl, canonicalUrl } = standardizeURL(url);
  const idOrSlug = extractPostIdOrSlugFromUrl(cleanUrl);

  let queryBuilder = con
    .getRepository(Post)
    .createQueryBuilder()
    .select(select)
    .orderBy('"createdAt"', 'ASC');

  if (!returnDeleted) {
    queryBuilder = queryBuilder.andWhere({ deleted: false });
  }

  if (idOrSlug) {
    queryBuilder = queryBuilder.andWhere([
      { id: idOrSlug },
      { slug: idOrSlug },
    ]);
  } else {
    queryBuilder = queryBuilder.andWhere([
      { canonicalUrl: canonicalUrl },
      { url: cleanUrl },
    ]);
  }

  return queryBuilder.getRawOne();
};

export const processApprovedModeratedPost = async (
  con: ConnectionManager,
  moderated: ModeratedPostCdc,
): Promise<ModeratedPostCdc | null> => {
  if (!moderated) {
    throw new Error('Moderated post is missing');
  }

  if (moderated.postId) {
    return updateModeratedPost(con, moderated);
  }

  const {
    title,
    content,
    contentHtml,
    image,
    createdById,
    sourceId,
    titleHtml,
    externalLink,
    sharedPostId,
  } = moderated;

  if (moderated.type === PostType.Freeform) {
    const id = await generateShortId();
    const params = {
      id,
      title,
      titleHtml,
      content,
      contentHtml,
      image,
      sourceId,
      authorId: createdById,
    };
    const post = await createFreeformPost({ con, args: params as CreatePost });
    return { ...moderated, postId: post.id };
  }

  if (sharedPostId) {
    const post = await createSharePost({
      con,
      args: {
        postId: sharedPostId,
        commentary: title,
        authorId: createdById,
        sourceId,
      },
    });

    return { ...moderated, postId: post.id };
  }

  if (externalLink) {
    if (!isValidHttpUrl(externalLink)) {
      throw new ValidationError('Invalid external link URL');
    }

    const { url, canonicalUrl } = standardizeURL(externalLink);
    const existingPost = await getExistingPost(con, { url, canonicalUrl });

    if (existingPost) {
      const post = await createSharePost({
        con,
        args: {
          sourceId,
          commentary: content,
          authorId: createdById,
          postId: existingPost.id,
          visible: existingPost.visible,
        },
      });

      return { ...moderated, postId: post.id };
    }

    const post = await createExternalLink({
      con,
      args: {
        title,
        image,
        url,
        canonicalUrl,
        sourceId,
        authorId: createdById,
        commentary: content,
        originalUrl: externalLink,
      },
    });
    return { ...moderated, postId: post.id };
  }

  logger.error({ moderated }, 'unable to process moderated post');

  return null;
};

export const validateSourcePostModeration = async (
  ctx: AuthContext,
  {
    postId,
    title,
    content,
    sourceId,
    image,
    type,
    sharedPostId,
    imageUrl,
    externalLink,
  }: CreateSourcePostModerationArgs,
): Promise<CreateSourcePostModeration> => {
  if (![PostType.Share, PostType.Freeform].includes(type)) {
    throw new ValidationError('Invalid post type!');
  }

  const { con, userId } = ctx;
  const pendingPost: CreateSourcePostModeration = {
    title: validateCommentary(title),
    postId,
    sourceId,
    type,
    sharedPostId,
    externalLink,
    createdById: userId,
  };

  const mentions = await getMentions(con, content, userId, sourceId);

  if (type === PostType.Share) {
    if (!!externalLink) {
      const cleanContent = validateCommentary(content);

      if (cleanContent) {
        pendingPost.content = cleanContent;
        pendingPost.contentHtml = generateTitleHtml(cleanContent, mentions);
      }
    } else if (pendingPost.title) {
      pendingPost.titleHtml = generateTitleHtml(pendingPost.title, mentions);
    }
  }

  if (content && type === PostType.Freeform) {
    pendingPost.content = content;
    pendingPost.contentHtml = markdown.render(content, { mentions })?.trim();
  }

  if (imageUrl) {
    pendingPost.image = imageUrl;
  } else if (image && process.env.CLOUDINARY_URL) {
    const upload = await image;
    const { url: coverImageUrl } = await uploadPostFile(
      await generateShortId(),
      upload.createReadStream(),
      UploadPreset.PostBannerImage,
    );
    pendingPost.image = coverImageUrl;
  }

  return pendingPost;
};

export const findPostImageFromContent = ({
  post,
}: {
  post: Pick<FreeformPost, 'content'>;
}): string | undefined => {
  if (!post.content) {
    return undefined;
  }

  const contentMarkdown = markdown.parse(post.content, {});

  const imgTag = findMarkdownTag({
    tokens: contentMarkdown,
    tag: 'img',
    depth: 0,
    maxDepth: 1,
  });

  return imgTag?.attrGet('src') || undefined;
};

type PostContentMeta = {
  alt_title: {
    translations: I18nRecord;
  };
  translate_title: {
    translations: I18nRecord;
  };
};

export const getPostTranslatedTitle = (
  post: Partial<Pick<Post, 'title' | 'translation'>>,
  contentLanguage: ContentLanguage | null,
): string => {
  if (!contentLanguage) {
    return post.title as string;
  }

  return post.translation?.[contentLanguage]?.title || post.title!;
};

export const getSmartTitle = (
  contentLanguage: ContentLanguage | null,
  legacyTranslations?: I18nRecord, // TODO AS-912 remove when we migrate data to translation column
  translations?: Post['translation'],
): string | undefined => {
  const fallbackSmartTitle =
    translations?.[ContentLanguage.English]?.smartTitle ||
    legacyTranslations?.[ContentLanguage.English];

  // We will always return the English smart title if the content language is not set
  if (!contentLanguage) {
    return fallbackSmartTitle;
  }

  const smartTitle =
    translations?.[contentLanguage]?.smartTitle ||
    legacyTranslations?.[contentLanguage];

  return smartTitle ?? fallbackSmartTitle;
};

export const getPostSmartTitle = (
  post: Partial<Pick<Post, 'title' | 'contentMeta' | 'translation'>>,
  contentLanguage: ContentLanguage | null,
) =>
  getSmartTitle(
    contentLanguage,
    (post.contentMeta as PostContentMeta)?.alt_title?.translations,
    post.translation,
  ) || getPostTranslatedTitle(post, contentLanguage);

export const getModerationItemsAsAdminForSource = async (
  ctx: Context,
  info: GraphQLResolveInfo,
  args: SourcePostModerationArgs,
) => {
  const page = sourcePostModerationPageGenerator.connArgsToPage(args);
  const statuses = Array.from(new Set(args.status));

  return graphorm.queryPaginated<GQLSourcePostModeration>(
    ctx,
    info,
    (nodeSize) =>
      sourcePostModerationPageGenerator.hasPreviousPage(page, nodeSize),
    (nodeSize) => sourcePostModerationPageGenerator.hasNextPage(page, nodeSize),
    (node, index) =>
      sourcePostModerationPageGenerator.nodeToCursor(page, args, node, index),
    (builder) => {
      builder.queryBuilder
        .where(`"${builder.alias}"."sourceId" = :sourceId`, {
          sourceId: args.sourceId,
        })
        .andWhere(`("${builder.alias}"."flags"->>'vordr')::boolean IS NOT TRUE`)
        .orderBy(`${builder.alias}.updatedAt`, 'DESC')
        .limit(page.limit)
        .offset(page.offset);

      if (statuses.length) {
        builder.queryBuilder.andWhere(
          `"${builder.alias}"."status" IN (:...status)`,
          {
            status: statuses,
          },
        );
      }

      return builder;
    },
    undefined,
    true,
  );
};

export const getModerationItemsByUserForSource = async (
  ctx: Context,
  info: GraphQLResolveInfo,
  args: SourcePostModerationArgs,
) => {
  const page = sourcePostModerationPageGenerator.connArgsToPage(args);
  const { userId } = ctx;
  const statuses = Array.from(new Set(args.status));

  return graphorm.queryPaginated<GQLSourcePostModeration>(
    ctx,
    info,
    (nodeSize) =>
      sourcePostModerationPageGenerator.hasPreviousPage(page, nodeSize),
    (nodeSize) => sourcePostModerationPageGenerator.hasNextPage(page, nodeSize),
    (node, index) =>
      sourcePostModerationPageGenerator.nodeToCursor(page, args, node, index),
    (builder) => {
      builder.queryBuilder
        .where(`"${builder.alias}"."sourceId" = :sourceId`, {
          sourceId: args.sourceId,
        })
        .andWhere(`"${builder.alias}"."createdById" = :userId`, {
          userId,
        })
        .orderBy(`${builder.alias}.updatedAt`, 'DESC')
        .limit(page.limit)
        .offset(page.offset);

      if (statuses.length) {
        builder.queryBuilder.andWhere(
          `"${builder.alias}"."status" IN (:...status)`,
          {
            status: statuses,
          },
        );
      }

      return builder;
    },
    undefined,
    true,
  );
};

export const getAllModerationItemsAsAdmin = async (
  ctx: Context,
  info: GraphQLResolveInfo,
  args: SourcePostModerationArgs,
) => {
  const page = sourcePostModerationPageGenerator.connArgsToPage(args);
  const { userId } = ctx;
  const statuses = Array.from(new Set(args.status));

  return graphorm.queryPaginated<GQLSourcePostModeration>(
    ctx,
    info,
    (nodeSize) =>
      sourcePostModerationPageGenerator.hasPreviousPage(page, nodeSize),
    (nodeSize) => sourcePostModerationPageGenerator.hasNextPage(page, nodeSize),
    (node, index) =>
      sourcePostModerationPageGenerator.nodeToCursor(page, args, node, index),
    (builder) => {
      builder.queryBuilder
        .innerJoin(SourceMember, 'sm', 'sm.userId = :userId', { userId })
        .where('sm.role IN (:...roles)', {
          roles: [SourceMemberRoles.Admin, SourceMemberRoles.Moderator],
        })
        .andWhere(`("${builder.alias}"."flags"->>'vordr')::boolean IS NOT TRUE`)
        .andWhere(`"${builder.alias}"."sourceId" = "sm"."sourceId"`)
        .orderBy(`${builder.alias}.updatedAt`, 'DESC')
        .limit(page.limit)
        .offset(page.offset);

      if (statuses.length) {
        builder.queryBuilder.andWhere(
          `"${builder.alias}"."status" IN (:...status)`,
          {
            status: statuses,
          },
        );
      }
      return builder;
    },
    undefined,
    true,
  );
};

export const getTranslationRecord = ({
  translations,
  contentLanguage,
}: {
  translations: Partial<Record<ContentLanguage, PostTranslation>>;
  contentLanguage: ContentLanguage | null;
}) => {
  const translation = contentLanguage
    ? translations[contentLanguage]
    : undefined;

  if (!translation) {
    return {};
  }

  return translateablePostFields.reduce(
    (acc: Record<string, boolean>, field) => {
      acc[field] = !!translation[field];
      return acc;
    },
    {},
  );
};

export const ensurePostAnalyticsPermissions = async ({
  ctx,
  postId,
}: {
  ctx: AuthContext;
  postId: string;
}): Promise<void> => {
  const { userId, isTeamMember } = ctx;

  // for now allow team members to view
  if (isTeamMember) {
    return;
  }

  if (!userId) {
    throw new ForbiddenError('Auth is required');
  }

  const post = await queryReadReplica(ctx.con, ({ queryRunner }) => {
    return queryRunner.manager.getRepository(Post).findOneOrFail({
      select: ['id', 'authorId'],
      where: { id: postId || '' },
    });
  });

  if (post.authorId !== userId) {
    throw new ForbiddenError(
      'You do not have permission to view post analytics',
    );
  }
};
