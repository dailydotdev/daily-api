import { createInterestToolDefinitions } from '../../../src/common/interest/tools/registry';
import type { InterestToolContext } from '../../../src/common/interest/tools/context';
import type {
  UserInterestOutputModes,
  UserInterestSources,
} from '../../../src/entity/UserInterest';

const toolNames = (
  outputModes?: Partial<UserInterestOutputModes>,
  sources?: Partial<UserInterestSources>,
) =>
  createInterestToolDefinitions({
    interest: { outputModes, sources },
  } as unknown as InterestToolContext).map(({ name }) => name);

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

describe('interest tool registry', () => {
  it('offers every non-gated tool plus the default outputs', () => {
    expect(toolNames()).toEqual([
      ...browsingTools,
      'add_finding',
      'write_post',
    ]);
  });

  it('keeps the browsing tools when feed output is off, dropping only add_finding', () => {
    expect(toolNames({ feed: false, post: true })).toEqual([
      ...browsingTools,
      'write_post',
    ]);
  });

  it('omits write_post when post output is off', () => {
    const tools = toolNames({ feed: true, post: false });
    expect(tools).toContain('add_finding');
    expect(tools).not.toContain('write_post');
  });

  it('includes discover_external only when the web source is on', () => {
    expect(toolNames(undefined, { web: true })).toContain('discover_external');
    expect(toolNames(undefined, { web: false })).not.toContain(
      'discover_external',
    );
  });

  it('does not enable discover_external for the github source alone', () => {
    expect(toolNames(undefined, { github: true })).not.toContain(
      'discover_external',
    );
  });

  it('omits discover_external when feed output is off even with web on', () => {
    expect(toolNames({ feed: false }, { web: true })).not.toContain(
      'discover_external',
    );
  });
});
