import { ChangeObject } from '../../types';
import {
  ContentImage,
  ContentImageUsedByType,
  updateUsedImagesInContent,
} from '../../entity';
import { messageToJson } from '../worker';

interface Content {
  id: string;
}

interface Data<T extends Content> {
  [key: string]: ChangeObject<T>;
}

interface OptionalParams {
  shouldClearOnly?: boolean;
}

export const generateEditImagesHandler =
  <T extends Data<Content> = Data<Content>>(
    key: keyof T,
    type: ContentImageUsedByType,
    { shouldClearOnly }: OptionalParams = {},
    contentKey: keyof Data<Content> = 'contentHtml',
  ) =>
  async (message, con): Promise<void> => {
    const data: T = messageToJson(message);
    const obj = data[key];

    if (!obj?.id) return;

    await con.transaction(async (entityManager) => {
      await entityManager
        .getRepository(ContentImage)
        .update(
          { usedByType: type, usedById: obj.id },
          { usedByType: null, usedById: null },
        );

      if (!obj[contentKey] || shouldClearOnly) return;

      await updateUsedImagesInContent(
        entityManager,
        type,
        obj.id,
        obj[contentKey],
      );
    });
  };
