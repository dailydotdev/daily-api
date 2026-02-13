import { z } from 'zod';

const optionalString = z
  .string()
  .nullish()
  .transform((v) => v?.trim() || undefined);

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
    type: optionalString,
    url: optionalString,
    thumbnail: optionalString,
  })
  .passthrough();

export const twitterSocialThreadTweetSchema = z
  .object({
    tweet_id: optionalString,
    content: optionalString,
    content_html: optionalString,
    media: z.array(twitterSocialMediaSchema).nullish(),
  })
  .passthrough();

export const twitterSocialReferenceSchema = z
  .object({
    tweet_id: optionalString,
    url: optionalString,
    content: optionalString,
    content_html: optionalString,
    media: z.array(twitterSocialMediaSchema).nullish(),
  })
  .passthrough();

export const twitterSocialExtraSchema = z
  .object({
    author_username: optionalString,
    subtype: twitterSocialInputSubTypeSchema.nullish(),
    sub_type: twitterSocialInputSubTypeSchema.nullish(),
    tweet_id: optionalString,
    content: optionalString,
    content_html: optionalString,
    media: z.array(twitterSocialMediaSchema).nullish(),
    video_id: optionalString,
    is_thread: z.boolean().nullish(),
    thread_tweets: z.array(twitterSocialThreadTweetSchema).nullish(),
    referenced_tweet: twitterSocialReferenceSchema.nullish(),
    quoted_tweet: twitterSocialReferenceSchema.nullish(),
    retweeted_tweet: twitterSocialReferenceSchema.nullish(),
    reposted_tweet: twitterSocialReferenceSchema.nullish(),
    referenced_tweet_id: optionalString,
    quoted_tweet_id: optionalString,
    retweeted_tweet_id: optionalString,
    reposted_tweet_id: optionalString,
    referenced_tweet_url: optionalString,
    quoted_tweet_url: optionalString,
    retweeted_tweet_url: optionalString,
    reposted_tweet_url: optionalString,
  })
  .passthrough();

export const twitterSocialPayloadSchema = z
  .object({
    content_type: z.literal('social:twitter'),
    url: z.string().min(1),
    title: optionalString,
    image: optionalString,
    language: optionalString,
    extra: twitterSocialExtraSchema.nullish(),
  })
  .passthrough();

export type TwitterSocialPayload = z.infer<typeof twitterSocialPayloadSchema>;
export type TwitterSocialMedia = z.infer<typeof twitterSocialMediaSchema>;
