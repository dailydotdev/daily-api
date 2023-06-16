import { ChangeObject } from '../../types';
import {
  ContentImage,
  ContentImageUsedByType,
  updateUsedImagesInContent,
} from '../../entity';
import { messageToJson } from '../worker';

interface Content {
  id: string;
  contentHtml: string;
}

interface Data<T extends Content> {
  [key: string]: ChangeObject<T>;
}

export const generateEditImagesHandler =
  <T extends Data<Content> = Data<Content>>(
    key: keyof T,
    type: ContentImageUsedByType,
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

      if (!obj.contentHtml) return;

      await updateUsedImagesInContent(entityManager, type, obj);
    });
  };
