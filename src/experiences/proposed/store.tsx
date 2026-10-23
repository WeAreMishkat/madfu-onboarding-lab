import { createContext, useCallback, useContext, useEffect, useReducer, useRef, type ReactNode } from 'react';
import { clearLocal, readLocal, writeLocal } from '@/lab/storage';
import { initialState } from './model/state';
import type { ProposedState } from './model/types';

type Action = { type: 'apply'; fn: (s: ProposedState) => ProposedState } | { type: 'replace'; state: ProposedState };

function reducer(s: ProposedState, a: Action): ProposedState {
  return a.type === 'apply' ? a.fn(s) : a.state;
}

interface Store {
  state: ProposedState;
  /** Apply a pure transition from model/state.ts. */
  apply: (fn: (s: ProposedState) => ProposedState) => void;
  replace: (s: ProposedState) => void;
  /** Restart demo: clears the application, the simulated backend and the controls. */
  reset: () => void;
  /** Static renders (PDF) do not run timers or simulated backend calls. */
  isStatic: boolean;
  /** Static renders can show field validation errors (PDF "validation examples"). */
  previewErrors: Record<string, string>;
}

const Ctx = createContext<Store | null>(null);
/** Versioned so a stored application from an older model never loads into the new one. */
export const STORE_KEY = 'proposed:v3';

function load(): ProposedState {
  const saved = readLocal<ProposedState | null>(STORE_KEY, null);
  return saved && saved.app && saved.sim && saved.backend && saved.app.kyb ? saved : initialState();
}

export function ProposedProvider({ children, initial, isStatic = false, previewErrors = {} }: { children: ReactNode; initial?: ProposedState; isStatic?: boolean; previewErrors?: Record<string, string> }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => initial ?? load());
  useEffect(() => { if (!initial) writeLocal(STORE_KEY, state); }, [state, initial]);
  const apply = useCallback((fn: (s: ProposedState) => ProposedState) => dispatch({ type: 'apply', fn }), []);
  const replace = useCallback((s: ProposedState) => dispatch({ type: 'replace', state: s }), []);
  const reset = useCallback(() => { clearLocal(STORE_KEY); dispatch({ type: 'replace', state: initialState() }); }, []);
  return <Ctx.Provider value={{ state, apply, replace, reset, isStatic, previewErrors }}>{children}</Ctx.Provider>;
}

export function useProposed(): Store {
  const c = useContext(Ctx);
  if (!c) throw new Error('useProposed outside ProposedProvider');
  return c;
}

/** Focus the step title when a step mounts (keyboard and screen-reader orientation). */
export function useStepFocus<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const { isStatic } = useProposed();
  useEffect(() => {
    if (isStatic) return;
    ref.current?.focus({ preventScroll: false });
    window.scrollTo({ top: 0 });
  }, [isStatic]);
  return ref;
}
