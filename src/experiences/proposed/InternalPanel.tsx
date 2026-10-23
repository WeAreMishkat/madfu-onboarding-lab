import { useState, type ReactNode } from 'react';
import { ACTIVITIES } from './model/activity';
import { LIMITS, maskMobile } from './model/config';
import { FLAG_LABEL, REASON_LABEL, STATUS_LABEL } from './model/copy';
import { DEMO_SMS_CODE } from './model/mock';
import { BASE_PLANS, OPTIONAL_PLANS, pct, priceFor } from './model/pricing';
import { SCENARIOS, SCENARIO_GROUPS, scenarioById } from './model/scenarios';
import { expireOtp, leaveSession, nafathResult, nextPaidCall, openContinueLink } from './model/state';
import type { CertificatesResult, IbanResult, IdentityState, NafathResult, PersonsResult, Sim } from './model/types';
import { VERIFICATION_LABEL, checkViews } from './model/verifications';
import { useProposed } from './store';

const OPTIONS = {
  identity: [['new', 'New applicant'], ['existing_merchant', 'Existing merchant account'], ['current_application', 'Saved application (same mobile)'], ['duplicate_identity', 'Application under another mobile']] as Array<[IdentityState, string]>,
  crResult: [['found', 'Found'], ['not_found', 'Not found'], ['unavailable', 'Provider unavailable']] as Array<[Sim['cr']['result'], string]>,
  crStatus: [['ACTIVE', 'Active'], ['EXPIRED', 'Expired'], ['SUSPENDED', 'Suspended'], ['VIOLATION', 'Government violation']] as Array<[Sim['cr']['status'], string]>,
  crAge: [['2', '2 months'], ['3', '3 months'], ['6', '6 months'], ['26', '26 months']] as Array<[string, string]>,
  entity: [['SAUDI', 'Saudi entity'], ['NON_SAUDI', 'Non-Saudi (extra documents later)']] as Array<[Sim['cr']['entity'], string]>,
  address: [['VALID', 'Valid'], ['MISSING', 'Missing'], ['EXPIRED', 'Expired']] as Array<[Sim['cr']['nationalAddress'], string]>,
  activity: [['auto', 'Matches declared category'], ...ACTIVITIES.map((a) => [a.code, a.label])] as Array<[string, string]>,
  persons: [['one', '1 person'], ['multiple', 'Several people'], ['none', 'No eligible individual'], ['unavailable', 'Provider unavailable']] as Array<[PersonsResult, string]>,
  nafath: [['verified', 'Verified'], ['rejected', 'Rejected'], ['timeout', 'Timeout'], ['technical', 'Technical failure']] as Array<[NafathResult, string]>,
  certificates: [['one', 'One'], ['multiple', 'Several'], ['none', 'None'], ['unavailable', 'Unavailable'], ['expired', 'One expired'], ['duplicate', 'One already linked'], ['inconsistent', 'Inconsistent'], ['mismatch', 'Activity requires a CR']] as Array<[CertificatesResult, string]>,
  iban: [['verified', 'Verified'], ['mismatch', 'Mismatch'], ['technical', 'Technical error']] as Array<[IbanResult, string]>
};

