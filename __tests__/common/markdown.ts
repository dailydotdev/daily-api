import cloudinary from 'cloudinary';
import { markdown } from '../../src/common/markdown';

const configureCloudinary = () => {
  cloudinary.v2.config({
    cloud_name: 'daily-now',
    api_key: 'test',
    api_secret: 'test',
  });
};

describe('markdown image proxy integration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    process.env.CLOUDINARY_URL = 'cloudinary://test:test@daily-now';
    configureCloudinary();
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

    it('should not render file:// protocol URLs as images', () => {
      const content = '![alt text](file:///etc/passwd)';
      const result = markdown.render(content);

      // Markdown-it does not render file:// URLs as images, just plain text
      // This is safe since the path is not loaded as an image
      expect(result).not.toContain('<img');
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

      // Both images should be proxied through Cloudinary
      expect(result.match(/media\.daily\.dev/g)?.length).toBe(2);
      expect(result).toContain('/image/fetch/');
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

  describe('video rendering', () => {
    it('should render video markdown as a video element', () => {
      const content =
        '![Bar chart race](https://daily-now-res.cloudinary.com/video/upload/v1/race.webm)';
      const result = markdown.render(content);

      expect(result).toContain('<video');
      expect(result).not.toContain('<img');
      expect(result).toContain('controls');
      expect(result).toContain('preload="metadata"');
      expect(result).toContain('type="video/webm"');
      expect(result).toContain('aria-label="Bar chart race"');
    });

    it('should not proxy video URLs through the image proxy', () => {
      const content =
        '![clip](https://daily-now-res.cloudinary.com/video/upload/v1/race.webm)';
      const result = markdown.render(content);

      expect(result).toContain(
        'https://daily-now-res.cloudinary.com/video/upload/v1/race.webm',
      );
      expect(result).not.toContain('/image/fetch/');
    });

    it('should render valid external videos as-is', () => {
      const content = '![clip](https://example.com/clip.mp4)';
      const result = markdown.render(content);

      expect(result).toContain('src="https://example.com/clip.mp4"');
      expect(result).toContain('type="video/mp4"');
    });

    it('should block videos from private IPs', () => {
      const content = '![clip](http://127.0.0.1/clip.mp4)';
      const result = markdown.render(content);

      expect(result).not.toContain('<video');
      expect(result).not.toContain('127.0.0.1');
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

describe('markdown emphasis rendering', () => {
  it.each([
    ['WORD_(text)_', 'WORD<em>(text)</em>'],
    ['word_(text)_', 'word<em>(text)</em>'],
    ['”_(text)_word', '”<em>(text)</em>word'],
    ['“WORD”_(text)_', '“WORD”<em>(text)</em>'],
    [
      '“SCARRING” _(Oh my goshhh)_ effect',
      '“SCARRING” <em>(Oh my goshhh)</em> effect',
    ],
  ])(
    'should render underscores around punctuation as emphasis: %s',
    (content, expected) => {
      expect(markdown.renderInline(content)).toBe(expected);
    },
  );

  it.each([
    ['some_file_name', 'some_file_name'],
    ['user_id', 'user_id'],
    ['a_b_c', 'a_b_c'],
    ['__init__', '<strong>init</strong>'],
    ['`some_var`', '<code>some_var</code>'],
    [
      'http://x/a_b_c',
      '<a href="http://x/a_b_c" target="_blank" rel="noopener nofollow">http://x/a_b_c</a>',
    ],
  ])(
    'should preserve existing underscore behavior: %s',
    (content, expected) => {
      expect(markdown.renderInline(content)).toBe(expected);
    },
  );

  it.each([
    ['before *(text)* after', 'before <em>(text)</em> after'],
    ['before **(text)** after', 'before <strong>(text)</strong> after'],
    ['before __(text)__ after', 'before <strong>(text)</strong> after'],
  ])(
    'should preserve non-single-underscore emphasis: %s',
    (content, expected) => {
      expect(markdown.renderInline(content)).toBe(expected);
    },
  );
});
