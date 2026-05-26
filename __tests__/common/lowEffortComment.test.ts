import { isLowEffortComment } from '../../src/common/lowEffortComment';

describe('isLowEffortComment', () => {
  describe('positive cases (low-effort)', () => {
    it.each([
      ['nice'],
      ['Great!'],
      ['Thanks for sharing!'],
      ["Let's go!"],
      ['sooo cool'],
      ['👍👍👍'],
      ['Thanks 👍'],
      ['wow trop coool'],
      ['gracias'],
      ['Helpful post.'],
      ['this is good'],
      ['OK'],
      ['thx'],
      ['Damnnnnnn'],
      ['Greatt!!!'],
    ])('flags %p as low-effort', (content) => {
      expect(isLowEffortComment(content)).toBe(true);
    });
  });

  describe('negative cases (substantive)', () => {
    it.each([
      // Templated @user welcome … greetings (any continuation, not just "welcome to")
      ['@alice welcome to The Awesome Squad!'],
      ['@bob welcome aboard! Glad to have you'],
      ['@giovannicompitiliceo welcome as well!!!'],
      ['@carol welcome back!'],

      // Image / GIF markdown embeds — anywhere in the comment, with or without surrounding text
      ['![GIF](https://media.tenor.com/PXOXwsJKbSYAAAAC/where-you.gif)'],
      ['![GIF](https://media.tenor.com/PXOXwsJKbSYAAAAC/where-you.gif) ??'],
      ['![GIF](<https://static.klipy.com/abc.gif>)'],
      ['check this out ![GIF](https://media.tenor.com/x.gif)'],

      // Real questions
      ['is this secure?'],
      ['free version?'],
      ['is the github repo down?'],
      ['And what is that extension?'],

      // Substantive short comments / opinions / answers
      ['Concerning'],
      ['Too verbose'],
      ['Embrace Enshittification!'],
      ['Certified NPM classic.'],
      ['Typescript supremacy'],
      ['Option D'],
      ['Answer: C (NoSQL Database)'],
      ['Awesome, a PR from Taylor!'],
    ])('does not flag %p', (content) => {
      expect(isLowEffortComment(content)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('treats empty string as low-effort', () => {
      expect(isLowEffortComment('')).toBe(true);
    });

    it('handles mixed-case the same as lowercase', () => {
      expect(isLowEffortComment('GREAT!')).toBe(true);
      expect(isLowEffortComment('NiCe')).toBe(true);
    });

    it('ignores leading/trailing whitespace', () => {
      expect(isLowEffortComment('   nice   ')).toBe(true);
      expect(isLowEffortComment('\t\nthanks\n')).toBe(true);
    });

    it('does not flag a long substantive comment', () => {
      const longComment =
        'This article walks through the tradeoffs between event sourcing and ' +
        'CRUD persistence really clearly, and I appreciated the concrete ' +
        'benchmarks they ran on Postgres versus Kafka — definitely worth a ' +
        'second read before our next architecture review.';
      expect(isLowEffortComment(longComment)).toBe(false);
    });
  });
});
