import { markdown } from '../../src/common/markdown';

describe('markdown image proxy integration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    process.env.CLOUDINARY_URL = 'cloudinary://test:test@daily-now';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('image rendering', () => {
    it('should proxy external image URLs in markdown', () => {
      const content = '![alt text](https://example.com/image.png)';
      const result = markdown.render(content);

      expect(result).toContain('media.daily.dev');
      expect(result).toContain('/image/fetch/');
      expect(result).toContain('s--'); // signature
    });

    it('should not proxy images from media.daily.dev', () => {
      const content = '![alt text](https://media.daily.dev/image.png)';
      const result = markdown.render(content);

      expect(result).toContain('https://media.daily.dev/image.png');
      expect(result).not.toContain('/image/fetch/');
    });

    it('should not proxy images from res.cloudinary.com', () => {
      const content =
        '![alt text](https://res.cloudinary.com/daily-now/image/upload/image.png)';
      const result = markdown.render(content);

      expect(result).toContain(
        'https://res.cloudinary.com/daily-now/image/upload/image.png',
      );
    });

    it('should block images from private IPs', () => {
      const content = '![alt text](http://127.0.0.1/image.png)';
      const result = markdown.render(content);

      expect(result).toContain('src=""');
      expect(result).not.toContain('127.0.0.1');
    });

    it('should block images from localhost', () => {
      const content = '![alt text](http://localhost/image.png)';
      const result = markdown.render(content);

      expect(result).toContain('src=""');
      expect(result).not.toContain('localhost');
    });

    it('should block images with file:// protocol', () => {
      const content = '![alt text](file:///etc/passwd)';
      const result = markdown.render(content);

      // Note: markdown-it may not produce a valid image tag for file:// URLs
      // but we ensure it doesn't expose the path
      expect(result).not.toContain('/etc/passwd');
    });

    it('should preserve alt text in proxied images', () => {
      const content = '![my alt text](https://example.com/image.png)';
      const result = markdown.render(content);

      expect(result).toContain('alt="my alt text"');
    });

    it('should handle multiple images in same content', () => {
      const content = `
![image1](https://example.com/1.png)

Some text here

![image2](https://evil.com/2.gif)
      `;
      const result = markdown.render(content);

      expect(result).not.toContain('example.com/1.png');
      expect(result).not.toContain('evil.com/2.gif');
      expect(result.match(/media\.daily\.dev/g)?.length).toBe(2);
    });

    it('should handle images in links', () => {
      const content =
        '[![alt](https://example.com/image.png)](https://link.com)';
      const result = markdown.render(content);

      expect(result).toContain('media.daily.dev');
      expect(result).toContain('href="https://link.com"');
    });

    it('should handle data URIs without proxying', () => {
      const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';
      const content = `![alt](${dataUri})`;
      const result = markdown.render(content);

      expect(result).toContain(dataUri);
    });
  });

  describe('without Cloudinary configured', () => {
    beforeEach(() => {
      delete process.env.CLOUDINARY_URL;
    });

    it('should pass through external URLs when Cloudinary is not configured', () => {
      const content = '![alt](https://example.com/image.png)';
      const result = markdown.render(content);

      expect(result).toContain('https://example.com/image.png');
    });
  });
});
