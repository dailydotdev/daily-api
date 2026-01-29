import { normalizeTitle } from '../../src/common/datasetTool';

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
