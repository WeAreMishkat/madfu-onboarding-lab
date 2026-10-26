import { useEffect, useState, type ComponentType } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MadfuBusinessLockup } from '@/lab/BrandMarks';
import { useLab, useRegisterRestart } from '@/lab/LabContext';
import { StatusBadge } from '@/lab/StatusBadge';
import { DecisionTables } from './DecisionTables';
import { InternalPanel } from './InternalPanel';
import { MasterBoards } from './MasterBoards';
import { STAGES, maskMobile, stageOf } from './model/config';
import { openContinueLink, sendContinueLink } from './model/state';
import type { StepId } from './model/types';
import { ProposedProvider, useProposed } from './store';
import { BusinessStep } from './steps/BusinessStep';
import { CertificatesStep } from './steps/CertificatesStep';
import { CommercialStep } from './steps/CommercialStep';
import { ContractStep } from './steps/ContractStep';
import { IdentifyStep } from './steps/IdentifyStep';
import { KybStep } from './steps/KybStep';
import { LoginStep } from './steps/LoginStep';
import { NafathStep } from './steps/NafathStep';
import { OtpStep } from './steps/OtpStep';
import { OutcomeStep } from './steps/OutcomeStep';
import { PersonsStep } from './steps/PersonsStep';
import { ReviewStep } from './steps/ReviewStep';
import { StatusStep } from './steps/StatusStep';
import { IconCheck, IconExit, IconHelp } from './ui/icons';
import './proposed.css';

export const STEP_VIEW: Record<StepId, ComponentType> = {
  kyb: KybStep,
  identify: IdentifyStep,
  otp: OtpStep,
  persons: PersonsStep,
  nafath: NafathStep,
  certificates: CertificatesStep,
  business: BusinessStep,
  commercial: CommercialStep,
  review: ReviewStep,
  contract: ContractStep,
  outcome: OutcomeStep,
  status: StatusStep,
  login: LoginStep
};

const PDF_NAME = 'Madfu_Merchant_Onboarding_Wireframes.pdf';
export const SIMPLE_BOARD_PDF = 'Madfu_Proposed_Simple_Master_Board.pdf';
export const DETAILED_BOARD_PDF = 'Madfu_Proposed_Detailed_Master_Board.pdf';
export const pdfHref = (name = PDF_NAME) => `${import.meta.env.BASE_URL}${name}`;

/** Merchant-facing frame: header, progress and the current step. Shared by the app and the PDF. */
export function ProposedFrame() {
  const { state, apply, isStatic } = useProposed();
  const { app } = state;
  const [notice, setNotice] = useState<'saved' | 'help' | null>(null);
  useEffect(() => { setNotice(null); }, [app.step]);
  const View = STEP_VIEW[app.step];
  const finished = app.step === 'outcome';
  // The stepper shows complete only for a real submission. Leads, stops, existing-record codes,
  // Application Progress and login hide it.
  const submitted = app.outcome === 'SUBMITTED' || (app.outcome === 'SUBMITTED_MANUAL' && !!app.commercial.agreed);
  const existingCode = app.step === 'otp' && (app.otp.purpose === 'registered' || app.otp.purpose === 'resume');
  const leadLike = app.eligibility?.result === 'SALES_LEAD' || existingCode || app.step === 'status' || app.step === 'login' || (finished && !submitted);
  const current = finished ? STAGES.length - 1 : STAGES.indexOf(stageOf(app.step));
  const canSave = !!app.id && app.sessionVerified && app.status === 'DRAFT' && !finished;

  const saveAndExit = () => {
    if (isStatic) return setNotice('saved');
    apply(sendContinueLink);
    setNotice('saved');
  };

  return (
    <div className="mb-app">
      <header className="mb-header">
        <div className="mb-header-inner">
          <MadfuBusinessLockup height={22} />
          <nav className="mb-header-actions" aria-label="Application">
            {app.id && app.sessionVerified && <span className="mb-app-chip" title="Your onboarding application. The merchant account is created after approval.">Application {app.id}</span>}
            <button type="button" className="mb-header-btn" onClick={() => setNotice(notice === 'help' ? null : 'help')} aria-expanded={notice === 'help'}>
              <IconHelp size={18} /> <span>Help</span>
            </button>
            {canSave && (
              <button type="button" className="mb-header-btn" onClick={saveAndExit}><IconExit size={18} /> <span>Save &amp; exit</span></button>
            )}
          </nav>
        </div>
      </header>
      <main className="mb-main" id="main">
        {notice && (
          <div className="mb-toast" role="status">
            {notice === 'saved'
              ? <><IconCheck size={16} /> Your application is saved. We sent a Continue Application link to {maskMobile(app.registeredMobile)}. Open it and confirm the code to continue where you left off.</>
              : <>Questions about your application? Contact Madfu Business support. <button type="button" className="mb-toast-close" onClick={() => setNotice(null)}>Close</button></>}
          </div>
        )}
        {!leadLike && (
          <ol className="mb-progress" aria-label={`Progress: stage ${Math.min(current + 1, STAGES.length)} of ${STAGES.length}`}>
            {STAGES.map((s, i) => (
              <li key={s.id} className={i < current || (submitted && i === current) ? 'is-done' : i === current ? 'is-current' : ''} aria-current={i === current ? 'step' : undefined}>
                <span className="mb-progress-mark" aria-hidden="true">{i < current || (submitted && i === current) ? <IconCheck size={13} /> : i + 1}</span>
                <span className="mb-progress-label">{s.short}</span>
              </li>
            ))}
          </ol>
        )}
        <View key={app.step + (state.scenarioId ?? '') + (app.returnTo ?? '')} />
      </main>
    </div>
  );
}

