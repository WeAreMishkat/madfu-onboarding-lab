import { SIGNER_STAGES, STAGES, stageFor } from '../model/config';
import type { Application, StepId } from '../model/types';

/** "Stage 3 of 8 · Business Verification": the same stage list as the boards. The signer has its own short list. */
export const stageEyebrow = (step: StepId, app?: Pick<Application, 'kyb' | 'actor'>) => {
  if (app?.actor === 'signer') {
    const i = SIGNER_STAGES.findIndex((s) => (s.steps as readonly string[]).includes(step));
    return `Authorization · Step ${i + 1} of ${SIGNER_STAGES.length} · ${SIGNER_STAGES[i].label}`;
  }
  const s = stageFor(step, app);
  return `Stage ${s.n} of ${STAGES.length} · ${s.label}`;
};

export const CHANNEL_LABEL = { online: 'Online', offline: 'Offline', both: 'Online and offline' } as const;
