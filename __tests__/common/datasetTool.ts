import { normalizeTitle, getIconSlug } from '../../src/common/datasetTool';

describe('normalizeTitle', () => {
  it('should convert to lowercase', () => {
    expect(normalizeTitle('JavaScript')).toBe('javascript');
    expect(normalizeTitle('TypeScript')).toBe('typescript');
    expect(normalizeTitle('PYTHON')).toBe('python');
  });

  it('should trim whitespace', () => {
    expect(normalizeTitle('  JavaScript  ')).toBe('javascript');
    expect(normalizeTitle('   Python   ')).toBe('python');
  });

  it('should replace dots with "dot"', () => {
    expect(normalizeTitle('Node.js')).toBe('nodedotjs');
    expect(normalizeTitle('.NET')).toBe('dotnet');
    expect(normalizeTitle('Vue.js')).toBe('vuedotjs');
  });

  it('should replace plus signs with "plus"', () => {
    expect(normalizeTitle('C++')).toBe('cplusplus');
    expect(normalizeTitle('Google+')).toBe('googleplus');
  });

  it('should replace hash with "sharp"', () => {
    expect(normalizeTitle('C#')).toBe('csharp');
    expect(normalizeTitle('F#')).toBe('fsharp');
  });

  it('should replace ampersand with "and"', () => {
    expect(normalizeTitle('R&D')).toBe('randd');
    expect(normalizeTitle('HTML & CSS')).toBe('htmlandcss');
  });

  it('should remove whitespace', () => {
    expect(normalizeTitle('Ruby on Rails')).toBe('rubyonrails');
    expect(normalizeTitle('Google Cloud')).toBe('googlecloud');
  });

  it('should handle complex cases', () => {
    expect(normalizeTitle('Three.js')).toBe('threedotjs');
    expect(normalizeTitle('Socket.IO')).toBe('socketdotio');
  });
});

describe('getIconSlug', () => {
  describe('simple-icons source', () => {
    it('should return mapped slug for known technologies', () => {
      expect(getIconSlug('Node.js', 'simple-icons')).toBe('nodedotjs');
      expect(getIconSlug('Vue.js', 'simple-icons')).toBe('vuedotjs');
      expect(getIconSlug('Next.js', 'simple-icons')).toBe('nextdotjs');
    });

    it('should return normalized title for unknown technologies', () => {
      expect(getIconSlug('UnknownTech', 'simple-icons')).toBe('unknowntech');
      expect(getIconSlug('My Custom Tool', 'simple-icons')).toBe(
        'mycustomtool',
      );
    });

    it('should handle special characters in title', () => {
      expect(getIconSlug('C++', 'simple-icons')).toBe('cplusplus');
      expect(getIconSlug('C#', 'simple-icons')).toBe('csharp');
    });
  });

  describe('devicon source', () => {
    it('should return mapped slug for known technologies', () => {
      expect(getIconSlug('Node.js', 'devicon')).toBe('nodejs');
      expect(getIconSlug('Vue.js', 'devicon')).toBe('vuejs');
      expect(getIconSlug('.NET', 'devicon')).toBe('dot-net');
    });

    it('should return normalized title for unknown technologies', () => {
      expect(getIconSlug('UnknownTech', 'devicon')).toBe('unknowntech');
    });
  });

  describe('iconify source', () => {
    it('should return mapped slug for known technologies', () => {
      expect(getIconSlug('Node.js', 'iconify')).toBe('nodejs');
      expect(getIconSlug('Vue.js', 'iconify')).toBe('vue');
      expect(getIconSlug('VS Code', 'iconify')).toBe('visual-studio-code');
    });

    it('should return normalized title for unknown technologies', () => {
      expect(getIconSlug('UnknownTech', 'iconify')).toBe('unknowntech');
    });
  });

  describe('Java special case', () => {
    it('should return devicon slug for Java', () => {
      expect(getIconSlug('Java', 'devicon')).toBe('java');
    });

    it('should return iconify slug for Java', () => {
      expect(getIconSlug('Java', 'iconify')).toBe('java');
    });

    it('should fallback to normalized for simple-icons (Java not in Simple Icons)', () => {
      // Java mapping doesn't have simpleIcons defined, so it falls back
      expect(getIconSlug('Java', 'simple-icons')).toBe('java');
    });
  });

  describe('case insensitivity', () => {
    it('should handle various casings', () => {
      expect(getIconSlug('JAVASCRIPT', 'simple-icons')).toBe('javascript');
      expect(getIconSlug('javascript', 'simple-icons')).toBe('javascript');
      expect(getIconSlug('JavaScript', 'simple-icons')).toBe('javascript');
    });
  });

  describe('cloud providers', () => {
    it('should handle AWS variations', () => {
      expect(getIconSlug('AWS', 'simple-icons')).toBe('amazonwebservices');
      expect(getIconSlug('Amazon Web Services', 'simple-icons')).toBe(
        'amazonwebservices',
      );
    });

    it('should handle GCP variations', () => {
      expect(getIconSlug('GCP', 'simple-icons')).toBe('googlecloud');
      expect(getIconSlug('Google Cloud', 'simple-icons')).toBe('googlecloud');
    });

    it('should handle Azure variations', () => {
      expect(getIconSlug('Azure', 'simple-icons')).toBe('microsoftazure');
      expect(getIconSlug('Microsoft Azure', 'simple-icons')).toBe(
        'microsoftazure',
      );
    });
  });

  describe('database technologies', () => {
    it('should handle PostgreSQL variations', () => {
      expect(getIconSlug('PostgreSQL', 'simple-icons')).toBe('postgresql');
      expect(getIconSlug('Postgres', 'simple-icons')).toBe('postgresql');
    });
  });

  describe('common frameworks', () => {
    it('should handle React variations', () => {
      expect(getIconSlug('React', 'simple-icons')).toBe('react');
      expect(getIconSlug('ReactJS', 'simple-icons')).toBe('react');
      expect(getIconSlug('React Native', 'simple-icons')).toBe('react');
    });

    it('should handle Angular variations', () => {
      expect(getIconSlug('Angular', 'simple-icons')).toBe('angular');
      expect(getIconSlug('AngularJS', 'simple-icons')).toBe('angular');
    });
  });
});
