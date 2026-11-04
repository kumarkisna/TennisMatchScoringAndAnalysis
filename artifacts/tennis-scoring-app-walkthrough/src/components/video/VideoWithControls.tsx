import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ChevronDown, ChevronUp, Pause, Play, Repeat } from 'lucide-react';
import VideoTemplate, { SCENE_DURATIONS } from './VideoTemplate';
import { useSceneControls } from './useSceneControls';
import { SCENE_DETAILS } from './sceneMeta';

function formatTime(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export default function VideoWithControls() {
  const isIframed = typeof window !== 'undefined' && window.self !== window.top;
  const controls = useSceneControls(SCENE_DURATIONS);
  const [collapsed, setCollapsed] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [tapPinned, setTapPinned] = useState(false);
  const sensorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!(collapsed && tapPinned)) return;
    const onDown = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' && sensorRef.current && !sensorRef.current.contains(event.target as Node)) {
        setTapPinned(false);
      }
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [collapsed, tapPinned]);

  if (!isIframed) return <VideoTemplate />;

  const visible = !collapsed || hovering || tapPinned;
  const jumpTo = (index: number) => {
    controls.jumpTo(index);
    const key = controls.sceneKeys[index];
    const details = SCENE_DETAILS[key];
    if (!details?.filePath) return;
    window.parent.postMessage({
      type: 'REPLIT_VIDEO_SCENE_SELECTED',
      payload: { sceneIndex: index, sceneCount: controls.sceneKeys.length, sceneTitle: details.title, filePath: details.filePath, lineNumber: 1 },
    }, '*');
  };
  const pointerEnter = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse') setHovering(true);
  };
  const pointerLeave = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse') setHovering(false);
  };
  const pointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' && collapsed) setTapPinned(true);
  };
  const toggleCollapsed = () => {
    setCollapsed((wasCollapsed) => {
      if (!wasCollapsed) {
        setHovering(false);
        setTapPinned(false);
      }
      return !wasCollapsed;
    });
  };

  return (
    <div className="relative h-screen w-full overflow-hidden">
      <VideoTemplate
        key={controls.mountKey}
        durations={controls.durations}
        paused={controls.paused}
        onSceneChange={controls.onSceneChange}
      />
      <div
        ref={sensorRef}
        className="absolute bottom-0 left-0 right-0 z-50 flex flex-col justify-end"
        style={{ height: '25%' }}
        onPointerEnter={pointerEnter}
        onPointerLeave={pointerLeave}
        onPointerDown={pointerDown}
      >
        <div className="flex-1" aria-hidden="true" />
        <ControlBar
          visible={visible}
          collapsed={collapsed}
          paused={controls.paused}
          locked={controls.locked}
          sceneKeys={controls.sceneKeys}
          activeIndex={controls.activeIndex}
          activeDuration={controls.activeDuration}
          activeStartTime={controls.activeStartTime}
          totalDuration={controls.totalDuration}
          tick={controls.tick}
          onTogglePause={controls.togglePause}
          onToggleLock={controls.toggleLock}
          onJumpTo={jumpTo}
          onToggleCollapsed={toggleCollapsed}
        />
      </div>
    </div>
  );
}

function ControlBar({
  visible, paused, locked, sceneKeys, activeIndex, activeDuration, activeStartTime,
  totalDuration, tick, onTogglePause, onToggleLock, onJumpTo, onToggleCollapsed, collapsed,
}: {
  visible: boolean;
  paused: boolean;
  locked: boolean;
  sceneKeys: string[];
  activeIndex: number;
  activeDuration: number;
  activeStartTime: number;
  totalDuration: number;
  tick: number;
  onTogglePause: () => void;
  onToggleLock: () => void;
  onJumpTo: (index: number) => void;
  onToggleCollapsed: () => void;
  collapsed: boolean;
}) {
  const [elapsed, setElapsed] = useState(0);
  const elapsedBase = useRef(0);
  useEffect(() => {
    setElapsed(0);
    elapsedBase.current = 0;
  }, [tick]);
  useEffect(() => {
    if (paused) return;
    const start = performance.now();
    const timer = window.setInterval(() => setElapsed(elapsedBase.current + performance.now() - start), 60);
    return () => {
      window.clearInterval(timer);
      elapsedBase.current += performance.now() - start;
    };
  }, [tick, paused]);
  const progress = activeDuration > 0 ? Math.min(1, elapsed / activeDuration) : 0;
  const totalElapsed = Math.min(totalDuration, activeStartTime + Math.min(elapsed, activeDuration));
  return (
    <div className={`flex items-center gap-[1.25vmin] border-t border-white/10 bg-[#0e291d]/90 px-[2vmin] py-[1.3vmin] text-[#f4f0df] backdrop-blur-md transition-all duration-200 ${visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-full opacity-0'}`} aria-hidden={!visible}>
      <button className="control-icon" onClick={onTogglePause} aria-label={paused ? 'Play' : 'Pause'} title={paused ? 'Play' : 'Pause'}>{paused ? <Play /> : <Pause />}</button>
      <button className={`control-icon ${locked ? 'control-active' : ''}`} onClick={onToggleLock} aria-label={locked ? 'Loop current scene: on' : 'Loop current scene: off'} aria-pressed={locked} title="Loop current scene"><Repeat /></button>
      <div className="mx-[.5vmin] h-[3.2vmin] w-px bg-white/20" />
      <div className="flex flex-1 items-center gap-[.55vmin]">
        {sceneKeys.map((key, index) => <button key={key} className="group relative h-[.75vmin] min-h-[8px] flex-1 overflow-hidden rounded-full bg-white/20 transition-all hover:h-[1vmin]" onClick={() => onJumpTo(index)} aria-label={`Jump to scene ${index + 1}`} aria-current={index === activeIndex ? 'true' : undefined}><span className="absolute inset-y-0 left-0 rounded-full bg-[#c8ed32]" style={{ width: `${index < activeIndex ? 100 : index === activeIndex ? progress * 100 : 0}%` }} /></button>)}
      </div>
      <span className="control-time">{activeIndex + 1}/{sceneKeys.length}</span>
      <span className="control-time min-w-[10ch] text-right">{formatTime(totalElapsed)} / {formatTime(totalDuration)}</span>
      <button className="control-icon" onClick={onToggleCollapsed} aria-expanded={!collapsed} aria-label={collapsed ? 'Show controls' : 'Hide controls'}>{collapsed ? <ChevronUp /> : <ChevronDown />}</button>
    </div>
  );
}
