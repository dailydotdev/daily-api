export enum HighlightSignificance {
  Unspecified = 0,
  Breaking = 1,
  Major = 2,
  Notable = 3,
  Routine = 4,
}

export const toHighlightSignificance = (
  label: string | null | undefined,
): HighlightSignificance => {
  switch ((label || '').toLowerCase()) {
    case 'breaking':
      return HighlightSignificance.Breaking;
    case 'major':
      return HighlightSignificance.Major;
    case 'notable':
      return HighlightSignificance.Notable;
    case 'routine':
      return HighlightSignificance.Routine;
    default:
      return HighlightSignificance.Unspecified;
  }
};

export const toHighlightSignificanceLabel = (
  significance: HighlightSignificance | null | undefined,
): string | null => {
  switch (significance) {
    case HighlightSignificance.Breaking:
      return 'breaking';
    case HighlightSignificance.Major:
      return 'major';
    case HighlightSignificance.Notable:
      return 'notable';
    case HighlightSignificance.Routine:
      return 'routine';
    default:
      return null;
  }
};
