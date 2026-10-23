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
 * Back / Next for every step. Opened through Edit, it becomes Cancel (restores the previous values)
 * + "Save and return". Back never re-enters a verified SMS code and never resets completed checks.
 */
export function StepNav({ onNext, nextLabel = 'Next', nextDisabled, loading, loadingLabel, hideBack }: Props) {
  const { state, apply } = useProposed();
  const editing = !!state.app.returnTo && !!state.app.editBaseline;
  const canBack = !hideBack && !editing && previousStep(state.app) !== null;
  const returnLabel = state.app.returnTo === 'review' ? 'Save and return to review' : 'Save and continue';
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
          {editing ? returnLabel : nextLabel}
        </Button>
      )}
    </Actions>
  );
}
