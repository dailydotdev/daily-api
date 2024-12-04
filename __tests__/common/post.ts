import { getPostSmartTitle, getPostTranslatedTitle } from '../../src/common';
import { ContentLanguage } from '../../src/types';

describe('getPostTranslatedTitle', () => {
  it('should return the translated title if it exists', () => {
    const post = {
      title: 'Original Title',
      contentMeta: {
        translate_title: {
          translations: {
            [ContentLanguage.German]: 'Übersetzter Titel',
          },
        },
      },
    };

    const result = getPostTranslatedTitle(post, ContentLanguage.German);
    expect(result).toBe('Übersetzter Titel');
  });

  it('should return the original title if the translation does not exist', () => {
    const post = {
      title: 'Original Title',
      contentMeta: {
        translate_title: {
          translations: {
            [ContentLanguage.Spanish]: 'Título Traducido',
          },
        },
      },
    };

    const result = getPostTranslatedTitle(post, ContentLanguage.German);
    expect(result).toBe('Original Title');
  });

  it('should return the original title if contentMeta is undefined', () => {
    const post = {
      title: 'Original Title',
      contentMeta: undefined,
    };

    const result = getPostTranslatedTitle(post, ContentLanguage.German);
    expect(result).toBe('Original Title');
  });

  it('should return the original title if translate_title is undefined', () => {
    const post = {
      title: 'Original Title',
      contentMeta: {
        translate_title: undefined,
      },
    };

    const result = getPostTranslatedTitle(post, ContentLanguage.German);
    expect(result).toBe('Original Title');
  });

  it('should return the original title if translations is undefined', () => {
    const post = {
      title: 'Original Title',
      contentMeta: {
        translate_title: {
          translations: undefined,
        },
      },
    };

    const result = getPostTranslatedTitle(post, ContentLanguage.German);
    expect(result).toBe('Original Title');
  });
});

describe('getPostSmartTitle', () => {
  it('should return the alt title for the specified content language', () => {
    const post = {
      contentMeta: {
        alt_title: {
          translations: {
            [ContentLanguage.Spanish]: 'Título en Español',
          },
        },
      },
      title: 'Default Title',
    };

    const result = getPostSmartTitle(post, ContentLanguage.Spanish);
    expect(result).toBe('Título en Español');
  });

  it('should return the English alt title if specified content language is not available', () => {
    const post = {
      contentMeta: {
        alt_title: {
          translations: {
            [ContentLanguage.English]: 'Title in English',
          },
        },
      },
      title: 'Default Title',
    };

    const result = getPostSmartTitle(post, ContentLanguage.Spanish);
    expect(result).toBe('Title in English');
  });

  it('should return the default title if no alt title translations are available', () => {
    const post = {
      title: 'Default Title',
    };

    const result = getPostSmartTitle(post);
    expect(result).toBe('Default Title');
  });

  it('should return the English alt translated title if no content language is specified', () => {
    const post = {
      contentMeta: {
        alt_title: {
          translations: {
            [ContentLanguage.English]: 'Title in English',
          },
        },
      },
      title: 'Default Title',
    };

    const result = getPostSmartTitle(post);
    expect(result).toBe('Title in English');
  });

  it('should return the default title if contentMeta is not defined', () => {
    const post = {
      title: 'Default Title',
    };

    const result = getPostSmartTitle(post);
    expect(result).toBe('Default Title');
  });
});
