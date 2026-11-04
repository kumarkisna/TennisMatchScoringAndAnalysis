import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useSceneTimer } from '@/lib/video';

const ease = [0.22, 1, 0.36, 1] as const;
const ink = '#0e291d';
const chalk = '#f4f0df';
const citron = '#c8ed32';
const clay = '#e66d47';

function TennisBall({ size = '37vmin' }: { size?: string }) {
  return (
    <motion.div
      className="absolute rounded-full"
      style={{
        width: size,
        aspectRatio: '1',
        left: '65%',
        top: '24%',
        background: 'radial-gradient(circle at 33% 29%, #e5ff6a 0, #c8ed32 48%, #94bd0f 100%)',
        boxShadow: 'inset -1.5vmin -2vmin 3vmin rgba(43,82,0,.28), 0 2vmin 7vmin rgba(0,0,0,.26)',
      }}
      initial={{ scale: 0.72, rotate: -22 }}
      animate={{ scale: [0.72, 1.08, 1], rotate: [-22, 6, 0] }}
      transition={{ duration: 1.05, ease }}
    >
      <svg viewBox="0 0 300 300" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <path d="M-30 68 C58 36 86 77 103 133 C126 207 192 250 330 216" fill="none" stroke="#f4f0df" strokeWidth="15" />
      </svg>
    </motion.div>
  );
}

function Kicker({ children, color = citron }: { children: ReactNode; color?: string }) {
  return <div className="scene-kicker uppercase" style={{ color }}>{children}</div>;
}

function SceneBase({ children, light = false }: { children: ReactNode; light?: boolean }) {
  return (
    <motion.section
      className="film-grain absolute inset-0 overflow-hidden"
      style={{ background: light ? chalk : ink, color: light ? ink : chalk }}
      initial={{ opacity: 0, scale: 1.025 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.985, transition: { duration: 0.34, ease: 'easeIn' } }}
      transition={{ duration: 0.42, ease }}
    >
      {children}
    </motion.section>
  );
}

export function HookScene() {
  return (
    <SceneBase>
      <div className="absolute inset-0 court-grid opacity-30" />
      <div className="absolute -right-[9vmin] -top-[13vmin] h-[65vmin] w-[65vmin] rounded-full border-[.22vmin] border-[#c8ed32]/35" />
      <div className="absolute -right-[4vmin] -top-[8vmin] h-[55vmin] w-[55vmin] rounded-full border-[.12vmin] border-[#c8ed32]/20" />
      <TennisBall size="43vmin" />
      <div className="absolute left-[8%] top-[15%] z-10">
        <Kicker>POINT-BY-POINT MATCH TRACKING</Kicker>
      </div>
      <motion.div
        className="absolute left-[8%] top-[27%] z-10 max-w-[58%]"
        initial={{ opacity: 0, y: 34, clipPath: 'inset(0 0 100% 0)' }}
        animate={{ opacity: 1, y: 0, clipPath: 'inset(0 0 0% 0)' }}
        transition={{ delay: 0.12, duration: 0.68, ease }}
      >
        <div className="font-display text-[16vmin] font-extrabold uppercase leading-[.76] tracking-[-.045em]">Every<br />point.</div>
        <motion.div
          className="mt-[2.2vmin] font-display text-[8.5vmin] font-bold uppercase leading-none text-[#c8ed32]"
          initial={{ opacity: 0, x: -28 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.78, duration: 0.52, ease }}
        >
          Has a story.
        </motion.div>
      </motion.div>
      <motion.div
        className="absolute bottom-[12%] left-[8%] flex items-center gap-[1.3vmin]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.42, duration: 0.4 }}
      >
        <span className="h-[1vmin] w-[1vmin] rounded-full bg-[#e66d47]" />
        <span className="scene-small text-[#d0d9ce]">ON-DEVICE · NO ACCOUNT · NO UPLOAD</span>
      </motion.div>
      <motion.div
        className="absolute left-[56%] top-[46%] z-20 flex h-[8vmin] w-[8vmin] items-center justify-center rounded-full border-[.25vmin] border-[#f4f0df]/60 bg-[#0e291d]/80 font-mono text-[2.2vmin] font-bold text-[#f4f0df]"
        initial={{ x: '15vw', y: '10vh', scale: 0, rotate: -35 }}
        animate={{ x: ['15vw', 0, 0], y: ['10vh', 0, 0], scale: [0, 1.12, 1], rotate: [-35, 8, 0] }}
        transition={{ duration: 1.05, delay: 0.6, ease }}
      >
        15
      </motion.div>
      <motion.div
        className="absolute right-[22%] top-[28%] text-[2.1vmin] font-mono font-bold tracking-[.12em] text-[#e66d47]"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: [0, 1, 1, 0], y: [14, 0, 0, -8] }}
        transition={{ duration: 2.8, times: [0, .2, .78, 1], delay: 1.45 }}
      >
        +1 POINT
      </motion.div>
    </SceneBase>
  );
}

