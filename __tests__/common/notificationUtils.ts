import { basicHtmlStrip } from '../../src/common/notificationUtils';

describe('notificationUtils', () => {
  describe('basicHtmlStrip', () => {
    it('should extract plain text without executable HTML', () => {
      expect(
        basicHtmlStrip(
          '<p>Hello <strong>daily.dev</strong></p><script>alert(1)</script><style>body { color: red; }</style><script',
        ),
      ).toEqual('Hello daily.dev');
    });
  });
});
