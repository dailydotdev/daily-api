import { ChangeObject } from '../../types';
import {
  ContentImage,
  ContentImageUsedByType,
  updateUsedImagesInContent,
} from '../../entity';
import { Message, messageToJson } from '../worker';
import { DataSource } from 'typeorm';

interface Content {
  id: string;
  contentHtml?: string;
  readmeHtml?: string;
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
    contentKey: keyof ChangeObject<Content> = 'contentHtml',
  ) =>
  async (message: Pick<Message, 'data'>, con: DataSource): Promise<void> => {
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
