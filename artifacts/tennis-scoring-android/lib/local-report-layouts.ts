import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  HEAD_TO_HEAD_REPORT_SECTIONS,
  PLAYER_REPORT_SECTIONS,
} from './report-sections';

export type ReportLayoutType = 'player' | 'head-to-head';

export interface LocalReportLayout {
  id: string;
  name: string;
  reportType: ReportLayoutType;
  sections: string[];
}

export const LOCAL_REPORT_LAYOUTS_KEY = ['device-report-layouts'] as const;

const STORAGE_KEY = '@tennis-scoring/report-layouts/record-v1';
const MAX_LAYOUT_NAME_LENGTH = 40;
let writeQueue = Promise.resolve();

function withWriteLock<T>(operation: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(operation, operation);
  writeQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function sectionIdsFor(reportType: ReportLayoutType): readonly string[] {
  if (reportType === 'player') {
    return PLAYER_REPORT_SECTIONS.map(({ id }) => id);
  }
  if (reportType === 'head-to-head') {
    return HEAD_TO_HEAD_REPORT_SECTIONS.map(({ id }) => id);
  }
  throw new Error('Choose a supported report type.');
}

function validateName(
  value: string,
  layouts: readonly LocalReportLayout[],
  reportType: ReportLayoutType,
  ignoredId?: string,
): string {
  const name = normalizeName(value);
  if (!name) throw new Error('Enter a name for this layout.');
  if (name.length > MAX_LAYOUT_NAME_LENGTH) {
    throw new Error(`Layout names must be ${MAX_LAYOUT_NAME_LENGTH} characters or fewer.`);
  }
  if (
    layouts.some(
      (layout) =>
        layout.id !== ignoredId &&
        layout.reportType === reportType &&
        layout.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
    )
  ) {
    throw new Error('A saved layout already uses that name.');
  }
  return name;
}

function normalizeSections(
  reportType: ReportLayoutType,
  sections: readonly string[],
): string[] {
  const availableSections = new Set(sectionIdsFor(reportType));
  if (
    !Array.isArray(sections) ||
    !sections.every(
      (section) => typeof section === 'string' && availableSections.has(section),
    ) ||
    new Set(sections).size !== sections.length
  ) {
    throw new Error('This layout contains invalid report sections.');
  }
  return [...sections];
}

function isLayout(value: unknown): value is LocalReportLayout {
  if (!isRecord(value)) return false;
  if (
    typeof value.id !== 'string' ||
    !value.id ||
    typeof value.name !== 'string' ||
    !value.name ||
    (value.reportType !== 'player' && value.reportType !== 'head-to-head') ||
    !Array.isArray(value.sections)
  ) {
    return false;
  }
  try {
    if (normalizeName(value.name) !== value.name) return false;
    normalizeSections(value.reportType, value.sections as string[]);
    return true;
  } catch {
    return false;
  }
}

async function readLayouts(): Promise<LocalReportLayout[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (raw === null) return [];

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error('Saved report layouts are damaged. No changes were made.');
  }
  if (
    !Array.isArray(value) ||
    !value.every(isLayout) ||
    new Set(value.map((layout) => layout.id)).size !== value.length
  ) {
    throw new Error('Saved report layouts are invalid. No changes were made.');
  }
  return value;
}

function createLayoutId(layouts: readonly LocalReportLayout[]): string {
  let id = '';
  do {
    id = `layout-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  } while (layouts.some((layout) => layout.id === id));
  return id;
}

async function writeLayouts(
  layouts: readonly LocalReportLayout[],
): Promise<LocalReportLayout[]> {
  const stored = layouts.map((layout) => ({
    ...layout,
    sections: [...layout.sections],
  }));
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  return stored;
}

export function listLocalReportLayouts(): Promise<LocalReportLayout[]> {
  return withWriteLock(readLayouts);
}

export function saveLocalReportLayout(
  reportType: ReportLayoutType,
  name: string,
  sections: readonly string[],
): Promise<LocalReportLayout[]> {
  return withWriteLock(async () => {
    const layouts = await readLayouts();
    const savedLayout: LocalReportLayout = {
      id: createLayoutId(layouts),
      name: validateName(name, layouts, reportType),
      reportType,
      sections: normalizeSections(reportType, sections),
    };
    return writeLayouts([...layouts, savedLayout]);
  });
}

export function renameLocalReportLayout(
  id: string,
  name: string,
): Promise<LocalReportLayout[]> {
  return withWriteLock(async () => {
    const layouts = await readLayouts();
    const layout = layouts.find((item) => item.id === id);
    if (!layout) throw new Error('Saved layout not found.');
    const renamed = {
      ...layout,
      name: validateName(name, layouts, layout.reportType, id),
    };
    return writeLayouts(layouts.map((item) => (item.id === id ? renamed : item)));
  });
}

export function deleteLocalReportLayout(
  id: string,
): Promise<LocalReportLayout[]> {
  return withWriteLock(async () => {
    const layouts = await readLayouts();
    if (!layouts.some((item) => item.id === id)) {
      throw new Error('Saved layout not found.');
    }
    return writeLayouts(layouts.filter((item) => item.id !== id));
  });
}