export default function ProposedPage() {
  return (
    <ProposedProvider>
      <ProposedShell />
    </ProposedProvider>
  );
}

type View = 'prototype' | 'boards' | 'rules';

function ProposedShell() {
  const { reset, apply } = useProposed();
  const { internalView, setInternalView } = useLab();
  const [params, setParams] = useSearchParams();
  const raw = params.get('view');
  const view: View = raw === 'boards' || raw === 'maps' ? 'boards' : raw === 'rules' ? 'rules' : 'prototype';
  useRegisterRestart(reset);

  // A Continue Application link: identifies the application; OTP opens it.
  const token = params.get('continue');
  useEffect(() => {
    if (!token) return;
    apply((s) => openContinueLink(s, token));
    setParams({}, { replace: true });
  }, [token, apply, setParams]);

  return (
    <div className="mb-root">
      <div className="fx-lab-strip" aria-label="Lab controls for this experience">
        <div className="fx-lab-strip-left">
          <span className="fx-lab-kind">Future Experience</span>
          <StatusBadge status="PROPOSED" />
          <div className="mb-viewswitch" role="group" aria-label="View">
            {(['prototype', 'boards', 'rules'] as View[]).map((v) => (
              <button key={v} type="button" aria-pressed={view === v} className={view === v ? 'is-on' : ''}
                onClick={() => setParams(v === 'prototype' ? {} : { view: v })}>
                {v === 'prototype' ? 'Prototype' : v === 'boards' ? 'Master boards' : 'Rules & decisions'}
              </button>
            ))}
          </div>
        </div>
        <div className="fx-lab-strip-right">
          <a className="lab-chip-btn" href={pdfHref()} download>Wireframes PDF</a>
          <Link to="/compare?view=madfu" className="lab-chip-btn">Compare with Current</Link>
          {view === 'prototype' && (
            <button type="button" className={`lab-chip-btn ${internalView ? 'is-on' : ''}`} aria-pressed={internalView} onClick={() => setInternalView(!internalView)}>
              Prototype Controls
            </button>
          )}
        </div>
      </div>

      {view === 'prototype' && (
        <p className="mb-proto-hint" role="note">
          <strong>Prototype mode</strong> Use the Prototype Controls beside each screen to simulate that step’s possible states, then continue through the journey.
          {!internalView && <button type="button" onClick={() => setInternalView(true)}>Show controls</button>}
        </p>
      )}
      {view === 'prototype' && (
        <div className="mb-shell">
          <ProposedFrame />
          {internalView && <InternalPanel onClose={() => setInternalView(false)} />}
        </div>
      )}
      {view === 'boards' && (
        <div className="mb-docview">
          <h1 className="mb-doc-h1">Master boards</h1>
          <p className="mb-small mb-muted">Generated from the same model as the prototype. PDFs: <a href={pdfHref(SIMPLE_BOARD_PDF)} download>Master Board</a> · <a href={pdfHref(DETAILED_BOARD_PDF)} download>Detailed Logic Board</a></p>
          <MasterBoards />
        </div>
      )}
      {view === 'rules' && <div className="mb-docview"><h1 className="mb-doc-h1">Rules &amp; decisions</h1><DecisionTables /></div>}
    </div>
  );
}
