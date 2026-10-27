import { HANDOFF_RULES, maskMobile } from '../model/config';
import { PREPARER_AUTH_VIEW } from '../model/copy';
import { activeVersion, canStartHandoff, currentVersion, restartAuthorization } from '../model/state';
import { useProposed, useStepFocus } from '../store';
import { Actions, Alert, Button, StepHeader, VerifyBadge } from '../ui/components';
import { IconLock } from '../ui/icons';
import { stageEyebrow } from './shared';

const day = (iso: string) => iso.slice(0, 10);

/**
 * Preparer after "Send Authorization": status only. The application and offer are frozen; the signer
 * and mobile cannot be changed in Phase 1 (shown as a disabled Phase 2 option). The displayed status
 * comes from configuration (PREPARER_AUTH_VIEW), not from this component.
 */
export function HandoffStep() {
  const { state, apply } = useProposed();
  const titleRef = useStepFocus<HTMLHeadingElement>();
  const { app } = state;
  const v = currentVersion(app);
  const view = PREPARER_AUTH_VIEW[app.authorization.status];
  const live = !!activeVersion(app);
  const ended = !live && (app.authorization.status === 'EXPIRED' || app.authorization.status === 'CANCELLED');
  const canRestart = ended && app.status === 'AWAITING_AUTHORIZATION';
  const tone = view.tone === 'success' ? 'verified' : view.tone === 'attention' ? 'attention' : 'pending';

  return (
    <section className="mb-card mb-card-narrow" aria-labelledby="mb-step-title">
      <StepHeader eyebrow={stageEyebrow('handoff', app)} title={live ? 'Waiting for authorization' : 'Authorization status'} description={view.body} titleRef={titleRef} />

      <div className="mb-handoff-status"><span className="mb-small mb-muted">Status</span> <VerifyBadge state={tone}>{view.label}</VerifyBadge></div>

      {v && (
        <dl className="mb-kv is-tight">
          <div className="mb-kv-row"><dt>Application reference</dt><dd className="mb-mono">{app.id}</dd></div>
          <div className="mb-kv-row"><dt>Signer</dt><dd>{v.signerName} · National ID {v.signerIdMasked}</dd></div>
          <div className="mb-kv-row"><dt>Signer’s mobile</dt><dd className="mb-mono">{maskMobile(v.signerMobile)}</dd></div>
          <div className="mb-kv-row"><dt>Sent</dt><dd>{day(v.createdAt)}</dd></div>
          <div className="mb-kv-row"><dt>{live ? 'Link valid until' : 'Link was valid until'}</dt><dd>{day(v.expiresAt)}</dd></div>
          <div className="mb-kv-row"><dt>Authorization request</dt><dd>{v.version} of {HANDOFF_RULES.maxVersions + app.authorization.extraVersions} within {HANDOFF_RULES.windowDays} days</dd></div>
        </dl>
      )}

      <p className="mb-locked-line"><IconLock size={14} /> Your application and offer are locked so the signer reviews exactly this version.</p>

      {canRestart && (canStartHandoff(app) ? (
        <Actions><Button size="lg" block onClick={() => apply(restartAuthorization)}>Start a new authorization</Button></Actions>
      ) : (
        <Alert tone="warning" title="A new authorization needs our team">
          This application already had {HANDOFF_RULES.maxVersions} authorization requests in the last {HANDOFF_RULES.windowDays} days. Please contact Madfu Business support. You can still authorize it yourself if you are an owner or manager.
          <div className="mb-alert-action"><Button variant="secondary" size="sm" onClick={() => apply(restartAuthorization)}>Authorize it myself</Button></div>
        </Alert>
      ))}

      {live && (
        <div className="mb-phase2">
          <Button variant="secondary" disabled aria-describedby="mb-change-signer-note">Change signer or mobile</Button>
          <p id="mb-change-signer-note" className="mb-small mb-muted"><span className="mb-phase-tag">Phase 2</span> Changing the signer or the signer’s mobile is not available yet. If something is wrong, contact Madfu Business support.</p>
        </div>
      )}
    </section>
  );
}
