import { getPostSmartTitle, getPostTranslatedTitle } from '../../src/common';
import type { Post } from '../../src/entity';
import { ContentLanguage } from '../../src/types';

describe('getPostTranslatedTitle', () => {
  it('should return the translated title if it exists', () => {
    const post: Partial<Post> = {
      title: 'Original Title',
      translation: {
        [ContentLanguage.German]: {
          title: 'Übersetzter Titel',
        },
      },
    };

    const result = getPostTranslatedTitle(post, ContentLanguage.German);
    expect(result).toBe('Übersetzter Titel');
  });

  it('should return the original title if the translation does not exist', () => {
    const post: Partial<Post> = {
      title: 'Original Title',
      translation: {
        [ContentLanguage.Spanish]: {
          title: 'Título Traducido',
        },
      },
    };

    const result = getPostTranslatedTitle(post, ContentLanguage.German);
    expect(result).toBe('Original Title');
  });

  it('should return the original title if translation is undefined', () => {
    const post: Partial<Post> = {
      title: 'Original Title',
      translation: undefined,
    };

    const result = getPostTranslatedTitle(post, ContentLanguage.German);
    expect(result).toBe('Original Title');
  });

  it('should return the original title if "de" is undefined', () => {
    const post: Partial<Post> = {
      title: 'Original Title',
      translation: {
        [ContentLanguage.German]: undefined,
      },
    };

    const result = getPostTranslatedTitle(post, ContentLanguage.German);
    expect(result).toBe('Original Title');
  });

  it('should return the original title if title is undefined', () => {
    const post: Partial<Post> = {
      title: 'Original Title',
      translation: {
        [ContentLanguage.German]: {
          title: undefined,
        },
      },
    };

    const result = getPostTranslatedTitle(post, ContentLanguage.German);
    expect(result).toBe('Original Title');
  });
});

describe('getPostSmartTitle', () => {
  it('should return the alt title for the specified content language', () => {
    const post: Partial<Post> = {
      title: 'Default Title',
      contentMeta: {
        alt_title: {
          translations: {
            [ContentLanguage.Spanish]: 'Título en Español',
          },
        },
      },
    };

    const result = getPostSmartTitle(post, ContentLanguage.Spanish);
    expect(result).toBe('Título en Español');
  });

  it('should return the English alt title if specified content language is not available', () => {
    const post: Partial<Post> = {
      title: 'Default Title',
      contentMeta: {
        alt_title: {
          translations: {
            [ContentLanguage.English]: 'Title in English',
          },
        },
      },
    };

    const result = getPostSmartTitle(post, ContentLanguage.Spanish);
    expect(result).toBe('Title in English');
  });

  it('should return the default title if no alt title translations are available', () => {
    const post: Partial<Post> = {
      title: 'Default Title',
    };

    const result = getPostSmartTitle(post, ContentLanguage.German);
    expect(result).toBe('Default Title');
  });

  it('should return the default title if contentMeta is not defined', () => {
    const post: Partial<Post> = {
      title: 'Default Title',
    };

    const result = getPostSmartTitle(post, ContentLanguage.German);
    expect(result).toBe('Default Title');
  });

  it('should return the translated title if no alt title translations are available', () => {
    const post: Partial<Post> = {
      title: 'Default Title',
      translation: {
        [ContentLanguage.German]: {
          title: 'Übersetzter Titel',
        },
      },
    };

    const result = getPostSmartTitle(post, ContentLanguage.German);
    expect(result).toBe('Übersetzter Titel');
  });
});
