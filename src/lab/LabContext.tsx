import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { readStore, writeStore } from './storage';

/**
 * Lab-wide UI state that sits outside every experience:
 * - evidenceMode: show the Evidence drawer on benchmark / current experiences
 * - internalView: show the "System Checks" internal panel on Madfu Proposed
 * - restart handler: the active experience registers how to reset itself
 */
interface LabState {
  evidenceMode: boolean;
  setEvidenceMode: (on: boolean) => void;
  internalView: boolean;
  setInternalView: (on: boolean) => void;
  registerRestart: (fn: (() => void) | null) => void;
  restart: () => void;
  canRestart: boolean;
}

const LabCtx = createContext<LabState | null>(null);

export function LabProvider({ children }: { children: ReactNode }) {
  const [evidenceMode, setEvidence] = useState<boolean>(() => readStore('lab.evidence', false));
  // The Internal View is a side rail on desktop; on phones and small tablets it would cover the
  // merchant UI, so it starts closed there.
  const [internalView, setInternal] = useState<boolean>(() => readStore('lab.internal', typeof window === 'undefined' || window.innerWidth >= 1000));
  const restartRef = useRef<(() => void) | null>(null);
  const [canRestart, setCanRestart] = useState(false);

  const setEvidenceMode = useCallback((on: boolean) => { setEvidence(on); writeStore('lab.evidence', on); }, []);
  const setInternalView = useCallback((on: boolean) => { setInternal(on); writeStore('lab.internal', on); }, []);
  const registerRestart = useCallback((fn: (() => void) | null) => {
    restartRef.current = fn;
    setCanRestart(!!fn);
  }, []);
  const restart = useCallback(() => { restartRef.current?.(); }, []);

  const value = useMemo(
    () => ({ evidenceMode, setEvidenceMode, internalView, setInternalView, registerRestart, restart, canRestart }),
    [evidenceMode, setEvidenceMode, internalView, setInternalView, registerRestart, restart, canRestart]
  );
  return <LabCtx.Provider value={value}>{children}</LabCtx.Provider>;
}

export function useLab(): LabState {
  const ctx = useContext(LabCtx);
  if (!ctx) throw new Error('useLab must be used inside <LabProvider>');
  return ctx;
}

/** An experience calls this to expose its reset to the Lab bar's "Restart" button. */
export function useRegisterRestart(fn: () => void) {
  const { registerRestart } = useLab();
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    registerRestart(() => fnRef.current());
    return () => registerRestart(null);
  }, [registerRestart]);
}
