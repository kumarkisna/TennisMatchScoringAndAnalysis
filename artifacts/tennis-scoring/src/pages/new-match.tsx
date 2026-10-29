import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowLeft, ArrowRight, CalendarDays, CircleAlert } from 'lucide-react';
import { useCreateMatch, getListMatchesQueryKey, type MatchInput } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';

const today = new Date().toISOString().slice(0, 10);

export default function NewMatchPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const createMatch = useCreateMatch();
  const [error, setError] = useState('');

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);
    const input: MatchInput = {
      matchDate: String(form.get('matchDate')),
      event: String(form.get('event') || '').trim() || null,
      round: String(form.get('round') || '').trim() || null,
      setNumber: Number(form.get('setNumber')),
      trackedPlayer: String(form.get('trackedPlayer')).trim(),
      opponent: String(form.get('opponent')).trim(),
      chairCoach: String(form.get('chairCoach') || '').trim() || null,
      surface: String(form.get('surface')) as MatchInput['surface'],
      firstServer: String(form.get('firstServer')) as MatchInput['firstServer'],
    };
    createMatch.mutate({ data: input }, {
      onSuccess: async (match) => {
        await queryClient.invalidateQueries({ queryKey: getListMatchesQueryKey() });
        setLocation(`/matches/${match.id}`);
      },
      onError: () => setError('We couldn’t create this scorecard. Check your connection and try again.'),
    });
  }

  return (
    <div className="page" style={{ maxWidth: 850 }}>
      <div className="enter" style={{ marginBottom: 28 }}>
        <Link href="/" className="back-link" data-testid="link-cancel-create"><ArrowLeft size={15} /> Match notebook</Link>
        <div className="eyebrow" style={{ marginTop: 29 }}>New scorecard · Set details</div>
        <h1 className="display-title" style={{ fontSize: 'clamp(40px,7vw,66px)', margin: '12px 0 10px' }}>Before first serve.</h1>
        <p style={{ color: '#737a70', margin: 0 }}>A few match details now. The point-by-point work can wait until the ball is live.</p>
      </div>

      <form onSubmit={submit} className="panel enter delay-1" style={{ padding: 'clamp(20px,4vw,38px)' }}>
        <div className="form-section-head"><span className="form-index">01</span><div><b>Match context</b><small>Where and when this set is happening</small></div></div>
        <div className="form-grid">
          <label className="field">Match date<input data-testid="input-match-date" name="matchDate" type="date" defaultValue={today} required /></label>
          <label className="field">Event or venue <span className="optional">OPTIONAL</span><input data-testid="input-event" name="event" placeholder="e.g. Lakeside Open" /></label>
          <label className="field">Round <span className="optional">OPTIONAL</span><input data-testid="input-round" name="round" placeholder="e.g. Quarter-final" /></label>
          <label className="field">Set number<input data-testid="input-set-number" name="setNumber" type="number" min="1" step="1" defaultValue="1" required /></label>
        </div>
        <div className="form-section-head second"><span className="form-index">02</span><div><b>Players & court</b><small>Choose the player whose patterns you’re tracking</small></div></div>
        <div className="form-grid">
          <label className="field">Tracked player<input data-testid="input-tracked-player" name="trackedPlayer" placeholder="Player name" required autoFocus /></label>
          <label className="field">Opponent<input data-testid="input-opponent" name="opponent" placeholder="Opponent name" required /></label>
          <label className="field">Chair / coach <span className="optional">OPTIONAL</span><input data-testid="input-chair-coach" name="chairCoach" placeholder="Name" /></label>
          <label className="field">Court surface<select data-testid="select-surface" name="surface" defaultValue="Hard"><option value="Hard">Hard</option><option value="Clay">Clay</option><option value="Grass">Grass</option><option value="Carpet">Carpet</option><option value="Other">Other</option></select></label>
        </div>
        <div className="server-select">
          <div><b>Who serves first?</b><small>The service turn alternates automatically as you score.</small></div>
          <div className="server-options">
            <label><input type="radio" name="firstServer" value="tracked" defaultChecked /><span data-testid="option-first-server-tracked">Tracked player</span></label>
            <label><input type="radio" name="firstServer" value="opponent" /><span data-testid="option-first-server-opponent">Opponent</span></label>
          </div>
        </div>
        {error && <div className="form-error" role="alert" data-testid="status-create-error"><CircleAlert size={17} />{error}</div>}
        <div className="form-actions">
          <Link href="/" className="button secondary" data-testid="button-cancel-create">Cancel</Link>
          <button className="button" type="submit" disabled={createMatch.isPending} data-testid="button-create-match">
            {createMatch.isPending ? 'Opening scorecard…' : 'Open scorecard'} <ArrowRight size={16} />
          </button>
        </div>
      </form>
      <div className="create-note"><CalendarDays size={15} /> One scorecard per set. Your points build the match pattern summary.</div>
      <style>{`
        .back-link { display:inline-flex; align-items:center; gap:7px; text-decoration:none; color:#617367; font-size:13px; font-weight:700; }
        .form-section-head { display:flex; align-items:center; gap:13px; padding-bottom:20px; border-bottom:1px solid #ebe7de; }
        .form-section-head.second { margin-top:32px; }
        .form-index { color:#c46245; font:12px var(--app-font-mono); }
        .form-section-head b { display:block; font-family:var(--app-font-serif); font-size:16px; }
        .form-section-head small,.server-select small { display:block; color:#7d8278; font-size:12px; margin-top:3px; }
        .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:20px 18px; padding-top:22px; }
        .optional { font:9px var(--app-font-mono); color:#a0a095; margin-left:4px; }
        .server-select { margin-top:28px; padding:18px; display:flex; justify-content:space-between; align-items:center; gap:16px; background:#f3f1e8; border-radius:10px; }
        .server-select b { font-size:13px; }
        .server-options { display:flex; gap:8px; }
        .server-options label input { position:absolute; opacity:0; }
        .server-options label span { display:block; padding:11px 14px; border:1px solid #d6d1c5; border-radius:8px; color:#56685c; font-size:12px; font-weight:700; cursor:pointer; }
        .server-options label input:checked + span { background:#285743; color:#fbf8ee; border-color:#285743; }
        .server-options label input:focus-visible + span { outline:3px solid #c97758; }
        .form-actions { display:flex; justify-content:flex-end; gap:10px; margin-top:28px; }
        .form-error { display:flex; align-items:center; gap:8px; margin-top:18px; color:#a44839; font-size:13px; }
        .create-note { display:flex; align-items:center; gap:8px; color:#82867c; font-size:12px; margin-top:16px; }
        @media(max-width:620px) { .form-grid { grid-template-columns:1fr; gap:15px; } .server-select { align-items:flex-start; flex-direction:column; } .server-options { width:100%; } .server-options label { flex:1; } .server-options label span { text-align:center; padding:11px 7px; } }
      `}</style>
    </div>
  );
}
