import AsyncStorage from '@react-native-async-storage/async-storage';

export interface LocalReportBenchmarkPreset {
  id: string;
  name: string;
  firstServePointsWon: number | null;
  secondServePointsWon: number | null;
  serviceGamesWon: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface LocalReportBenchmarkInput {
  name: string;
  firstServePointsWon: number | null;
  secondServePointsWon: number | null;
  serviceGamesWon: number | null;
}

export interface LocalReportBenchmarkSettings {
  presets: LocalReportBenchmarkPreset[];
  selectedPresetIds: string[];
}

export const LOCAL_REPORT_BENCHMARKS_KEY = ['device-report-benchmarks'] as const;
export const MAX_SELECTED_REPORT_BENCHMARKS = 2;

const PRESETS_STORAGE_KEY = '@tennis-scoring/report-benchmarks/record-v1';
const SELECTION_STORAGE_KEY = '@tennis-scoring/report-benchmarks/selected-v1';
let writeQueue = Promise.resolve();

const INITIAL_PRESETS: Omit<LocalReportBenchmarkPreset, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'reference-season-2026',
    name: '2026',
    firstServePointsWon: 75.1,
    secondServePointsWon: 56.4,
    serviceGamesWon: 86.8,
  },
  {
    id: 'reference-cincinnati-2026',
    name: '2026 Cincinnati',
    firstServePointsWon: 79.2,
    secondServePointsWon: 61.7,
    serviceGamesWon: 94.3,
  },
];

function withWriteLock<T>(operation: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(operation, operation);
  writeQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function isValidPercent(value: unknown): value is number | null {
  return value === null ||
    (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100);
}

function parsePresets(raw: string): LocalReportBenchmarkPreset[] {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error('Saved report benchmarks are damaged. No benchmark data was changed.');
  }

  if (
    !Array.isArray(value) ||
    value.some(
      (item) =>
        !item ||
        typeof item !== 'object' ||
        typeof item.id !== 'string' ||
        typeof item.name !== 'string' ||
        item.name.trim().length === 0 ||
        !isValidPercent(item.firstServePointsWon) ||
        !isValidPercent(item.secondServePointsWon) ||
        !isValidPercent(item.serviceGamesWon) ||
        typeof item.createdAt !== 'string' ||
        typeof item.updatedAt !== 'string',
    )
  ) {
    throw new Error('Saved report benchmarks are damaged. No benchmark data was changed.');
  }

  return value as LocalReportBenchmarkPreset[];
}

async function readSettings(): Promise<LocalReportBenchmarkSettings> {
  const [presetRaw, selectionRaw] = await Promise.all([
    AsyncStorage.getItem(PRESETS_STORAGE_KEY),
    AsyncStorage.getItem(SELECTION_STORAGE_KEY),
  ]);

  let presets: LocalReportBenchmarkPreset[];
  if (presetRaw === null) {
    const createdAt = new Date().toISOString();
    presets = INITIAL_PRESETS.map((preset) => ({
      ...preset,
      createdAt,
      updatedAt: createdAt,
    }));
    await AsyncStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
  } else {
    presets = parsePresets(presetRaw);
  }

  let selectedPresetIds: string[];
  if (selectionRaw === null) {
    selectedPresetIds =
      presetRaw === null
        ? INITIAL_PRESETS.map(({ id }) => id)
        : [];
  } else {
    let value: unknown;
    try {
      value = JSON.parse(selectionRaw);
    } catch {
      throw new Error('Saved report benchmark selection is damaged. No data was changed.');
    }
    if (!Array.isArray(value) || value.some((id) => typeof id !== 'string')) {
      throw new Error('Saved report benchmark selection is damaged. No data was changed.');
    }
    selectedPresetIds = value;
  }

  selectedPresetIds = [...new Set(selectedPresetIds)]
    .filter((id) => presets.some((preset) => preset.id === id))
    .slice(0, MAX_SELECTED_REPORT_BENCHMARKS);

  if (selectionRaw === null || JSON.stringify(JSON.parse(selectionRaw)) !== JSON.stringify(selectedPresetIds)) {
    await AsyncStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify(selectedPresetIds));
  }

  return { presets, selectedPresetIds };
}

