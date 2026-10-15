import { useEffect, useRef, useState } from 'react';
import { wait } from '@/lib/timing';
import type { ProposedState } from '../model/types';
import { useProposed } from '../store';

/**
 * Runs a simulated backend call once when `when` is true (e.g. a step opened with status "idle"),
 * with realistic latency. Static renders (PDF) never run it. Returns [running, rerun].
 */
export function useAutoRun(when: boolean, fn: (s: ProposedState) => ProposedState, ms = 1100): [boolean, () => void] {
  const { apply, isStatic } = useProposed();
  const [running, setRunning] = useState(false);
  const started = useRef(false);

  const run = async () => {
    setRunning(true);
    await wait(ms);
    setRunning(false);
    apply(fn);
  };

  useEffect(() => {
    if (isStatic || !when || started.current) return;
    started.current = true;
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [when, isStatic]);

  return [running, () => void run()];
}
