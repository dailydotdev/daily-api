import { TypedWorker } from './worker';
import { Post } from '../entity';
import { validLanguages } from '../types';
import { logger } from '../logger';

export const postTranslated: TypedWorker<'kvasir.v1.post-translated'> = {
  subscription: 'api.post-translated',
  handler: async (message, con) => {
    const { id, translations, language } = message.data;

    if (!validLanguages.includes(language)) {
      logger.error({ id, language }, '[postTranslated]: Invalid language');
      return;
    }

    const post = await con.getRepository(Post).findOneByOrFail({ id });

    const existingTranslation = post.translation?.[language];
    post.translation[language] = {
      ...existingTranslation,
      ...translations,
    };

    await con.getRepository(Post).save(post);
    logger.debug(
      { id, language, keys: Object.keys(translations) },
      '[postTranslated]: Post translation updated',
    );
  },
};
