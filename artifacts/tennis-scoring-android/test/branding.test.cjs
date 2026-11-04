const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { checkBranding } = require('../scripts/branding-assets.cjs');

const projectRoot = path.resolve(__dirname, '..');

test('launch artwork and Expo app label match the shared branding source', () => {
  assert.doesNotThrow(() => checkBranding());

  const result = spawnSync(
    process.execPath,
    ['scripts/branding-assets.cjs', '--check'],
    { cwd: projectRoot, encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('branding check rejects a stale Expo app label', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tennis-branding-test-'));
  const tempLib = path.join(tempRoot, 'lib');
  const tempAssets = path.join(tempRoot, 'assets', 'images');
  fs.mkdirSync(tempLib, { recursive: true });
  fs.mkdirSync(tempAssets, { recursive: true });
  fs.copyFileSync(
    path.join(projectRoot, 'lib', 'branding.ts'),
    path.join(tempLib, 'branding.ts'),
  );
  fs.copyFileSync(
    path.join(projectRoot, 'assets', 'images', 'launch-splash.svg'),
    path.join(tempAssets, 'launch-splash.svg'),
  );
  fs.copyFileSync(
    path.join(projectRoot, 'assets', 'images', 'launch-splash.png'),
    path.join(tempAssets, 'launch-splash.png'),
  );
  fs.copyFileSync(
    path.join(projectRoot, 'app.json'),
    path.join(tempRoot, 'app.json'),
  );
  const { checkBranding: checkTempBranding } = require('../scripts/branding-assets.cjs');
  const appConfigPath = path.join(tempRoot, 'app.json');
  const appConfig = JSON.parse(fs.readFileSync(appConfigPath, 'utf8'));
  appConfig.expo.name = 'Outdated App Label';
  fs.writeFileSync(appConfigPath, JSON.stringify(appConfig, null, 2));

  try {
    assert.throws(
      () => checkTempBranding({ projectRoot: tempRoot }),
      /but branding\.ts defines/,
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('branding check rejects a changed launch image', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tennis-branding-image-'));
  const tempLib = path.join(tempRoot, 'lib');
  const tempAssets = path.join(tempRoot, 'assets', 'images');
  fs.mkdirSync(tempLib, { recursive: true });
  fs.mkdirSync(tempAssets, { recursive: true });
  fs.copyFileSync(
    path.join(projectRoot, 'lib', 'branding.ts'),
    path.join(tempLib, 'branding.ts'),
  );
  fs.copyFileSync(
    path.join(projectRoot, 'assets', 'images', 'launch-splash.svg'),
    path.join(tempAssets, 'launch-splash.svg'),
  );
  const imagePath = path.join(tempAssets, 'launch-splash.png');
  const image = fs.readFileSync(
    path.join(projectRoot, 'assets', 'images', 'launch-splash.png'),
  );
  image[64] ^= 1;
  fs.writeFileSync(imagePath, image);
  fs.copyFileSync(
    path.join(projectRoot, 'app.json'),
    path.join(tempRoot, 'app.json'),
  );

  try {
    assert.throws(
      () => checkBranding({ projectRoot: tempRoot }),
      /changed after generation/,
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
