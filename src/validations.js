import {
  object,
  string,
} from 'koa-context-validator';

const publicationId = string();

const source = object().keys({
  publicationId: publicationId.required(),
  url: string().uri({ scheme: ['http', 'https'] }),
});

export default {
  publicationId,
  source,
};
