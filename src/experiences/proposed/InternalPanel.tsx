import { useEffect, useState, type ReactNode } from 'react';
import { activityLabel } from './model/activity';
import { COST_ASSUMPTIONS_SAR, LIMITS, RULE_FLAGS, kindLabel, maskMobile } from './model/config';
import { FLAG_LABEL, REASON_LABEL, STATUS_LABEL } from './model/copy';
import { subLabel } from './model/eligibility';
import { pageScenarios, reuseNote } from './model/pageScenarios';
import { pct, priceFor, pricingSub } from './model/pricing';
import { JOURNEY_PRESETS, scenarioById } from './model/scenarios';
import { leaveSession, nextPaidCall, openContinueLink, routeFor } from './model/state';
import { VERIFICATION_LABEL, checkViews, knownCost } from './model/verifications';
import { useProposed } from './store';

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="ip-group"><h3 className="ip-group-title">{title}</h3>{children}</section>
);
const Row = ({ k, children }: { k: string; children: ReactNode }) => <div><dt>{k}</dt><dd>{children}</dd></div>;
const yes = (b: boolean) => (b ? 'yes' : 'no');

type Tab = 'step' | 'demo' | 'internal';

/**
 * Prototype Controls (not merchant UI), three separate areas:
 * - This step: Page Scenarios — only what can happen on the current screen.
 * - Start demo: full-journey starting points and received Continue links.
 * - Internal view: hidden backend state (lifecycle, routing, category, risk, hard blocks, mobiles,
 *   calls / reuse / invalidation, cost assumptions, ledger).
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
  const cat = app.categoryCheck;
  const cost = knownCost(app);
  const lead = backend.leads.find((l) => l.applicationId === app.id);
  const hardBlock = app.status === 'BLOCKED' || app.status === 'PAUSED_CR' ? app.outcomeReason : null;

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
                    <span>To {maskMobile(m.to)} · {m.text}{backend.tokens[m.token!] ? '' : ' (no longer valid)'}</span>
                    <button type="button" onClick={() => apply((s) => openContinueLink(leaveSession(s), m.token!))}>Open Continue link (new session)</button>
                  </li>
                ))}
              </ul>
            ) : <p className="ip-note">None yet. Use Save &amp; exit on a draft application to send one.</p>}
          </Section>
        </div>
      )}

      {tab === 'internal' && (
        <div className="ip-body" role="tabpanel" aria-label="Internal view">
          <div className="ip-route">
            <div className="ip-route-row"><span>{app.id ? 'Application' : 'Qualification'}</span><code>{app.id ?? app.qualificationId}</code></div>
            <div className="ip-route-row"><span>Lifecycle status</span><code>{app.status}</code></div>
            <p className="ip-route-label">{STATUS_LABEL[app.status]}</p>
          </div>
          <Section title="Routing">
            <dl className="ip-dl">
              <Row k="Existing record match">{app.existence ?? 'not checked yet'}</Row>
              <Row k="Opens at (status-aware)">{app.id ? routeFor(app) : app.step}</Row>
              <Row k="Eligibility (Page 1)">{e ? `${e.result} · ${REASON_LABEL[e.reason]}` : 'not evaluated'}</Row>
              <Row k="Rule version">{e?.ruleset ?? '—'}</Row>
              <Row k="Hard block">{hardBlock ? `${hardBlock} · ${REASON_LABEL[hardBlock]}` : 'none'}</Row>
              <Row k="Sales lead">{lead ? `persisted · ${lead.reason}` : app.status === 'SALES_LEAD' ? 'yes' : 'no'}</Row>
              <Row k="Next expected step">{nextPaidCall(state)}</Row>
            </dl>
          </Section>
          <Section title="Applicant and mobiles">
            <dl className="ip-dl">
              <Row k="Applicant type">{kindLabel(app.kyb.kind) || '—'}</Row>
              <Row k="Prerequisite declaration">{app.identity.prerequisite ?? '—'}</Row>
              <Row k="Stored registered mobile">{app.registeredMobile ? maskMobile(app.registeredMobile) : '—'}</Row>
              <Row k="contact_mobile_verified">{yes(app.contactMobileVerified)}</Row>
              <Row k="authorized_person_mobile_verified">{yes(app.authorizedMobileVerified)} · {app.mobileMatch.checks}/{LIMITS.mobileMatchChecks} checks{app.mobileMatch.status !== 'idle' ? ` · ${app.mobileMatch.status}` : ''}</Row>
              <Row k="Session verified">{yes(app.sessionVerified)}</Row>
            </dl>
          </Section>
          <Section title="Category and risk (backend)">
            <dl className="ip-dl">
              <Row k="Preliminary category">{app.kyb.sub ? subLabel(app.kyb.sub) : '—'}</Row>
              <Row k="Verified mapped category">{cat ? `${subLabel(cat.verifiedSub)} · ${cat.outcome} (${cat.source})` : 'not retrieved yet'}</Row>
              <Row k={cat?.source === 'CERTIFICATE' ? 'Certificate activity' : 'CR activities'}>{cat ? cat.activities.map((a) => activityLabel(a.code)).join(' · ') : app.cr.record ? app.cr.record.activities.map((a) => activityLabel(a.code)).join(' · ') : '—'}</Row>
              <Row k="Risk (synthetic)">{app.risk ? `${app.risk.level} · score ${app.risk.score}` : 'not calculated'}</Row>
              {app.risk?.factors.map((f) => <Row key={f.factor} k={`  ${f.factor}`}>{f.value} → {f.points}</Row>)}
              <Row k="Certificate pre-check">{app.kyb.kind === 'FL_CERT' ? `${app.certs.precheck} (rule flag ${RULE_FLAGS.flCertificatePrecheckBeforeNafath ? 'ON' : 'OFF'})` : 'n/a'}</Row>
              <Row k="Nafath">{app.nafath.status} · requests {app.nafath.requests} · failures {app.nafath.failures}/{LIMITS.nafathAttempts} · technical {app.nafath.technical}/{LIMITS.nafathTechnicalRetries}</Row>
            </dl>
          </Section>
          <Section title="External checks (cost view)">
            <ul className="ip-checks">
              {checkViews(app).map((c) => (
                <li key={c.type} className={`ip-check is-${c.state}`}><strong>{c.label}</strong><span>{c.text}</span></li>
              ))}
              <li className={`ip-check ${app.sessionVerified ? 'is-verified' : 'is-invalidated'}`}><strong>{VERIFICATION_LABEL.OTP}</strong><span>{app.sessionVerified ? 'Verified for this session' : app.id ? 'OTP required (new session)' : 'Not verified yet'}</span></li>
            </ul>
            <p className="ip-foot">Product cost assumptions: {Object.entries(COST_ASSUMPTIONS_SAR).filter(([, v]) => v !== null).map(([k, v]) => `${k} ≈ SAR ${v}`).join(' · ')}. Known spend so far ≈ SAR {cost.sar}{cost.unknown ? ` + ${cost.unknown} call(s) of unknown cost` : ''}.</p>
          </Section>
          <Section title="Commercial">
            <dl className="ip-dl">
              <Row k="Priced on">{app.kyb.sub ? `${subLabel(pricingSub(app))} (${cat ? 'verified' : 'declared, provisional'})` : '—'}</Row>
              <Row k="Standard commission">{app.kyb.sub ? pct(priceFor(pricingSub(app)).standard) : '—'}</Row>
              <Row k="Rate review requested">{app.commercial.reviewRequested ? `yes · ${app.commercial.evidence.length} file(s)` : 'no'}</Row>
              <Row k="Contract">{app.contract.status}</Row>
            </dl>
          </Section>
          <Section title="Internal flags">
            {app.flags.length ? <ul className="ip-flags">{app.flags.map((f) => <li key={f}><code>{f}</code> {FLAG_LABEL[f]}</li>)}</ul> : <p className="ip-note">None.</p>}
          </Section>
          <Section title="Ledger (latest)">
            <ul className="ip-ledger">
              {app.ledger.slice(-16).map((l, i) => <li key={i}><span className={`k-${l.kind}`}>{l.kind}</span><span>{l.note}</span></li>)}
            </ul>
          </Section>
        </div>
      )}
    </aside>
  );
}
