import { z } from 'zod';

export const twitterSocialSubTypes = [
  'tweet',
  'thread',
  'media',
  'quote',
  'repost',
] as const;

export const twitterSocialSubTypeSchema = z.enum(twitterSocialSubTypes);
export type TwitterSocialSubType = z.infer<typeof twitterSocialSubTypeSchema>;
export const twitterSocialInputSubTypes = [
  ...twitterSocialSubTypes,
  'retweet',
] as const;
export const twitterSocialInputSubTypeSchema = z.enum(
  twitterSocialInputSubTypes,
);

export const twitterSocialMediaSchema = z
  .object({
    type: z.string().nullish(),
    url: z.string().nullish(),
    thumbnail: z.string().nullish(),
  })
  .passthrough();

export const twitterSocialThreadTweetSchema = z
  .object({
    tweet_id: z.string().nullish(),
    content: z.string().nullish(),
    content_html: z.string().nullish(),
    media: z.array(twitterSocialMediaSchema).nullish(),
  })
  .passthrough();

export const twitterSocialReferenceSchema = z
  .object({
    tweet_id: z.string().nullish(),
    url: z.string().nullish(),
    title: z.string().nullish(),
    content: z.string().nullish(),
    content_html: z.string().nullish(),
    sub_type: z.string().nullish(),
    media: z.array(twitterSocialMediaSchema).nullish(),
    source_id: z.string().nullish(),
    author_username: z.string().nullish(),
  })
  .passthrough();

export const twitterSocialExtraSchema = z
  .object({
    author_username: z.string().nullish(),
    subtype: twitterSocialInputSubTypeSchema.nullish(),
    sub_type: twitterSocialInputSubTypeSchema.nullish(),
    tweet_id: z.string().nullish(),
    content: z.string().nullish(),
    content_html: z.string().nullish(),
    media: z.array(twitterSocialMediaSchema).nullish(),
    video_id: z.string().nullish(),
    is_thread: z.boolean().nullish(),
    thread_tweets: z.array(twitterSocialThreadTweetSchema).nullish(),
    reference: twitterSocialReferenceSchema.nullish(),
  })
  .passthrough();

export const twitterSocialPayloadSchema = z
  .object({
    content_type: z.literal('social:twitter'),
    url: z.string().min(1),
    title: z.string().nullish(),
    image: z.string().nullish(),
    language: z.string().nullish(),
    extra: twitterSocialExtraSchema.nullish(),
  })
  .passthrough();

export type TwitterSocialPayload = z.infer<typeof twitterSocialPayloadSchema>;
export type TwitterSocialMedia = z.infer<typeof twitterSocialMediaSchema>;
