import type { TypedWorker } from './worker';
import { ChatMessage, ChatRequest, ModelProvider } from '@dailydotdev/schema';
import { AGENTS_DIGEST_SOURCE } from '../entity/Source';
import { FreeformPost } from '../entity/posts/FreeformPost';
import { ONE_DAY_IN_SECONDS, ONE_MINUTE_IN_SECONDS } from '../common/constants';
import {
  checkRedisObjectExists,
  deleteRedisKey,
  setRedisObjectIfNotExistsWithExpiry,
  setRedisObjectWithExpiry,
} from '../redis';
import { getBragiProxyClient } from '../integrations/bragi';
import { retryFetch } from '../integrations/retry';
import { getTwitterClient } from '../integrations/twitter/clients';

const AGENTIC_DIGEST_IMAGE_URL = 'http://og.daily.dev/api/arena?tab=llms';
const AGENTIC_DIGEST_DONE_TTL_SECONDS = 7 * ONE_DAY_IN_SECONDS;
const AGENTIC_DIGEST_LOCK_TTL_SECONDS = 10 * ONE_MINUTE_IN_SECONDS;
const AGENTIC_DIGEST_IMAGE_TIMEOUT_MS = 60 * 1000;

const AGENTIC_DIGEST_SYSTEM_PROMPT = `You write a daily AI coding news post for daily.dev's social media.
The audience is developers who use AI tools daily.

Structure (follow exactly):
1. HOOK + BRIDGE (one or two short lines): Opens with a punchy, moody one-liner (under 10 words) then immediately
frames what follows as today's AI dev news roundup. The two should flow naturally together. Never "morning". Tired,
cynical, busy energy. Vary the mood every time — wry, deadpan, resigned, amused, exasperated. IMPORTANT: Do not start
 with "who greenlit" or "another day". Invent something fresh each time.
2. BLANK LINE
3. BULLETS: 3-4 bullet points using "-" prefix. Each bullet is a mini take (8-15 words). Must contain enough context
that someone seeing this for the first time gets it, plus a bit of opinion or color that makes it fun to read. Every
bullet should make a stranger think "hah, okay, tell me more." When a handle is provided in the input for a company
or person mentioned, use it naturally in the bullet (e.g. "@OpenAI's Codex hits Windows" not "OpenAI's Codex hits
Windows"). Don't force handles where they don't fit.
4. BLANK LINE
5. CLOSER: One short line (under 15 words) that nods to the attached chart showing which LLMs developers actually use
 and trust right now. Keep the same tired-engineer energy. Don't be promotional or salesy — just a casual nod like
you're pointing at a screen. Vary this too, don't repeat the same closer. Never use the word "sentiment".

Rules:
- Tired cynical senior engineer who tracks AI tools because it's literally their job. Cooky, punchy, busy.
- Every bullet needs context AND attitude. Fact alone is boring. Opinion alone is confusing.
- Not promotional. No calls to action. No links. The closer references the chart but doesn't sell it.
- No hashtags, no emojis, no threads, no em dashes.
- No AI slop.
- Straight quotes only.

Output: just the post. Nothing else.`;

const getTweetDoneKey = (postId: string): string =>
  `agentic-digest:tweet:done:${postId}`;

const getTweetLockKey = (postId: string): string =>
  `agentic-digest:tweet:lock:${postId}`;

const buildAgenticDigestChatRequest = ({
  systemPrompt,
  userPrompt,
}: {
  systemPrompt: string;
  userPrompt: string;
}): ChatRequest =>
  new ChatRequest({
    application: 'agentic-digest-tweet',
    provider: ModelProvider.Anthropic,
    model: 'claude-sonnet-4-6',
    maxTokens: 400,
    temperature: 1,
    messages: [
      new ChatMessage({
        role: 'system',
        content: systemPrompt,
      }),
      new ChatMessage({
        role: 'user',
        content: userPrompt,
      }),
    ],
  });

const hasTweetBeenPublished = async (postId: string): Promise<boolean> =>
  !!(await checkRedisObjectExists(getTweetDoneKey(postId)));

const acquireTweetLock = async ({
  postId,
  messageId,
}: {
  postId: string;
  messageId?: string;
}): Promise<boolean> =>
  setRedisObjectIfNotExistsWithExpiry(
    getTweetLockKey(postId),
    messageId || postId,
    AGENTIC_DIGEST_LOCK_TTL_SECONDS,
  );

const releaseTweetLock = async (postId: string): Promise<void> => {
  await deleteRedisKey(getTweetLockKey(postId));
};

