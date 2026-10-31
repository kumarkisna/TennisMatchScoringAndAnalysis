import AsyncStorage from '@react-native-async-storage/async-storage';

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

export const PLAYER_REPORT_SECTION_PREFERENCE_KEY =
  'tennis-scoring:report-sections:player:v1';
export const HEAD_TO_HEAD_REPORT_SECTION_PREFERENCE_KEY =
  'tennis-scoring:report-sections:head-to-head:v1';

export function parseReportSectionPreference<T extends string>(
  raw: string | null,
  validSections: readonly T[],
  defaultSections: readonly T[],
): T[] {
  const defaults = [...defaultSections];
  if (raw === null) return defaults;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaults;

    const selected = [...new Set(
      parsed.filter(
        (section): section is T =>
          typeof section === 'string' &&
          validSections.includes(section as T),
      ),
    )];

    return parsed.length > 0 && selected.length === 0 ? defaults : selected;
  } catch {
    return defaults;
  }
}

export async function loadReportSectionPreference<T extends string>(
  storageKey: string,
  validSections: readonly T[],
  defaultSections: readonly T[],
): Promise<T[]> {
  const raw = await AsyncStorage.getItem(storageKey);
  return parseReportSectionPreference(raw, validSections, defaultSections);
}

export async function saveReportSectionPreference<T extends string>(
  storageKey: string,
  selectedSections: readonly T[],
): Promise<void> {
  await AsyncStorage.setItem(storageKey, JSON.stringify(selectedSections));
}
