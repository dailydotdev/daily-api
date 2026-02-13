import { z } from 'zod';
import { optionalStringSchema } from './common';

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
    type: optionalStringSchema,
    url: optionalStringSchema,
    thumbnail: optionalStringSchema,
  })
  .passthrough();

export const twitterSocialThreadTweetSchema = z
  .object({
    tweet_id: optionalStringSchema,
    content: optionalStringSchema,
    content_html: optionalStringSchema,
    media: z.array(twitterSocialMediaSchema).nullish(),
  })
  .passthrough();

export const twitterSocialReferenceSchema = z
  .object({
    tweet_id: optionalStringSchema,
    url: optionalStringSchema,
    content: optionalStringSchema,
    content_html: optionalStringSchema,
    media: z.array(twitterSocialMediaSchema).nullish(),
  })
  .passthrough();

export const twitterSocialExtraSchema = z
  .object({
    author_username: optionalStringSchema,
    subtype: twitterSocialInputSubTypeSchema.nullish(),
    sub_type: twitterSocialInputSubTypeSchema.nullish(),
    tweet_id: optionalStringSchema,
    content: optionalStringSchema,
    content_html: optionalStringSchema,
    media: z.array(twitterSocialMediaSchema).nullish(),
    video_id: optionalStringSchema,
    is_thread: z.boolean().nullish(),
    thread_tweets: z.array(twitterSocialThreadTweetSchema).nullish(),
    referenced_tweet: twitterSocialReferenceSchema.nullish(),
    quoted_tweet: twitterSocialReferenceSchema.nullish(),
    retweeted_tweet: twitterSocialReferenceSchema.nullish(),
    reposted_tweet: twitterSocialReferenceSchema.nullish(),
    referenced_tweet_id: optionalStringSchema,
    quoted_tweet_id: optionalStringSchema,
    retweeted_tweet_id: optionalStringSchema,
    reposted_tweet_id: optionalStringSchema,
    referenced_tweet_url: optionalStringSchema,
    quoted_tweet_url: optionalStringSchema,
    retweeted_tweet_url: optionalStringSchema,
    reposted_tweet_url: optionalStringSchema,
  })
  .passthrough();

export const twitterSocialPayloadSchema = z
  .object({
    content_type: z.literal('social:twitter'),
    url: z.string().min(1),
    title: optionalStringSchema,
    image: optionalStringSchema,
    language: optionalStringSchema,
    extra: twitterSocialExtraSchema.nullish(),
  })
  .passthrough();

export type TwitterSocialPayload = z.infer<typeof twitterSocialPayloadSchema>;
export type TwitterSocialMedia = z.infer<typeof twitterSocialMediaSchema>;
