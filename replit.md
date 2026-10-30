# TennisScoring Android

An offline-first Android app for recording tennis points and reviewing player development. Match and player records stay on the device.

## Run & Operate

- `pnpm --filter @workspace/tennis-scoring-android run dev` — start the Android preview
- `pnpm --filter @workspace/tennis-scoring-android run typecheck` — typecheck the mobile app
- `pnpm --filter @workspace/tennis-scoring-android run test:offline-persistence` — verify local storage and backup behavior
- `pnpm --filter @workspace/tennis-scoring-android run test:reports` — verify report generation
- `pnpm --filter @workspace/tennis-scoring-android run test:score-progress` — verify scoring logic
- `pnpm --filter @workspace/tennis-scoring-android run test:match-ui` — verify match UI behavior

## Stack

- Expo, React Native, Expo Router, and TypeScript
- Local persistence: AsyncStorage
- Reports and backups are generated and shared from the device

## Where things live

- `artifacts/tennis-scoring-android` — Android app

## Architecture decisions

- Scoring, player records, and analytics are local-only; the app does not use accounts, sync, or a remote database.

## Product

- Record live tennis matches, save players locally, and review match and player reports offline.

## User preferences

- Keep the Android app standalone and offline; do not add remote storage or authentication.

## Gotchas

- The Replit Expo workflow is only for development preview; match data remains on-device.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
