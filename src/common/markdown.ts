import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
import { getUserProfileUrl } from './users';
import { User } from '../entity';

export const markdown: MarkdownIt = MarkdownIt({
  html: true,
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

  return `<a href="${href}" data-mention-id="${id}" data-mention-username="${username}">${username}</a>`;
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

markdown.renderer.rules.text = function (tokens, idx, options, env, self) {
  const content = defaultTextRender(tokens, idx, options, env, self);
  const mentions = env?.mentions as MarkdownMention[];
  if (!mentions?.length) {
    return content;
  }

  const words = content.split(' ').map((word) => {
    const mention = mentions.find(({ username }) => word === `@${username}`);
    return mention ? getMentionLink(mention) : word;
  });

  return words.join(' ');
};

markdown.renderer.rules.link_open = function (tokens, idx, options, env, self) {
  tokens[idx] = setTokenAttribute(tokens[idx], 'target', '_blank');
  tokens[idx] = setTokenAttribute(tokens[idx], 'rel', 'noopener nofollow');
  return defaultRender(tokens, idx, options, env, self);
};
