// Optional scene metadata for Replit workspace integrations. When the
// workspace's scene controls are enabled for this project, a viewer's click on
// a scene segment scopes their next chat request to that scene's source file.
// Fill one entry per SCENE_DURATIONS key in VideoTemplate.tsx only when a
// skill reference asks for it; otherwise leave the map empty. Scenes missing
// from the map still play and can be jumped to.
//
// Example:
//   export const SCENE_DETAILS: Record<string, SceneDetails> = {
//     open: { title: 'Intro', filePath: 'src/components/video/video_scenes/Scene1.tsx' },
//   };

export interface SceneDetails {
  title: string;
  filePath: string;
}

export const SCENE_DETAILS: Record<string, SceneDetails> = {
  hook: { title: 'Every point', filePath: 'src/components/video/WalkthroughScenes.tsx' },
  setup: { title: 'Set up a match', filePath: 'src/components/video/WalkthroughScenes.tsx' },
  point: { title: 'Record a point', filePath: 'src/components/video/WalkthroughScenes.tsx' },
  setsNotes: { title: 'Sets and notes', filePath: 'src/components/video/WalkthroughScenes.tsx' },
  development: { title: 'Player development', filePath: 'src/components/video/WalkthroughScenes.tsx' },
  backup: { title: 'On-device backup', filePath: 'src/components/video/WalkthroughScenes.tsx' },
};
