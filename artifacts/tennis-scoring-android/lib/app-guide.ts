export const APP_GUIDE_SECTIONS = [
  {
    id: 'players',
    navLabel: 'Players',
    title: 'Save and choose players',
    icon: 'people-outline',
    intro: 'Save player details once, then reuse them when starting matches.',
    steps: [
      'On Home, open Saved players to add or edit a player. Add a name and any optional details you want to keep, such as date of birth, tennis identifiers, profile links, or phone numbers.',
      'Use the main tracked-player control on Home to switch the player whose development you are following.',
      'When setting up a match, select saved players for either side or type names for players you have not saved.',
    ],
  },
  {
    id: 'match-setup',
    navLabel: 'Match setup',
    title: 'Start a match',
    icon: 'calendar-outline',
    intro: 'Set the match details before opening the live scorecard.',
    steps: [
      'Tap Start a match on Home. Choose the match date, tracked player, and opponent.',
      'Add event, round, or chair/coach details if useful. Choose the court surface and the first server.',
      'Open live score to begin recording. Match and player information is saved on this device.',
    ],
  },
  {
    id: 'point-scoring',
    navLabel: 'Record points',
    title: 'Record each point',
    icon: 'tennisball-outline',
    intro: 'Choose the player who won the point; the score advances automatically.',
    steps: [
      'Tap the button for the player who won. The buttons identify each side by player name or A/B, and the current game score updates immediately.',
      'Use the first-serve-fault control when the first serve misses. Add a winner, error, or serve tag when you observed it; tags are optional.',
      'Expand stroke details or shot context to capture more detail. If you do not know a shot tag, leave it blank rather than guessing.',
    ],
  },
  {
    id: 'sets',
    navLabel: 'Sets',
    title: 'Move through sets and tie-breaks',
    icon: 'albums-outline',
    intro: 'A match can contain multiple sets, including a tie-break-only set.',
    steps: [
      'The scorecard keeps points in the current set and shows completed sets in order. Add another set when the match continues.',
      'For a tie-break-only set, choose 7 or 10 as the target, or enter a custom target. The tie-break must still be won by two points.',
      'Review each set score and the match winner in the match details after play.',
    ],
  },
  {
    id: 'notes-timing',
    navLabel: 'Notes & timing',
    title: 'Add context while you record',
    icon: 'create-outline',
    intro: 'Use notes and timing markers to preserve what happened beyond the score.',
    steps: [
      'Expand Shot context during a point to add observed direction or rally-length details.',
      'Expand the game or set notes panels to record observations and coaching notes. Stroke ratings use a 0–10 scale.',
      'Tap timing markers as events happen. They are manual observations, so use them consistently; the app does not measure court time automatically.',
    ],
  },
  {
    id: 'reports',
    navLabel: 'Reports',
    title: 'Review player performance',
    icon: 'stats-chart-outline',
    intro: 'Reports combine match outcomes with the point details you recorded.',
    steps: [
      'Open a match from Home or History to review its set scores, winner, and recorded statistics.',
      'Use player development to review one player across matches, or Head to Head to compare two players over the recorded matches.',
      'Preview a match or head-to-head report before saving or sharing its PDF. Untagged points still count toward score-based statistics, but not shot-tag totals.',
    ],
  },
  {
    id: 'history-backups',
    navLabel: 'History & backup',
    title: 'Find matches and protect your records',
    icon: 'archive-outline',
    intro: 'Home keeps the newest matches close; History is the separate archive.',
    steps: [
      'Open History to browse older matches in newest-first order. Use the available search and result filters to narrow the list.',
      'On Home, use Save to write a backup, Share to send the backup through Android sharing, or Load to restore a backup. Loading adds missing records and keeps existing ones.',
      'A report PDF and a full-data backup are different files. Keep a backup somewhere you control before changing or replacing devices.',
    ],
  },
  {
    id: 'settings-privacy',
    navLabel: 'Settings & privacy',
    title: 'Personalize the app and keep data local',
    icon: 'color-palette-outline',
    intro: 'TennisScoring works offline and does not require an account.',
    steps: [
      'Open Settings to choose a theme, adjust its tone, or build a custom color palette.',
      'Players and match records are stored on this device. The app does not upload them to an external database.',
      'Use the backup controls when you want a separate copy or want to move records to another device.',
    ],
  },
] as const;

export type AppGuideSectionId = (typeof APP_GUIDE_SECTIONS)[number]['id'];

/**
 * Review this map whenever a user-facing screen or capability changes.
 * The offline-persistence test compares it with real app routes and checks
 * that important controls still exist on each route.
 */
export const APP_GUIDE_SCREEN_COVERAGE = [
  {
    route: 'about.tsx',
    sectionIds: APP_GUIDE_SECTIONS.map(({ id }) => id),
    requiredSourceMarkers: [
      'APP_GUIDE_SECTIONS.map',
      'jumpToSection',
      'APP_COPYRIGHT_NOTICE',
      'selectable={false}',
    ],
  },
  {
    route: 'head-to-head.tsx',
    sectionIds: ['reports'],
    requiredSourceMarkers: ['head-to-head-summary', 'head-to-head-timing-summary'],
  },
  {
    route: 'history.tsx',
    sectionIds: ['history-backups', 'reports'],
    requiredSourceMarkers: ['history-match-list', 'history-toggle-completed-matches'],
  },
  {
    route: 'index.tsx',
    sectionIds: ['players', 'match-setup', 'history-backups'],
    requiredSourceMarkers: [
      'button-start-match',
      'button-switch-main-player',
      'button-save-local-backup',
      'button-share-local-backup',
      'button-load-local-backup',
    ],
  },
  {
    route: 'matches/[id].tsx',
    sectionIds: ['point-scoring', 'sets', 'notes-timing', 'reports'],
    requiredSourceMarkers: [
      'button-point-tracked',
      'button-add-standard-set',
      'button-add-custom-tiebreak-set',
      'toggle-game-notes',
      'toggle-point-context',
    ],
  },
  {
    route: 'matches/new.tsx',
    sectionIds: ['match-setup', 'players', 'sets'],
    requiredSourceMarkers: [
      'input-match-date',
      'input-set-number',
      'input-tracked-player',
      'Open live score',
    ],
  },
  {
    route: 'players/[id]/development.tsx',
    sectionIds: ['reports'],
    requiredSourceMarkers: ['player-timing-history', 'player-timing-match-trend'],
  },
  {
    route: 'players.tsx',
    sectionIds: ['players'],
    requiredSourceMarkers: [
      'input-saved-player-name',
      'button-add-player-profile-link',
      'button-add-player-phone-number',
    ],
  },
  {
    route: 'settings.tsx',
    sectionIds: ['settings-privacy'],
    requiredSourceMarkers: ['<ThemeSettingsPanel'],
  },
] as const;
