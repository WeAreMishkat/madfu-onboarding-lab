import { STATUS_HELP, STATUS_LABEL, type BadgeStatus } from './evidence';

export function StatusBadge({ status, note, size = 'sm' }: { status: BadgeStatus; note?: string; size?: 'sm' | 'xs' }) {
  const title = note ? `${STATUS_HELP[status]} ${note}` : STATUS_HELP[status];
  return (
    <span className={`status-badge status-${status.toLowerCase()} status-${size}`} title={title}>
      <span className="status-dot" aria-hidden="true" />
      {STATUS_LABEL[status]}
      <span className="sr-only">. {title}</span>
    </span>
  );
}
