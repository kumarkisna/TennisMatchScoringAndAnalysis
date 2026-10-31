import AsyncStorage from '@react-native-async-storage/async-storage';

export interface LocalReportNameLabels {
  trackedPlayer: string;
  opponent: string;
}

export const DEFAULT_LOCAL_REPORT_NAME_LABELS: LocalReportNameLabels = {
  trackedPlayer: 'Player A',
  opponent: 'Player B',
};

export const LOCAL_REPORT_NAME_LABELS_KEY = ['device-report-name-labels'] as const;
export const LOCAL_REPORT_NAME_VISIBILITY_KEY = [
  'device-report-name-visibility',
] as const;

const STORAGE_KEY = '@tennis-scoring/report-name-labels/record-v1';
const VISIBILITY_STORAGE_KEY =
  '@tennis-scoring/report-name-visibility/record-v1';
let writeQueue = Promise.resolve();

function withWriteLock<T>(operation: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(operation, operation);
  writeQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function normalizeLabel(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function getLocalReportNameLabelsError(
  labels: LocalReportNameLabels,
): string | null {
  const trackedPlayer = normalizeLabel(labels.trackedPlayer);
  const opponent = normalizeLabel(labels.opponent);

  if (!trackedPlayer || !opponent) return 'Enter a label for both players.';
  if (trackedPlayer.length > 32 || opponent.length > 32) {
    return 'Each label must be 32 characters or fewer.';
  }
  if (trackedPlayer.toLowerCase() === opponent.toLowerCase()) {
    return 'Choose a different label for each player.';
  }
  return null;
}

function normalizeLabels(input: LocalReportNameLabels): LocalReportNameLabels {
  const labels = {
    trackedPlayer: normalizeLabel(input.trackedPlayer),
    opponent: normalizeLabel(input.opponent),
  };
  const error = getLocalReportNameLabelsError(labels);
  if (error) throw new Error(error);
  return labels;
}

export function getLocalReportNameLabels(): Promise<LocalReportNameLabels> {
  return withWriteLock(async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw === null) return { ...DEFAULT_LOCAL_REPORT_NAME_LABELS };

    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      throw new Error('Saved report labels are damaged. No data was changed.');
    }

    if (
      !value ||
      typeof value !== 'object' ||
      !('trackedPlayer' in value) ||
      typeof value.trackedPlayer !== 'string' ||
      !('opponent' in value) ||
      typeof value.opponent !== 'string'
    ) {
      throw new Error('Saved report labels are damaged. No data was changed.');
    }

    try {
      return normalizeLabels(value as LocalReportNameLabels);
    } catch {
      throw new Error('Saved report labels are invalid. No data was changed.');
    }
  });
}

export function saveLocalReportNameLabels(
  input: LocalReportNameLabels,
): Promise<LocalReportNameLabels> {
  return withWriteLock(async () => {
    const labels = normalizeLabels(input);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(labels));
    return labels;
  });
}

export function getLocalReportHideNamesPreference(): Promise<boolean> {
  return withWriteLock(async () => {
    const raw = await AsyncStorage.getItem(VISIBILITY_STORAGE_KEY);
    if (raw === null) return false;
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    throw new Error('Saved report privacy preference is damaged. No data was changed.');
  });
}

export function saveLocalReportHideNamesPreference(
  hidePlayerNames: boolean,
): Promise<boolean> {
  return withWriteLock(async () => {
    if (typeof hidePlayerNames !== 'boolean') {
      throw new Error('Report privacy preference must be true or false.');
    }
    await AsyncStorage.setItem(VISIBILITY_STORAGE_KEY, String(hidePlayerNames));
    return hidePlayerNames;
  });
}
