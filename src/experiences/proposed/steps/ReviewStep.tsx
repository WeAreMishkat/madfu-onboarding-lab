import type { ReactNode } from 'react';
import { activityLabel } from '../model/activity';
import { kindLabel, maskIban, maskIdentifier, maskMobile, revenueLabel } from '../model/config';
import { subLabel } from '../model/eligibility';
import { eligiblePersons, maskedName, ROLE_LABEL } from '../model/mock';
import { pct } from '../model/pricing';
import { EDITABLE_SECTIONS, contractEligible, continueFromReview, reviewIssues, startEdit } from '../model/state';
import type { SectionId } from '../model/types';
import { useProposed, useStepFocus } from '../store';
import { Alert, Button, StepHeader, VerifyBadge } from '../ui/components';
import { IconLock, IconPen } from '../ui/icons';
import { CHANNEL_LABEL, stageEyebrow } from './shared';
import { StepNav } from './StepNav';

function Section({ title, section, children, issue }: { title: string; section: SectionId; children: ReactNode; issue?: boolean }) {
  const { apply } = useProposed();
  const editable = EDITABLE_SECTIONS.includes(section);
  return (
    <section className={`mb-review-section ${issue ? 'has-issue' : ''}`} aria-label={title}>
      <header className="mb-review-head">
        <h2>{title}</h2>
        {editable
          ? <Button variant="link" iconLeft={<IconPen size={15} />} onClick={() => apply((s) => startEdit(s, section))} aria-label={`Edit ${title}`}>Edit</Button>
          : <span className="mb-locked" title="Verified information cannot be changed in this application"><IconLock size={13} /> Locked</span>}
      </header>
      <dl className="mb-kv">{children}</dl>
    </section>
  );
}
const Row = ({ k, children }: { k: string; children: ReactNode }) => <div className="mb-kv-row"><dt>{k}</dt><dd>{children}</dd></div>;
const missing = (t = 'Not provided') => <span className="mb-missing">{t}</span>;

/** Stage 6 — summary. Verified sections are locked; store presence and the rate review open a transactional edit. */
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
  const cat = app.categoryCheck;
  const offer = app.commercial.agreed;
  const v = (ok: boolean, okText: string, other: string) => <VerifyBadge state={ok ? 'verified' : 'pending'}>{ok ? okText : other}</VerifyBadge>;

  return (
    <section className="mb-card mb-card-wide" aria-labelledby="mb-step-title">
      <StepHeader eyebrow={stageEyebrow('review')} title="Review your application" description="Verified information is locked. You can still edit your store links and your rate-review request." titleRef={titleRef} />

      {issues.length === 0
        ? <Alert tone="success" title="Everything is ready">{eligible ? 'Continue to the contract.' : 'Submit your application. Our team will complete the remaining verification.'}</Alert>
        : (
          <Alert tone="warning" title={`${issues.length} item${issues.length > 1 ? 's' : ''} need${issues.length > 1 ? '' : 's'} attention`}>
            <ul className="mb-issue-list">{issues.map((i) => <li key={i.message}>{i.message} {EDITABLE_SECTIONS.includes(i.section) && <Button variant="link" size="sm" onClick={() => apply((s) => startEdit(s, i.section))}>Fix</Button>}</li>)}</ul>
          </Alert>
        )}

      <div className="mb-review-grid">
        <Section title="Business" section="applicant">
          <Row k="Applicant type">{kindLabel(k.kind)}</Row>
          <Row k="Category">{subLabel(cat?.verifiedSub ?? k.sub)}{cat && cat.outcome !== 'UNMAPPED' && <> <VerifyBadge state="verified">From government records</VerifyBadge></>}</Row>
          <Row k="Annual revenue">{revenueLabel(k.revenue)}</Row>
          <Row k="Sales channel">{k.channel ? CHANNEL_LABEL[k.channel] : missing()}</Row>
          <Row k={cr ? 'Commercial Registration' : 'National ID'}><span className="mb-mono">{maskIdentifier(app.identity.identifier)}</span></Row>
          <Row k="Registered mobile"><span className="mb-mono">{maskMobile(app.registeredMobile)}</span> <VerifyBadge state="verified">Verified</VerifyBadge></Row>
          <Row k="Application">{app.id}</Row>
        </Section>
        <Section title={cr ? 'Verified business' : 'Verified Freelancer'} section="verified">
          {cr && <Row k="Registered name">{app.cr.record?.legalName ?? missing()}</Row>}
          {cr && <Row k="Registered activities">{app.cr.record ? app.cr.record.activities.map((a) => activityLabel(a.code)).join(' · ') : missing()}</Row>}
          {cr && <Row k="Owner / manager">{person ? `${maskedName(person)} (${ROLE_LABEL[person.role]})` : missing('Not selected')}</Row>}
          {!cr && <Row k="Certificate">{cert ? <span className="mb-mono">{cert.number}</span> : missing()}</Row>}
          {!cr && cert && <Row k="Certificate activity">{activityLabel(cert.activity)}</Row>}
        </Section>
        <Section title="Store presence" section="presence" issue={has('presence')}>
          {(k.channel === 'online' || k.channel === 'both') && <Row k="Online store">{b.websiteUrl ? <span className="mb-break">{b.websiteUrl}</span> : missing()}</Row>}
          {(k.channel === 'offline' || k.channel === 'both') && <Row k="Google Maps">{b.mapsUrl ? <span className="mb-break">{b.mapsUrl}</span> : missing()}</Row>}
        </Section>
        {!cr && (
          <Section title="Bank account" section="banking" issue={has('banking')}>
            <Row k="IBAN">{b.iban ? <span className="mb-mono">{maskIban(b.iban)}</span> : missing()}</Row>
            {b.bankName && <Row k="Bank">{b.bankName}</Row>}
            <Row k="Linked to certificate">{v(b.ibanStatus === 'verified', 'Verified', 'Not verified')}</Row>
          </Section>
        )}
        <Section title="Commercial offer" section="commercial" issue={has('commercial')}>
          <Row k="Standard commission">{offer ? pct(offer.standardRate) : missing('Not confirmed')}</Row>
          <Row k="Better-rate review">{app.commercial.reviewRequested ? 'Requested (standard offer applies meanwhile)' : 'Not requested'}</Row>
        </Section>
        <section className="mb-review-section" aria-label="Verification status">
          <header className="mb-review-head"><h2>Verification status</h2></header>
          <dl className="mb-kv">
            <Row k="Mobile">{v(app.contactMobileVerified, 'Verified', 'Pending')}</Row>
            {cr && <Row k="Commercial Registration">{v(app.cr.status === 'loaded', 'Retrieved', 'Pending')}</Row>}
            {!cr && <Row k="Freelancer Certificate">{v(cat?.source === 'CERTIFICATE', 'Retrieved', 'Pending')}</Row>}
            <Row k="Mobile belongs to the verifying person">{v(app.authorizedMobileVerified, 'Confirmed', 'Our team will verify')}</Row>
            <Row k="Nafath">{v(app.nafath.status === 'verified', 'Verified', 'Our team will verify')}</Row>
          </dl>
        </section>
      </div>

      <StepNav onNext={() => apply(continueFromReview)} nextLabel={eligible ? 'Continue to contract' : 'Submit application'} nextDisabled={issues.length > 0} />
    </section>
  );
}
