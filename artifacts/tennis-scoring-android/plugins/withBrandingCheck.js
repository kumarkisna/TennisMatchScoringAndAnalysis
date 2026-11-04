const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { withAppBuildGradle } = require('@expo/config-plugins');
const { withDangerousMod } = require('@expo/config-plugins');

const GRADLE_CHECK = `
tasks.register("checkBranding", Exec) {
    workingDir projectRoot
    commandLine "node", "scripts/branding-assets.cjs", "--check", "--native"
}

tasks.named("preBuild").configure {
    dependsOn("checkBranding")
}
`;

module.exports = function withBrandingCheck(config) {
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const splashPath = path.join(
        projectRoot,
        'assets',
        'images',
        'launch-splash.png',
      );
      const nativeStampPath = path.join(
        projectRoot,
        'android',
        '.branding-splash.sha256',
      );
      const splashHash = crypto
        .createHash('sha256')
        .update(await fs.promises.readFile(splashPath))
        .digest('hex');
      await fs.promises.writeFile(nativeStampPath, `${splashHash}\n`);
      return config;
    },
  ]);

  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') {
      throw new Error(
        'The branding build check currently supports Groovy Android build files only.',
      );
    }
    if (!config.modResults.contents.includes('tasks.register("checkBranding"')) {
      config.modResults.contents += `\n${GRADLE_CHECK}`;
    }
    return config;
  });
};
