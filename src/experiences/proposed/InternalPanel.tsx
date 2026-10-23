import { useEffect, useState, type ReactNode } from 'react';
import { LIMITS, maskMobile } from './model/config';
import { FLAG_LABEL, REASON_LABEL, STATUS_LABEL } from './model/copy';
import { pageScenarios, reuseNote } from './model/pageScenarios';
import { BASE_PLANS, OPTIONAL_PLANS, pct, priceFor } from './model/pricing';
import { JOURNEY_PRESETS, scenarioById } from './model/scenarios';
import { leaveSession, nextPaidCall, openContinueLink } from './model/state';
import { VERIFICATION_LABEL, checkViews } from './model/verifications';
import { useProposed } from './store';

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="ip-group"><h3 className="ip-group-title">{title}</h3>{children}</section>
);

type Tab = 'step' | 'demo' | 'internal';

/**
 * Prototype Controls (not merchant UI), three separate areas:
 * - This step: Page Scenarios — only what can happen on the current screen.
 * - Start demo: full-journey starting points and received Continue links.
 * - Internal view: hidden backend state (reuse, calls, eligibility, flags, pricing, rule version).
 */
export function InternalPanel({ onClose }: { onClose: () => void }) {
  const { state, apply, replace } = useProposed();
  const [tab, setTab] = useState<Tab>('step');
  const { app, backend } = state;
  // After a Start demo choice (or any navigation), show what can happen on the new screen.
  useEffect(() => { setTab((t) => (t === 'demo' ? 'step' : t)); }, [app.step, state.scenarioId]);
  const { page, groups } = pageScenarios(state);
  const note = reuseNote(state);
  const e = app.eligibility;
  const links = backend.sms.filter((m) => m.kind === 'continue-link').slice().reverse();
  const otpLine = app.sessionMobile ? 'Verified for this session' : app.id ? 'OTP required (new session)' : 'Not verified yet';

  return (
    <aside className="ip" aria-label="Prototype Controls">
      <header className="ip-head">
        <div>
          <p className="ip-eyebrow">Prototype Controls</p>
          <p className="ip-title">For reviewers — not part of the merchant UI</p>
          <span className="ip-reviewer-tag">Prototype only</span>
        </div>
        <button type="button" className="lab-icon-btn" onClick={onClose} aria-label="Hide Prototype Controls">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        </button>
      </header>

      <div className="ip-tabs" role="tablist" aria-label="Prototype Controls sections">
        {(['step', 'demo', 'internal'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={`ip-tab ${tab === t ? 'is-active' : ''}`} onClick={() => setTab(t)}>
            {t === 'step' ? 'This step' : t === 'demo' ? 'Start demo' : 'Internal view'}
          </button>
        ))}
      </div>

      {tab === 'step' && (
        <div className="ip-body" role="tabpanel" aria-label="Page Scenarios">
          <p className="ip-tip"><strong>Prototype tip:</strong> choose a scenario below to simulate the possible outcomes of this step.</p>
          <div className="ip-current">
            <p className="ip-eyebrow">Page Scenarios</p>
            <p className="ip-current-label">{page.title}</p>
            <p className="ip-current-hint">{page.intro}</p>
            {page.integrations.length > 0 && <p className="ip-foot">Simulates: {page.integrations.join(' · ')}</p>}
          </div>
          {note && <p className="ip-next-call" role="status">{note}</p>}
          {groups.map((g) => (
            <section key={g.title} className="ip-group" aria-label={g.title}>
              <h3 className="ip-group-title">{g.title}</h3>
              {g.note && <p className="ip-note">{g.note}</p>}
              <div className="ip-scenarios">
                {g.options.map((o) => {
                  const on = o.current?.(state) ?? false;
                  return (
                    <button key={o.id} type="button" className={`ip-scenario ${on ? 'is-active' : ''}`} aria-pressed={o.current ? on : undefined} onClick={() => apply(o.run)}>
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
          {groups.length === 0 && !note && <p className="ip-note">Nothing to simulate on this screen. Continue in the prototype.</p>}
        </div>
      )}

      {tab === 'demo' && (
        <div className="ip-body" role="tabpanel" aria-label="Start demo">
          <Section title="Journey overview">
            <div className="ip-scenarios">
              {JOURNEY_PRESETS.map((p) => (
                <button key={p.id} type="button" className={`ip-scenario ${state.scenarioId === p.id ? 'is-active' : ''}`} title={p.hint} onClick={() => replace(scenarioById(p.id)!.build())}>
                  {p.label}
                </button>
              ))}
            </div>
            <p className="ip-foot">Inside a screen, use This step: it shows only what can happen there.</p>
          </Section>
          <Section title="Continue links received (simulated SMS)">
            {links.length ? (
              <ul className="ip-sms">
                {links.map((m) => (
                  <li key={m.token}>
                    <span>To {maskMobile(m.to)} · {m.text}</span>
                    <button type="button" onClick={() => apply((s) => openContinueLink(leaveSession(s), m.token!))}>Open Continue link (new session)</button>
                  </li>
                ))}
              </ul>
            ) : <p className="ip-note">None yet. Use Save &amp; exit after the code to send one.</p>}
          </Section>
        </div>
      )}

      {tab === 'internal' && (
        <div className="ip-body" role="tabpanel" aria-label="Internal view">
          <div className="ip-route">
            <div className="ip-route-row"><span>{app.id ? 'Application' : 'Qualification'}</span><code>{app.id ?? app.qualificationId}</code></div>
            <div className="ip-route-row"><span>Internal status</span><code>{app.status}</code></div>
            <p className="ip-route-label">{STATUS_LABEL[app.status]}</p>
          </div>
          <Section title="External checks (cost view)">
            <ul className="ip-checks">
              {checkViews(app).map((c) => (
                <li key={c.type} className={`ip-check is-${c.state}`}><strong>{c.label}</strong><span>{c.text}</span></li>
              ))}
              <li className={`ip-check ${app.sessionMobile ? 'is-verified' : 'is-invalidated'}`}><strong>{VERIFICATION_LABEL.OTP}</strong><span>Session verification: {otpLine}</span></li>
            </ul>
          </Section>
          <Section title="Expected next paid call">
            <p className="ip-next-call">{nextPaidCall(state)}</p>
          </Section>
          <Section title="Application">
            <dl className="ip-dl">
              <div><dt>Screen</dt><dd>{app.step}</dd></div>
              <div><dt>Furthest screen</dt><dd>{app.lastStep}</dd></div>
              <div><dt>Eligibility</dt><dd>{e ? `${e.result} · ${REASON_LABEL[e.reason]}` : 'not evaluated'}</dd></div>
              <div><dt>Rule version</dt><dd>{e?.ruleset ?? '—'}</dd></div>
              <div><dt>KYB linked</dt><dd>{app.kybSnapshot ? `yes · ${app.kybSnapshot.linkedAt.slice(0, 16).replace('T', ' ')}` : 'no (qualification draft)'}</dd></div>
              <div><dt>Resumed</dt><dd>{app.resumed ? 'yes' : 'no'}</dd></div>
              {app.outcomeReason && <div><dt>Outcome reason</dt><dd>{app.outcomeReason}</dd></div>}
              <div><dt>Nafath attempts</dt><dd>{app.nafath.failures}/{LIMITS.nafathAttempts} used</dd></div>
              <div><dt>Contract</dt><dd>{app.contract.status}</dd></div>
            </dl>
          </Section>
          <Section title="Commercial">
            <dl className="ip-dl">
              <div><dt>Pricing tier</dt><dd>Standard (category matrix)</dd></div>
              <div><dt>Standard commission</dt><dd>{app.kyb.sub ? pct(priceFor(app.kyb.sub).standard) : '—'}</dd></div>
              <div><dt>Optional pricing review</dt><dd>{app.commercial.evidence.length ? `requested (${app.commercial.evidence.length} file)` : 'not requested'}</dd></div>
              <div><dt>Tenures</dt><dd>{[...BASE_PLANS, ...OPTIONAL_PLANS.filter((t) => app.commercial.optional.includes(t))].join(' · ')} months</dd></div>
            </dl>
          </Section>
          <Section title="Internal flags">
            {app.flags.length ? <ul className="ip-flags">{app.flags.map((f) => <li key={f}><code>{f}</code> {FLAG_LABEL[f]}</li>)}</ul> : <p className="ip-note">None.</p>}
          </Section>
          <Section title="Ledger (latest)">
            <ul className="ip-ledger">
              {app.ledger.slice(-14).map((l, i) => <li key={i}><span className={`k-${l.kind}`}>{l.kind}</span><span>{l.note}</span></li>)}
            </ul>
          </Section>
        </div>
      )}
    </aside>
  );
}
