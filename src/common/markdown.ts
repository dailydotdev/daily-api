import MarkdownIt, { Renderer, Token } from 'markdown-it';
import hljs from 'highlight.js';
import { getUserProfileUrl } from './users';
import { CommentMention, PostMention, User } from '../entity';
import { DataSource, EntityManager } from 'typeorm';
import { MentionedUser } from '../schema/comments';
import { EntityTarget } from 'typeorm/common/EntityTarget';
import { ghostUser } from './utils';
import { isValidHttpUrl } from './links';

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