function PlayerHomeCard() {
  return (
    <div className="rounded-[1.3vmin] border border-[#d9dfd1] bg-[#fffdf4] p-[1.6vmin]">
      <div className="ui-label">MAIN TRACKED PLAYER</div>
      <div className="mt-[.85vmin] flex items-center gap-[1vmin]">
        <div className="flex h-[4.8vmin] w-[4.8vmin] items-center justify-center rounded-full bg-[#e6f0d0] font-display text-[2.4vmin] font-bold text-[#355a26]">MC</div>
        <div className="min-w-0 flex-1">
          <div className="ui-value">Maya Chen</div>
          <div className="ui-tiny mt-[.3vmin]">Saved on this device</div>
        </div>
        <span className="ui-pill bg-[#e9f2d3] text-[#385823]">SWITCH</span>
      </div>
    </div>
  );
}

function MatchSetupCard() {
  return (
    <div className="rounded-[1.5vmin] border border-[#d9dfd1] bg-[#fffdf4] p-[1.7vmin]">
      <div className="mb-[1.3vmin] flex items-center justify-between">
        <div className="font-display text-[2.5vmin] font-bold text-[#173322]">New score sheet</div>
        <span className="ui-tiny">TODAY · SET 1</span>
      </div>
      <div className="grid grid-cols-2 gap-[.9vmin]">
        <div className="ui-field"><div className="ui-label">TRACKED PLAYER</div><div className="ui-value mt-[.55vmin]">Maya Chen</div></div>
        <div className="ui-field"><div className="ui-label">OPPONENT</div><div className="ui-value mt-[.55vmin]">Alex Rivera</div></div>
      </div>
      <div className="mt-[1vmin]">
        <div className="ui-label">COURT SURFACE</div>
        <div className="mt-[.6vmin] flex gap-[.6vmin]">
          {['Hard', 'Clay', 'Grass'].map((surface) => <span key={surface} className={`ui-pill ${surface === 'Hard' ? 'bg-[#183c29] text-[#f4f0df]' : 'border border-[#d9dfd1] text-[#526757]'}`}>{surface.toUpperCase()}</span>)}
        </div>
      </div>
      <div className="mt-[1.15vmin] flex items-center justify-between rounded-[.9vmin] bg-[#edf1e3] px-[1vmin] py-[.9vmin]">
        <div><div className="ui-label">FIRST SERVER</div><div className="ui-value mt-[.35vmin]">Maya Chen</div></div>
        <span className="flex h-[2.2vmin] w-[2.2vmin] items-center justify-center rounded-full border-[.2vmin] border-[#608229]"><i className="h-[1vmin] w-[1vmin] rounded-full bg-[#608229]" /></span>
      </div>
      <div className="mt-[1.2vmin] rounded-[.9vmin] bg-[#163d29] px-[1.2vmin] py-[1.05vmin] text-center font-body text-[1.55vmin] font-bold text-[#f4f0df]">Open live score&nbsp; →</div>
    </div>
  );
}