const markTweetAsPublished = async (postId: string): Promise<void> => {
  await setRedisObjectWithExpiry(
    getTweetDoneKey(postId),
    '1',
    AGENTIC_DIGEST_DONE_TTL_SECONDS,
  );
};

const getPostContent = async ({
  con,
  postId,
}: {
  con: Parameters<TypedWorker<'api.v1.post-visible'>['handler']>[1];
  postId: string;
}): Promise<string | null> => {
  const post = await con.getRepository(FreeformPost).findOne({
    select: {
      id: true,
      content: true,
    },
    where: {
      id: postId,
      sourceId: AGENTS_DIGEST_SOURCE,
    },
  });

  return post?.content || null;
};

const generateTweetText = async ({
  postContent,
}: {
  postContent: string;
}): Promise<string> => {
  const bragiClient = getBragiProxyClient();
  const bragiResponse = await bragiClient.garmr.execute(() =>
    bragiClient.instance.chat(
      buildAgenticDigestChatRequest({
        systemPrompt: AGENTIC_DIGEST_SYSTEM_PROMPT,
        userPrompt: `<digest>
${postContent}
</digest>
<handles>
@OpenAI - OpenAI, GPT, Codex, o1, o3, Sora
@AnthropicAI - Anthropic, Claude, Sonnet, Opus, Haiku
@GoogleDeepMind - Google DeepMind, Gemini, Gemma
@xai - xAI, Grok
@AIatMeta - Meta AI, Llama
@MistralAI - Mistral AI, Mixtral, Le Chat
@Alibaba_Qwen - Qwen, QwQ
@deepseek_ai - DeepSeek, DeepSeek-R1, DeepSeek-V3
@cohere - Cohere, Command R
@AI21Labs - AI21 Labs, Jamba
@StabilityAI - Stability AI, Stable Diffusion
@huggingface - Hugging Face, Transformers
@perplexity_ai - Perplexity
@elevenlabsio - ElevenLabs
@runwayml - Runway
@midjourney - Midjourney
@replicate - Replicate
@cursor_ai - Cursor
@windsurf - Windsurf, Codeium, Cascade
@Replit - Replit, Replit Agent
@github - GitHub, Copilot
</handles>
        `,
      }),
    ),
  );
  const tweetText = bragiResponse.message?.content?.trim();

  if (!tweetText) {
    throw new Error('bragi chat response is missing content');
  }

  return tweetText;
};

const downloadDigestImage = async (): Promise<{
  imageBuffer: Buffer;
  mediaContentType: string | null;
}> => {
  const imageResponse = await retryFetch(
    AGENTIC_DIGEST_IMAGE_URL,
    {
      method: 'GET',
      signal: AbortSignal.timeout(AGENTIC_DIGEST_IMAGE_TIMEOUT_MS),
    },
    {
      retries: 3,
      minTimeout: 500,
    },
  );
  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

  if (!imageBuffer.length) {
    throw new Error('agentic digest image response is empty');
  }

  return {
    imageBuffer,
    mediaContentType: imageResponse.headers.get('content-type'),
  };
};

const publishTweet = async ({
  tweetText,
  imageBuffer,
  mediaContentType,
}: {
  tweetText: string;
  imageBuffer: Buffer;
  mediaContentType: string | null;
}): Promise<void> => {
  const twitterClient = getTwitterClient();

  if (!twitterClient) {
    throw new Error('twitter client is not configured');
  }

  await twitterClient.postTweetWithMedia({
    text: tweetText,
    media: imageBuffer,
    mediaContentType,
  });
};

const worker: TypedWorker<'api.v1.post-visible'> = {
  subscription: 'api.agentic-digest-tweet',
  handler: async ({ data, messageId }, con, logger): Promise<void> => {
    if (data.post.sourceId !== AGENTS_DIGEST_SOURCE) {
      return;
    }

    const postId = data.post.id;

    if (await hasTweetBeenPublished(postId)) {
      return;
    }

    const lockAcquired = await acquireTweetLock({
      postId,
      messageId,
    });

    if (!lockAcquired) {
      return;
    }

    try {
      const postContent = await getPostContent({
        con,
        postId,
      });

      if (!postContent) {
        return;
      }

      const [tweetText, imageResult] = await Promise.all([
        generateTweetText({
          postContent,
        }),
        downloadDigestImage(),
      ]);

      await publishTweet({
        tweetText,
        imageBuffer: imageResult.imageBuffer,
        mediaContentType: imageResult.mediaContentType,
      });
      await markTweetAsPublished(postId);
    } catch (err) {
      logger.error(
        {
          postId,
          messageId,
          err,
        },
        'failed to publish agentic digest tweet',
      );
      throw err;
    } finally {
      await releaseTweetLock(postId);
    }
  },
};

export default worker;
