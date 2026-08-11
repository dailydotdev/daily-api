import { Type } from 'typebox';
import { Post } from '../../../entity/posts/Post';
import { insertFreeformPost } from '../../post';
import { markdown } from '../../markdown';
import { updateFlagsStatement } from '../../utils';
import { generateShortId } from '../../../ids';
import type { InterestToolContext } from './context';
import { jsonResult } from './constants';

export const writePostTool = ({
  con,
  interest,
  pendingCount,
  state,
  addedPostIds,
}: InterestToolContext) => ({
  name: 'write_post',
  label: 'Write summary post',
  description:
    "Write a short markdown digest of what is being delivered in THIS run — findings you added, plus anything already waiting to be delivered. Hosted in the interest's source. Refused when the run has neither, so it can never re-describe previous runs. When you link a post, use ONLY an exact url returned by a tool — never invent, shorten, or guess a URL, and never write relative links. This is product copy: write about the content only, never about tools, tool errors, budgets, limits, scores, thresholds, filtered results, or anything else internal, and never apologise or explain what you could not do. See <output_voice>.",
  parameters: Type.Object({
    title: Type.String(),
    content: Type.String(),
  }),
  execute: async (_id: never, params: { title: string; content: string }) => {
    if (state.summaryPostId) {
      return jsonResult({
        error: 'already_written',
        postId: state.summaryPostId,
      });
    }
    if (!addedPostIds.size && !pendingCount) {
      return jsonResult({
        error: 'nothing_new_to_report',
        hint: 'This run added no findings and none are waiting to be delivered, so there is nothing new to summarise.',
      });
    }
    const { sourceId } = interest;
    if (!sourceId) {
      return jsonResult({ error: 'interest_has_no_source' });
    }
    const id = await generateShortId();
    const saved = await insertFreeformPost({
      con,
      args: {
        id,
        title: params.title,
        content: params.content,
        contentHtml: markdown.render(params.content),
        authorId: interest.userId,
        sourceId,
      },
    });
    await con.getRepository(Post).update(
      { id: saved.id },
      {
        showOnFeed: false,
        flags: updateFlagsStatement<Post>({ showOnFeed: false }),
      },
    );
    state.summaryPostId = saved.id;
    return jsonResult({ postId: saved.id });
  },
});