export function SetupScene() {
  return (
    <SceneBase>
      <div className="absolute inset-0">
        <div className="absolute right-[4%] top-[10%] h-[80%] w-[38%] border-l-[.18vmin] border-[#c8ed32]/60" />
        <div className="absolute right-[10%] top-[10%] h-[80%] w-[26%] border-x-[.18vmin] border-[#c8ed32]/45" />
        <div className="absolute right-[4%] top-1/2 h-[.18vmin] w-[38%] bg-[#c8ed32]/50" />
        <div className="absolute right-[17%] top-[29%] h-[42%] w-[12%] border-[.18vmin] border-[#c8ed32]/45" />
      </div>
      <div className="absolute left-[7%] top-[14%] z-10 max-w-[38%]">
        <Kicker>01 / SET THE SCENE</Kicker>
        <motion.h2 className="mt-[2vmin] font-display text-[9vmin] font-bold uppercase leading-[.88] tracking-[-.025em]" initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .55, ease }}>
          Start with<br /><span className="text-[#c8ed32]">your player.</span>
        </motion.h2>
        <motion.p className="scene-copy mt-[2vmin] max-w-[36vmin] text-[#b4c4b7]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .55, duration: .45 }}>
          Pick your main tracked player, then set the court and first server.
        </motion.p>
        <motion.div className="mt-[2.2vmin] flex items-center gap-[1vmin]" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.05, duration: .35 }}>
          <span className="rounded-full bg-[#c8ed32] px-[1.1vmin] py-[.55vmin] font-mono text-[1.25vmin] font-bold text-[#102a1d]">SAVED PLAYERS</span>
          <span className="font-mono text-[1.6vmin] text-[#b4c4b7]">03</span>
        </motion.div>
      </div>
      <motion.div
        className="phone-shell absolute right-[10%] top-[8%] z-10 h-[84%] w-[32%] p-[.8vmin]"
        initial={{ opacity: 0, y: 70, rotate: 2.5, scale: .94 }}
        animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
        transition={{ delay: .18, duration: .72, ease }}
      >
        <div className="phone-screen h-full p-[2.5vmin]">
          <div className="flex h-full flex-col gap-[1.3vmin]">
            <div className="flex items-center gap-[.8vmin]">
              <div className="h-[2.2vmin] w-[2.2vmin] rounded-full bg-[#c8ed32]" />
              <span className="font-display text-[2.1vmin] font-bold text-[#173322]">TennisScoring</span>
            </div>
            <div><div className="ui-label">PLAYER DEVELOPMENT</div><div className="mt-[.5vmin] font-display text-[4.2vmin] font-bold leading-[.9] text-[#173322]">Every point<br />has a story.</div></div>
            <div className="rounded-[1vmin] bg-[#183c29] px-[1.5vmin] py-[1vmin] font-body text-[1.65vmin] font-bold text-white">+ &nbsp; Start a match</div>
            <PlayerHomeCard />
            <MatchSetupCard />
          </div>
        </div>
      </motion.div>
      <motion.div className="absolute bottom-[9%] left-[7%] flex items-center gap-[1.1vmin] text-[#d5ded2]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.55 }}>
        <span className="h-[.2vmin] w-[5vmin] bg-[#e66d47]" />
        <span className="scene-small">NAMES · DATE · COURT · SERVER</span>
      </motion.div>
    </SceneBase>
  );
}

function ScorePanel({ count }: { count: number }) {
  const score = count % 3 === 0 ? ['30', '15'] : count % 3 === 1 ? ['40', '15'] : ['40', '30'];
  return (
    <div className="relative w-[71%] overflow-hidden rounded-[2vmin] border border-white/15 bg-[#173a29] px-[4vmin] py-[3vmin]">
      <div className="absolute inset-y-0 left-1/2 w-[.16vmin] bg-white/10" />
      <div className="mb-[2vmin] flex justify-between">
        <div><div className="scene-small text-[#c8ed32]">TRACKED PLAYER</div><div className="mt-[.6vmin] font-body text-[2.6vmin] font-semibold">Maya Chen</div></div>
        <div className="text-right"><div className="scene-small text-[#e66d47]">OPPONENT</div><div className="mt-[.6vmin] font-body text-[2.6vmin] font-semibold">Alex Rivera</div></div>
      </div>
      <div className="flex items-center justify-between">
        {score.map((value, i) => <motion.div key={`${count}-${i}`} className={`score-number ${i === 0 ? 'text-[#c8ed32]' : 'text-[#f4f0df]'}`} initial={{ y: 18, opacity: .3 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: .28, ease }}>{value}</motion.div>)}
      </div>
      <div className="mt-[2.5vmin] flex items-center justify-between border-t border-white/15 pt-[1.5vmin]">
        <span className="scene-small text-white/55">SET 1 · GAME 4 · 1ST SERVE</span>
        <span className="ui-pill bg-[#c8ed32] text-[#102a1d]">LIVE</span>
      </div>
    </div>
  );
}

