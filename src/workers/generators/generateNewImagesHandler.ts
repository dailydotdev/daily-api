import { ChangeObject } from '../../types';
import {
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

export const generateNewImagesHandler =
  <T extends Data<Content> = Data<Content>>(
    key: keyof T,
    type: ContentImageUsedByType,
    contentKey: keyof Data<Content> = 'contentHtml',
  ) =>
  async (message, con): Promise<void> => {
    const data: T = messageToJson(message);
    const obj = data[key];

    if (!obj || !obj?.id || !obj?.[contentKey]) return;

    await updateUsedImagesInContent(con, type, obj.id, obj[contentKey]);
  };
