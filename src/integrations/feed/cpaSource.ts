import { generateStorageKey, StorageKey, StorageTopic } from '../../config';
import { getRedisObject } from '../../redis';

// Reads the CPA campaign source cached by boot (see getEngagementCreatives),
// keyed by the user/tracking id, so feed queries can forward it to the feed
// service as `cpa_source`. Returns undefined when nothing is cached.
export const getCpaSource = async (
  id?: string | null,
): Promise<string | undefined> => {
  if (!id) {
    return undefined;
  }

  return (
    (await getRedisObject(
      generateStorageKey(StorageTopic.Boot, StorageKey.CpaSource, id),
    )) ?? undefined
  );
};