export function PointScene() {
  const [pointCount, setPointCount] = useState(0);
  useSceneTimer([
    { time: 950, callback: () => setPointCount(1) },
    { time: 2350, callback: () => setPointCount(2) },
    { time: 3900, callback: () => setPointCount(3) },
  ]);
  return (
    <SceneBase>
      <div className="absolute inset-0 court-grid opacity-20" />
      <div className="absolute left-1/2 top-0 h-full w-[.15vmin] bg-white/10" />
      <div className="absolute left-[6%] top-[12%]"><Kicker>02 / RECORD THE RALLY</Kicker></div>
      <motion.div className="absolute left-[6%] top-[25%] z-10 w-[74%]" initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .6, ease }}>
        <ScorePanel count={pointCount} />
        <div className="mt-[1.2vmin] flex w-[71%] gap-[1vmin]">
          <motion.div className="flex-1 rounded-[1.2vmin] bg-[#c8ed32] px-[1.5vmin] py-[1.25vmin] text-[#102a1d]" animate={{ scale: pointCount === 2 ? [1, 1.035, 1] : 1 }} transition={{ duration: .35 }}>
            <div className="ui-label text-[#466324]">POINT WINNER</div>
            <div className="mt-[.5vmin] font-display text-[2.75vmin] font-bold uppercase">Maya won</div>
          </motion.div>
          <div className="flex-1 rounded-[1.2vmin] border border-white/20 bg-[#142f22] px-[1.5vmin] py-[1.25vmin]">
            <div className="ui-label text-white/50">OR TAP</div>
            <div className="mt-[.5vmin] font-display text-[2.75vmin] font-bold uppercase">Alex won</div>
          </div>
        </div>
      </motion.div>
      <motion.div className="absolute right-[7%] top-[28%] w-[17%]" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .42, duration: .48, ease }}>
        <div className="scene-small text-[#d5ded2]">OPTIONAL CONTEXT</div>
        <div className="mt-[1.2vmin] border-l-[.24vmin] border-[#e66d47] pl-[1.2vmin]">
          <div className="mb-[1.3vmin] text-[1.7vmin] font-semibold">1st serve fault</div>
          <div className="paper-rule mb-[1.2vmin]" />
          <div className="mb-[1.3vmin] text-[1.7vmin] font-semibold">Cross-court</div>
          <div className="paper-rule mb-[1.2vmin]" />
          <div className="text-[1.7vmin] font-semibold">Rally · 7–9 shots</div>
        </div>
      </motion.div>
      <motion.div className="absolute bottom-[12%] left-[6%] right-[7%] h-[.24vmin] origin-left bg-[#c8ed32]" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: .7, duration: 1.2, ease }} />
      <div className="absolute bottom-[8%] left-[6%] scene-small text-white/55">TAP THE WINNER · ADD DETAILS WHEN THEY MATTER</div>
      <motion.div className="absolute bottom-[7%] right-[7%] h-[1.5vmin] w-[1.5vmin] rounded-full bg-[#e66d47]" animate={{ x: [0, 18, 0], scale: [1, 1.4, 1] }} transition={{ delay: 1.6, duration: 1.1, ease }} />
    </SceneBase>
  );
}

