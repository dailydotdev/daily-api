export enum CommonReportReason {
  Other = 'OTHER',
}

export enum PostReportReason {
  Broken = 'BROKEN',
  Clickbait = 'CLICKBAIT',
  Low = 'LOW',
  Nsfw = 'NSFW',
  Irrelevant = 'IRRELEVANT',
}

export enum SourceReportReason {
  Explicit = 'EXPLICIT',
  Spam = 'SPAM',
  Hateful = 'HATEFUL',
  Copyright = 'COPYRIGHT',
  Privacy = 'PRIVACY',
  Miscategorized = 'MISCATEGORIZED',
  Illegal = 'ILLEGAL',
}

export type PostReportReasonType = PostReportReason | CommonReportReason;

export const postReportReasonsMap = new Map<PostReportReasonType, string>([
  [PostReportReason.Broken, '💔 Link is broken'],
  [PostReportReason.Clickbait, '🔞 Post is NSFW'],
  [PostReportReason.Low, '🎣 Clickbait!!!'],
  [PostReportReason.Nsfw, '💩 Low quality content'],
  [PostReportReason.Irrelevant, `Post's tags are irrelevant`],
  [CommonReportReason.Other, '🤔 Other'],
]);

export type ReportReason =
  | PostReportReason
  | SourceReportReason
  | CommonReportReason;

export const reportReasons = Array.from(
  new Set<ReportReason>(
    [
      Object.values(PostReportReason),
      Object.values(SourceReportReason),
      Object.values(CommonReportReason),
    ].flat(),
  ),
);
