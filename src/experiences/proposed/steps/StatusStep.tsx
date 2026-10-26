import { STATUS_COPY, STATUS_TRACK } from '../model/copy';
import { useProposed, useStepFocus } from '../store';
import { Alert, StepHeader } from '../ui/components';
import { IconCheck } from '../ui/icons';

/**
 * Application Progress. A submitted application opens here after the registered-mobile code. It shows
 * the status only: Review, Contract and submission are never reopened. No SLA is invented.
 */
export function StatusStep() {
  const { state } = useProposed();
  const titleRef = useStepFocus<HTMLHeadingElement>();
  const { app } = state;
  const copy = STATUS_COPY[app.status] ?? STATUS_COPY.SUBMITTED!;
  const at = STATUS_TRACK.indexOf(app.status);
  const offTrack = at < 0;

  return (
    <section className="mb-card mb-card-narrow" aria-labelledby="mb-step-title">
      <StepHeader eyebrow="Application Progress" title={copy.title} description={copy.body} titleRef={titleRef} />
      <dl className="mb-kv is-tight">
        <div className="mb-kv-row"><dt>Application reference</dt><dd className="mb-mono">{app.id}</dd></div>
        {app.submittedAt && <div className="mb-kv-row"><dt>Submitted</dt><dd>{app.submittedAt.slice(0, 10)}</dd></div>}
      </dl>
      <ol className="mb-status-track" aria-label="Application status">
        {STATUS_TRACK.map((st, i) => {
          const done = !offTrack && i < at;
          const current = !offTrack && i === at;
          return (
            <li key={st} className={done ? 'is-done' : current ? 'is-current' : ''} aria-current={current ? 'step' : undefined}>
              <span className="mb-status-mark" aria-hidden="true">{done ? <IconCheck size={13} /> : i + 1}</span>
              <span>{STATUS_COPY[st]!.title}</span>
            </li>
          );
        })}
      </ol>
      {app.status === 'ACTION_REQUIRED' && <Alert tone="warning" title="Action required">{STATUS_COPY.ACTION_REQUIRED!.body}</Alert>}
      {app.status === 'UNABLE_TO_PROCEED' && <Alert tone="warning" title="Unable to proceed">{STATUS_COPY.UNABLE_TO_PROCEED!.body}</Alert>}
      <p className="mb-small mb-muted">Your submitted application can no longer be changed here. If something needs to change, our team will contact you.</p>
    </section>
  );
}
