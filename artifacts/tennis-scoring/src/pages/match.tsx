import { useState } from 'react';
import { Link, useParams } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetMatchInsightsQueryKey, getGetMatchQueryKey, getListMatchesQueryKey,
  useGetMatch, useGetMatchInsights, useRecordPoint, useUndoLatestPoint,
  type PointInput,
} from '@workspace/api-client-react';
import { ArrowLeft, CircleAlert, CornerDownLeft, RefreshCw, Undo2 } from 'lucide-react';

const endingCodes = [
  ['A', 'Ace'], ['F', 'Forehand winner'], ['B', 'Backhand winner'], ['V', 'Net volley winner'],
  ['O', 'Overhead winner'], ['P', 'Drop shot winner'], ['N', 'Net error'], ['L', 'Long'],
  ['W', 'Wide'], ['D', 'Double fault'], ['FE', 'Forced error'],
] as const;
const codeMap = Object.fromEntries(endingCodes);

function formatDate(value: string) {
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
}

function SkeletonMatch() {
  return <div className="page"><div className="skeleton" style={{ height: 18, width: 140, marginBottom: 26 }} /><div className="skeleton" style={{ height: 160, marginBottom: 18 }} /><div className="skeleton" style={{ height: 360 }} /></div>;
}

export default function MatchPage() {
  const params = useParams<{ id: string }>();
  const id = params.id ?? '';
  const queryClient = useQueryClient();
  const { data: match, isLoading, isError, refetch } = useGetMatch(id, {
    query: { enabled: !!id, queryKey: getGetMatchQueryKey(id) },
  });
  const { data: insights } = useGetMatchInsights(id, {
    query: { enabled: !!id, queryKey: getGetMatchInsightsQueryKey(id) },
  });
  const recordPoint = useRecordPoint();
  const undoPoint = useUndoLatestPoint();
  const [endingCode, setEndingCode] = useState<PointInput['endingCode']>();
  const [firstServeFault, setFirstServeFault] = useState(false);
  const [mutationError, setMutationError] = useState('');

  function refreshRelated() {
    void queryClient.invalidateQueries({ queryKey: getGetMatchQueryKey(id) });
    void queryClient.invalidateQueries({ queryKey: getGetMatchInsightsQueryKey(id) });
    void queryClient.invalidateQueries({ queryKey: getListMatchesQueryKey() });
  }

  function submitPoint(winner: PointInput['winner']) {
    if (!match || match.score.isComplete) return;
    setMutationError('');
    recordPoint.mutate({
      id,
      data: {
        winner,
        ...(endingCode ? { endingCode } : {}),
        firstServeFault,
      },
    }, {
      onSuccess: () => {
        setEndingCode(undefined);
        setFirstServeFault(false);
        refreshRelated();
      },
      onError: () => setMutationError('Point wasn’t saved. Tap to retry after checking your connection.'),
    });
  }

  function undoLatest() {
    setMutationError('');
    undoPoint.mutate({ id }, {
      onSuccess: refreshRelated,
      onError: () => setMutationError('The last point could not be corrected. Please try again.'),
    });
  }

  if (isLoading) return <SkeletonMatch />;
  if (isError || !match) return (
    <div className="page">
      <div className="panel" style={{ padding: 32, maxWidth: 620, margin: '50px auto', textAlign: 'center' }}>
        <CircleAlert color="#b95742" size={28} />
        <h1 className="display-title" style={{ fontSize: 36, margin: '16px 0 8px' }}>Scorecard unavailable.</h1>
        <p style={{ color: '#747b72', marginBottom: 20 }}>We couldn’t retrieve this match. It may be temporarily offline.</p>
        <button className="button" onClick={() => void refetch()} data-testid="button-retry-match"><RefreshCw size={15} /> Try again</button>
        <div style={{ marginTop: 18 }}><Link href="/" className="back-link" data-testid="link-return-notebook">Back to match notebook</Link></div>
      </div>
    </div>
  );

  const score = match.score;
  const serverName = score.nextServer === 'tracked' ? match.trackedPlayer : match.opponent;
  const trackedPoint = score.isTiebreak ? String(score.trackedTiebreakPoints) : score.trackedPoints;
  const opponentPoint = score.isTiebreak ? String(score.opponentTiebreakPoints) : score.opponentPoints;

  return (
    <div className="page match-page">
      <div className="match-heading enter">
        <div>
          <Link href="/" className="back-link" data-testid="link-match-notebook"><ArrowLeft size={15} /> Match notebook</Link>
          <div className="eyebrow" style={{ marginTop: 22 }}>{match.event || 'Match scorecard'} · {match.round || `Set ${match.setNumber}`}</div>
          <h1 className="display-title" style={{ fontSize: 'clamp(34px,5vw,52px)', margin: '8px 0' }}>{match.trackedPlayer}<span style={{ color: '#a9aa9e', fontSize: '.58em', padding: '0 10px' }}>vs</span>{match.opponent}</h1>
          <div className="match-context" data-testid="text-match-metadata">{formatDate(match.matchDate)} <i /> {match.surface} court {match.chairCoach ? <><i /> Chair / coach: {match.chairCoach}</> : null}</div>
        </div>
        <span className={`status-pill ${score.isComplete ? 'complete' : ''}`} data-testid="status-match">{score.isComplete ? 'Set complete' : 'Live scoring'}</span>
      </div>

      <div className="match-layout">
        <div className="primary-column">
          <section className="score-card court-dash enter delay-1" aria-label="Current score">
            <div className="score-inner">
              <div className="score-top"><span className="score-meta">{score.isTiebreak ? 'Tie-break' : 'Set score'} · Set {match.setNumber}</span><span className="score-meta">{score.isComplete ? 'Final' : `Game ${score.trackedGames + score.opponentGames + 1}`}</span></div>
              <div className="score-grid">
                <div className="player-side"><div className="player-label">{match.trackedPlayer}<span className="server-indicator">{score.nextServer === 'tracked' && !score.isComplete ? 'SERVING' : ''}</span></div><div className="score-number" data-testid="score-tracked-games">{score.trackedGames}</div></div>
                <div className="score-grid-divider" />
                <div className="player-side opponent-side"><div className="player-label">{match.opponent}<span className="server-indicator">{score.nextServer === 'opponent' && !score.isComplete ? 'SERVING' : ''}</span></div><div className="score-number" data-testid="score-opponent-games">{score.opponentGames}</div></div>
              </div>
              <div className="divider" />
              <div className="point-score"><span className="score-meta">{score.isTiebreak ? 'TIE-BREAK POINTS' : 'CURRENT POINTS'}</span><b className="mono" data-testid="score-current-points">{trackedPoint}<span>–</span>{opponentPoint}</b></div>
              {!score.isComplete && <div className="serve-note"><span className="serve-dot" /> {serverName} to serve next</div>}
              {score.isComplete && <div className="serve-note">Set winner: {score.winner === 'tracked' ? match.trackedPlayer : match.opponent}</div>}
            </div>
          </section>

          <section className="panel point-entry enter delay-2">
            <div className="entry-head">
              <div><div className="eyebrow">Next point</div><h2>Who won it?</h2></div>
              <button className="button secondary small undo-button" onClick={undoLatest} disabled={!match.points.length || undoPoint.isPending} data-testid="button-undo-point" aria-label="Correct the last point">
                <Undo2 size={15} /> {undoPoint.isPending ? 'Undoing…' : 'Correct last'}
              </button>
            </div>
            <div className="winner-buttons">
              <button className="point-button" onClick={() => submitPoint('tracked')} disabled={score.isComplete || recordPoint.isPending} data-testid="button-point-tracked">
                <span className="winner-name">{match.trackedPlayer}</span><small>POINT WON</small>
              </button>
              <button className="point-button opponent" onClick={() => submitPoint('opponent')} disabled={score.isComplete || recordPoint.isPending} data-testid="button-point-opponent">
                <span className="winner-name">{match.opponent}</span><small>POINT WON</small>
              </button>
            </div>
            <div className="point-options">
              <div className="option-title"><span>How did it end?</span><span className="option-optional">OPTIONAL · TAP TO SELECT</span></div>
              <div className="code-grid">
                <button className="code-chip" aria-pressed={!endingCode} onClick={() => setEndingCode(undefined)} data-testid="code-none">No code</button>
                {endingCodes.map(([code, label]) => (
                  <button key={code} title={label} className="code-chip" aria-pressed={endingCode === code} onClick={() => setEndingCode(code)} data-testid={`code-${code.toLowerCase()}`}>
                    <b>{code}</b><span>{label}</span>
                  </button>
                ))}
              </div>
              <label className="fault-toggle">
                <input type="checkbox" checked={firstServeFault} onChange={(event) => setFirstServeFault(event.target.checked)} disabled={score.isComplete} data-testid="toggle-first-serve-fault" />
                <span className="fault-check" />
                <span><b>First serve fault</b><small>Mark if the first serve missed before this point was won</small></span>
              </label>
            </div>
            {recordPoint.isPending && <div className="saving-note" role="status" data-testid="status-saving-point"><span className="saving-dot" /> Saving point…</div>}
            {score.isComplete && <div className="complete-note" data-testid="status-set-complete">This set is complete. The final score and point log are ready to review.</div>}
            {mutationError && <div className="mutation-error" role="alert" data-testid="status-point-error"><CircleAlert size={16} />{mutationError}</div>}
          </section>

          <section className="panel log-panel enter delay-3">
            <div className="log-head"><div><div className="eyebrow">Point-by-point</div><h2>Match log</h2></div><span className="mono log-count" data-testid="text-point-count">{match.points.length} points</span></div>
            {match.points.length === 0 ? (
              <div className="empty-log" data-testid="empty-point-log"><CornerDownLeft size={18} /><span>First point is up next. Log the winner and the details will appear here.</span></div>
            ) : (
              <div className="point-log-list">
                {[...match.points].reverse().map((point) => {
                  const winnerName = point.winner === 'tracked' ? match.trackedPlayer : match.opponent;
                  const server = point.server === 'tracked' ? match.trackedPlayer : match.opponent;
                  return (
                    <div className="log-row" key={point.id} data-testid={`row-point-${point.sequenceNumber}`}>
                      <span className="point-seq mono">{String(point.sequenceNumber).padStart(2, '0')}</span>
                      <div className="log-description">
                        <b>{winnerName}</b><span> won · {point.isTiebreak ? 'Tie-break' : `Game ${point.gameNumber}`}</span>
                        <small>{server} serving{point.firstServeFault ? ' · 1st serve fault' : ''}</small>
                      </div>
                      <div className="log-code">{point.endingCode ? <><b>{point.endingCode}</b><span>{codeMap[point.endingCode] || 'Point code'}</span></> : <span>—</span>}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <aside className="insights-column">
          <section className="insights-panel panel enter delay-2">
            <div className="eyebrow">Player development</div><h2>Patterns so far</h2>
            {!insights ? <div className="insight-skeleton"><div className="skeleton" /><div className="skeleton" /><div className="skeleton" /></div> : (
              <>
                <div className="metric-pair">
                  <div><b data-testid="insight-tracked-points">{insights.trackedPointsWon}</b><span>{match.trackedPlayer} points</span></div>
                  <div><b data-testid="insight-opponent-points">{insights.opponentPointsWon}</b><span>{match.opponent} points</span></div>
                </div>
                <div className="total-points"><span>Points tracked</span><b className="mono" data-testid="insight-total-points">{insights.pointCount}</b></div>
                <div className="insight-stats">
                  <div><span>Service points won</span><b data-testid="insight-service-points">{insights.servicePointsWon}</b></div>
                  <div><span>Return points won</span><b data-testid="insight-return-points">{insights.returnPointsWon}</b></div>
                  <div><span>First-serve faults</span><b data-testid="insight-first-serve-faults">{insights.firstServeFaults}</b></div>
                </div>
                <div className="code-insights">
                  <div className="code-insights-head"><b>Point endings</b><span>COUNT · TRACKED WON</span></div>
                  {insights.codes.length === 0 ? <p className="no-codes">Codes you record will build a pattern here.</p> : insights.codes.map((item) => (
                    <div className="code-insight-row" key={item.code} data-testid={`insight-code-${item.code.toLowerCase()}`}>
                      <b>{item.code}</b><span>{codeMap[item.code] || 'Other ending'}</span><strong>{item.count}</strong><em>{item.trackedWon} won</em>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
          <div className="courtside-tip"><span className="tip-mark">“</span><p>Every point is a clue. Start with the winner; add a code when you can.</p><small>COURTSIDE NOTE</small></div>
        </aside>
      </div>
      <style>{`
        .match-page { max-width:1200px; }
        .match-heading { display:flex; justify-content:space-between; align-items:flex-end; gap:16px; margin-bottom:26px; }
        .back-link { display:inline-flex; align-items:center; gap:7px; text-decoration:none; color:#617367; font-size:13px; font-weight:700; }
        .match-context { color:#777f74; font-size:12px; }
        .match-context i { display:inline-block; width:3px; height:3px; border-radius:50%; background:#b3ac9f; vertical-align:middle; margin:0 8px; }
        .match-layout { display:grid; grid-template-columns:minmax(0,1.65fr) minmax(265px,.75fr); gap:20px; align-items:start; }
        .primary-column,.insights-column { display:grid; gap:18px; min-width:0; }
        .score-inner { padding:22px 25px 17px; }
        .score-top { display:flex; justify-content:space-between; }
        .score-grid { display:grid; grid-template-columns:1fr 1px 1fr; align-items:center; padding:20px 0; }
        .score-grid-divider { height:94px; background:rgba(240,240,219,.2); }
        .player-side { padding-right:28px; }
        .opponent-side { padding:0 0 0 28px; text-align:right; }
        .player-label { font-size:14px; display:flex; align-items:center; gap:9px; }
        .opponent-side .player-label { justify-content:flex-end; }
        .server-indicator { font:9px var(--app-font-mono); color:#e5b28c; letter-spacing:.08em; }
        .point-score { display:flex; align-items:center; justify-content:space-between; padding-top:14px; }
        .point-score b { font-size:25px; color:#f4eedc; }
        .point-score b span { padding:0 11px; color:#a5b6a6; font-size:14px; }
        .serve-note { display:flex; justify-content:flex-end; align-items:center; gap:7px; font-size:11px; color:#c7d1bf; margin-top:13px; }
        .serve-dot { width:6px; height:6px; border-radius:50%; background:#df9b73; }
        .point-entry { padding:23px; }
        .entry-head,.log-head { display:flex; justify-content:space-between; align-items:center; gap:12px; }
        .entry-head h2,.log-head h2,.insights-panel h2 { font:800 22px var(--app-font-serif); letter-spacing:-.06em; margin:4px 0 0; }
        .winner-buttons { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:20px; }
        .winner-name { display:block; font:800 clamp(16px,2vw,20px) var(--app-font-serif); letter-spacing:-.04em; }
        .point-button small { display:block; font:10px var(--app-font-mono); letter-spacing:.08em; margin-top:7px; color:#718276; }
        .point-button.opponent small { color:#a16b5a; }
        .point-options { border-top:1px solid #ebe7de; margin-top:20px; padding-top:18px; }
        .option-title { display:flex; justify-content:space-between; color:#58665c; font-size:12px; font-weight:700; margin-bottom:10px; }
        .option-optional { color:#a2a195; font:9px var(--app-font-mono); }
        .code-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:7px; }
        .code-chip { padding:6px 4px; display:flex; align-items:center; flex-direction:column; justify-content:center; gap:3px; }
        .code-chip b { font:500 12px var(--app-font-mono); }
        .code-chip span { color:#888a80; font-size:9px; text-align:center; line-height:1.2; }
        .code-chip[aria-pressed=true] span { color:#375d49; }
        .fault-toggle { display:flex; align-items:center; gap:11px; padding-top:17px; cursor:pointer; }
        .fault-toggle input { position:absolute; opacity:0; }
        .fault-check { width:18px; height:18px; border:1px solid #c9c5b9; border-radius:5px; background:#fffef9; flex-shrink:0; }
        .fault-toggle input:checked + .fault-check { background:#315e49; border-color:#315e49; box-shadow:inset 0 0 0 4px #fbfaf5; }
        .fault-toggle input:focus-visible + .fault-check { outline:3px solid #d28a69; }
        .fault-toggle b { display:block; font-size:12px; }
        .fault-toggle small { display:block; color:#85877e; font-size:10px; margin-top:3px; }
        .saving-note,.complete-note,.mutation-error { display:flex; align-items:center; gap:8px; margin-top:13px; font-size:12px; color:#52705b; }
        .saving-dot { width:7px; height:7px; border-radius:50%; background:#d4825e; animation:pulse 1s infinite alternate; }
        @keyframes pulse { to { opacity:.35; } }
        .complete-note { padding:10px 12px; background:#f2eee3; border-radius:7px; }
        .mutation-error { color:#a44839; }
        .log-panel { padding:22px 24px; }
        .log-count { color:#85877d; font-size:11px; }
        .empty-log { display:flex; gap:11px; align-items:center; padding:28px 0 8px; color:#81877d; font-size:13px; line-height:1.6; }
        .empty-log svg { color:#c16c4e; flex:none; }
        .point-seq { color:#a7a397; font-size:11px; }
        .log-description b { font-size:13px; }
        .log-description span { color:#737c72; font-size:12px; }
        .log-description small { display:block; color:#9a9a8f; font-size:10px; margin-top:3px; }
        .log-code { display:flex; flex-direction:column; align-items:flex-end; gap:3px; min-width:62px; }
        .log-code b { color:#315d47; font:500 11px var(--app-font-mono); }
        .log-code span { color:#929287; font-size:9px; }
        .insights-panel { padding:22px; }
        .insights-panel h2 { margin-bottom:19px; }
        .metric-pair { display:grid; grid-template-columns:1fr 1fr; padding:15px; background:#f0eee4; border-radius:9px; }
        .metric-pair > div { display:flex; flex-direction:column; gap:4px; }
        .metric-pair > div + div { border-left:1px solid #dcd8cc; padding-left:15px; }
        .metric-pair b { font:500 27px var(--app-font-mono); letter-spacing:-.07em; color:#315b46; }
        .metric-pair span { color:#777e73; font-size:10px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .total-points { display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #ebe7de; padding:14px 0; color:#737b71; font-size:12px; }
        .total-points b { color:#384c3f; font-size:13px; }
        .insight-stats { display:grid; gap:0; padding:5px 0 11px; }
        .insight-stats div { display:flex; justify-content:space-between; padding:9px 0; font-size:11px; color:#757d73; border-bottom:1px solid #f0ede5; }
        .insight-stats b { color:#354c3d; font:500 12px var(--app-font-mono); }
        .code-insights { border-top:1px solid #e7e3d8; padding-top:16px; }
        .code-insights-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
        .code-insights-head b { font-family:var(--app-font-serif); font-size:14px; }
        .code-insights-head span { color:#99998e; font:8px var(--app-font-mono); }
        .code-insight-row { display:grid; grid-template-columns:27px 1fr 20px 48px; align-items:center; gap:6px; padding:8px 0; border-bottom:1px solid #f0ede5; }
        .code-insight-row > b { font:500 10px var(--app-font-mono); color:#315d47; }
        .code-insight-row > span { font-size:10px; color:#737b71; }
        .code-insight-row strong { text-align:right; font:500 11px var(--app-font-mono); }
        .code-insight-row em { text-align:right; font:9px var(--app-font-mono); color:#929489; font-style:normal; }
        .no-codes { color:#86877c; font-size:11px; line-height:1.5; }
        .insight-skeleton { display:grid; gap:12px; }
        .insight-skeleton .skeleton { height:52px; }
        .courtside-tip { padding:17px 19px; background:#e9e5d9; border-radius:11px; position:relative; }
        .tip-mark { font:40px Georgia,serif; line-height:.8; color:#c16c4e; }
        .courtside-tip p { font:600 14px/1.5 var(--app-font-serif); color:#405548; margin:6px 0 13px; }
        .courtside-tip small { font:9px var(--app-font-mono); color:#88887c; letter-spacing:.1em; }
        @media(max-width:900px) { .match-layout { grid-template-columns:minmax(0,1fr) 260px; gap:14px; } .point-entry { padding:19px; } }
        @media(max-width:760px) { .match-layout { grid-template-columns:1fr; } .insights-column { grid-row:2; } .insights-panel { padding:20px; } .insight-stats { grid-template-columns:repeat(3,1fr); gap:10px; } .insight-stats div { display:block; border:0; } .insight-stats b { display:block; margin-top:5px; } }
        @media(max-width:520px) { .match-heading { align-items:flex-start; flex-direction:column; } .score-inner { padding:18px; } .player-side { padding-right:15px; } .opponent-side { padding-left:15px; } .score-grid-divider { height:80px; } .point-entry,.log-panel { padding:17px; } .winner-buttons { gap:8px; } .point-button { min-height:72px; } .code-grid { grid-template-columns:repeat(3,minmax(0,1fr)); } .undo-button { padding:0 9px !important; } }
      `}</style>
    </div>
  );
}
