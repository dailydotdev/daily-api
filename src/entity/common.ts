export enum ReportEntity {
  Post = 'post',
  Source = 'source',
}

export enum ReportReason {
  Nsfw = 'NSFW',
  Other = 'OTHER',
  Broken = 'BROKEN',
  Clickbait = 'CLICKBAIT',
  Low = 'LOW',
  Irrelevant = 'IRRELEVANT',
  Spam = 'SPAM',
  Harassment = 'HARASSMENT',
  Hateful = 'HATEFUL',
  Copyright = 'COPYRIGHT',
  Privacy = 'PRIVACY',
  Miscategorized = 'MISCATEGORIZED',
  Illegal = 'ILLEGAL',
}

export const postReportReasonsMap: Map<ReportReason, string> = new Map([
  [ReportReason.Broken, '💔 Link is broken'],
  [ReportReason.Clickbait, '🔞 Post is NSFW'],
  [ReportReason.Low, '🎣 Clickbait!!!'],
  [ReportReason.Nsfw, '💩 Low quality content'],
  [ReportReason.Irrelevant, `Post's tags are irrelevant`],
  [ReportReason.Other, '🤔 Other'],
]);

export const sourceReportReasonsMap: Map<ReportReason, string> = new Map([
  [ReportReason.Nsfw, '🔞 Post is NSFW'],
  [ReportReason.Spam, '♻️ Spam'],
  [ReportReason.Harassment, '🤬 Harrasment or bullying'],
  [ReportReason.Hateful, '📛 Hateful speech'],
  [ReportReason.Copyright, '©️ Copyright infringement'],
  [ReportReason.Privacy, '📵 Violates privacy policies'],
  [ReportReason.Miscategorized, '🚮 Miscategorized'],
  [ReportReason.Illegal, '❗️ Illegal activities are made'],
  [ReportReason.Other, '🤔 Other'],
]);
