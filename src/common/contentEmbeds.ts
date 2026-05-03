import { DataSource, EntityManager, In } from 'typeorm';
import fetch from 'node-fetch';
import type { Token } from 'markdown-it';
import {
  ContentEmbed,
  ContentEmbedParentType,
  ContentEmbedReferenceType,
} from '../entity/ContentEmbed';
import { Post } from '../entity/posts/Post';
import { markdown } from './markdown';

export const MAX_POST_CONTENT_EMBEDS = 10;
export const MAX_COMMENT_CONTENT_EMBEDS = 3;
export const MAX_LIVE_ROOM_CONTENT_EMBEDS = 10;

const DLY_TO_REDIRECT_LIMIT = 5;
const DLY_TO_RESOLVE_TIMEOUT_MS = 1500;

type ConnectionManager = DataSource | EntityManager;

type ExtractedContentEmbed = Pick<
  ContentEmbed,
  | 'referenceType'
  | 'referenceId'
  | 'url'
  | 'sortOrder'
  | 'startOffset'
  | 'endOffset'
>;

type ContentEmbedParent = Pick<ContentEmbed, 'parentType' | 'parentId'>;

const getCommentsHost = (): string | undefined => {
  if (!process.env.COMMENTS_PREFIX) {
    return undefined;
  }

  try {
    return new URL(process.env.COMMENTS_PREFIX).host;
  } catch {
    return undefined;
  }
};

const isAllowedDailyDevUrl = (url: URL): boolean => {
  if (!['http:', 'https:'].includes(url.protocol)) {
    return false;
  }

  return url.host === getCommentsHost();
};

const isDlyToUrl = (url: URL): boolean =>
  url.protocol === 'https:' && url.host === 'dly.to';

const getPostReferenceFromUrl = (url: URL): string | undefined => {
  const parts = url.pathname.split('/').filter(Boolean);

  if (parts.length === 2 && parts[0] === 'posts') {
    return parts[1];
  }

  return undefined;
};

const findReferencedPostId = async (
  con: ConnectionManager,
  url: URL,
): Promise<string | undefined> => {
  if (!isAllowedDailyDevUrl(url)) {
    return undefined;
  }

  const reference = getPostReferenceFromUrl(url);
  if (!reference) {
    return undefined;
  }

  const post = await con.getRepository(Post).findOne({
    select: ['id'],
    where: [
      {
        slug: reference,
        deleted: false,
        visible: true,
        private: false,
      },
      {
        id: reference,
        deleted: false,
        visible: true,
        private: false,
      },
    ],
  });

  return post?.id;
};

const fetchRedirectLocation = async (url: URL): Promise<string | undefined> => {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    DLY_TO_RESOLVE_TIMEOUT_MS,
  );

  try {
    const response = await fetch(url.toString(), {
      method: 'HEAD',
      redirect: 'manual',
      signal: controller.signal,
    });

    return response.headers.get('location') ?? undefined;
  } finally {
    clearTimeout(timeout);
  }
};

const resolveDlyToUrl = async (url: URL): Promise<URL | undefined> => {
  let current = url;

  for (let index = 0; index < DLY_TO_REDIRECT_LIMIT; index += 1) {
    const location = await fetchRedirectLocation(current);
    if (!location) {
      return undefined;
    }

    const next = new URL(location, current);
    if (!isDlyToUrl(next)) {
      return next;
    }

    current = next;
  }

  return undefined;
};

const getLinkHref = (token: Token): string | undefined =>
  token.attrs?.find(([name]) => name === 'href')?.[1];

const getLineStartOffsets = (content: string): number[] => {
  const offsets = [0];

  for (const line of content.split('\n')) {
    offsets.push(offsets[offsets.length - 1] + line.length + 1);
  }

  return offsets;
};

const getLinkText = ({
  children,
  linkStartIndex,
}: {
  children: Token[];
  linkStartIndex: number;
}): string => {
  let text = '';

  for (
    let index = linkStartIndex + 1;
    index < children.length && children[index].type !== 'link_close';
    index += 1
  ) {
    text += children[index].content;
  }

  return text;
};

