export const PLAYER_REPORT_SECTIONS = [
  { id: 'overview', label: 'Match overview' },
  { id: 'serve', label: 'Serve' },
  { id: 'return', label: 'Return' },
  { id: 'sets', label: 'Set scores' },
  { id: 'break-points', label: 'Break-point pressure' },
  { id: 'coaching', label: 'Coaching notes' },
  { id: 'point-ending', label: 'Point-ending analysis' },
  { id: 'strokes', label: 'Recorded strokes' },
  { id: 'observations', label: 'Game and set observations' },
  { id: 'tactical-context', label: 'Tactical context' },
] as const;

export type PlayerReportSection = (typeof PLAYER_REPORT_SECTIONS)[number]['id'];

export const HEAD_TO_HEAD_REPORT_SECTIONS = [
  { id: 'overview', label: 'Match overview' },
  { id: 'meetings', label: 'Meetings and set scores' },
  { id: 'serve', label: 'Serve' },
  { id: 'return-points', label: 'Return and points' },
  { id: 'break-points', label: 'Break points' },
  { id: 'point-ending', label: 'Recorded point-ending tags' },
  { id: 'point-context', label: 'Point context tags' },
  { id: 'coaching', label: 'Coaching observations' },
] as const;

export type HeadToHeadReportSection =
  (typeof HEAD_TO_HEAD_REPORT_SECTIONS)[number]['id'];

export function allPlayerReportSections(): PlayerReportSection[] {
  return PLAYER_REPORT_SECTIONS.map(({ id }) => id);
}

export function allHeadToHeadReportSections(): HeadToHeadReportSection[] {
  return HEAD_TO_HEAD_REPORT_SECTIONS.map(({ id }) => id);
}
