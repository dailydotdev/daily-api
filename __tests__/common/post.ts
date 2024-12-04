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
  it('should return the alt title if it exists', () => {
    const post = {
      contentMeta: {
        alt_title: {
          translations: {
            [ContentLanguage.Spanish]: 'Título Inteligente',
          },
        },
      },
    };

    const result = getPostSmartTitle(post, ContentLanguage.Spanish);
    expect(result).toBe('Título Inteligente');
  });

  it('should return undefined if the alt title translation does not exist', () => {
    const post = {
      contentMeta: {
        alt_title: {
          translations: {
            [ContentLanguage.Spanish]: 'Título Inteligente',
          },
        },
      },
    };

    const result = getPostSmartTitle(post, ContentLanguage.German);
    expect(result).toBeUndefined();
  });

  it('should return undefined if alt_title is undefined', () => {
    const post = {
      contentMeta: {
        alt_title: undefined,
      },
    };

    const result = getPostSmartTitle(post, ContentLanguage.Spanish);
    expect(result).toBeUndefined();
  });

  it('should return undefined if alt title translations is undefined', () => {
    const post = {
      contentMeta: {
        alt_title: {
          translations: undefined,
        },
      },
    };

    const result = getPostSmartTitle(post, ContentLanguage.Spanish);
    expect(result).toBeUndefined();
  });

  it('should return undefined if contentMeta is undefined', () => {
    const post = {
      contentMeta: undefined,
    };

    const result = getPostSmartTitle(post, ContentLanguage.Spanish);
    expect(result).toBeUndefined();
  });

  it('should return the English alt title translation if contentLanguage is undefined', () => {
    const post = {
      contentMeta: {
        alt_title: {
          translations: {
            [ContentLanguage.English]: 'Smart Title',
          },
        },
      },
    };

    const result = getPostSmartTitle(post, undefined);
    expect(result).toBe('Smart Title');
  });
});
