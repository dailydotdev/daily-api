import { z } from 'zod';

const MAX_BATCH = 32;
const MAX_LIST_ITEMS = 200;
const MAX_STRING_ITEM = 200;
const MAX_TITLE_ITEM = 500;
const MAX_PROMPT = 2000;

const stringList = (max: number, itemMax = MAX_STRING_ITEM) =>
  z.array(z.string().min(1).max(itemMax)).max(max).default([]);

export const onboardingDiscoverPostsInputSchema = z.object({
  prompt: z.string().max(MAX_PROMPT).default(''),
  selectedTags: stringList(MAX_LIST_ITEMS),
  confirmedTags: stringList(MAX_LIST_ITEMS),
  likedTitles: stringList(MAX_LIST_ITEMS, MAX_TITLE_ITEM),
  excludeIds: stringList(MAX_LIST_ITEMS),
  saturatedTags: stringList(MAX_LIST_ITEMS),
  n: z.number().int().min(1).max(MAX_BATCH).default(8),
});