export function SetsNotesScene() {
  const [noteIndex, setNoteIndex] = useState(0);
  useSceneTimer([
    { time: 1800, callback: () => setNoteIndex(1) },
    { time: 2900, callback: () => setNoteIndex(2) },
  ]);
  const notes = ['What worked?', 'Opponent pattern', 'Next-match adjustment'];
  return (
    <SceneBase light>
      <div className="absolute -left-[18vmin] -top-[25vmin] h-[75vmin] w-[75vmin] rounded-full border border-[#193b2a]/10" />
      <div className="absolute right-[8%] top-[13%]"><Kicker color="#65842d">03 / SETS + NOTES</Kicker></div>
      <div className="absolute left-[8%] top-[15%] w-[39%]">
        <div className="font-display text-[9vmin] font-bold uppercase leading-[.85] tracking-[-.03em]">The whole<br /><span className="text-[#64882b]">match.</span></div>
        <p className="scene-copy mt-[2vmin] max-w-[33vmin] text-[#59705f]">Carry the score into the next set—and keep your own read on the match.</p>
      </div>
      <motion.div className="absolute left-[46%] top-[11%] h-[78%] w-[.2vmin] bg-[#9faa92]" initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: .65, ease }} />
      <motion.div className="absolute left-[51%] top-[15%] w-[40%]" initial={{ opacity: 0, x: 35, rotate: 1.5 }} animate={{ opacity: 1, x: 0, rotate: 0 }} transition={{ delay: .16, duration: .62, ease }}>
        <div className="scene-small text-[#718274]">MATCH BOOK / SAMPLE SCORE</div>
        {[
          { no: '01', label: 'SET 1', score: '6–4' },
          { no: '02', label: 'SET 2', score: '4–6' },
        ].map((row, index) => (
          <motion.div key={row.no} className="mt-[1.1vmin] flex items-center gap-[1.3vmin] border-b border-[#102a1d]/15 pb-[1vmin]" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .35 + index * .2, duration: .36 }}>
            <span className="font-mono text-[1.45vmin] text-[#809082]">{row.no}</span><span className="flex-1 font-mono text-[1.55vmin] font-bold tracking-[.08em]">{row.label}</span><span className="font-display text-[4vmin] font-bold">{row.score}</span>
          </motion.div>
        ))}
        <motion.div className="mt-[1.1vmin] flex items-center gap-[1.3vmin] rounded-[1.1vmin] bg-[#e66d47] px-[1.4vmin] py-[1vmin] text-[#fff9ed]" initial={{ opacity: 0, rotateX: 70, y: 15 }} animate={{ opacity: 1, rotateX: 0, y: 0 }} transition={{ delay: .9, duration: .55, ease }}>
          <span className="font-mono text-[1.35vmin] font-bold">03</span><span className="flex-1 font-mono text-[1.35vmin] font-bold tracking-[.08em]">MATCH TIEBREAK</span><span className="font-display text-[3.4vmin] font-bold">10–8</span>
        </motion.div>
        <div className="mt-[1.3vmin] flex items-center justify-between">
          <span className="ui-pill border border-[#c8d0c0] text-[#38523d]">ADD ANOTHER SET +</span>
          <span className="ui-tiny">REVIEW EACH SET</span>
        </div>
      </motion.div>
      <div className="absolute bottom-[13%] left-[8%] w-[34%]">
        <div className="scene-small text-[#718274]">AFTER THE CHANGEOVER</div>
        <div className="mt-[1.3vmin] min-h-[6vmin]">
          <AnimatePresence mode="wait">
            <motion.div key={noteIndex} className="font-display text-[4.3vmin] font-bold leading-none text-[#183b29]" initial={{ opacity: 0, y: 15, rotate: -1 }} animate={{ opacity: 1, y: 0, rotate: 0 }} exit={{ opacity: 0, y: -13 }} transition={{ duration: .32, ease }}>{notes[noteIndex]}</motion.div>
          </AnimatePresence>
        </div>
        <motion.div className="mt-[1.2vmin] h-[.16vmin] origin-left bg-[#e66d47]" initial={{ scaleX: 0 }} animate={{ scaleX: [0, 1, 1] }} transition={{ delay: 1.15, duration: 3.2, times: [0, .35, 1] }} />
      </div>
      <motion.div className="absolute bottom-[10%] right-[9%] text-right font-mono text-[1.3vmin] uppercase tracking-[.13em] text-[#718274]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.1 }}>A scorebook that<br />remembers the context.</motion.div>
    </SceneBase>
  );
}

