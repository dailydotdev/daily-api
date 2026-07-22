import { getInterestAgentTools } from '../../../src/common/interest/runInterestAgent';

describe('getInterestAgentTools', () => {
  it('includes every tool by default', () => {
    expect(getInterestAgentTools(undefined)).toEqual([
      'set_interest_tags',
      'search_daily_dev',
      'score_finding',
      'add_to_feed',
      'write_post',
    ]);
  });

  it('omits scoring and add_to_feed when feed output is off', () => {
    const tools = getInterestAgentTools({
      feed: false,
      post: true,
      digest: false,
      notification: true,
    });
    expect(tools).not.toContain('score_finding');
    expect(tools).not.toContain('add_to_feed');
    expect(tools).toContain('write_post');
  });

  it('omits write_post when post output is off', () => {
    const tools = getInterestAgentTools({
      feed: true,
      post: false,
      digest: false,
      notification: true,
    });
    expect(tools).toContain('add_to_feed');
    expect(tools).not.toContain('write_post');
  });
});