const findLinkSourceOffset = ({
  line,
  href,
  text,
  cursor,
}: {
  line: string;
  href: string;
  text: string;
  cursor: number;
}): { start: number; end: number } | undefined => {
  const markdownLink = `[${text}](${href})`;
  const markdownLinkStart = line.indexOf(markdownLink, cursor);

  if (markdownLinkStart >= 0) {
    return {
      start: markdownLinkStart,
      end: markdownLinkStart + markdownLink.length,
    };
  }

  const hrefStart = line.indexOf(href, cursor);

  if (hrefStart >= 0) {
    const markdownHrefStart = line.lastIndexOf('](', hrefStart);
    const markdownTextStart = line.lastIndexOf('[', markdownHrefStart);
    const markdownHrefEnd = line.indexOf(')', hrefStart + href.length);

    if (
      markdownTextStart >= cursor &&
      markdownHrefStart >= 0 &&
      markdownHrefEnd >= 0
    ) {
      return {
        start: markdownTextStart,
        end: markdownHrefEnd + 1,
      };
    }

    if (line[hrefStart - 1] === '<' && line[hrefStart + href.length] === '>') {
      return {
        start: hrefStart - 1,
        end: hrefStart + href.length + 1,
      };
    }

    return {
      start: hrefStart,
      end: hrefStart + href.length,
    };
  }

  if (!text) {
    return undefined;
  }

  const textStart = line.indexOf(`[${text}]`, cursor);

  if (textStart >= 0) {
    return {
      start: textStart,
      end: textStart + text.length + 2,
    };
  }

  return undefined;
};

const extractMarkdownLinks = ({
  content,
  tokens,
}: {
  content: string;
  tokens: Token[];
}): Array<{ url: string; startOffset: number; endOffset: number }> => {
  const lineStartOffsets = getLineStartOffsets(content);
  const lines = content.split('\n');

  return tokens.reduce<
    Array<{ url: string; startOffset: number; endOffset: number }>
  >((links, token) => {
    const [lineStart, lineEnd] = token.map ?? [];
    if (
      token.type !== 'inline' ||
      lineStart === undefined ||
      lineEnd !== lineStart + 1
    ) {
      return links;
    }

    const line = lines[lineStart] ?? '';
    const contentOffset = line.indexOf(token.content);
    const inlineOffset = Math.max(contentOffset, 0);
    let cursor = inlineOffset;

    token.children?.forEach((child, index, children) => {
      if (child.type !== 'link_open') {
        return;
      }

      const url = getLinkHref(child);
      if (!url) {
        return;
      }

      const offset = findLinkSourceOffset({
        line,
        href: url,
        text: getLinkText({ children, linkStartIndex: index }),
        cursor,
      });

      if (!offset) {
        return;
      }

      links.push({
        url,
        startOffset: lineStartOffsets[lineStart] + offset.start,
        endOffset: lineStartOffsets[lineStart] + offset.end,
      });
      cursor = offset.end;
    });

    return links;
  }, []);
};

const resolveContentEmbedUrl = async (
  con: ConnectionManager,
  rawUrl: string,
): Promise<string | undefined> => {
  try {
    const url = new URL(rawUrl);

    if (isDlyToUrl(url)) {
      const resolved = await resolveDlyToUrl(url);
      return resolved ? findReferencedPostId(con, resolved) : undefined;
    }

    return findReferencedPostId(con, url);
  } catch {
    return undefined;
  }
};

export const extractContentEmbeds = async ({
  con,
  content,
  tokens,
  limit,
}: {
  con: ConnectionManager;
  content: string;
  tokens?: Token[];
  limit: number;
}): Promise<ExtractedContentEmbed[]> => {
  const markdownLinks = extractMarkdownLinks({
    content,
    tokens: tokens ?? markdown.parse(content, {}),
  });
  const embeds: ExtractedContentEmbed[] = [];

  for (const link of markdownLinks) {
    const referenceId = await resolveContentEmbedUrl(con, link.url);
    if (!referenceId) {
      continue;
    }

    embeds.push({
      referenceType: ContentEmbedReferenceType.Post,
      referenceId,
      url: link.url,
      sortOrder: embeds.length,
      startOffset: link.startOffset,
      endOffset: link.endOffset,
    });

    if (embeds.length >= limit) {
      break;
    }
  }

  return embeds;
};

export const replaceContentEmbeds = async ({
  con,
  parentType,
  parentId,
  content,
  tokens,
  limit,
}: {
  con: ConnectionManager;
  content: string;
  tokens?: Token[];
  limit: number;
} & ContentEmbedParent): Promise<void> => {
  const repo = con.getRepository(ContentEmbed);
  const embeds = await extractContentEmbeds({ con, content, tokens, limit });

  await repo.delete({ parentType, parentId });

  if (!embeds.length) {
    return;
  }

  await repo.insert(
    embeds.map((embed) =>
      repo.create({
        ...embed,
        parentType,
        parentId,
      }),
    ),
  );
};

export const deleteContentEmbedsByParent = async ({
  con,
  parentType,
  parentIds,
}: {
  con: ConnectionManager;
  parentType: ContentEmbedParentType;
  parentIds: string[];
}): Promise<void> => {
  if (!parentIds.length) {
    return;
  }

  await con.getRepository(ContentEmbed).delete({
    parentType,
    parentId: In(parentIds),
  });
};