function TrendChart() {
  return (
    <svg viewBox="0 0 760 410" className="h-full w-full overflow-visible">
      <g stroke="#54705d" strokeOpacity=".28" strokeWidth="2">
        <path d="M36 70H720M36 170H720M36 270H720M36 370H720" />
        <path d="M36 55V370M205 55V370M374 55V370M543 55V370M712 55V370" />
      </g>
      <motion.path d="M38 310 C120 280 126 225 218 240 S340 210 393 174 S520 188 560 123 S665 112 716 70" fill="none" stroke={citron} strokeWidth="8" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: .25, duration: 1.7, ease: 'easeInOut' }} />
      <motion.path d="M38 344 C112 316 153 284 218 290 S331 265 393 238 S510 245 560 205 S660 190 716 169" fill="none" stroke={clay} strokeWidth="5" strokeLinecap="round" strokeDasharray="7 13" initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: .9 }} transition={{ delay: 1.6, duration: 1.3, ease: 'easeInOut' }} />
      {[['38','310'], ['218','240'], ['393','174'], ['560','123'], ['716','70']].map(([cx, cy], i) => <motion.circle key={cx} cx={cx} cy={cy} r="10" fill={citron} stroke={ink} strokeWidth="5" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: .5 + i * .2, type: 'spring', stiffness: 280, damping: 18 }} />)}
    </svg>
  );
}

export function DevelopmentScene() {
  return (
    <SceneBase>
      <div className="absolute left-[6%] top-[12%]"><Kicker>04 / LEARN FROM THE RECORD</Kicker></div>
      <div className="absolute left-[6%] top-[23%]">
        <div className="font-display text-[8vmin] font-bold uppercase leading-[.84]">Look back.<br /><span className="text-[#c8ed32]">Get better.</span></div>
      </div>
      <motion.div className="absolute left-[5%] top-[49%] w-[59%]" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .18, duration: .5, ease }}>
        <div className="mb-[1vmin] flex items-center justify-between">
          <div className="scene-small text-white/75">POINTS WON BY MATCH</div>
          <div className="scene-small text-[#a8bca9]">ILLUSTRATIVE SAMPLE</div>
        </div>
        <div className="h-[28vmin]"><TrendChart /></div>
        <div className="mt-[.8vmin] flex justify-between scene-small text-white/45"><span>MATCH 01</span><span>MATCH 02</span><span>MATCH 03</span><span>MORE RECORDED MATCHES →</span></div>
      </motion.div>
      <motion.div className="absolute right-[7%] top-[27%] w-[24%]" initial={{ opacity: 0, x: 26 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .55, duration: .52, ease }}>
        <div className="scene-small text-[#c8ed32]">PLAYER DEVELOPMENT</div>
        <div className="mt-[1vmin] border-y border-white/20 py-[1.5vmin]">
          <div className="flex justify-between font-display text-[3.2vmin] font-bold"><span>Serve</span><span className="text-[#c8ed32]">01</span></div>
          <div className="paper-rule my-[1vmin]" />
          <div className="flex justify-between font-display text-[3.2vmin] font-bold"><span>Return</span><span className="text-[#c8ed32]">02</span></div>
          <div className="paper-rule my-[1vmin]" />
          <div className="flex justify-between font-display text-[3.2vmin] font-bold"><span>Rally</span><span className="text-[#c8ed32]">03</span></div>
        </div>
        <motion.div className="mt-[2vmin] rounded-[1.3vmin] border border-[#e66d47]/70 bg-[#e66d47]/10 p-[1.5vmin]" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.45, duration: .4 }}>
          <div className="scene-small text-[#f09170]">HEAD-TO-HEAD</div>
          <div className="mt-[.7vmin] font-body text-[1.9vmin] font-semibold">Compare recorded<br />meetings with an opponent.</div>
        </motion.div>
      </motion.div>
      <motion.div className="absolute bottom-[8%] left-[5%] right-[6%] origin-left border-t border-[#c8ed32]/60" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 2.7, duration: 1.45, ease }} />
      <motion.div className="absolute bottom-[5.5%] right-[6%] h-[4vmin] w-[5vmin] rounded-[1vmin] border-[.28vmin] border-[#c8ed32]" initial={{ opacity: 0, scale: .65 }} animate={{ opacity: 1, scale: [0.65, 1.12, 1] }} transition={{ delay: 4.25, duration: .55, ease }} />
    </SceneBase>
  );
}

