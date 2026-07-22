import MarkdownIt, { Renderer, Token } from 'markdown-it';
import type StateInline from 'markdown-it/lib/rules_inline/state_inline.mjs';
import hljs from 'highlight.js';
import { getUserProfileUrl } from './users';
import { CommentMention, PostMention, User } from '../entity';
import { DataSource, EntityManager } from 'typeorm';
import { MentionedUser } from '../schema/comments';
import { EntityTarget } from 'typeorm/common/EntityTarget';
import { ghostUser } from './utils';
import { isValidHttpUrl } from './links';
import {
  getProxiedImageUrl,
  isExternalImageUrl,
  validateImageUrl,
} from './imageProxy';

const underscoreMarker = 0x5f;
const alphaNumericRegex = /[\p{L}\p{N}]/u;
const adjustedDelimiterStates = new WeakSet<StateInline>();

/**
 * Sanitizes HTML content, allowing only safe tags for rich text content.
 * Used for opportunity content sections (WYSIWYG editor output).
 */
export const sanitizeHtml = async (html: string): Promise<string> => {
  const DOMPurify = await import('isomorphic-dompurify');

  // Use hook to properly set link attributes without creating duplicates
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener nofollow');
    }
  });

  const result = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'br'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  });

  DOMPurify.removeHook('afterSanitizeAttributes');
  return result;
};

export const markdown: MarkdownIt = MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  highlight: function (str, lang) {
    try {
      if (lang) {
        return hljs.highlight(str, { language: lang }).value;
      }
      return hljs.highlightAuto(str).value;
    } catch (e) {
      return markdown.utils.escapeHtml(str);
    }
  },
});

const isPunctuationChar = (charCode: number | undefined): boolean =>
  typeof charCode === 'number' &&
  (markdown.utils.isMdAsciiPunct(charCode) ||
    markdown.utils.isPunctChar(String.fromCharCode(charCode)));

const isAlphaNumericChar = (charCode: number | undefined): boolean =>
  typeof charCode === 'number' &&
  alphaNumericRegex.test(String.fromCharCode(charCode));

const getCharCode = ({
  state,
  pos,
}: {
  state: StateInline;
  pos: number;
}): number | undefined =>
  pos >= 0 && pos < state.posMax ? state.src.charCodeAt(pos) : undefined;

const getPunctuationBoundary = ({
  state,
  start,
  length,
}: {
  state: StateInline;
  start: number;
  length: number;
}): { canOpen: boolean; canClose: boolean } => {
  const previousChar = getCharCode({ state, pos: start - 1 });
  const nextChar = getCharCode({ state, pos: start + length });

  return {
    canOpen: isAlphaNumericChar(previousChar) && isPunctuationChar(nextChar),
    canClose: isPunctuationChar(previousChar) && isAlphaNumericChar(nextChar),
  };
};

const adjustUnderscoreDelimiterScan = (state: StateInline): void => {
  const defaultScanDelims = state.scanDelims.bind(state);

  state.scanDelims = (start, canSplitWord) => {
    const scanned = defaultScanDelims(start, canSplitWord);

    if (
      canSplitWord ||
      state.src.charCodeAt(start) !== underscoreMarker ||
      scanned.length !== 1
    ) {
      return scanned;
    }

    const boundary = getPunctuationBoundary({
      state,
      start,
      length: scanned.length,
    });

    return {
      ...scanned,
      can_open: scanned.can_open || boundary.canOpen,
      can_close: scanned.can_close || boundary.canClose,
    };
  };
};

markdown.inline.ruler.before(
  'emphasis',
  'underscore_punctuation_emphasis',
  (state: StateInline, silent: boolean) => {
    if (silent || adjustedDelimiterStates.has(state)) {
      return false;
    }

    adjustUnderscoreDelimiterScan(state);
    adjustedDelimiterStates.add(state);

    return false;
  },
);

export const renderMarkdown = (
  content: string,
  env: Record<string, unknown> = {},
): { contentHtml: string; tokens: Token[] } => {
  const tokens = markdown.parse(content, env);
  const contentHtml = markdown.renderer.render(tokens, markdown.options, env);

  return { contentHtml, tokens };
};

export const getMentionLink = ({ id, username }: MarkdownMention): string => {
  const href = getUserProfileUrl(username || ghostUser.id);

  return `<a href="${href}" data-mention-id="${id}" data-mention-username="${username}" translate="no">@${username}</a>`;
};

const defaultRender =
  markdown.renderer.rules.link_open ||
  function (tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options);
  };

