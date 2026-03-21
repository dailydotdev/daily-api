import { Timestamp } from '@bufbuild/protobuf';
import {
  ChannelHighlightCandidateItem,
  ChannelHighlightCurrentItem,
  ChannelHighlightSignificance,
  EvaluateChannelHighlightsRequest as BragiEvaluateChannelHighlightsRequest,
} from '@dailydotdev/schema';
import { getBragiClient } from '../../integrations/bragi/clients';
import type { HighlightCandidate, HighlightSnapshotItem } from './types';

export type EvaluateChannelHighlightsRequest = {
  channel: string;
  targetAudience: string;
  maxItems: number;
  currentHighlights: HighlightSnapshotItem[];
  newCandidates: HighlightCandidate[];
};

export type EvaluatedHighlightItem = {
  postId: string;
  headline: string;
  significanceLabel: string | null;
  reason: string;
};

export type EvaluateChannelHighlightsResponse = {
  items: EvaluatedHighlightItem[];
};

const toTimestamp = (date: Date | undefined): Timestamp | undefined =>
  date ? Timestamp.fromDate(date) : undefined;

const toProtoSignificance = (
  significanceLabel: string | null | undefined,
): ChannelHighlightSignificance => {
  switch ((significanceLabel || '').toLowerCase()) {
    case 'breaking':
      return ChannelHighlightSignificance.BREAKING;
    case 'major':
      return ChannelHighlightSignificance.MAJOR;
    case 'notable':
      return ChannelHighlightSignificance.NOTABLE;
    case 'routine':
      return ChannelHighlightSignificance.ROUTINE;
    default:
      return ChannelHighlightSignificance.UNSPECIFIED;
  }
};

const toSignificanceLabel = (
  significance: ChannelHighlightSignificance,
): string | null => {
  switch (significance) {
    case ChannelHighlightSignificance.BREAKING:
      return 'breaking';
    case ChannelHighlightSignificance.MAJOR:
      return 'major';
    case ChannelHighlightSignificance.NOTABLE:
      return 'notable';
    case ChannelHighlightSignificance.ROUTINE:
      return 'routine';
    default:
      return null;
  }
};

const toCurrentHighlight = (
  item: HighlightSnapshotItem,
): ChannelHighlightCurrentItem =>
  new ChannelHighlightCurrentItem({
    postId: item.postId,
    headline: item.headline,
    highlightedAt: toTimestamp(item.highlightedAt),
    significance: toProtoSignificance(item.significanceLabel),
  });

const toCandidate = (
  candidate: HighlightCandidate,
): ChannelHighlightCandidateItem =>
  new ChannelHighlightCandidateItem({
    postId: candidate.postId,
    title: candidate.title,
    summary: candidate.summary || undefined,
    createdAt: toTimestamp(candidate.createdAt),
    upvotes: candidate.upvotes,
    comments: candidate.comments,
    views: candidate.views,
    contentCuration: candidate.contentCuration,
    specificity: candidate.quality.specificity || '',
    intent: candidate.quality.intent || '',
    substanceDepth: candidate.quality.substanceDepth || '',
    titleContentAlignment: candidate.quality.titleContentAlignment || '',
    selfPromotionScore: candidate.quality.selfPromotionScore || 0,
    clickbaitProbability: candidate.quality.clickbaitProbability ?? undefined,
    relatedItemsCount: candidate.relatedItemsCount,
  });

export const evaluateChannelHighlights = async ({
  channel,
  targetAudience,
  maxItems,
  currentHighlights,
  newCandidates,
}: EvaluateChannelHighlightsRequest): Promise<EvaluateChannelHighlightsResponse> => {
  if (!newCandidates.length) {
    return {
      items: [],
    };
  }

  const bragiClient = getBragiClient();
  const request = new BragiEvaluateChannelHighlightsRequest({
    channel,
    targetAudience,
    maxItems,
    currentHighlights: currentHighlights.map(toCurrentHighlight),
    newCandidates: newCandidates.map(toCandidate),
  });
  const response = await bragiClient.garmr.execute(() =>
    bragiClient.instance.evaluateChannelHighlights(request),
  );

  return {
    items: response.highlights.map((item) => {
      if (!item.postId) {
        throw new Error('bragi channel highlights response is missing postId');
      }

      if (!item.headline) {
        throw new Error(
          `bragi channel highlights response is missing headline for ${item.postId}`,
        );
      }

      return {
        postId: item.postId,
        headline: item.headline,
        significanceLabel: toSignificanceLabel(item.significance),
        reason: item.reason || '',
      };
    }),
  };
};
