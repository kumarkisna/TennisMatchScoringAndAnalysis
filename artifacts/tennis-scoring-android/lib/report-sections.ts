export const PLAYER_REPORT_SECTIONS = [
  { id: 'overview', label: 'Match overview' },
  { id: 'serve', label: 'Serve' },
  { id: 'return', label: 'Return' },
  { id: 'sets', label: 'Set scores' },
  { id: 'game-notes', label: 'Game notes' },
  { id: 'break-points', label: 'Break-point pressure' },
  { id: 'break-point-context', label: 'Break-point moments' },
  { id: 'coaching', label: 'Coaching notes' },
  { id: 'point-ending', label: 'Point-ending analysis' },
  { id: 'strokes', label: 'Recorded strokes' },
  { id: 'observations', label: 'Set-level observations' },
  { id: 'tactical-context', label: 'Tactical context' },
] as const;

export type PlayerReportSection = (typeof PLAYER_REPORT_SECTIONS)[number]['id'];

export type ReportSectionPreset<TSection extends string = string> = {
  id: string;
  label: string;
  sections: readonly TSection[];
};

export const PLAYER_REPORT_SECTION_PRESETS = [
  {
    id: 'overview',
    label: 'Overview only',
    sections: ['overview'],
  },
  {
    id: 'statistics',
    label: 'Statistics',
    sections: ['overview', 'serve', 'return', 'sets', 'game-notes', 'break-points'],
  },
  {
    id: 'full',
    label: 'Full report',
    sections: PLAYER_REPORT_SECTIONS.map(({ id }) => id),
  },
] satisfies readonly ReportSectionPreset<PlayerReportSection>[];

export const HEAD_TO_HEAD_REPORT_SECTIONS = [
  { id: 'overview', label: 'Match overview' },
  { id: 'meetings', label: 'Meetings and set scores' },
  { id: 'serve', label: 'Serve' },
  { id: 'return-points', label: 'Return and points' },
  { id: 'break-points', label: 'Break points' },
  { id: 'break-point-context', label: 'Break-point moments' },
  { id: 'point-ending', label: 'Recorded point-ending tags' },
  { id: 'point-context', label: 'Point context tags' },
  { id: 'coaching', label: 'Coaching observations' },
] as const;

export type HeadToHeadReportSection =
  (typeof HEAD_TO_HEAD_REPORT_SECTIONS)[number]['id'];

export const HEAD_TO_HEAD_REPORT_SECTION_PRESETS = [
  {
    id: 'overview',
    label: 'Overview only',
    sections: ['overview'],
  },
  {
    id: 'statistics',
    label: 'Statistics',
    sections: ['overview', 'meetings', 'serve', 'return-points', 'break-points'],
  },
  {
    id: 'full',
    label: 'Full report',
    sections: HEAD_TO_HEAD_REPORT_SECTIONS.map(({ id }) => id),
  },
] satisfies readonly ReportSectionPreset<HeadToHeadReportSection>[];

export function allPlayerReportSections(): PlayerReportSection[] {
  return PLAYER_REPORT_SECTIONS.map(({ id }) => id);
}

export function allHeadToHeadReportSections(): HeadToHeadReportSection[] {
  return HEAD_TO_HEAD_REPORT_SECTIONS.map(({ id }) => id);
}