function normalizeInput(input: LocalReportBenchmarkInput): LocalReportBenchmarkInput {
  const name = input.name.trim().replace(/\s+/g, ' ');
  if (!name) throw new Error('Enter a name for this benchmark.');
  if (name.length > 60) throw new Error('Benchmark names must be 60 characters or fewer.');

  const values = [
    input.firstServePointsWon,
    input.secondServePointsWon,
    input.serviceGamesWon,
  ];
  if (values.some((value) => !isValidPercent(value))) {
    throw new Error('Enter percentages from 0 to 100.');
  }
  if (values.every((value) => value === null)) {
    throw new Error('Enter at least one reference percentage.');
  }

  return {
    name,
    firstServePointsWon: input.firstServePointsWon,
    secondServePointsWon: input.secondServePointsWon,
    serviceGamesWon: input.serviceGamesWon,
  };
}

function newPresetId(): string {
  return `benchmark-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getLocalReportBenchmarkSettings(): Promise<LocalReportBenchmarkSettings> {
  return withWriteLock(readSettings);
}

export function saveLocalReportBenchmarkPreset(
  input: LocalReportBenchmarkInput,
  presetId?: string,
): Promise<LocalReportBenchmarkSettings> {
  return withWriteLock(async () => {
    const settings = await readSettings();
    const normalized = normalizeInput(input);
    const duplicate = settings.presets.find(
      (preset) =>
        preset.id !== presetId &&
        preset.name.toLocaleLowerCase() === normalized.name.toLocaleLowerCase(),
    );
    if (duplicate) throw new Error('A benchmark with that name already exists.');

    const now = new Date().toISOString();
    let presets: LocalReportBenchmarkPreset[];
    if (presetId) {
      if (!settings.presets.some((preset) => preset.id === presetId)) {
        throw new Error('That benchmark is no longer available.');
      }
      presets = settings.presets.map((preset) =>
        preset.id === presetId
          ? { ...preset, ...normalized, updatedAt: now }
          : preset,
      );
    } else {
      presets = [
        ...settings.presets,
        { id: newPresetId(), ...normalized, createdAt: now, updatedAt: now },
      ];
    }

    await AsyncStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
    return { ...settings, presets };
  });
}

export function setSelectedLocalReportBenchmarkPresets(
  presetIds: string[],
): Promise<LocalReportBenchmarkSettings> {
  return withWriteLock(async () => {
    const settings = await readSettings();
    const selectedPresetIds = [...new Set(presetIds)];
    if (selectedPresetIds.length > MAX_SELECTED_REPORT_BENCHMARKS) {
      throw new Error(`Choose up to ${MAX_SELECTED_REPORT_BENCHMARKS} report benchmarks.`);
    }
    if (selectedPresetIds.some((id) => !settings.presets.some((preset) => preset.id === id))) {
      throw new Error('A selected benchmark is no longer available.');
    }

    await AsyncStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify(selectedPresetIds));
    return { ...settings, selectedPresetIds };
  });
}

export function removeLocalReportBenchmarkPreset(
  presetId: string,
): Promise<LocalReportBenchmarkSettings> {
  return withWriteLock(async () => {
    const settings = await readSettings();
    if (!settings.presets.some((preset) => preset.id === presetId)) {
      throw new Error('That benchmark is no longer available.');
    }

    const presets = settings.presets.filter((preset) => preset.id !== presetId);
    const selectedPresetIds = settings.selectedPresetIds.filter((id) => id !== presetId);
    await Promise.all([
      AsyncStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets)),
      AsyncStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify(selectedPresetIds)),
    ]);
    return { presets, selectedPresetIds };
  });
}
