import { useEffect, useState, type ReactNode } from 'react';
import { activityLabel } from './model/activity';
import { COST_ASSUMPTIONS_SAR, HANDOFF_RULES, LIMITS, kindLabel, maskMobile } from './model/config';
import { AUTH_END_LABEL, AUTH_STATUS_LABEL, DELEGATION_LABEL, FLAG_LABEL, REASON_LABEL, RISK_DECISION_LABEL, STATUS_LABEL, customerStatus } from './model/copy';
import { subLabel } from './model/eligibility';
import { eligiblePersons, maskedName } from './model/mock';
import { PAGE_SCENARIOS, pageScenarios, reuseNote } from './model/pageScenarios';
import { pct, priceFor, pricingSub } from './model/pricing';
import { JOURNEY_PRESETS, WORKFLOWS, scenarioById } from './model/scenarios';
import {
  currentVersion, firstIncomplete, handoffAllowance, handoffsInWindow, isFrozen, leaveSession, nextPaidCall, openContinueLink, openSignerLink, reviewerBack,
  reviewerBackTarget, routeFor
} from './model/state';
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
  const signerLinks = backend.sms.filter((m) => m.kind === 'signer-link').slice().reverse();
  const auth = app.authorization;
  const version = currentVersion(app);
  const signerPerson = eligiblePersons(app.persons.list).find((p) => p.id === app.persons.selectedId);
  const cat = app.categoryCheck;
  const cost = knownCost(app);
  const saved = backend.notEligible.find((l) => l.applicationId === app.id);
  const stopReason = app.status === 'NOT_ELIGIBLE' || app.status === 'PAUSED_CR' ? app.outcomeReason : null;
  const merchantSees = app.status === 'NOT_ELIGIBLE' ? `Application submitted → “${customerStatus(app.status).replace('_', ' ').toLowerCase()}”` : null;
  const backTo = reviewerBackTarget(app);

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

      <div className="ip-nav" role="group" aria-label="Reviewer navigation">
        <button type="button" className="ip-back" disabled={!backTo} onClick={() => apply(reviewerBack)}
          title={backTo ? `Show ${PAGE_SCENARIOS[backTo].title} again. Nothing is reset.` : 'Not available here (code screen, edit in progress, or the application has left draft).'}>
          ← Back to previous step
        </button>
        <span className="ip-back-note">Reviewer only · keeps all state{backTo ? ` · ${PAGE_SCENARIOS[backTo].title}` : ''}</span>
      </div>

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
          {WORKFLOWS.map((w, i) => (
            <Section key={w} title={`${i + 1}. ${w}`}>
              <div className="ip-scenarios">
                {JOURNEY_PRESETS.filter((p) => p.workflow === w).map((p) => (
                  <button key={p.id} type="button" className={`ip-scenario ${state.scenarioId === p.id ? 'is-active' : ''}`} title={p.hint} onClick={() => replace(scenarioById(p.id)!.build())}>
                    {p.label}
                  </button>
                ))}
              </div>
            </Section>
          ))}
          <p className="ip-foot">Inside a screen, use This step: it shows only what can happen there.</p>
          <Section title="Signer links received (simulated SMS)">
            {signerLinks.length ? (
              <ul className="ip-sms">
                {signerLinks.map((m) => (
                  <li key={m.token}>
                    <span>To {maskMobile(m.to)} · {m.text}</span>
                    <button type="button" onClick={() => apply((s) => openSignerLink(leaveSession(s), m.token!))}>Open signer link (new session)</button>
                  </li>
                ))}
              </ul>
            ) : <p className="ip-note">None yet. Use “Send to another signer” on the Authorization page.</p>}
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
              <Row k="Session actor">{app.actor === 'signer' ? `signer (secure link V${app.signerSession?.version} · ${app.signerSession?.link})` : 'preparer'}</Row>
              <Row k="Existing record match">{app.existence ?? 'not checked yet'}</Row>
              <Row k="Entered mobile ≠ stored mobile">{app.enteredMobileIgnored ? 'yes — not used; code to the stored mobile only' : 'no'}</Row>
              <Row k="Opens at (lifecycle + authorization)">{app.id ? routeFor(app) : app.step}</Row>
              <Row k="Resume stage (first unfinished)">{app.id && app.status === 'DRAFT' ? firstIncomplete(app) : '—'}</Row>
              <Row k="Eligibility result (internal)">{e ? `${e.result} · ${REASON_LABEL[e.reason]}` : 'not evaluated'}</Row>
              <Row k="Rule version">{e?.ruleset ?? '—'}</Row>
              <Row k="Internal not-eligible / paused reason">{stopReason ? `${stopReason} · ${REASON_LABEL[stopReason]}` : 'none'}</Row>
              <Row k="Merchant sees">{merchantSees ?? (app.outcome ? app.outcome : '—')}</Row>
              <Row k="Captured not-eligible record">{saved ? `saved · ${saved.reason} · team contacts the applicant` : 'no'}</Row>
              <Row k="Next expected step">{nextPaidCall(state)}</Row>
            </dl>
          </Section>
          <Section title="Applicant and mobiles">
            <dl className="ip-dl">
              <Row k="Applicant type">{kindLabel(app.kyb.kind) || '—'}</Row>
              <Row k="IBAN-linked declaration (Freelancer)">{app.identity.prerequisite ?? '—'}</Row>
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
              <Row k="Risk (synthetic)">{app.risk ? `${app.risk.level} · score ${app.risk.score} · ${RISK_DECISION_LABEL[app.risk.decision]} (illustrative)` : 'not calculated'}</Row>
              {app.risk?.factors.map((f) => <Row key={f.factor} k={`  ${f.factor}`}>{f.value} → {f.points}</Row>)}
              <Row k="Freelancer certificate (before Nafath)">{app.kyb.kind === 'FL_CERT' ? `${app.certs.status}${app.categoryCheck?.source === 'CERTIFICATE' ? ' · confirmed' : ''}` : 'n/a'}</Row>
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
          {app.kyb.kind === 'CR' && (
            <Section title="Authorization (CR signer handoff)">
              <dl className="ip-dl">
                <Row k="Mode">{auth.mode ?? 'not chosen'}</Row>
                <Row k="Authorization status">{auth.status} · {AUTH_STATUS_LABEL[auth.status]}</Row>
                <Row k="Authorization version">{version ? `V${version.version} · ${version.status}` : 'none'}</Row>
                <Row k="Signer selected">{auth.mode && signerPerson ? `${maskedName(signerPerson)} · ${signerPerson.idMasked}` : '—'}</Row>
                <Row k="Signer mobile (masked)">{version ? maskMobile(version.signerMobile) : '—'}</Row>
                <Row k="Handoff created / expiry">{version ? `${version.createdAt.slice(0, 10)} → ${version.expiresAt.slice(0, 10)} (${HANDOFF_RULES.expiryDays} days, configurable)` : '—'}</Row>
                <Row k="Handoff attempts in window">{handoffsInWindow(app)} of {handoffAllowance(app)} in {HANDOFF_RULES.windowDays} days{auth.limitReached ? ' · LIMIT REACHED — internal unlock needed' : ''}</Row>
                <Row k="Application frozen">{isFrozen(app) ? `yes, since ${auth.frozenAt!.slice(0, 10)}` : 'no'}</Row>
                <Row k="Delegated signer (Phase 2 demo)">{auth.delegation.type ? `${DELEGATION_LABEL[auth.delegation.type].title} · ${auth.delegation.status} (${DELEGATION_LABEL[auth.delegation.type].review})` : 'none'}</Row>
                <Row k="Final signing status">{app.contract.status === 'accepted' ? `signed ${app.contract.acceptedAt.slice(0, 10)}` : app.contract.status}</Row>
              </dl>
              {auth.versions.length > 0 && (
                <ul className="ip-ledger" aria-label="Authorization audit trail">
                  {auth.versions.map((v) => (
                    <li key={v.version}><span className="k-internal">V{v.version}</span><span>{v.applicationId} · {v.signerName} · {maskMobile(v.signerMobile)} · {v.status}{v.endReason ? ` (${AUTH_END_LABEL[v.endReason]})` : ''} · by {v.initiatedBy}{v.completedAt ? ` · completed ${v.completedAt.slice(0, 10)}` : ''}</span></li>
                  ))}
                </ul>
              )}
            </Section>
          )}
          <Section title="Commercial">
            <dl className="ip-dl">
              <Row k="Priced on">{app.kyb.sub ? `${subLabel(pricingSub(app))} (${cat ? 'verified' : 'declared, provisional'})` : '—'}</Row>
              <Row k="Standard commission">{app.kyb.sub ? pct(priceFor(pricingSub(app)).standard) : '—'}</Row>
              <Row k="Rate review requested">{app.commercial.reviewRequested ? `yes · ${app.commercial.evidence.length} file(s)` : 'no'}</Row>
              <Row k="Offer frozen">{isFrozen(app) ? 'yes (signer reviews it read-only)' : 'no'}</Row>
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
