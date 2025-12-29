import { z } from 'zod';

const socialUrlSchema = (regex: RegExp) =>
  z.preprocess(
    (val) => (val === '' ? null : val),
    z
      .string()
      .regex(regex)
      .transform((val) => {
        const match = val.match(regex);
        return match?.groups?.value ?? val;
      })
      .nullish(),
  );

export const roadmapSchema = socialUrlSchema(
  /^(?:(?:https:\/\/)?(?:www\.)?roadmap\.sh\/u\/)?(?<value>[\w-]{2,})\/?$/,
);

export const twitterSchema = socialUrlSchema(
  /^(?:(?:https:\/\/)?(?:www\.)?(?:twitter|x)\.com\/)?@?(?<value>[\w-]{2,})\/?$/,
);

export const githubSchema = socialUrlSchema(
  /^(?:(?:https:\/\/)?(?:www\.)?github\.com\/)?@?(?<value>[\w-]{2,})\/?$/,
);

export const threadsSchema = socialUrlSchema(
  /^(?:(?:https:\/\/)?(?:www\.)?threads\.net\/)?@?(?<value>[\w-]{2,})\/?$/,
);

export const codepenSchema = socialUrlSchema(
  /^(?:(?:https:\/\/)?(?:www\.)?codepen\.io\/)?(?<value>[\w-]{2,})\/?$/,
);

export const redditSchema = socialUrlSchema(
  /^(?:(?:https:\/\/)?(?:www\.)?reddit\.com\/(?:u|user)\/)?(?<value>[\w-]{2,})\/?$/,
);

export const stackoverflowSchema = socialUrlSchema(
  /^(?:(?:https:\/\/)?(?:www\.)?stackoverflow\.com\/users\/)?(?<value>\d+\/[\w-]+)\/?$/,
);

export const youtubeSchema = socialUrlSchema(
  /^(?:(?:https:\/\/)?(?:www\.)?youtube\.com\/)?@?(?<value>[\w-]{2,})\/?$/,
);

export const linkedinSchema = socialUrlSchema(
  /^(?:(?:https:\/\/)?(?:www\.)?linkedin\.com\/in\/)?(?<value>[\p{L}\p{N}_-]{2,})\/?$/u,
);

export const mastodonSchema = socialUrlSchema(
  /^(?<value>https:\/\/(?:[a-z0-9-]+\.)*[a-z0-9-]+\.[a-z]{2,}\/@[\w-]{2,}\/?)$/,
);

export const hashnodeSchema = socialUrlSchema(
  /^(?<value>https:\/\/(?:[a-z0-9-]{1,50}\.){0,5}[a-z0-9-]{1,50}\.[a-z]{2,24}\b([-a-zA-Z0-9@:%_+.~#?&\/=]*))$/,
);

export const portfolioSchema = socialUrlSchema(
  /^(?<value>https:\/\/(?:[a-z0-9-]{1,50}\.){0,5}[a-z0-9-]{1,50}\.[a-z]{2,24}\b([-a-zA-Z0-9@:%_+.~#?&\/=]*))$/,
);

export const blueskySchema = socialUrlSchema(
  /^(?:(?:https:\/\/)?(?:www\.)?bsky\.app\/profile\/)?(?<value>[\w.-]+)(?:\/.*)?$/,
);

export const socialFieldsSchema = z.object({
  github: githubSchema,
  twitter: twitterSchema,
  threads: threadsSchema,
  codepen: codepenSchema,
  reddit: redditSchema,
  stackoverflow: stackoverflowSchema,
  youtube: youtubeSchema,
  linkedin: linkedinSchema,
  mastodon: mastodonSchema,
  roadmap: roadmapSchema,
  bluesky: blueskySchema,
  hashnode: hashnodeSchema,
  portfolio: portfolioSchema,
});

export type SocialFields = z.infer<typeof socialFieldsSchema>;
