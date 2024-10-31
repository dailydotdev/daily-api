import { DataSource, EntityManager, In, Not } from 'typeorm';
import {
  Comment,
  ExternalLinkPreview,
  FreeformPost,
  Post,
  PostOrigin,
  SquadSource,
  User,
  WelcomePost,
} from '../entity';
import { ValidationError } from 'apollo-server-errors';
import { isValidHttpUrl } from './links';
import { markdown } from './markdown';
import { generateShortId } from '../ids';
import { GQLPost } from '../schema/posts';
// @ts-expect-error - no types
import { FileUpload } from 'graphql-upload/GraphQLUpload.js';
import { HttpError, retryFetchParse } from '../integrations/retry';
import { checkWithVordr, VordrFilterType } from './vordr';
import { AuthContext } from '../Context';
import { createHash } from 'node:crypto';
import { PostCodeSnippet } from '../entity/posts/PostCodeSnippet';
import { logger } from '../logger';
import { downloadJsonFile } from './googleCloud';
import type { PostCodeSnippetJsonFile } from '../types';
import { uniqueifyObjectArray } from './utils';

export const defaultImage = {
  urls: process.env.DEFAULT_IMAGE_URL?.split?.(',') ?? [],
  ratio: parseFloat(process.env.DEFAULT_IMAGE_RATIO),
  placeholder: process.env.DEFAULT_IMAGE_PLACEHOLDER,
  welcomePost:
    'https://daily-now-res.cloudinary.com/image/upload/f_auto,q_auto/public/welcome_post',
};

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
  'title' | 'content' | 'image' | 'contentHtml'
>;

export type CreatePost = Pick<
  FreeformPost,
  'title' | 'content' | 'image' | 'contentHtml' | 'authorId' | 'sourceId' | 'id'
>;

export const createFreeformPost = async (
  con: DataSource | EntityManager,
  ctx: AuthContext,
  args: CreatePost,
) => {
  const { private: privacy } = await con
    .getRepository(SquadSource)
    .findOneByOrFail({ id: args.sourceId });

  const createdPost = con.getRepository(FreeformPost).create({
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

  const vordrStatus = await checkWithVordr(
    {
      id: createdPost.id,
      type: VordrFilterType.Post,
      content: createdPost.content,
    },
    { con, userId: ctx.userId, req: ctx.req },
  );

  if (vordrStatus === true) {
    createdPost.banned = true;
    createdPost.showOnFeed = false;

    createdPost.flags = {
      ...createdPost.flags,
      banned: true,
      showOnFeed: false,
    };
  }

  createdPost.flags.vordr = vordrStatus;

  return con.getRepository(FreeformPost).save(createdPost);
};

export interface EditPostArgs
  extends Pick<GQLPost, 'id' | 'title' | 'content'> {
  image: Promise<FileUpload>;
}

export interface CreatePostArgs
  extends Pick<EditPostArgs, 'title' | 'content' | 'image'> {
  sourceId: string;
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
