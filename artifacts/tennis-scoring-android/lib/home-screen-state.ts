import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LocalMatchSummary } from '@/lib/local-matches';

export type MatchBookSection = 'home' | 'history' | 'settings';

export interface HomeScreenPreferences {
  matchBookSection: MatchBookSection;
  showCompletedMatches: boolean;
  expandedMatchIds: string[];
}

export type MatchBookResultFilter =
  | 'all'
  | 'tracked_win'
  | 'opponent_win'
  | 'no_set_majority'
  | 'in_progress';

export interface MatchBookFilters {
  opponentQuery: string;
  result: MatchBookResultFilter;
  showCompletedMatches: boolean;
}

export const HOME_SCREEN_PREFERENCES_KEY = '@tennis-scoring/home-screen/preferences-v1';

export const DEFAULT_HOME_SCREEN_PREFERENCES: HomeScreenPreferences = {
  matchBookSection: 'home',
  showCompletedMatches: true,
  expandedMatchIds: [],
};

export function splitHomeMatches(matches: readonly LocalMatchSummary[]) {
  const ordered = [...matches].sort(
    (first, second) =>
      second.matchDate.localeCompare(first.matchDate) ||
      second.updatedAt.localeCompare(first.updatedAt),
  );

  return {
    recent: ordered.slice(0, 2),
    history: ordered.slice(2),
  };
}

function normalizeOpponentSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase();
}

export function filterMatchBookSummaries(
  matches: readonly LocalMatchSummary[],
  filters: MatchBookFilters,
): LocalMatchSummary[] {
  const opponentQuery = normalizeOpponentSearch(filters.opponentQuery);

  return matches.filter((match) => {
    if (!filters.showCompletedMatches && match.status === 'complete') return false;
    if (
      opponentQuery &&
      !normalizeOpponentSearch(match.opponent).includes(opponentQuery)
    ) {
      return false;
    }

    const winner = match.matchOutcome?.winner ?? match.winner;
    switch (filters.result) {
      case 'tracked_win':
        return match.status === 'complete' && winner === 'tracked';
      case 'opponent_win':
        return match.status === 'complete' && winner === 'opponent';
      case 'no_set_majority':
        return match.status === 'complete' && winner === null;
      case 'in_progress':
        return match.status === 'in_progress';
      default:
        return true;
    }
  });
}

function normalizePreferences(value: unknown): HomeScreenPreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return DEFAULT_HOME_SCREEN_PREFERENCES;
  }

  const record = value as Record<string, unknown>;
  return {
    matchBookSection:
      record.matchBookSection === 'history' ||
      record.matchBookSection === 'settings'
        ? record.matchBookSection
        : 'home',
    showCompletedMatches:
      typeof record.showCompletedMatches === 'boolean'
        ? record.showCompletedMatches
        : DEFAULT_HOME_SCREEN_PREFERENCES.showCompletedMatches,
    expandedMatchIds: Array.isArray(record.expandedMatchIds)
      ? [...new Set(record.expandedMatchIds.filter(
          (id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 120,
        ))]
      : [],
  };
}

export async function getHomeScreenPreferences(): Promise<HomeScreenPreferences> {
  const stored = await AsyncStorage.getItem(HOME_SCREEN_PREFERENCES_KEY);
  if (stored === null) return DEFAULT_HOME_SCREEN_PREFERENCES;

  try {
    return normalizePreferences(JSON.parse(stored));
  } catch {
    return DEFAULT_HOME_SCREEN_PREFERENCES;
  }
}

let writeQueue = Promise.resolve();

export function saveHomeScreenPreferences(
  preferences: HomeScreenPreferences,
): Promise<void> {
  const serialized = JSON.stringify(normalizePreferences(preferences));
  const write = writeQueue.then(
    () => AsyncStorage.setItem(HOME_SCREEN_PREFERENCES_KEY, serialized),
    () => AsyncStorage.setItem(HOME_SCREEN_PREFERENCES_KEY, serialized),
  );
  writeQueue = write.then(
    () => undefined,
    () => undefined,
  );
  return write;
}
