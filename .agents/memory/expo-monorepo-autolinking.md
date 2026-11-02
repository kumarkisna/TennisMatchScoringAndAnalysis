---
name: Expo monorepo autolinking
description: Expo native dependency discovery when an app is nested in this pnpm monorepo.
---

For nested Expo apps in this workspace, configure Expo autolinking to search both the app's `node_modules` and the workspace-root `node_modules`. Node.js resolving a native package through parent directories does not guarantee Expo autolinking will discover it.

**Why:** Expo SDK 54+ no longer searches every ancestor `node_modules` directory by default. Native packages can resolve in JavaScript while being absent from Android's Gradle subprojects.

**How to apply:** Set `expo.autolinking.searchPaths` relative to the app root, including `../../node_modules` and `./node_modules`. If `expo-modules-autolinking react-native-config --platform android` still omits a direct React Native package that Node can resolve, add it to the app-root `react-native.config.js` with an explicit `root` path. Verify the config output before rebuilding Android.

**Why:** In a hoisted Windows pnpm workspace, a package can resolve from the root yet remain absent from Gradle's autolinked project list; an explicit React Native package root lets Expo Autolinking include it.