const setTokenAttribute = (
  tokens: Token,
  attribute: string,
  attributeValue: string,
) => {
  const attributeIndex = tokens.attrIndex('attribute');
  if (attributeIndex < 0) {
    tokens.attrPush([attribute, attributeValue]);
  } else if (tokens.attrs) {
    tokens.attrs[attributeIndex][1] = attributeValue;
  }
  return tokens;
};

const defaultTextRender = markdown.renderer.rules.text as Renderer.RenderRule;

type MarkdownMention = Pick<User, 'id' | 'username'>;

export const mentionSpecialCharacters = new RegExp('[^a-zA-Z0-9_@-]', 'g');

type ReplacedCharacters = string[];

// in order to easily identify whether a comment mention is valid or not, we replace special characters with space
// then while we reconstruct the word as the length changes afterwards, we passed the reference to which were those replaced characters
const getReplacedCharacters = (word: string): [string, ReplacedCharacters] => {
  const specialCharacters = [];
  let match: RegExpExecArray | null;
  while ((match = mentionSpecialCharacters.exec(word)) != null) {
    specialCharacters.push(word.charAt(match.index));
  }

  return [word.replace(mentionSpecialCharacters, ' '), specialCharacters];
};

export const renderMentions = (
  content: string,
  mentions: MarkdownMention[],
) => {
  const words = content.split(' ').map((word: string) => {
    if (word.indexOf('@') === -1) {
      return word;
    }

    const [replaced, specialCharacters] = getReplacedCharacters(word);

    return replaced.split(' ').reduce((result, section, i) => {
      const removed = specialCharacters[i] ?? '';
      if (section.indexOf('@') === -1) {
        return result + section + removed;
      }

      const user = mentions.find(({ username }) => `@${username}` === section);
      const reconstructed = user?.username ? getMentionLink(user) : section;
      return result + reconstructed + removed;
    }, '');
  });

  return words.join(' ');
};

// Check if the current token at idx is inside a link by looking for
// unclosed link_open tokens before it
const isInsideLink = (tokens: Token[], idx: number): boolean => {
  let linkDepth = 0;
  for (let i = 0; i < idx; i++) {
    if (tokens[i].type === 'link_open') {
      linkDepth++;
    } else if (tokens[i].type === 'link_close') {
      linkDepth--;
    }
  }
  return linkDepth > 0;
};

markdown.renderer.rules.text = function (tokens, idx, options, env, self) {
  const content = defaultTextRender(tokens, idx, options, env, self);
  const mentions = env?.mentions as MarkdownMention[];

  if (!mentions?.length) {
    return content;
  }

  // Skip mention processing when inside a link to avoid turning
  // @ symbols in URLs into user mention tags
  if (isInsideLink(tokens, idx)) {
    return content;
  }

  return renderMentions(content, mentions);
};

/**
 * Extracts the text content from a link by looking at tokens following link_open.
 * The link text appears in 'text' tokens between link_open and link_close.
 */
const getLinkText = (tokens: Token[], linkOpenIdx: number): string => {
  let text = '';
  for (let i = linkOpenIdx + 1; i < tokens.length; i++) {
    if (tokens[i].type === 'link_close') {
      break;
    }
    if (tokens[i].type === 'text') {
      text += tokens[i].content;
    }
  }
  return text.trim();
};

/**
 * Attempts to convert text to a valid HTTP URL.
 * Handles cases like "www.example.com" by prepending "https://".
 */
const toValidHttpUrl = (text: string): string | null => {
  if (!text) return null;

  // Already a valid HTTP URL
  if (isValidHttpUrl(text)) {
    return text;
  }

  // Try adding https:// prefix for URLs like www.example.com or example.com
  const withProtocol = `https://${text}`;
  if (isValidHttpUrl(withProtocol)) {
    return withProtocol;
  }

  return null;
};

markdown.renderer.rules.link_open = function (tokens, idx, options, env, self) {
  const token = tokens[idx];
  const hrefIndex = token.attrIndex('href');

  if (hrefIndex >= 0 && token.attrs) {
    const href = token.attrs[hrefIndex][1];

    // If the href is not a valid HTTP URL, try using the link text as the URL
    if (!isValidHttpUrl(href)) {
      const linkText = getLinkText(tokens, idx);
      const validUrl = toValidHttpUrl(linkText);
      if (validUrl) {
        token.attrs[hrefIndex][1] = validUrl;
      }
    }
  }

  tokens[idx] = setTokenAttribute(tokens[idx], 'target', '_blank');
  tokens[idx] = setTokenAttribute(tokens[idx], 'rel', 'noopener nofollow');
  return defaultRender(tokens, idx, options, env, self);
};

