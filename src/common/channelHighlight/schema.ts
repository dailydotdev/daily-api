export const channelHighlightModes = ['disabled', 'shadow', 'publish'] as const;
export type ChannelHighlightMode = (typeof channelHighlightModes)[number];
