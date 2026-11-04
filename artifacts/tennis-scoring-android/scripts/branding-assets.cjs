const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const BRANDING_CHUNK_KEY = 'TennisScoringBranding';

function readBranding(root = projectRoot) {
  const branding = require(path.join(root, 'lib', 'branding.ts'));
  for (const key of ['APP_BRAND_NAME', 'APP_COPYRIGHT_NOTICE']) {
    if (typeof branding[key] !== 'string' || branding[key].trim() === '') {
      throw new Error(`lib/branding.ts must define a non-empty ${key}`);
    }
  }
  return branding;
}

function renderExpectedSplash(branding, outputPath, root = projectRoot) {
  const template = fs.readFileSync(
    path.join(root, 'assets', 'images', 'launch-splash.svg'),
    'utf8',
  );
  const svg = template
    .replaceAll('{{APP_BRAND_NAME}}', escapeXml(branding.APP_BRAND_NAME))
    .replaceAll(
      '{{APP_COPYRIGHT_NOTICE}}',
      escapeXml(branding.APP_COPYRIGHT_NOTICE),
    );

  if (/\{\{APP_[A-Z_]+\}\}/.test(svg)) {
    throw new Error('The launch artwork template contains an unknown token.');
  }

  const svgPath = path.join(path.dirname(outputPath), 'launch-splash.svg');
  fs.writeFileSync(svgPath, svg);
  execFileSync(
    'magick',
    [
      svgPath,
      '-alpha',
      'off',
      '-strip',
      '-define',
      'png:compression-level=9',
      outputPath,
    ],
    { stdio: 'pipe' },
  );
}

function escapeXml(value) {
  return value.replace(/[<>&"']/g, (character) => {
    const entities = {
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      '"': '&quot;',
      "'": '&apos;',
    };
    return entities[character];
  });
}

