const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const values = new Map();
const asyncStorage = {
  async getItem(key) {
    return values.has(key) ? values.get(key) : null;
  },
  async setItem(key, value) {
    values.set(key, String(value));
  },
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '@react-native-async-storage/async-storage') {
    return { __esModule: true, default: asyncStorage };
  }
  return originalLoad.call(this, request, parent, isMain);
};

require.extensions['.ts'] = function (module, filename) {
  const source = fs.readFileSync(filename, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  module._compile(outputText, filename);
};

const reportSections = require('../lib/report-sections.ts');
const {
  allHeadToHeadReportSections,
  allPlayerReportSections,
  HEAD_TO_HEAD_REPORT_SECTION_PREFERENCE_KEY,
  loadReportSectionPreference,
  parseReportSectionPreference,
  PLAYER_REPORT_SECTION_PREFERENCE_KEY,
  saveReportSectionPreference,
} = reportSections;

test.after(() => {
  Module._load = originalLoad;
  delete require.extensions['.ts'];
});

test('new report preferences default to all sections and can save an intentional clear', async () => {
  values.clear();
  assert.deepEqual(
    await loadReportSectionPreference(
      PLAYER_REPORT_SECTION_PREFERENCE_KEY,
      allPlayerReportSections(),
      allPlayerReportSections(),
    ),
    allPlayerReportSections(),
  );

  await saveReportSectionPreference(PLAYER_REPORT_SECTION_PREFERENCE_KEY, []);
  assert.deepEqual(
    await loadReportSectionPreference(
      PLAYER_REPORT_SECTION_PREFERENCE_KEY,
      allPlayerReportSections(),
      allPlayerReportSections(),
    ),
    [],
  );
});

test('single-match and head-to-head preferences are stored independently', async () => {
  values.clear();
  const playerSelection = ['serve', 'return'];
  const headToHeadSelection = ['meetings', 'break-points'];

  await saveReportSectionPreference(
    PLAYER_REPORT_SECTION_PREFERENCE_KEY,
    playerSelection,
  );
  await saveReportSectionPreference(
    HEAD_TO_HEAD_REPORT_SECTION_PREFERENCE_KEY,
    headToHeadSelection,
  );

  assert.deepEqual(
    await loadReportSectionPreference(
      PLAYER_REPORT_SECTION_PREFERENCE_KEY,
      allPlayerReportSections(),
      allPlayerReportSections(),
    ),
    playerSelection,
  );
  assert.deepEqual(
    await loadReportSectionPreference(
      HEAD_TO_HEAD_REPORT_SECTION_PREFERENCE_KEY,
      allHeadToHeadReportSections(),
      allHeadToHeadReportSections(),
    ),
    headToHeadSelection,
  );
});

test('invalid saved data falls back to the full report and filters unknown sections', () => {
  const playerSections = allPlayerReportSections();
  assert.deepEqual(
    parseReportSectionPreference('{broken', playerSections, playerSections),
    playerSections,
  );
  assert.deepEqual(
    parseReportSectionPreference('["unknown"]', playerSections, playerSections),
    playerSections,
  );
  assert.deepEqual(
    parseReportSectionPreference('["serve","unknown","serve"]', playerSections, playerSections),
    ['serve'],
  );
});
