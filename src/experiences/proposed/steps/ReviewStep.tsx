import type { ReactNode } from 'react';
import { activityByCode } from '../model/activity';
import { kindLabel, maskIban, maskMobile, revenueLabel } from '../model/config';
import { subLabel } from '../model/eligibility';
import { eligiblePersons, maskedName } from '../model/mock';
import { pct } from '../model/pricing';
import { contractEligible, continueFromReview, reviewIssues, startEdit } from '../model/state';
import type { SectionId } from '../model/types';
import { useProposed, useStepFocus } from '../store';
import { Alert, Button, StepHeader, VerifyBadge } from '../ui/components';
import { IconPen } from '../ui/icons';
import { CHANNEL_LABEL, stageEyebrow } from './shared';
import { StepNav } from './StepNav';

function Section({ title, section, children, issue }: { title: string; section?: SectionId; children: ReactNode; issue?: boolean }) {
  const { apply } = useProposed();
  return (
    <section className={`mb-review-section ${issue ? 'has-issue' : ''}`} aria-label={title}>
      <header className="mb-review-head">
        <h2>{title}</h2>
        {section && <Button variant="link" iconLeft={<IconPen size={15} />} onClick={() => apply((s) => startEdit(s, section))} aria-label={`Edit ${title}`}>Edit</Button>}
      </header>
      <dl className="mb-kv">{children}</dl>
    </section>
  );
}
const Row = ({ k, children }: { k: string; children: ReactNode }) => <div className="mb-kv-row"><dt>{k}</dt><dd>{children}</dd></div>;
const missing = (t = 'Not provided') => <span className="mb-missing">{t}</span>;