function syncBranding(root = projectRoot) {
  const branding = readBranding(root);
  const rootAppConfigPath = path.join(root, 'app.json');
  const rootSplashImagePath = path.join(
    root,
    'assets',
    'images',
    'launch-splash.png',
  );
  const appConfig = JSON.parse(fs.readFileSync(rootAppConfigPath, 'utf8'));
  appConfig.expo.name = branding.APP_BRAND_NAME;
  syncSplashPlugin(appConfig.expo);
  fs.writeFileSync(
    rootAppConfigPath,
    `${JSON.stringify(appConfig, null, 2)}\n`,
  );
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tennis-branding-'));
  try {
    const renderedSplashPath = path.join(tempDir, 'launch-splash.png');
    renderExpectedSplash(branding, renderedSplashPath, root);
    const renderedSplash = fs.readFileSync(renderedSplashPath);
    fs.writeFileSync(
      rootSplashImagePath,
      addBrandingMarker(renderedSplash, branding),
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  console.log(
    `Synced Expo app name and launch artwork to ${branding.APP_BRAND_NAME}.`,
  );
}

function checkBranding({ projectRoot: root = projectRoot, checkNative = false } = {}) {
  const branding = readBranding(root);
  const rootAppConfigPath = path.join(root, 'app.json');
  const rootSplashImagePath = path.join(
    root,
    'assets',
    'images',
    'launch-splash.png',
  );
  const appConfig = JSON.parse(fs.readFileSync(rootAppConfigPath, 'utf8'));
  if (appConfig.expo.name !== branding.APP_BRAND_NAME) {
    throw new Error(
      `app.json expo.name is "${appConfig.expo.name}", but branding.ts defines "${branding.APP_BRAND_NAME}". Run pnpm run sync:branding.`,
    );
  }
  assertSplashPluginConfig(appConfig.expo);

  if (!fs.existsSync(rootSplashImagePath)) {
    throw new Error('The launch splash image is missing. Run pnpm run sync:branding.');
  }
  const pngInfo = readBrandingMarker(fs.readFileSync(rootSplashImagePath));
  if (
    pngInfo.marker.name !== branding.APP_BRAND_NAME ||
    pngInfo.marker.copyright !== branding.APP_COPYRIGHT_NOTICE
  ) {
    throw new Error(
      'launch-splash.png was generated for different branding. Run pnpm run sync:branding.',
    );
  }
  const sourceTemplate = fs.readFileSync(
    path.join(root, 'assets', 'images', 'launch-splash.svg'),
    'utf8',
  );
  if (
    !sourceTemplate.includes('{{APP_BRAND_NAME}}') ||
    !sourceTemplate.includes('{{APP_COPYRIGHT_NOTICE}}')
  ) {
    throw new Error(
      'The launch artwork template must render the shared app name and copyright.',
    );
  }
  if (
    crypto.createHash('sha256').update(pngInfo.basePng).digest('hex') !==
    pngInfo.marker.renderSha256
  ) {
    throw new Error(
      'launch-splash.png changed after generation. Run pnpm run sync:branding.',
    );
  }

  if (checkNative) {
    const rootAndroidStringsPath = path.join(
      root,
      'android',
      'app',
      'src',
      'main',
      'res',
      'values',
      'strings.xml',
    );
    if (!fs.existsSync(rootAndroidStringsPath)) {
      throw new Error(
        'Android app name resource is missing. Run pnpm run build:android to regenerate native branding.',
      );
    }
    const stringsXml = fs.readFileSync(rootAndroidStringsPath, 'utf8');
    const appNameMatch = stringsXml.match(
      /<string\s+name="app_name">([\s\S]*?)<\/string>/,
    );
    if (!appNameMatch || decodeXml(appNameMatch[1].trim()) !== branding.APP_BRAND_NAME) {
      throw new Error(
        `Android app label does not match "${branding.APP_BRAND_NAME}". Run pnpm run build:android to regenerate native branding.`,
      );
    }
    const nativeSplashHashPath = path.join(
      root,
      'android',
      '.branding-splash.sha256',
    );
    if (!fs.existsSync(nativeSplashHashPath)) {
      throw new Error(
        'Android splash resources have no generated branding record. Run pnpm run build:android.',
      );
    }
    const nativeSplashHash = fs.readFileSync(nativeSplashHashPath, 'utf8').trim();
    const sourceSplashHash = crypto
      .createHash('sha256')
      .update(fs.readFileSync(rootSplashImagePath))
      .digest('hex');
    if (nativeSplashHash !== sourceSplashHash) {
      throw new Error(
        'Android splash resources are out of date with launch-splash.png. Run pnpm run build:android.',
      );
    }
    for (const density of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
      const nativeImage = path.join(
        root,
        'android',
        'app',
        'src',
        'main',
        'res',
        `drawable-${density}`,
        'splashscreen_logo.png',
      );
      if (!fs.existsSync(nativeImage) || fs.statSync(nativeImage).size === 0) {
        throw new Error(
          `The Android ${density} splash image is missing. Run pnpm run build:android.`,
        );
      }
    }
  }

  console.log(
    `Branding check passed${checkNative ? ' (including Android app label)' : ''}.`,
  );
}

function decodeXml(value) {
  return value
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&');
}

function splashPluginOptions(expoConfig) {
  const splash = expoConfig.splash ?? {};
  return {
    image: splash.image,
    imageWidth: splash.imageWidth,
    resizeMode: splash.resizeMode,
    backgroundColor: splash.backgroundColor,
  };
}

function syncSplashPlugin(expoConfig) {
  const plugins = expoConfig.plugins ?? [];
  const splashIndex = plugins.findIndex(
    (plugin) =>
      (Array.isArray(plugin) ? plugin[0] : plugin) === 'expo-splash-screen',
  );
  const options = splashPluginOptions(expoConfig);
  const splashPlugin = ['expo-splash-screen', options];

  if (splashIndex === -1) {
    plugins.push(splashPlugin);
  } else {
    plugins[splashIndex] = splashPlugin;
  }
  expoConfig.plugins = plugins;
}

function assertSplashPluginConfig(expoConfig) {
  const plugins = expoConfig.plugins ?? [];
  const splashPlugin = plugins.find(
    (plugin) =>
      (Array.isArray(plugin) ? plugin[0] : plugin) === 'expo-splash-screen',
  );
  const options = Array.isArray(splashPlugin) ? splashPlugin[1] : undefined;
  const expected = splashPluginOptions(expoConfig);

  if (
    !options ||
    Object.entries(expected).some(([key, value]) => options[key] !== value)
  ) {
    throw new Error(
      'The expo-splash-screen plugin must use the splash settings in app.json. Run pnpm run sync:branding.',
    );
  }
}

function addBrandingMarker(basePng, branding) {
  const marker = {
    name: branding.APP_BRAND_NAME,
    copyright: branding.APP_COPYRIGHT_NOTICE,
    renderSha256: crypto.createHash('sha256').update(basePng).digest('hex'),
  };
  const markerData = Buffer.from(
    `${BRANDING_CHUNK_KEY}\0${JSON.stringify(marker)}`,
    'utf8',
  );
  const chunk = Buffer.alloc(12 + markerData.length);
  chunk.writeUInt32BE(markerData.length, 0);
  chunk.write('tEXt', 4, 4, 'ascii');
  markerData.copy(chunk, 8);
  chunk.writeUInt32BE(
    pngCrc32(chunk.subarray(4, 8 + markerData.length)),
    8 + markerData.length,
  );

  return insertPngChunk(basePng, chunk);
}

function readBrandingMarker(png) {
  if (!png.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new Error('launch-splash.png is not a valid PNG.');
  }

  const chunks = [];
  let marker = null;
  let offset = PNG_SIGNATURE.length;
  while (offset < png.length) {
    if (offset + 12 > png.length) {
      throw new Error('launch-splash.png has a truncated PNG chunk.');
    }
    const length = png.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > png.length) {
      throw new Error('launch-splash.png has a truncated PNG chunk.');
    }
    const type = png.toString('ascii', offset + 4, offset + 8);
    const chunk = png.subarray(offset, end);
    if (type === 'tEXt') {
      const text = png.subarray(offset + 8, offset + 8 + length);
      const separator = text.indexOf(0);
      const key = text.toString('utf8', 0, separator);
      if (key === BRANDING_CHUNK_KEY) {
        if (marker) throw new Error('launch-splash.png has duplicate branding data.');
        try {
          marker = JSON.parse(text.toString('utf8', separator + 1));
        } catch {
          throw new Error('launch-splash.png has invalid branding data.');
        }
      } else {
        chunks.push(chunk);
      }
    } else {
      chunks.push(chunk);
    }
    offset = end;
  }
  if (!marker) {
    throw new Error(
      'launch-splash.png has no generated branding data. Run pnpm run sync:branding.',
    );
  }

  return { marker, basePng: Buffer.concat([PNG_SIGNATURE, ...chunks]) };
}

function insertPngChunk(png, chunk) {
  let offset = PNG_SIGNATURE.length;
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    if (type === 'IEND') {
      return Buffer.concat([png.subarray(0, offset), chunk, png.subarray(offset)]);
    }
    offset += length + 12;
  }
  throw new Error('Cannot add branding data to an invalid PNG.');
}

function pngCrc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

if (require.main === module) {
  try {
    if (process.argv.includes('--check')) {
      checkBranding({ checkNative: process.argv.includes('--native') });
    } else {
      syncBranding();
    }
  } catch (error) {
    console.error(`Branding error: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { checkBranding, syncBranding };