function Control<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Array<[T, string]>; onChange: (v: T) => void }) {
  return (
    <label className="ip-control">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="ip-group"><h3 className="ip-group-title">{title}</h3>{children}</section>
);

/** Prototype Controls: separate from the merchant UI. Scenarios, simulated answers, internal state and cost. */
export function InternalPanel({ onClose }: { onClose: () => void }) {
  const { state, apply, replace } = useProposed();
  const [tab, setTab] = useState<'scenarios' | 'simulate' | 'internal'>('scenarios');
  const { app, sim, backend } = state;
  const current = scenarioById(state.scenarioId);
  const setSim = (patch: Partial<Sim>) => apply((s) => ({ ...s, sim: { ...s.sim, ...patch } }));
  const setCr = (patch: Partial<Sim['cr']>) => apply((s) => ({ ...s, sim: { ...s.sim, cr: { ...s.sim.cr, ...patch } } }));
  const e = app.eligibility;
  const links = backend.sms.filter((m) => m.kind === 'continue-link').slice().reverse();
  const otpLine = app.sessionMobile ? 'Verified for this session' : app.id ? 'OTP required (new session)' : 'Not verified yet';

  return (
    <aside className="ip" aria-label="Prototype Controls">
      <header className="ip-head">
        <div>
          <p className="ip-eyebrow">Prototype Controls</p>
          <p className="ip-title">Not part of the merchant UI</p>
        </div>
        <button type="button" className="lab-icon-btn" onClick={onClose} aria-label="Hide Prototype Controls">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        </button>
      </header>

      <div className="ip-route">
        <div className="ip-route-row"><span>{app.id ? 'Application' : 'Qualification'}</span><code>{app.id ?? app.qualificationId}</code></div>
        <div className="ip-route-row"><span>Internal status</span><code>{app.status}</code></div>
        <p className="ip-route-label">{STATUS_LABEL[app.status]}</p>
        {e && <div className="ip-route-row"><span>Eligibility</span><code>{e.result} · {e.ruleId}</code></div>}
      </div>

      <div className="ip-tabs" role="tablist" aria-label="Prototype Controls sections">
        {(['scenarios', 'simulate', 'internal'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={`ip-tab ${tab === t ? 'is-active' : ''}`} onClick={() => setTab(t)}>
            {t === 'scenarios' ? 'Scenarios' : t === 'simulate' ? 'Simulate' : 'Internal state'}
          </button>
        ))}
      </div>

      {tab === 'scenarios' && (
        <div className="ip-body" role="tabpanel" aria-label="Scenarios">
          {current && <div className="ip-current"><p className="ip-current-label">{current.label}</p><p className="ip-current-hint">{current.hint}</p></div>}
          {SCENARIO_GROUPS.map((g) => {
            const list = SCENARIOS.filter((s) => s.group === g);
            return (
              <section key={g} className="ip-group">
                <h3 className="ip-group-title">{g} <span>{list.length}</span></h3>
                <div className="ip-scenarios">
                  {list.map((s) => (
                    <button key={s.id} type="button" className={`ip-scenario ${state.scenarioId === s.id ? 'is-active' : ''}`} aria-pressed={state.scenarioId === s.id}
                      onClick={() => replace(s.build())}>
                      <span className="ip-scenario-n">{s.n ?? '+'}</span>{s.label}
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
          <p className="ip-foot">1–60 follow the required scenario list; + marks extra scenarios. Demo SMS code {DEMO_SMS_CODE}.</p>
        </div>
      )}

      {tab === 'simulate' && (
        <div className="ip-body" role="tabpanel" aria-label="Simulate">
          {app.step === 'otp' && (
            <Section title="SMS code">
              <p className="ip-note">Demo code <code className="ip-code">{DEMO_SMS_CODE}</code>. Any other code is incorrect ({LIMITS.otpAttempts} attempts).</p>
              <div className="ip-sim-btns"><button type="button" onClick={() => apply(expireOtp)}>Expire code</button></div>
            </Section>
          )}
          {app.step === 'nafath' && app.nafath.status === 'waiting' && (
            <div className="ip-sim">
              <p className="ip-sim-title">Answer the Nafath request now</p>
              <div className="ip-sim-btns">
                {OPTIONS.nafath.map(([v, l]) => <button key={v} type="button" onClick={() => apply((s) => nafathResult(s, v))}>{l}</button>)}
              </div>
            </div>
          )}
          <Section title="Simulated providers">
            <div className="ip-controls">
              <Control label="Identity check" value={sim.identity} options={OPTIONS.identity} onChange={(v) => setSim({ identity: v })} />
              <Control label="CR retrieval" value={sim.cr.result} options={OPTIONS.crResult} onChange={(v) => setCr({ result: v })} />
              <Control label="CR status" value={sim.cr.status} options={OPTIONS.crStatus} onChange={(v) => setCr({ status: v })} />
              <Control label="CR age" value={String(sim.cr.issuedMonthsAgo)} options={OPTIONS.crAge} onChange={(v) => setCr({ issuedMonthsAgo: Number(v) })} />
              <Control label="Legal entity" value={sim.cr.entity} options={OPTIONS.entity} onChange={(v) => setCr({ entity: v })} />
              <Control label="National Address" value={sim.cr.nationalAddress} options={OPTIONS.address} onChange={(v) => setCr({ nationalAddress: v })} />
              <Control label="Registered activity" value={sim.cr.activity} options={OPTIONS.activity} onChange={(v) => setCr({ activity: v })} />
              <Control label="Authorised people" value={sim.persons} options={OPTIONS.persons} onChange={(v) => setSim({ persons: v })} />
              <Control label="Next Nafath answer" value={sim.nafath[0]} options={OPTIONS.nafath} onChange={(v) => setSim({ nafath: [v] })} />
              <Control label="Freelancer certificates" value={sim.certificates} options={OPTIONS.certificates} onChange={(v) => setSim({ certificates: v })} />
              <Control label="Next IBAN check" value={sim.iban[0]} options={OPTIONS.iban} onChange={(v) => setSim({ iban: [v] })} />
            </div>
            <p className="ip-foot">Changes apply to the next NEW call. Stored results are reused and do not call the provider again.</p>
          </Section>
        </div>
      )}

      {tab === 'internal' && (
        <div className="ip-body" role="tabpanel" aria-label="Internal state">
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
          <Section title="Simulated SMS (Continue links)">
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
