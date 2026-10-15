import { back, cancelEdit, previousStep } from '../model/state';
import { useProposed } from '../store';
import { Actions, Button } from '../ui/components';
import { IconArrowLeft, IconArrowRight } from '../ui/icons';

interface Props {
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  hideBack?: boolean;
}

/**
 * Back / Next for every step. Opened from Review via Edit, it becomes Cancel (discard) +
 * "Save and return to review". Back never re-enters a verified SMS code.
 */
export function StepNav({ onNext, nextLabel = 'Next', nextDisabled, loading, loadingLabel, hideBack }: Props) {
  const { state, apply } = useProposed();
  const editing = state.app.editing === 'review';
  const canBack = !hideBack && !editing && previousStep(state.app) !== null;
  return (
    <Actions split>
      {editing ? (
        <Button variant="ghost" onClick={() => apply(cancelEdit)}>Cancel</Button>
      ) : canBack ? (
        <Button variant="ghost" iconLeft={<IconArrowLeft size={18} />} onClick={() => apply(back)}>Back</Button>
      ) : <span />}
      {onNext && (
        <Button
          type="submit"
          size="lg"
          loading={loading}
          loadingLabel={loadingLabel}
          disabled={nextDisabled}
          iconRight={editing ? undefined : <IconArrowRight size={18} />}
          onClick={(e) => { e.preventDefault(); onNext(); }}
        >
          {editing ? 'Save and return to review' : nextLabel}
        </Button>
      )}
    </Actions>
  );
}
