import type { ReactNode } from 'react';
import { maskIban, maskMobile, revenueLabel } from '../model/config';
import { eligiblePersons, maskedName } from '../model/mock';
import { categoryLabel, contractEligible, continueFromReview, reviewIssues, startEdit, type SectionId } from '../model/state';
import { useProposed, useStepFocus } from '../store';
import { Alert, Button, StepHeader, VerifyBadge } from '../ui/components';
import { IconPen } from '../ui/icons';
import { StepNav } from './StepNav';

function Section({ title, section, children, issue }: { title: string; section: SectionId; children: ReactNode; issue?: boolean }) {
  const { apply } = useProposed();
  return (
    <section className={`mb-review-section ${issue ? 'has-issue' : ''}`} aria-label={title}>
      <header className="mb-review-head">
        <h2>{title}</h2>
        <Button variant="link" iconLeft={<IconPen size={15} />} onClick={() => apply((s) => startEdit(s, section))} aria-label={`Edit ${title}`}>Edit</Button>
      </header>
      <dl className="mb-kv">{children}</dl>
    </section>
  );
}
const Row = ({ k, children }: { k: string; children: ReactNode }) => <div className="mb-kv-row"><dt>{k}</dt><dd>{children}</dd></div>;
const missing = (t = 'Not provided') => <span className="mb-missing">{t}</span>;

export function ReviewStep() {
  const { state, apply } = useProposed();
  const titleRef = useStepFocus<HTMLHeadingElement>();
  const { app } = state;
  const fl = app.entry.type === 'FL';
  const b = app.business;
  const issues = reviewIssues(app);
  const has = (s: SectionId) => issues.some((i) => i.section === s);
  const eligible = contractEligible(app);
  const person = eligiblePersons(app.persons.list).find((p) => p.id === app.persons.selectedId);
  const cert = app.certs.list.find((c) => c.id === app.certs.selectedId);
  const nafathBadge = app.nafath.status === 'verified'
    ? <VerifyBadge state="verified">Verified</VerifyBadge>
    : <VerifyBadge state="pending">Manual verification</VerifyBadge>;

  return (
    <section className="mb-card mb-card-wide" aria-labelledby="mb-step-title">
      <StepHeader eyebrow="Step 5 of 6" title="Review your application" description="Check your details. You can edit any section and come back here." titleRef={titleRef} />

      {issues.length === 0
        ? <Alert tone="success" title="Everything is ready">{eligible ? 'Continue to the agreement.' : 'Submit your application. Our team will complete the remaining verification.'}</Alert>
        : (
          <Alert tone="warning" title={`${issues.length} item${issues.length > 1 ? 's' : ''} need${issues.length > 1 ? '' : 's'} attention`}>
            <ul className="mb-issue-list">{issues.map((i) => <li key={i.message}>{i.message} <Button variant="link" size="sm" onClick={() => apply((s) => startEdit(s, i.section))}>Fix</Button></li>)}</ul>
          </Alert>
        )}

      <div className="mb-review-grid">
        <Section title="Applicant" section="applicant">
          <Row k="Applicant type">{fl ? 'Freelancer' : 'Registered Business'}</Row>
          <Row k={fl ? 'National ID Number' : 'Commercial Registration Number'}><span className="mb-mono">{app.entry.identifier}</span></Row>
          <Row k="Annual revenue">{revenueLabel(app.entry.revenue)}</Row>
          <Row k="Mobile"><span className="mb-mono">{maskMobile(app.entry.mobile)}</span> <VerifyBadge state="verified">Verified</VerifyBadge></Row>
        </Section>
        <Section title="Business category" section="category" issue={has('category')}>
          <Row k="Category">{categoryLabel(app) || missing()}</Row>
        </Section>
        <Section title={fl ? 'Identity' : 'Registration and authority'} section="verification">
          {!fl && <Row k="Registration">{app.cr.record ? <>{app.cr.record.legalName} <VerifyBadge state={app.cr.status === 'valid' ? 'verified' : 'attention'}>{app.cr.status === 'valid' ? 'Verified' : 'Expired'}</VerifyBadge></> : missing()}</Row>}
          {!fl && <Row k="Authorised person">{person ? maskedName(person) : app.persons.status === 'none' ? 'To be verified by our team' : missing('Not selected')}</Row>}
          <Row k="Nafath">{nafathBadge}</Row>
        </Section>
        {fl && (
          <Section title="Freelance certificate" section="certificate" issue={has('certificate')}>
            <Row k="Certificate">{cert ? <span className="mb-mono">{cert.number}</span> : app.certs.manualNumber ? <span className="mb-mono">FL-{app.certs.manualNumber}</span> : missing()}</Row>
            {cert && <Row k="Activity">{cert.category} · {cert.subcategory}</Row>}
            {!cert && app.certs.manualNumber && <Row k="Verification"><VerifyBadge state="pending">Manual verification</VerifyBadge></Row>}
          </Section>
        )}
        <Section title="Settlement account" section="bank" issue={has('bank')}>
          <Row k="IBAN">{b.iban ? <span className="mb-mono">{maskIban(b.iban)}</span> : missing()}</Row>
          {b.bankName && <Row k="Bank">{b.bankName}</Row>}
          <Row k="Ownership">
            {b.ibanStatus === 'verified' ? <VerifyBadge state="verified">Verified</VerifyBadge>
              : b.ibanStatus === 'unverified' || b.ibanStatus === 'not_checked' ? <VerifyBadge state="pending">Reviewed by our team</VerifyBadge>
                : <VerifyBadge state="attention">Not verified yet</VerifyBadge>}
          </Row>
        </Section>
        <Section title="Tax" section="tax" issue={has('tax')}>
          <Row k="VAT registered">{b.vat === 'yes' ? 'Yes' : b.vat === 'no' ? 'No' : missing('Not answered')}</Row>
          {b.vat === 'yes' && <Row k="VAT number"><span className="mb-mono">{fl ? b.vatNumber : '3•••••••••••003'}</span>{!fl && <> <VerifyBadge state="verified">Retrieved</VerifyBadge></>}</Row>}
        </Section>
        <Section title="Sales channel" section="channels" issue={has('channels')}>
          <Row k="Channel">{b.channel ? { online: 'Online', offline: 'Offline', both: 'Online and offline' }[b.channel] : missing()}</Row>
          {(b.channel === 'online' || b.channel === 'both') && <Row k="Website">{b.websiteUrl || missing()}</Row>}
          {(b.channel === 'offline' || b.channel === 'both') && <Row k="Location">{b.mapsUrl || missing()}</Row>}
          {(b.channel === 'offline' || b.channel === 'both') && b.branches && <Row k="Branches">{b.branches}</Row>}
        </Section>
      </div>

      <StepNav onNext={() => apply(continueFromReview)} nextLabel={eligible ? 'Continue to agreement' : 'Submit application'} nextDisabled={issues.length > 0} />
    </section>
  );
}
