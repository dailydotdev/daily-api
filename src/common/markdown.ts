import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
import { getUserProfileUrl } from './users';
import { CommentMention, PostMention, User } from '../entity';
import { DataSource, EntityManager } from 'typeorm';
import { MentionedUser } from '../schema/comments';
import { EntityTarget } from 'typeorm/common/EntityTarget';

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
  const href = getUserProfileUrl(username);

  return `<a href="${href}" data-mention-id="${id}" data-mention-username="${username}">@${username}</a>`;
};

const defaultRender =
  markdown.renderer.rules.link_open ||
  function (tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options);
  };

const setTokenAttribute = (tokens, attribute, attributeValue) => {
  const attributeIndex = tokens.attrIndex('attribute');
  if (attributeIndex < 0) {
    tokens.attrPush([attribute, attributeValue]);
  } else {
    tokens.attrs[attributeIndex][1] = attributeValue;
  }
  return tokens;
};

const defaultTextRender = markdown.renderer.rules.text;

type MarkdownMention = Pick<User, 'id' | 'username'>;

export const mentionSpecialCharacters = new RegExp('[^a-zA-Z0-9_@-]', 'g');

type ReplacedCharacters = string[];

// in order to easily identify whether a comment mention is valid or not, we replace special characters with space
// then while we reconstruct the word as the length changes afterwards, we passed the reference to which were those replaced characters
const getReplacedCharacters = (word: string): [string, ReplacedCharacters] => {
  const specialCharacters = [];
  let match: RegExpExecArray;
  while ((match = mentionSpecialCharacters.exec(word)) != null) {
    specialCharacters.push(word.charAt(match.index));
  }

  return [word.replace(mentionSpecialCharacters, ' '), specialCharacters];
};

markdown.renderer.rules.text = function (tokens, idx, options, env, self) {
  const content = defaultTextRender(tokens, idx, options, env, self);
  const mentions = env?.mentions as MarkdownMention[];
  if (!mentions?.length) {
    return content;
  }

  const words = content.split(' ').map((word: string) => {
    if (word.indexOf('@') === -1) {
      return word;
    }

    const [replaced, specialCharacters] = getReplacedCharacters(word);
    const result = replaced.split(' ').reduce((result, section, i) => {
      const removed = specialCharacters[i] ?? '';
      if (section.indexOf('@') === -1) {
        return result + section + removed;
      }

      const user = mentions.find(({ username }) => `@${username}` === section);
      const reconstructed = user ? getMentionLink(user) : section;
      return result + reconstructed + removed;
    }, '');

    return result;
  });

  return words.join(' ');
};

markdown.renderer.rules.link_open = function (tokens, idx, options, env, self) {
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
