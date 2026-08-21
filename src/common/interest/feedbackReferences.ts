import { IsNull, type DataSource } from 'typeorm';
import type { FastifyBaseLogger } from 'fastify';
import {
  InterestFeedback,
  type InterestFeedbackRelationship,
} from '../../entity/InterestFeedback';
import type { UserInterest } from '../../entity/UserInterest';
import { Post } from '../../entity/posts/Post';
import { findPostByUrl } from '../post';
import { isDlyToUrl, resolveDlyToUrl } from '../contentEmbeds';
import { generateShortId } from '../../ids';

export const MAX_FEEDBACK_REFERENCE_URLS = 5;
export const FEEDBACK_REFERENCE_FAILED_SENTINEL = 'null';

const MARKER_REGEX = /@dailydev:post:([a-zA-Z0-9]+)(?::([a-zA-Z0-9]+))?/g;
const URL_REGEX = /https?:\/\/[^\s<>"')\]]+/g;

type FeedbackReference = {
  start: number;
  end: number;
  postId?: string;
  url?: string;
};

const extractReferences = (text: string): FeedbackReference[] => {
  const markers = [...text.matchAll(MARKER_REGEX)].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
    postId: match[1],
  }));
  const urls = [...text.matchAll(URL_REGEX)]
    .slice(0, MAX_FEEDBACK_REFERENCE_URLS)
    .map((match) => ({
      start: match.index,
      end: match.index + match[0].length,
      url: match[0],
    }));

  return [...markers, ...urls].sort((a, b) => a.start - b.start);
};

const resolveUrlToPostId = async (
  con: DataSource,
  rawUrl: string,
): Promise<string | undefined> => {
  try {
    let target = rawUrl;
    const url = new URL(rawUrl);
    if (isDlyToUrl(url)) {
      const resolved = await resolveDlyToUrl(url);
      if (!resolved) {
        return undefined;
      }
      target = resolved.toString();
    }
    const post = await findPostByUrl(target, ['id'], con);
    return post?.id;
  } catch {
    return undefined;
  }
};

const fetchVisiblePosts = async ({
  con,
  interest,
  postIds,
}: {
  con: DataSource;
  interest: UserInterest;
  postIds: string[];
}): Promise<Map<string, { title: string | null; summary: string | null }>> => {
  if (!postIds.length) {
    return new Map();
  }

  const rows = await con
    .getRepository(Post)
    .createQueryBuilder('p')
    .select([
      'p.id AS id',
      'p.title AS title',
      'p.summary AS summary',
      'sp.title AS "sharedTitle"',
      'sp.summary AS "sharedSummary"',
    ])
    .leftJoin(
      Post,
      'sp',
      'sp.id = p."sharedPostId" AND sp.deleted = false AND sp.private = false AND sp.visible = true',
    )
    .where('p.id IN (:...postIds)', { postIds })
    .andWhere('p.deleted = false')
    .andWhere('p.banned = false')
    .andWhere(
      '((p.private = false AND p."showOnFeed" = true) OR p."sourceId" = :interestSourceId)',
      { interestSourceId: interest.sourceId },
    )
    .getRawMany<{
      id: string;
      title: string | null;
      summary: string | null;
      sharedTitle: string | null;
      sharedSummary: string | null;
    }>();

  return new Map(
    rows.map((row) => [
      row.id,
      {
        title: row.title ?? row.sharedTitle,
        summary: row.summary ?? row.sharedSummary,
      },
    ]),
  );
};

const processFeedbackRow = async ({
  con,
  interest,
  row,
}: {
  con: DataSource;
  interest: UserInterest;
  row: Pick<InterestFeedback, 'id' | 'text'>;
}): Promise<void> => {
  const references = extractReferences(row.text);

  const resolvedByReference = new Map<FeedbackReference, string>();
  for (const reference of references) {
    if (reference.postId) {
      resolvedByReference.set(reference, reference.postId);
    } else if (reference.url) {
      const postId = await resolveUrlToPostId(con, reference.url);
      if (postId) {
        resolvedByReference.set(reference, postId);
      }
    }
  }

  const candidateIds = [...new Set(resolvedByReference.values())];
  const visiblePosts = await fetchVisiblePosts({
    con,
    interest,
    postIds: candidateIds,
  });

  const entriesByPostId = new Map<string, InterestFeedbackRelationship>();
  for (const reference of references) {
    const postId = resolvedByReference.get(reference);
    const post = postId ? visiblePosts.get(postId) : undefined;
    if (!postId || !post || entriesByPostId.has(postId)) {
      continue;
    }
    entriesByPostId.set(postId, {
      id: await generateShortId(),
      entity: 'post',
      entityId: postId,
      url: reference.url ?? null,
      title: post.title,
      summary: post.summary,
    });
  }

  const segments: string[] = [];
  let cursor = 0;
  for (const reference of references) {
    if (reference.start < cursor) {
      continue;
    }
    const postId = resolvedByReference.get(reference);
    const entry = postId ? entriesByPostId.get(postId) : undefined;

    let replacement = row.text.slice(reference.start, reference.end);
    if (entry) {
      replacement = `@dailydev:post:${entry.entityId}:${entry.id}`;
    } else if (reference.postId) {
      replacement = `@dailydev:post:${reference.postId}:${FEEDBACK_REFERENCE_FAILED_SENTINEL}`;
    }

    segments.push(row.text.slice(cursor, reference.start), replacement);
    cursor = reference.end;
  }
  segments.push(row.text.slice(cursor));

  await con
    .getRepository(InterestFeedback)
    .update(
      { id: row.id, relationships: IsNull() },
      { text: segments.join(''), relationships: [...entriesByPostId.values()] },
    );
};

export const sweepInterestFeedbackReferences = async ({
  con,
  log,
  interest,
}: {
  con: DataSource;
  log: FastifyBaseLogger;
  interest: UserInterest;
}): Promise<void> => {
  const rows = await con.getRepository(InterestFeedback).find({
    select: ['id', 'text'],
    where: { interestId: interest.id, relationships: IsNull() },
    order: { createdAt: 'ASC' },
  });

  for (const row of rows) {
    try {
      await processFeedbackRow({ con, interest, row });
    } catch (error) {
      log.warn(
        { interestId: interest.id, feedbackId: row.id, err: error },
        'interest feedback reference sweep failed for row',
      );
    }
  }
};
