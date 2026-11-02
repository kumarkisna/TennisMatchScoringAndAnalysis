---
name: Expo monorepo autolinking
description: Expo native dependency discovery when an app is nested in this pnpm monorepo.
---

For nested Expo apps in this workspace, configure Expo autolinking to search both the app's `node_modules` and the workspace-root `node_modules`. Node.js resolving a native package through parent directories does not guarantee Expo autolinking will discover it.

**Why:** Expo SDK 54+ no longer searches every ancestor `node_modules` directory by default. Native packages can resolve in JavaScript while being absent from Android's Gradle subprojects.

**How to apply:** Set `expo.autolinking.searchPaths` relative to the app root, including `../../node_modules` and `./node_modules`; verify with `expo-modules-autolinking react-native-config --platform android` before regenerating native Android files.
