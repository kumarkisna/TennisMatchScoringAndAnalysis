import {
  VideoCanvas,
  type VideoAspectRatio,
  VideoPausedContext,
  useVideoPlayer,
} from '@/lib/video';
import { AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';
import {
  BackupScene,
  DevelopmentScene,
  HookScene,
  PointScene,
  SetsNotesScene,
  SetupScene,
} from './WalkthroughScenes';

export const SCENE_DURATIONS = {
  hook: 4500,
  setup: 5000,
  point: 5500,
  setsNotes: 5000,
  development: 5500,
  backup: 4500,
};

export const VIDEO_ASPECT_RATIO: VideoAspectRatio = '16:9';
const SCENE_COMPONENTS = [
  HookScene,
  SetupScene,
  PointScene,
  SetsNotesScene,
  DevelopmentScene,
  BackupScene,
];
const SCENE_KEYS = Object.keys(SCENE_DURATIONS);

export default function VideoTemplate({
  durations = SCENE_DURATIONS,
  loop = true,
  paused = false,
  onSceneChange,
}: {
  durations?: Record<string, number>;
  loop?: boolean;
  paused?: boolean;
  onSceneChange?: (sceneKey: string) => void;
} = {}) {
  const { currentSceneKey } = useVideoPlayer({ durations, loop, paused });
  const baseSceneKey = currentSceneKey.replace(/_r[12]$/, '');
  const sceneIndex = SCENE_KEYS.indexOf(baseSceneKey);
  const Scene = SCENE_COMPONENTS[sceneIndex];
  useEffect(() => {
    onSceneChange?.(currentSceneKey);
  }, [currentSceneKey, onSceneChange]);

  return (
    <VideoCanvas
      aspectRatio={VIDEO_ASPECT_RATIO}
      style={{ backgroundColor: 'var(--color-bg-dark)' }}
    >
      <VideoPausedContext.Provider value={paused}>
        <AnimatePresence mode="sync">
          {Scene && <Scene key={currentSceneKey} />}
        </AnimatePresence>
      </VideoPausedContext.Provider>
    </VideoCanvas>
  );
}
