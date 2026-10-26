import { STAGES, stageOf } from '../model/config';
import type { StepId } from '../model/types';

/** "Stage 3 of 8 · Business Verification": the same stage list as the boards. */
export const stageEyebrow = (step: StepId) => {
  const s = stageOf(step);
  return `Stage ${s.n} of ${STAGES.length} · ${s.label}`;
};

export const CHANNEL_LABEL = { online: 'Online', offline: 'Offline', both: 'Online and offline' } as const;
