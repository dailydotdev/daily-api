import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
import { getUserProfileUrl } from './users';
import { User } from '../entity';

export const markdown: MarkdownIt = MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  highlight: function (str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang }).value;
      } catch (__) {}
    }
    return str;
  },
});

export const getMentionLink = ({ id, username }: MarkdownMention): string => {
  const href = getUserProfileUrl(username);

  return `<a href="${href}" data-mention-id="${id}" data-mention-username="${username}">@${username}</a>`;
};

export const isValidUsernameChar = (char: string): boolean => {
  const match = char.match(/^[a-z0-9_]+$/i);

  return match && match[0].length === 1;
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

export const splitBySpecialChars = (word: string, index: number): string[] => {
  const sections = [];

  if (index > 0) {
    sections.push(word.substring(0, index));
  }

  for (let i = index, current = word.substring(index); i >= 0; ) {
    const nextIndex = current
      .substring(i + 1)
      .split('')
      .findIndex((char) => !isValidUsernameChar(char));

    if (nextIndex === -1) {
      sections.push(current);
      break;
    }

    i = 0;
    if (nextIndex === 0) {
      sections.push(current.charAt(0));
      current = current.substring(1);
    } else {
      sections.push(current.substring(0, nextIndex + 1));
      current = current.substring(nextIndex + 1);
    }
  }

  return sections;
};

const findValidMention = (
  sections: string[],
  mentions: MarkdownMention[],
  i: number,
): MarkdownMention => {
  const section = sections[i];
  if (section.length === 1 || section.charAt(0) !== '@') {
    return null;
  }

  if (i === 0) {
    const after = sections[i + 1];
    if (after?.charAt(0) === '@') {
      return null;
    }

    return mentions.find(({ username }) => `@${username}` === section);
  }

  const before = sections[i - 1];
  const beforeLastChar = before.charAt(before.length - 1);
  const after = sections[i + 1];

  if (
    beforeLastChar === '@' ||
    isValidUsernameChar(beforeLastChar) ||
    after?.charAt(0) === '@'
  ) {
    return null;
  }

  return mentions.find(({ username }) => `@${username}` === section);
};

const reconstructWord = (sections: string[], mentions: MarkdownMention[]) => {
  const reconstructed = [];

  sections.forEach((section, i) => {
    if (section.length === 1 || section.charAt(0) !== '@') {
      return reconstructed.push(section);
    }

    const mention = findValidMention(sections, mentions, i);
    return reconstructed.push(mention ? getMentionLink(mention) : section);
  });

  return reconstructed.join('');
};

markdown.renderer.rules.text = function (tokens, idx, options, env, self) {
  const content = defaultTextRender(tokens, idx, options, env, self);
  const mentions = env?.mentions as MarkdownMention[];
  if (!mentions?.length) {
    return content;
  }

  const words = content.split(' ').map((word: string) => {
    const mentionIndex = word.indexOf('@');

    if (mentionIndex === -1) {
      return word;
    }

    const sections = splitBySpecialChars(word, mentionIndex);

    return reconstructWord(sections, mentions);
  });

  return words.join(' ');
};

markdown.renderer.rules.link_open = function (tokens, idx, options, env, self) {
  tokens[idx] = setTokenAttribute(tokens[idx], 'target', '_blank');
  tokens[idx] = setTokenAttribute(tokens[idx], 'rel', 'noopener nofollow');
  return defaultRender(tokens, idx, options, env, self);
};
