import { DeepPartial } from 'typeorm';
import {
  removeAllSpecialCharactersForDedup,
  normalizeContentForDeduplication,
  generateContentHash,
  generateDeduplicationKey,
  applyDeduplicationHook,
} from '../src/entity/posts/hooks';
import {
  Post,
  PostType,
  SharePost,
  FreeformPost,
  ArticlePost,
} from '../src/entity';

describe('Post Deduplication Hooks', () => {
  describe('removeAllSpecialCharactersForDedup', () => {
    it('should keep letters and numbers from all languages', () => {
      const result = removeAllSpecialCharactersForDedup('hello-123_world!@#$%');
      expect(result).toBe('helloworld');
    });

    it('should keep Unicode letters but remove emojis', () => {
      const result = removeAllSpecialCharactersForDedup(
        'Hello 🌍 World! 中文测试',
      );
      expect(result).toBe('HelloWorld中文测试');
    });

    it('should handle empty string', () => {
      const result = removeAllSpecialCharactersForDedup('');
      expect(result).toBe('');
    });

    it('should preserve accented characters', () => {
      const result = removeAllSpecialCharactersForDedup('Café naïve résumé');
      expect(result).toBe('Cafénaïverésumé');
    });
  });

  describe('normalizeContentForDeduplication', () => {
    it('should convert to lowercase', () => {
      const result = normalizeContentForDeduplication('HELLO WORLD');
      expect(result).toBe('helloworld'); // All non-alphanumeric characters removed
    });

    it('should trim whitespace', () => {
      const result = normalizeContentForDeduplication('  hello world  ');
      expect(result).toBe('helloworld'); // All non-alphanumeric characters removed
    });

    it('should remove special characters', () => {
      const result = normalizeContentForDeduplication('hello@world!#$%');
      expect(result).toBe('helloworld'); // ALL special characters removed for dedup
    });
  });

  describe('generateContentHash', () => {
    it('should generate consistent hash', () => {
      const content = 'hello world';
      const hash1 = generateContentHash(content);
      const hash2 = generateContentHash(content);

      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different content', () => {
      const hash1 = generateContentHash('hello world');
      const hash2 = generateContentHash('hello universe');

      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty string', () => {
      const hash = generateContentHash('');
      expect(hash).toHaveLength(64);
      expect(hash).toBe(
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      );
    });
  });

  describe('generateDeduplicationKey', () => {
    describe('shared posts', () => {
      it('should use sharedPostId when available', () => {
        const post: DeepPartial<SharePost> = {
          type: PostType.Share,
          sharedPostId: 'shared-123',
          title: 'Some title',
        };

        const result = generateDeduplicationKey(post);
        expect(result).toBe('shared-123');
      });

      it('should return undefined when sharedPostId is missing', () => {
        const post: DeepPartial<SharePost> = {
          type: PostType.Share,
          title: 'Some title',
        };

        const result = generateDeduplicationKey(post);
        expect(result).toBeUndefined();
      });

      it('should use sharedPostId even when title and content exist', () => {
        const post: DeepPartial<SharePost> = {
          type: PostType.Share,
          sharedPostId: 'shared-456',
          title: 'Some title',
        };

        const result = generateDeduplicationKey(post);
        expect(result).toBe('shared-456');
      });
    });

    describe('freeform posts', () => {
      it('should use content hash when content is available', () => {
        const post: DeepPartial<FreeformPost> = {
          type: PostType.Freeform,
          content: 'This is my content',
          title: 'This is my title',
        };

        const result = generateDeduplicationKey(post);
        const expectedHash = generateContentHash(
          normalizeContentForDeduplication('This is my content'),
        );
        expect(result).toBe(expectedHash);
      });

      it('should fall back to title hash when content is empty', () => {
        const post: DeepPartial<FreeformPost> = {
          type: PostType.Freeform,
          content: '',
          title: 'This is my title',
        };

        const result = generateDeduplicationKey(post);
        const expectedHash = generateContentHash(
          normalizeContentForDeduplication('This is my title'),
        );
        expect(result).toBe(expectedHash);
      });

      it('should fall back to title hash when content is undefined', () => {
        const post: DeepPartial<FreeformPost> = {
          type: PostType.Freeform,
          title: 'This is my title',
        };

        const result = generateDeduplicationKey(post);
        const expectedHash = generateContentHash(
          normalizeContentForDeduplication('This is my title'),
        );
        expect(result).toBe(expectedHash);
      });

      it('should return undefined when both content and title are missing', () => {
        const post: DeepPartial<FreeformPost> = {
          type: PostType.Freeform,
        };

        const result = generateDeduplicationKey(post);
        expect(result).toBeUndefined();
      });

      it('should normalize content before hashing', () => {
        const post1: DeepPartial<FreeformPost> = {
          type: PostType.Freeform,
          content: '  HELLO WORLD!  ',
        };

        const post2: DeepPartial<FreeformPost> = {
          type: PostType.Freeform,
          content: 'hello world',
        };

        const result1 = generateDeduplicationKey(post1);
        const result2 = generateDeduplicationKey(post2);
        expect(result1).toBe(result2);
      });
    });

    describe('other post types', () => {
      it('should return undefined for article posts', () => {
        const post: DeepPartial<ArticlePost> = {
          type: PostType.Article,
          title: 'Article title',
          url: 'https://example.com',
        };

        const result = generateDeduplicationKey(post);
        expect(result).toBeUndefined();
      });

      it('should return undefined for welcome posts', () => {
        const post: DeepPartial<Post> = {
          type: PostType.Welcome,
          title: 'Welcome title',
        };

        const result = generateDeduplicationKey(post);
        expect(result).toBeUndefined();
      });

      it('should return undefined for collection posts', () => {
        const post: DeepPartial<Post> = {
          type: PostType.Collection,
          title: 'Collection title',
        };

        const result = generateDeduplicationKey(post);
        expect(result).toBeUndefined();
      });

      it('should return undefined for brief posts', () => {
        const post: DeepPartial<Post> = {
          type: PostType.Brief,
          title: 'Brief title',
        };

        const result = generateDeduplicationKey(post);
        expect(result).toBeUndefined();
      });

      it('should return undefined for video posts', () => {
        const post: DeepPartial<Post> = {
          type: PostType.VideoYouTube,
          title: 'Video title',
        };

        const result = generateDeduplicationKey(post);
        expect(result).toBeUndefined();
      });
    });
  });

  describe('applyDeduplicationHook', () => {
    it('should add dedupKey to flags when key is generated', async () => {
      const post: DeepPartial<FreeformPost> = {
        type: PostType.Freeform,
        content: 'test content',
        flags: {
          visible: true,
        },
      };

      const result = await applyDeduplicationHook(post);

      expect(result.flags?.dedupKey).toBeDefined();
      expect(result.flags?.visible).toBe(true); // Preserve existing flags
      expect(typeof result.flags?.dedupKey).toBe('string');
      expect(result.flags?.dedupKey).toHaveLength(64); // SHA-256 hash
    });

    it('should preserve existing flags when adding dedupKey', async () => {
      const post: DeepPartial<SharePost> = {
        type: PostType.Share,
        sharedPostId: 'shared-123',
        flags: {
          visible: true,
          private: false,
          banned: false,
        },
      };

      const result = await applyDeduplicationHook(post);

      expect(result.flags?.dedupKey).toBe('shared-123');
      expect(result.flags?.visible).toBe(true);
      expect(result.flags?.private).toBe(false);
      expect(result.flags?.banned).toBe(false);
    });

    it('should not modify post when no dedupKey is generated', async () => {
      const post: DeepPartial<ArticlePost> = {
        type: PostType.Article,
        title: 'Article title',
        flags: {
          visible: true,
        },
      };

      const result = await applyDeduplicationHook(post);

      expect(result).toEqual(post); // Should be unchanged
      expect(result.flags?.dedupKey).toBeUndefined();
    });

    it('should handle post with no existing flags', async () => {
      const post: DeepPartial<FreeformPost> = {
        type: PostType.Freeform,
        content: 'test content',
      };

      const result = await applyDeduplicationHook(post);

      expect(result.flags?.dedupKey).toBeDefined();
      expect(typeof result.flags?.dedupKey).toBe('string');
    });

    it('should handle post with empty flags object', async () => {
      const post: DeepPartial<FreeformPost> = {
        type: PostType.Freeform,
        content: 'test content',
        flags: {},
      };

      const result = await applyDeduplicationHook(post);

      expect(result.flags?.dedupKey).toBeDefined();
      expect(typeof result.flags?.dedupKey).toBe('string');
    });
  });
});