/**
 * Store the default image renderer for markdown-it
 */
const defaultImageRender =
  markdown.renderer.rules.image ||
  function (tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options);
  };

const videoMimeTypes: Record<string, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  ogg: 'video/ogg',
  ogv: 'video/ogg',
  mov: 'video/quicktime',
  m4v: 'video/x-m4v',
};

const getVideoExtension = (url: string): string => {
  const path = url.split(/[?#]/, 1)[0];
  const lastDot = path.lastIndexOf('.');
  return lastDot === -1 ? '' : path.slice(lastDot + 1).toLowerCase();
};

export const isVideoUrl = (url: string): boolean =>
  !!url && getVideoExtension(url) in videoMimeTypes;

/**
 * External videos can't be proxied through the Cloudinary image fetch (it would
 * corrupt the file), so we only render them when they pass the same SSRF/URL
 * validation used for images. Our own hosted media and allowed domains render
 * as-is.
 */
const getSafeVideoSrc = (url: string): string => {
  if (!isExternalImageUrl(url)) {
    return url;
  }

  return validateImageUrl(url) ? '' : url;
};

const renderVideo = (src: string, alt: string): string => {
  const escapedAlt = markdown.utils.escapeHtml(alt);
  const type = videoMimeTypes[getVideoExtension(src)];

  if (!src) {
    return '';
  }

  const escapedSrc = markdown.utils.escapeHtml(src);
  const source = `<source src="${escapedSrc}"${type ? ` type="${type}"` : ''}>`;

  return `<video src="${escapedSrc}" controls preload="metadata" aria-label="${escapedAlt}">${source}</video>`;
};

/**
 * Custom image renderer that proxies external images through Cloudinary
 * to prevent IP address exposure when users view markdown content with
 * external images. Video URLs render as a `<video>` element instead.
 */
markdown.renderer.rules.image = function (tokens, idx, options, env, self) {
  const token = tokens[idx];
  const srcIndex = token.attrIndex('src');

  if (srcIndex >= 0 && token.attrs) {
    const originalSrc = token.attrs[srcIndex][1];

    if (isVideoUrl(originalSrc)) {
      return renderVideo(getSafeVideoSrc(originalSrc), token.content);
    }

    const proxiedSrc = getProxiedImageUrl(originalSrc);

    if (proxiedSrc) {
      token.attrs[srcIndex][1] = proxiedSrc;
    } else {
      // If the URL is invalid/blocked, remove the src to prevent the image from loading
      // This is a security measure to prevent SSRF and other attacks
      token.attrs[srcIndex][1] = '';
    }
  }

  return defaultImageRender(tokens, idx, options, env, self);
};

export const saveMentions = (
  transaction: DataSource | EntityManager,
  referenceId: string,
  mentionedByUserId: string,
  users: MentionedUser[],
  target: EntityTarget<PostMention | CommentMention>,
) => {
  // we are intentionally not checking if we need to remove any mentions
  // for more context see: https://dailydotdev.slack.com/archives/C02E2C3C13R/p1697103348449099
  if (!users.length) {
    return;
  }

  const query = transaction.createQueryBuilder().insert().into(target);

  if (target === PostMention) {
    query.values(
      users.map(({ id }) => ({
        postId: referenceId,
        mentionedByUserId,
        mentionedUserId: id,
      })),
    );
  } else {
    query.values(
      users.map(({ id }) => ({
        commentId: referenceId,
        commentByUserId: mentionedByUserId,
        mentionedUserId: id,
      })),
    );
  }

  return query.orIgnore().execute();
};

export const checkHasMention = (content: string, username: string) => {
  if (!content?.length) return false;

  const lines = content.split('\n');

  return lines.some((line) => {
    const words = line.split(' ');

    return words.some((word) => word === `@${username}`);
  });
};

export const findMarkdownTag = ({
  tokens,
  tag,
  depth = 0,
  maxDepth = 2,
}: {
  tokens: Token[];
  tag: string;
  depth?: number;
  maxDepth?: number;
}): Token | undefined => {
  if (depth > maxDepth) {
    return undefined;
  }

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];

    if (token.tag === tag) {
      return token;
    }

    if (token.children?.length) {
      const nestedToken = findMarkdownTag({
        tokens: token.children,
        tag,
        depth: depth + 1,
        maxDepth,
      });

      if (nestedToken) {
        return nestedToken;
      }
    }
  }
};