export function BackupScene() {
  return (
    <SceneBase light>
      <div className="absolute -right-[12vmin] -top-[20vmin] h-[76vmin] w-[76vmin] rounded-full border-[.15vmin] border-[#102a1d]/10" />
      <div className="absolute -right-[6vmin] -top-[14vmin] h-[64vmin] w-[64vmin] rounded-full border-[.15vmin] border-[#102a1d]/10" />
      <div className="absolute left-[8%] top-[14%]">
        <Kicker color="#64842d">LOCAL BY DESIGN</Kicker>
      </div>
      <motion.div className="absolute left-[8%] top-[25%] z-10" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .5, ease }}>
        <div className="font-display text-[8vmin] font-bold uppercase leading-[.83] tracking-[-.025em]">Your match<br />history.</div>
        <motion.div className="mt-[1.1vmin] font-display text-[9.5vmin] font-extrabold uppercase leading-[.88] text-[#63872b]" initial={{ opacity: 0, x: -18 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .35, duration: .48, ease }}>Stays here.</motion.div>
        <div className="mt-[2vmin] max-w-[37vmin] font-body text-[2.3vmin] leading-[1.35] text-[#586d5c]">No account. No upload.<br />Your data stays on this device.</div>
      </motion.div>
      <motion.div
        className="absolute right-[14%] top-[18%] z-10 flex h-[54vmin] w-[35vmin] flex-col items-center justify-center rounded-[4vmin] border-[.35vmin] border-[#d6dcc8] bg-[#183c29] px-[2.2vmin] text-center text-[#f4f0df]"
        initial={{ opacity: 0, scale: .84, rotate: 4 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ delay: .28, duration: .72, ease }}
      >
        <div className="relative flex h-[16vmin] w-[16vmin] items-center justify-center rounded-full border-[.25vmin] border-[#c8ed32]/60">
          <div className="absolute inset-[1.5vmin] rounded-full bg-[#c8ed32]/10" />
          <svg viewBox="0 0 70 70" className="relative h-[7vmin] w-[7vmin]" aria-hidden="true"><path d="M22 8h-8a6 6 0 0 0-6 6v8m48-14h8a6 6 0 0 1 6 6v8M8 48v8a6 6 0 0 0 6 6h8m40-14v8a6 6 0 0 1-6 6h-8" fill="none" stroke={citron} strokeWidth="4" strokeLinecap="round"/><path d="M22 35c0-10 7-17 13-17s13 7 13 17-7 17-13 17-13-7-13-17z" fill="none" stroke={chalk} strokeWidth="3"/><path d="M27 22c7 5 10 21 16 26M43 22c-7 5-10 21-16 26" fill="none" stroke={chalk} strokeWidth="2"/></svg>
        </div>
        <div className="mt-[2vmin] scene-small text-[#c8ed32]">ON THIS DEVICE</div>
        <div className="mt-[1vmin] font-display text-[4.5vmin] font-bold uppercase leading-[.9]">Your match<br />book, backed up.</div>
        <div className="mt-[1.6vmin] font-body text-[1.6vmin] leading-[1.3] text-[#d2dbd0]">Save · Share · Restore</div>
      </motion.div>
      <motion.div className="absolute bottom-[11%] left-[8%] flex items-center gap-[1.2vmin]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.25 }}>
        <span className="h-[.22vmin] w-[5.5vmin] bg-[#e66d47]" />
        <span className="scene-small text-[#617464]">TENNISSCORING</span>
      </motion.div>
      <motion.div className="absolute bottom-[8%] right-[14%] font-display text-[3.3vmin] font-bold text-[#173322]" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.1, duration: .38 }}>Every point, remembered.</motion.div>
      <motion.div className="absolute right-[31%] top-[33%] z-20 h-[.45vmin] w-[.45vmin] rounded-full bg-[#c8ed32]" initial={{ scale: 0 }} animate={{ scale: [0, 1.5, 0] }} transition={{ delay: 3.85, duration: .65 }} />
      <motion.div className="absolute -right-[3vmin] -top-[10vmin] z-30 h-[40vmin] w-[40vmin] rounded-full border-[3vmin] border-[#c8ed32]" initial={{ scale: .03, opacity: 0, x: '-12vw', y: '14vh' }} animate={{ scale: [0.03, .03, 1.7], opacity: [0, 0, 1], x: ['-12vw', '-12vw', '-40vw'], y: ['14vh', '14vh', '44vh'] }} transition={{ duration: .46, delay: 4.0, ease: 'easeIn' }} />
    </SceneBase>
  );
}
