import { DELEGATION_LABEL, DELEGATION_STATUS_COPY } from '../model/copy';
import { delegationResult, leaveDelegation, setDelegationType } from '../model/state';
import type { DelegationType } from '../model/types';
import { useProposed, useStepFocus } from '../store';
import { Actions, Alert, Button, ChoiceGroup, StepHeader } from '../ui/components';
import { IconArrowLeft, IconUpload } from '../ui/icons';
import { stageEyebrow } from './shared';

/**
 * PHASE 2 — DEMO ONLY. A signer who is not on the CR but holds an official delegation. Delegation
 * authority is verified BEFORE Nafath (Nafath proves identity, not authority): MOJ delegations
 * automatically, documents by a manual Quality review that never needs an open session. Nothing in the
 * Phase 1 journey depends on this screen.
 */
export function DelegationStep() {
  const { state, apply } = useProposed();
  const titleRef = useStepFocus<HTMLHeadingElement>();
  const d = state.app.authorization.delegation;
  const tone = d.status === 'valid' || d.status === 'approved' ? 'success' : d.status === 'invalid' || d.status === 'rejected' ? 'warning' : 'info';

  return (
    <section className="mb-card" aria-labelledby="mb-step-title">
      <StepHeader eyebrow={stageEyebrow('delegation', state.app)} title="Delegated signatory" description="For a signer who is not registered on the CR but holds an official delegation." titleRef={titleRef} />
      <Alert tone="warning" title="Phase 2 — demo only">Shown to explain the future design. Delegated signing is not part of the Phase 1 launch.</Alert>

      <ChoiceGroup<DelegationType>
        legend="Type of delegation"
        name="delegation"
        value={d.type}
        columns={3}
        compact
        options={(Object.keys(DELEGATION_LABEL) as DelegationType[]).map((t) => ({ value: t, label: DELEGATION_LABEL[t].title, description: DELEGATION_LABEL[t].detail }))}
        onChange={(t) => apply((s) => setDelegationType(s, t))}
      />

      {d.type === 'MOJ' && d.status === 'idle' && (
        <Actions><Button onClick={() => apply((s) => delegationResult(s, 'valid'))}>Verify with the Ministry of Justice (demo)</Button></Actions>
      )}
      {d.type && d.type !== 'MOJ' && d.status === 'idle' && (
        <Actions><Button iconLeft={<IconUpload size={18} />} onClick={() => apply((s) => delegationResult(s, 'under_review'))}>Upload the delegation document (demo)</Button></Actions>
      )}
      {d.status !== 'idle' && <Alert tone={tone} title={`Delegation: ${d.status.replace('_', ' ')}`}>{DELEGATION_STATUS_COPY[d.status]}</Alert>}

      <ol className="mb-steps-list" aria-label="Delegated signer flow (Phase 2)">
        <li>Delegation verified (MOJ) or approved by Quality.</li>
        <li>The signer receives a secure continuation link.</li>
        <li>Nafath, then the contract.</li>
      </ol>

      <Actions split>
        <Button variant="ghost" iconLeft={<IconArrowLeft size={18} />} onClick={() => apply(leaveDelegation)}>Back to authorization</Button>
        <span />
      </Actions>
    </section>
  );
}
