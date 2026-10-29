import { Link } from 'wouter';
import { ArrowRight, CalendarDays, CircleAlert, Plus, RefreshCw } from 'lucide-react';
import { useListMatches } from '@workspace/api-client-react';

function formatDate(value: string) {
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export default function HomePage() {
  const { data: matches, isLoading, isError, refetch } = useListMatches();
  const recent = matches ?? [];

  return (
    <div className="page">
      <section className="enter" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24, marginBottom: 42 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 16 }}>Tennis match matrix · 01</div>
          <h1 className="display-title" style={{ fontSize: 'clamp(42px,7vw,76px)', margin: 0 }}>
            Keep the match.<br /><span style={{ color: '#718272' }}>Find the pattern.</span>
          </h1>
          <p style={{ color: '#68756b', fontSize: 15, lineHeight: 1.7, maxWidth: 460, margin: '18px 0 0' }}>
            Point-by-point notes from the sideline, shaped into useful player-development data.
          </p>
        </div>
        <Link href="/matches/new" className="button" data-testid="button-new-match" style={{ flexShrink: 0 }}>
          <Plus size={18} /> New set <ArrowRight size={15} />
        </Link>
      </section>

      <section className="enter delay-1" aria-labelledby="recent-heading">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Your notebook</div>
            <h2 id="recent-heading" style={{ fontFamily: 'var(--app-font-serif)', fontSize: 25, letterSpacing: '-.05em', margin: 0 }}>Recent sets</h2>
          </div>
          <span className="mono" style={{ color: '#7a8178', fontSize: 12 }} data-testid="text-match-count">{recent.length} recorded</span>
        </div>

        {isLoading && (
          <div className="panel" aria-label="Loading recent matches" style={{ padding: 20, display: 'grid', gap: 12 }}>
            {[0, 1, 2].map((item) => <div key={item} className="skeleton" style={{ height: 72 }} />)}
          </div>
        )}
        {isError && (
          <div className="panel" style={{ padding: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <CircleAlert color="#b95742" />
              <div><strong>Couldn’t load match history.</strong><div style={{ color: '#777d74', fontSize: 13, marginTop: 4 }}>Your saved sets are still safe. Try again.</div></div>
            </div>
            <button className="button secondary small" onClick={() => void refetch()} data-testid="button-retry-matches"><RefreshCw size={14} /> Retry</button>
          </div>
        )}
        {!isLoading && !isError && recent.length === 0 && (
          <div className="panel" style={{ padding: '40px 24px', textAlign: 'center' }}>
            <div style={{ width: 54, height: 54, display: 'grid', placeItems: 'center', background: '#e6ece1', color: '#315d47', borderRadius: '50%', margin: '0 auto 17px' }}>
              <CalendarDays size={22} />
            </div>
            <h3 style={{ fontFamily: 'var(--app-font-serif)', fontSize: 22, margin: '0 0 8px' }}>A fresh scorebook.</h3>
            <p style={{ color: '#70796f', margin: '0 auto 22px', maxWidth: 360, lineHeight: 1.6 }}>Start a set and capture the details that a final score alone can’t tell you.</p>
            <Link href="/matches/new" className="button" data-testid="button-empty-new-match"><Plus size={16} /> Start a set</Link>
          </div>
        )}
        {!isLoading && !isError && recent.length > 0 && (
          <div className="panel" style={{ overflow: 'hidden' }}>
            {recent.map((match) => {
              const winnerName = match.winner === 'tracked' ? match.trackedPlayer : match.winner === 'opponent' ? match.opponent : '';
              return (
                <Link href={`/matches/${match.id}`} key={match.id} className="match-history-row" data-testid={`row-match-${match.id}`}>
                  <div className="date-badge"><span>{new Date(`${match.matchDate.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}</span><b>{new Date(`${match.matchDate.slice(0, 10)}T12:00:00`).getDate()}</b></div>
                  <div className="match-summary">
                    <div className="players">{match.trackedPlayer}<span className="versus">vs</span>{match.opponent}</div>
                    <div className="match-subline">{match.event || 'Practice set'} <span>·</span> {match.round || `Set ${match.setNumber}`} <span>·</span> {match.surface}</div>
                  </div>
                  <div className="history-score">
                    <b className="mono">{match.trackedGames}–{match.opponentGames}</b>
                    <span>{winnerName ? `${winnerName} won` : `${match.pointCount} points`}</span>
                  </div>
                  <span className={`status-pill ${match.status === 'complete' ? 'complete' : ''}`}>{match.status === 'complete' ? 'Complete' : 'In play'}</span>
                  <ArrowRight className="row-arrow" size={17} />
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <div className="home-footnote enter delay-2"><span>BUILT FOR THE MOMENT BETWEEN POINTS</span><span>01 — SCORE · 02 — NOTICE · 03 — GROW</span></div>
      <style>{`
        .match-history-row { display:grid; grid-template-columns:48px minmax(0,1fr) 105px 90px 18px; align-items:center; gap:17px; padding:17px 20px; text-decoration:none; color:inherit; border-bottom:1px solid #ebe7de; transition:background .16s ease; }
        .match-history-row:last-child { border-bottom:0; }
        .match-history-row:hover { background:#f3f1e8; }
        .date-badge { width:42px; height:45px; background:#eae8dc; border-radius:8px; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#637266; line-height:1; }
        .date-badge span { font:9px var(--app-font-mono); letter-spacing:.08em; }
        .date-badge b { font:700 17px var(--app-font-mono); margin-top:4px; }
        .players { font-family:var(--app-font-serif); font-weight:700; font-size:16px; letter-spacing:-.03em; }
        .versus { color:#b0aa9e; font:11px var(--app-font-mono); padding:0 9px; }
        .match-subline { color:#7b8178; font-size:12px; margin-top:5px; }
        .match-subline span { color:#c4bfb3; padding:0 4px; }
        .history-score { display:flex; flex-direction:column; gap:4px; }
        .history-score b { font-size:17px; letter-spacing:-.07em; }
        .history-score span { color:#778075; font-size:10px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .row-arrow { color:#98a096; }
        .home-footnote { display:flex; justify-content:space-between; color:#93958a; font:10px var(--app-font-mono); letter-spacing:.08em; margin-top:28px; }
        @media(max-width:680px) { .match-history-row { grid-template-columns:42px minmax(0,1fr) auto 16px; gap:10px; padding:15px 12px; } .history-score { display:none; } .match-history-row .status-pill { font-size:9px; padding:5px 6px; } .home-footnote span:last-child { display:none; } }
        @media(max-width:520px) { .page > section:first-child { align-items:flex-start !important; flex-direction:column; } }
      `}</style>
    </div>
  );
}
