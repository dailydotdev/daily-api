import { setDefaultsIfNull } from '../../src/common/object';
import { defaultPublicSourceFlags } from '../../src/entity';

describe('setDefaultsIfNull function', () => {
  it('should return the default value object if first param is null or undefined', () => {
    const result = setDefaultsIfNull(null, defaultPublicSourceFlags);

    expect(result).toEqual(defaultPublicSourceFlags);
  });

  it('should return the first param if default value is null or undefined', () => {
    const result = setDefaultsIfNull(defaultPublicSourceFlags, null);

    expect(result).toEqual(defaultPublicSourceFlags);
  });

  it('should set the default value if property is null or undefined', () => {
    const result = setDefaultsIfNull(
      { ...defaultPublicSourceFlags, totalPosts: null },
      defaultPublicSourceFlags,
    );

    expect(result.totalPosts).toEqual(0);
  });

  it('should NOT set the default value if property is NOT null or undefined', () => {
    const totalPosts = 12;
    const result = setDefaultsIfNull(
      { ...defaultPublicSourceFlags, totalPosts },
      defaultPublicSourceFlags,
    );

    expect(result.totalPosts).toEqual(totalPosts);
  });

  it('should ensure `false` value is NOT considered as falsy and should NOT be overwritten', () => {
    const result = setDefaultsIfNull(
      { ...defaultPublicSourceFlags, featured: false },
      { ...defaultPublicSourceFlags, featured: true },
    );

    expect(result.featured).toEqual(false);
  });
});
