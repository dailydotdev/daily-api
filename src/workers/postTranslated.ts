import { TypedWorker } from './worker';
import { Post } from '../entity';
import { logger } from '../logger';
import { remoteConfig } from '../remoteConfig';

export const postTranslated: TypedWorker<'kvasir.v1.post-translated'> = {
  subscription: 'api.post-translated',
  handler: async (message, con) => {
    const { id, translations, language } = message.data;

    const validLanguages = Object.keys(remoteConfig.validLanguages || {});
    if (!validLanguages.includes(language)) {
      logger.error({ id, language }, '[postTranslated]: Invalid language');
      return;
    }

    try {
      const post = await con.getRepository(Post).findOneByOrFail({ id });
      const query = con
        .getRepository(Post)
        .createQueryBuilder()
        .update(Post)
        .set({
          translation: () => /*sql*/ `jsonb_set(
          translation,
          ARRAY[(:language)],
          COALESCE(translation->:language, '{}'::jsonb) || :translations::jsonb,
          true
        )`,
        })
        .setParameters({
          language,
          translations: JSON.stringify(translations),
        })
        .where('id = :id', { id });

      await query.execute();

      logger.debug(
        { id, language, keys: Object.keys(translations) },
        '[postTranslated]: Post translation updated',
      );
    } catch (_err) {
      const err = _err as Error;
      logger.error(
        { id, err },
        '[postTranslated]: Failed to update post translation',
      );
    }
  },
};
