import { useEffect, useState, type ComponentType } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MadfuBusinessLockup } from '@/lab/BrandMarks';
import { useLab, useRegisterRestart } from '@/lab/LabContext';
import { StatusBadge } from '@/lab/StatusBadge';
import { DecisionTables } from './DecisionTables';
import { InternalPanel } from './InternalPanel';
import { JourneyMaps } from './JourneyMaps';
import type { StepId } from './model/types';
import { ProposedProvider, useProposed } from './store';
import { BusinessStep } from './steps/BusinessStep';
import { CategoryStep } from './steps/CategoryStep';
import { CertificatesStep, ManualCertificateStep } from './steps/CertificatesStep';
import { ContractStep } from './steps/ContractStep';
import { CrVerifyStep } from './steps/CrVerifyStep';
import { EntryStep } from './steps/EntryStep';
import { NafathStep } from './steps/NafathStep';
import { OtpStep } from './steps/OtpStep';
import { OutcomeStep } from './steps/OutcomeStep';
import { PersonsStep } from './steps/PersonsStep';
import { ReviewStep } from './steps/ReviewStep';
import { IconCheck, IconExit, IconHelp } from './ui/icons';
import './proposed.css';

export const STEP_VIEW: Record<StepId, ComponentType> = {
  entry: EntryStep,
  otp: OtpStep,
  category: CategoryStep,
  'cr-verify': CrVerifyStep,
  persons: PersonsStep,
  nafath: NafathStep,
  certificates: CertificatesStep,
  'manual-certificate': ManualCertificateStep,
  business: BusinessStep,
  review: ReviewStep,
  contract: ContractStep,
  outcome: OutcomeStep
};

const STAGES: Array<{ label: string; steps: StepId[] }> = [
  { label: 'Applicant', steps: ['entry', 'otp'] },
  { label: 'Category', steps: ['category'] },
  { label: 'Verification', steps: ['cr-verify', 'persons', 'nafath', 'certificates', 'manual-certificate'] },
  { label: 'Business details', steps: ['business'] },
  { label: 'Review', steps: ['review'] },
  { label: 'Agreement', steps: ['contract', 'outcome'] }
];

const PDF_NAME = 'Madfu_Merchant_Onboarding_Wireframes.pdf';
export const pdfHref = () => `${import.meta.env.BASE_URL}${PDF_NAME}`;

/** Merchant-facing frame: header, progress and the current step. Shared by the app and the PDF. */
export function ProposedFrame() {
  const { state } = useProposed();
  const { app } = state;
  const [notice, setNotice] = useState<'saved' | 'help' | null>(null);
  useEffect(() => { setNotice(null); }, [app.step]);
  const View = STEP_VIEW[app.step];
  const finished = app.step === 'outcome';
  const current = finished ? STAGES.length : Math.max(0, STAGES.findIndex((s) => s.steps.includes(app.step)));
  const leadLike = finished && app.outcome && !['SUBMITTED', 'MANUAL_VERIFICATION', 'CONTRACT_DECLINED'].includes(app.outcome);
  const hasApplication = !!app.verifiedMobile && !leadLike;

  return (
    <div className="mb-app">
      <header className="mb-header">
        <div className="mb-header-inner">
          <MadfuBusinessLockup height={22} />
          <nav className="mb-header-actions" aria-label="Application">
            {hasApplication && <span className="mb-app-chip" title="Your onboarding application. The merchant account is created after approval.">Application {app.id}</span>}
            <button type="button" className="mb-header-btn" onClick={() => setNotice(notice === 'help' ? null : 'help')} aria-expanded={notice === 'help'}>
              <IconHelp size={18} /> <span>Help</span>
            </button>
            {hasApplication && !finished && (
              <button type="button" className="mb-header-btn" onClick={() => setNotice('saved')}><IconExit size={18} /> <span>Save &amp; exit</span></button>
            )}
          </nav>
        </div>
      </header>
      <main className="mb-main" id="main">
        {notice && (
          <div className="mb-toast" role="status">
            {notice === 'saved'
              ? <><IconCheck size={16} /> Your application is saved. To continue, enter the same details and confirm the code we send to your mobile.</>
              : <>Questions about your application? Contact Madfu Business support. <button type="button" className="mb-toast-close" onClick={() => setNotice(null)}>Close</button></>}
          </div>
        )}
        {!leadLike && (
          <ol className="mb-progress" aria-label={`Progress: step ${Math.min(current + 1, STAGES.length)} of ${STAGES.length}`}>
            {STAGES.map((s, i) => (
              <li key={s.label} className={i < current ? 'is-done' : i === current ? 'is-current' : ''} aria-current={i === current ? 'step' : undefined}>
                <span className="mb-progress-mark" aria-hidden="true">{i < current ? <IconCheck size={13} /> : i + 1}</span>
                <span className="mb-progress-label">{s.label}</span>
              </li>
            ))}
          </ol>
        )}
        <View key={app.step + (state.scenarioId ?? '')} />
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

type View = 'prototype' | 'maps' | 'rules';

function ProposedShell() {
  const { reset } = useProposed();
  const { internalView, setInternalView } = useLab();
  const [params, setParams] = useSearchParams();
  const view: View = params.get('view') === 'maps' ? 'maps' : params.get('view') === 'rules' ? 'rules' : 'prototype';
  useRegisterRestart(reset);

  return (
    <div className="mb-root">
      <div className="fx-lab-strip" aria-label="Lab controls for this experience">
        <div className="fx-lab-strip-left">
          <span className="fx-lab-kind">Future Experience</span>
          <StatusBadge status="PROPOSED" />
          <div className="mb-viewswitch" role="group" aria-label="View">
            {(['prototype', 'maps', 'rules'] as View[]).map((v) => (
              <button key={v} type="button" aria-pressed={view === v} className={view === v ? 'is-on' : ''}
                onClick={() => setParams(v === 'prototype' ? {} : { view: v })}>
                {v === 'prototype' ? 'Prototype' : v === 'maps' ? 'Journey maps' : 'Decision tables'}
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
        <div className="mb-shell">
          <ProposedFrame />
          {internalView && <InternalPanel onClose={() => setInternalView(false)} />}
        </div>
      )}
      {view === 'maps' && <div className="mb-docview"><h1 className="mb-doc-h1">Journey maps</h1><JourneyMaps /></div>}
      {view === 'rules' && <div className="mb-docview"><h1 className="mb-doc-h1">Decision tables</h1><DecisionTables /></div>}
    </div>
  );
}
