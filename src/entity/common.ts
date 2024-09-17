export enum ReportEntity {
  Post = 'post',
  Source = 'source',
  Comment = 'comment',
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
  Misinformation = 'MISINFORMATION',
  Illegal = 'ILLEGAL',
}

export const postReportReasonsMap: Map<ReportReason, string> = new Map([
  [ReportReason.Broken, '💔 Link is broken'],
  [ReportReason.Clickbait, '🎣 Clickbait!!!'],
  [ReportReason.Low, '💩 Low quality content'],
  [ReportReason.Nsfw, '🔞 Post is NSFW'],
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

export const reportCommentReasonsMap: Map<ReportReason, string> = new Map([
  [ReportReason.Hateful, 'Hateful or Offensive Content'],
  [ReportReason.Harassment, 'Harassment or Bullying'],
  [ReportReason.Spam, 'Spam or Scams'],
  [ReportReason.Nsfw, 'Explicit Sexual Content'],
  [ReportReason.Misinformation, 'False Information or Misinformation'],
  [ReportReason.Other, 'Other'],
]);