/** Stage 6 — full summary. Every editable section has Edit and returns here. */
export function ReviewStep() {
  const { state, apply } = useProposed();
  const titleRef = useStepFocus<HTMLHeadingElement>();
  const { app } = state;
  const k = app.kyb;
  const cr = k.kind === 'CR';
  const b = app.business;
  const issues = reviewIssues(app);
  const has = (s: SectionId) => issues.some((i) => i.section === s);
  const eligible = contractEligible(app);
  const person = eligiblePersons(app.persons.list).find((p) => p.id === app.persons.selectedId);
  const cert = app.certs.list.find((c) => c.id === app.certs.selectedId);
  const offer = app.commercial.agreed;
  const v = (ok: boolean, okText: string, other: string) => <VerifyBadge state={ok ? 'verified' : 'pending'}>{ok ? okText : other}</VerifyBadge>;

  return (
    <section className="mb-card mb-card-wide" aria-labelledby="mb-step-title">
      <StepHeader eyebrow={stageEyebrow('review')} title="Review your application" description="Check your details. You can edit any section and come back here." titleRef={titleRef} />

      {issues.length === 0
        ? <Alert tone="success" title="Everything is ready">{eligible ? 'Continue to the contract.' : 'Submit your application. Our team will complete the remaining verification.'}</Alert>
        : (
          <Alert tone="warning" title={`${issues.length} item${issues.length > 1 ? 's' : ''} need${issues.length > 1 ? '' : 's'} attention`}>
            <ul className="mb-issue-list">{issues.map((i) => <li key={i.message}>{i.message} <Button variant="link" size="sm" onClick={() => apply((s) => startEdit(s, i.section))}>Fix</Button></li>)}</ul>
          </Alert>
        )}

      <div className="mb-review-grid">
        <Section title="Know Your Business" section="kyb">
          <Row k="Applicant type">{kindLabel(k.kind)}</Row>
          <Row k="Category">{subLabel(k.sub)}</Row>
          <Row k="Annual revenue">{revenueLabel(k.revenue)}</Row>
          <Row k="Sales channel">{k.channel ? CHANNEL_LABEL[k.channel] : missing()}</Row>
          {(k.channel === 'online' || k.channel === 'both') && <Row k="Website"><span className="mb-break">{k.websiteUrl}</span></Row>}
          {(k.channel === 'offline' || k.channel === 'both') && <Row k="Google Maps"><span className="mb-break">{k.mapsUrl}</span></Row>}
        </Section>
        <Section title="Identification" section="identification">
          <Row k={cr ? 'Commercial Registration' : 'National ID'}><span className="mb-mono">{app.identity.identifier}</span></Row>
          <Row k="Mobile"><span className="mb-mono">{maskMobile(app.verifiedMobile || app.identity.mobile)}</span> <VerifyBadge state="verified">Verified</VerifyBadge></Row>
          <Row k="Application">{app.id}</Row>
        </Section>
        <Section title={cr ? 'Verified business data' : 'Verified Freelancer data'} section="verified" issue={has('verified')}>
          {cr && <Row k="Registered name">{app.cr.record?.legalName ?? missing()}</Row>}
          {cr && <Row k="Registered activity">{app.cr.record ? activityByCode(app.cr.record.activity)?.label : missing()}</Row>}
          {cr && <Row k="Authorised person">{person ? maskedName(person) : app.persons.status === 'none' ? 'To be verified by our team' : missing('Not selected')}</Row>}
          {!cr && <Row k="Certificate">{cert ? <span className="mb-mono">{cert.number}</span> : missing()}</Row>}
          {!cr && cert && <Row k="Certificate activity">{activityByCode(cert.activity)?.label ?? cert.activityLabel}</Row>}
        </Section>
        <Section title="Business & banking" section="banking" issue={has('banking')}>
          {!cr && <Row k="Bank linked to certificate">{b.bankLinked === 'yes' ? 'Yes' : b.bankLinked === 'no' ? 'No — our team will help you set it up' : missing('Not answered')}</Row>}
          {b.bankLinked !== 'no' && <Row k="IBAN">{b.iban ? <span className="mb-mono">{maskIban(b.iban)}</span> : missing()}</Row>}
          {b.bankName && <Row k="Bank">{b.bankName}</Row>}
          <Row k="VAT registered">{b.vat === 'yes' ? 'Yes' : b.vat === 'no' ? 'No' : missing('Not answered')}</Row>
          {b.vat === 'yes' && <Row k="VAT number"><span className="mb-mono">{cr ? '3•••••••••••003' : b.vatNumber}</span></Row>}
          {b.branches && <Row k="Branches">{b.branches}</Row>}
        </Section>
        <Section title="Commercial offer" section="commercial" issue={has('commercial')}>
          <Row k="Standard commission">{offer ? pct(offer.standardRate) : missing('Not confirmed')}</Row>
          <Row k="Better-rate review">{app.commercial.evidence.length ? 'Requested (standard rate applies meanwhile)' : 'Not requested'}</Row>
        </Section>
        <Section title="Payment plans" section="plans" issue={has('commercial')}>
          {offer ? offer.plans.map((p) => <Row key={p.tenure} k={`${p.tenure} months`}>{pct(p.rate)} · {p.included ? 'Included' : 'Selected'}</Row>) : <Row k="Plans">{missing('Not confirmed')}</Row>}
        </Section>
        <Section title="Verification status">
          <Row k="Mobile">{v(true, 'Verified', '')}</Row>
          {cr && <Row k="Commercial Registration">{v(app.cr.decision === 'continue', 'Verified', 'Pending')}</Row>}
          <Row k="Nafath">{v(app.nafath.status === 'verified', 'Verified', 'Manual verification')}</Row>
          {!cr && <Row k="Freelancer Certificate">{v(!!cert, 'Retrieved', 'Pending')}</Row>}
          <Row k="IBAN ownership">{b.bankLinked === 'no' ? <VerifyBadge state="pending">Banking setup later</VerifyBadge> : v(b.ibanStatus === 'verified', 'Verified', 'Reviewed by our team')}</Row>
        </Section>
      </div>

      <StepNav onNext={() => apply(continueFromReview)} nextLabel={eligible ? 'Continue to contract' : 'Submit application'} nextDisabled={issues.length > 0} />
    </section>
  );
}
