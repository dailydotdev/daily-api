export enum ReportEntity {
  Post = 'post',
  Source = 'source',
}

export enum CommonReportReason {
  Nsfw = 'NSFW',
  Other = 'OTHER',
}

export enum PostReportReason {
  Broken = 'BROKEN',
  Clickbait = 'CLICKBAIT',
  Low = 'LOW',
  Irrelevant = 'IRRELEVANT',
}

export enum SourceReportReason {
  Spam = 'SPAM',
  Harassment = 'HARASSMENT',
  Hateful = 'HATEFUL',
  Copyright = 'COPYRIGHT',
  Privacy = 'PRIVACY',
  Miscategorized = 'MISCATEGORIZED',
  Illegal = 'ILLEGAL',
}

export type PostReportReasonType = PostReportReason | CommonReportReason;
export type SourceReportReasonType = SourceReportReason | CommonReportReason;

export const postReportReasonsMap: Record<PostReportReasonType, string> = {
  [PostReportReason.Broken]: '💔 Link is broken',
  [PostReportReason.Clickbait]: '🔞 Post is NSFW',
  [PostReportReason.Low]: '🎣 Clickbait!!!',
  [CommonReportReason.Nsfw]: '💩 Low quality content',
  [PostReportReason.Irrelevant]: `Post's tags are irrelevant`,
  [CommonReportReason.Other]: '🤔 Other',
};

export const sourceReportReasonsMap: Record<SourceReportReasonType, string> = {
  [CommonReportReason.Nsfw]: '🔞 Post is NSFW',
  [SourceReportReason.Spam]: '♻️ Spam',
  [SourceReportReason.Harassment]: '🤬 Harrasment or bullying',
  [SourceReportReason.Hateful]: '📛 Hateful speech',
  [SourceReportReason.Copyright]: '©️ Copyright infringement',
  [SourceReportReason.Privacy]: '📵 Violates privacy policies',
  [SourceReportReason.Miscategorized]: '🚮 Miscategorized',
  [SourceReportReason.Illegal]: '❗️ Illegal activities are made',
  [CommonReportReason.Other]: '🤔 Other',
};

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
