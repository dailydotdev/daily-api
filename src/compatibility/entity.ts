import { SourceRequest } from '../entity';
import { ChangeObject } from '../types';

export interface LegacySourceRequest {
  id: string;
  url: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  approved?: boolean;
  closed?: boolean;
  pubId?: string;
  pubName?: string;
  pubImage?: string;
  pubTwitter?: string;
  pubRss?: string;
  createdAt: Date;
  reason?: string;
}

export const toLegacySourceRequest = (
  req: ChangeObject<SourceRequest> | SourceRequest,
): LegacySourceRequest => ({
  id: req.id,
  url: req.sourceUrl,
  userId: req.userId,
  userName: req.userName,
  userEmail: req.userEmail,
  approved: req.approved,
  closed: req.closed,
  pubId: req.sourceId,
  pubName: req.sourceName,
  pubImage: req.sourceImage,
  pubTwitter: req.sourceTwitter,
  pubRss: req.sourceFeed,
  createdAt: new Date(req.createdAt),
  reason: req.reason,
});
