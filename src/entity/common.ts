export enum ReportEntity {
  Post = 'post',
  Source = 'source',
  Comment = 'comment',
  User = 'user',
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
  Inappropriate = 'INAPPROPRIATE',
  Trolling = 'TROLLING',
  Impersonation = 'IMPERSONATION',
  Plagiarism = 'PLAGIARISM',
  Paywall = 'PAYWALL',
}

export const postReportReasonsMap: Map<ReportReason, string> = new Map([
  [ReportReason.Spam, '♻️ Spam or scam'],
  [ReportReason.Hateful, '📛 Hateful speech or harassment'],
  [ReportReason.Misinformation, '🚫 Misinformation or politically-oriented'],
  [ReportReason.Copyright, '©️ Plagiarism or copyright violation'],
  [ReportReason.Privacy, '📵 Privacy violation'],
  [ReportReason.Broken, '💔 Link is broken'],
  [ReportReason.Clickbait, '🎣 Clickbait!!!'],
  [ReportReason.Low, '💩 Low quality content'],
  [ReportReason.Nsfw, '🔞 Post is NSFW'],
  [ReportReason.Irrelevant, `Post's tags are irrelevant`],
  [ReportReason.Paywall, '🔒 Paywalled content'],
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

export const userReportReasonsMap: Map<ReportReason, string> = new Map([
  [ReportReason.Inappropriate, 'Inappropriate or NSFW Content'],
  [ReportReason.Trolling, 'Trolling or Disruptive Behavior'],
  [ReportReason.Harassment, 'Harassment or Bullying'],
  [ReportReason.Impersonation, 'Impersonation or False Identity'],
  [ReportReason.Spam, 'Spam or Unsolicited Advertising'],
  [ReportReason.Misinformation, 'Misinformation or False Claims'],
  [ReportReason.Hateful, 'Hate Speech or Discrimination'],
  [ReportReason.Privacy, 'Privacy or Copyright Violation'],
  [ReportReason.Plagiarism, 'Plagiarism or Content Theft'],
  [ReportReason.Other, 'Other'],
]);
