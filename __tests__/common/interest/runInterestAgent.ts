import { getInterestAgentTools } from '../../../src/common/interest/runInterestAgent';

const browsingTools = [
  'set_interest_tags',
  'search_daily_dev',
  'query_feed',
  'read_post',
  'read_comments',
  'get_source',
  'get_tag',
  'search_tags',
  'search_sources',
  'set_run_summary',
];

describe('getInterestAgentTools', () => {
  it('includes every tool by default', () => {
    expect(getInterestAgentTools(undefined)).toEqual([
      ...browsingTools,
      'add_finding',
      'write_post',
    ]);
  });

  it('never offers score_finding, which was replaced by read_post contentQuality', () => {
    expect(getInterestAgentTools(undefined)).not.toContain('score_finding');
  });

  it('keeps the browsing tools when feed output is off, dropping only add_finding', () => {
    const tools = getInterestAgentTools({
      feed: false,
      post: true,
      digest: false,
      notification: true,
    });
    expect(tools).toEqual([...browsingTools, 'write_post']);
  });

  it('omits write_post when post output is off', () => {
    const tools = getInterestAgentTools({
      feed: true,
      post: false,
      digest: false,
      notification: true,
    });
    expect(tools).toContain('add_finding');
    expect(tools).not.toContain('write_post');
  });

  it('omits discover_external when the web source is off', () => {
    expect(
      getInterestAgentTools(undefined, {
        dailyDev: true,
        web: false,
        github: false,
      }),
    ).not.toContain('discover_external');
  });

  it('includes discover_external when the web source is on', () => {
    expect(
      getInterestAgentTools(undefined, {
        dailyDev: true,
        web: true,
        github: false,
      }),
    ).toContain('discover_external');
  });

  it('does not enable discover_external for the github source alone (reserved for a future github tool)', () => {
    const tools = getInterestAgentTools(undefined, {
      dailyDev: true,
      web: false,
      github: true,
    });
    expect(tools).not.toContain('discover_external');
  });

  it('omits discover_external when feed output is off even with web source on', () => {
    const tools = getInterestAgentTools(
      { feed: false, post: true, digest: false, notification: true },
      { dailyDev: true, web: true, github: false },
    );
    expect(tools).not.toContain('discover_external');
  });
});
