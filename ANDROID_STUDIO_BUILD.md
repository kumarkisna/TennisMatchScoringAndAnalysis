# Build TennisScoring for Android on Windows 11

This guide builds the Android app locally from the GitHub repository and produces an APK you can install on your phone. It follows the Windows workflow used for [RoutineFlow's Android Studio build](https://github.com/kumarkisna/routineFlow/blob/main/ANDROID_STUDIO_BUILD.md), adapted for TennisScoring.

## What stays on your phone

Match scores, players, notes, and reports are stored by the installed app on the device. Normal app use does not require a Replit account, hosted server, or external database. The build computer does need an internet connection to download Node packages, the Android SDK, and Gradle components.

Before uninstalling the app or changing its Android package ID, export a backup from the app. Uninstalling an Android app normally removes that app's local data.

## 1. Install the Windows tools

Install:

1. [GitHub Desktop](https://desktop.github.com/) and [Git for Windows](https://gitforwindows.org/) (Git Bash is needed for this repository's install check).
2. [Node.js 24](https://nodejs.org/).
3. [Android Studio](https://developer.android.com/studio).
4. OpenJDK 17, such as [Microsoft OpenJDK 17](https://learn.microsoft.com/java/openjdk/download).

In Android Studio's setup wizard, choose the **Standard** installation and install the Android SDK and Android Virtual Device.

In **SDK Manager**, make sure these components are installed:

- Android SDK Platform 36 (Android 16), as requested by the current Expo/React Native setup guide.
- Android SDK Build-Tools.
- Android SDK Platform-Tools.
- Android SDK Command-line Tools (latest).
- Android Emulator, if you plan to test on an emulator.

The project may request an additional SDK component during Gradle sync. Install the exact component named in the prompt.

## 2. Clone the repository

Clone `kumarkisna/TennisMatchScoringAndAnalysis` with GitHub Desktop to a short local path, for example:

```text
C:\ts
```

Avoid deeply nested folders and OneDrive-synced locations for the first build; native build tools can create long paths.

## 3. Install the JavaScript dependencies

Open **Git Bash** in the repository root—the folder containing `pnpm-workspace.yaml`. Do not run the install from inside the app folder.

This repository requires pnpm. Its root install check uses `sh`, so use Git Bash for `pnpm install` on Windows.

The repository root already has an `.npmrc` file. In your local clone, keep its existing settings and add this line:

```ini
node-linker=hoisted
```

This Windows-local setting keeps native dependency paths manageable. Do not replace the other `.npmrc` settings.

Run:

```bash
node --version
corepack enable
corepack prepare pnpm@10.26.1 --activate
pnpm --version
pnpm install --frozen-lockfile
```

Use Node 24 and pnpm 10.26.1 for this repository. If Corepack is unavailable, install the pinned pnpm version from PowerShell with `npm install --global pnpm@10.26.1`, reopen Git Bash, and continue.

## 4. Generate the Android Studio project

From the repository root, run:

```bash
cd artifacts/tennis-scoring-android
pnpm exec expo prebuild --platform android
```

This generates the native Android project here:

```text
artifacts\tennis-scoring-android\android
```

The app's `.gitignore` excludes this generated folder. Build from it locally; do not commit generated Android files for routine Expo changes. If native Android customizations are added later, keep them in Expo config or a config plugin so prebuild can reproduce them.

## 5. Open the project in Android Studio

1. Open Android Studio and choose **File → Open**.
2. Select `artifacts\tennis-scoring-android\android`.
3. Wait for Gradle sync to finish. Accept prompts to install missing SDK components or licenses.
4. Open **File → Settings → Build, Execution, Deployment → Build Tools → Gradle**.
5. Set the Gradle JDK/JVM to **JDK 17**, then sync again.

Android Studio's bundled Java runtime can be newer than the version this React Native build expects. Use JDK 17 for Gradle.

## 6. Build an APK

### Standalone release APK

For an APK that includes the app's JavaScript bundle and can launch without Metro:

1. In Android Studio, open **View → Tool Windows → Gradle**.
2. Use **Execute Gradle Task**.
3. Enter and run:

```text
:app:assembleRelease
```

The usual output path is:

```text
artifacts\tennis-scoring-android\android\app\build\outputs\apk\release\app-release.apk
```

For a properly signed APK to install on devices or share, use **Build → Generate Signed Bundle / APK → APK** and follow the wizard. Create a signing key or select the existing key used for prior releases. Keep the keystore and passwords private, backed up, and outside GitHub; future updates must use the same Android package ID and signing key.

An **APK** can be installed directly on a phone. An **AAB** is intended for Google Play and cannot be installed by tapping it.

### Debug APK

For development only, run `:app:assembleDebug` or choose **Build → Build Bundle(s) / APK(s) → Build APK(s)**. A debug build normally needs Metro running on the computer; it is not the standalone build to give someone for offline use.

## 7. Install and test on your phone

You can copy the release APK to the phone, open it, and approve Android's prompt to install from that file source.

Or connect the phone with a USB data cable, enable **Developer options → USB debugging**, accept the phone's authorization prompt, then in PowerShell run:

```powershell
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb devices
& $adb install -r "C:\ts\artifacts\tennis-scoring-android\android\app\build\outputs\apk\release\app-release.apk"
```

Replace `C:\ts` if you cloned the repository elsewhere. The device must appear with status `device` in the `adb devices` output.

## If a release build cannot find Expo

If Gradle reports `Cannot find module 'expo/package.json'`, set a Windows user `NODE_PATH` that includes both the app and repository `node_modules` folders. In PowerShell, replace `C:\ts` with your clone location:

```powershell
setx NODE_PATH "C:\ts\artifacts\tennis-scoring-android\node_modules;C:\ts\node_modules"
```

If `NODE_PATH` already has a value, append these paths rather than replacing the existing value. Close and reopen Android Studio so it receives the updated environment.

## Troubleshooting

- **`sh` is not recognized:** run dependency commands from Git Bash at the repository root.
- **pnpm reports a lockfile mismatch:** confirm `pnpm --version` is `10.26.1`, then run `pnpm install --frozen-lockfile` again from the repository root.
- **Gradle reports a Java or JDK error:** set Android Studio's Gradle JDK to JDK 17 and sync again.
- **Gradle asks for an SDK or license:** install the named SDK component from Android Studio's SDK Manager and accept its license.
- **Ninja reports a path or `build.ninja` error:** move the clone to a shorter path such as `C:\ts`, keep `node-linker=hoisted` in the local root `.npmrc`, reinstall, and regenerate Android with `pnpm exec expo prebuild --platform android`.
- **The debug APK stays on the splash screen:** run the release task instead. Debug builds expect Metro to serve the JavaScript bundle.
- **Gradle cannot download its wrapper:** check the network or Android Studio's proxy settings; do not change the Gradle wrapper version just to work around a timeout.
- **You need to update an installed APK:** keep the same Android package ID and signing key. Back up app data before uninstalling.

The current `app.json` does not set `android.package` explicitly. Expo derives a default application ID from the project configuration. If you want a specific permanent ID, set it before your first release and keep it unchanged; changing it later makes Android treat the build as a different app.

## References

- [RoutineFlow Android Studio build guide](https://github.com/kumarkisna/routineFlow/blob/main/ANDROID_STUDIO_BUILD.md)
- [Expo: local app development](https://docs.expo.dev/guides/local-app-development/)
- [Expo: continuous native generation and prebuild](https://docs.expo.dev/workflow/continuous-native-generation/)
- [Expo: local release builds](https://docs.expo.dev/guides/local-app-production/)
- [Expo: set up Android for local builds](https://docs.expo.dev/get-started/set-up-your-environment/?platform=android&device=physical&mode=development-build&buildEnv=local)
- [Android Studio installation](https://developer.android.com/studio/install)
- [Android Gradle JDK selection](https://developer.android.com/build/jdks)
