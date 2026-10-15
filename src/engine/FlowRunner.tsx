import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLab, useRegisterRestart } from '@/lab/LabContext';
import { EvidencePanel } from '@/lab/EvidencePanel';
import { StatusBadge } from '@/lab/StatusBadge';
import { readStore, writeStore, clearStore } from '@/lab/storage';
import { wait } from '@/lib/timing';
import { FieldView } from './FieldView';
import { resolve, type ActionDef, type Block, type ExperienceDef, type FieldDef, type FlowCtx, type ScreenDef, type Values } from './types';

interface RunState {
  screenId: string;
  values: Values;
  history: string[];
}

const isTrue = (b: boolean | ((v: Values) => boolean) | undefined, v: Values) => (typeof b === 'function' ? b(v) : !!b);

function visibleFields(screen: ScreenDef, values: Values): FieldDef[] {
  return screen.blocks
    .filter((b): b is Extract<Block, { type: 'field' }> => b.type === 'field')
    .map((b) => b.field)
    .filter((f) => !f.when || f.when(values));
}

function isEmpty(v: unknown) {
  return v == null || v === '' || v === false || (Array.isArray(v) && v.length === 0);
}

export function validateScreen(screen: ScreenDef, values: Values, requiredMessage = 'This field is required'): Record<string, string> {
  const errs: Record<string, string> = {};
  for (const f of visibleFields(screen, values)) {
    if (isTrue(f.readOnly, values)) continue;
    const v = values[f.name];
    if (isTrue(f.required, values) && isEmpty(v)) {
      errs[f.name] = requiredMessage;
      continue;
    }
    if (!isEmpty(v) && f.validate) {
      const msg = f.validate(v, values);
      if (msg) errs[f.name] = msg;
    }
  }
  return errs;
}

export function FlowRunner({ experience }: { experience: ExperienceDef }) {
  const storeKey = `flow:${experience.id}`;
  const byId = useMemo(() => new Map(experience.screens.map((s) => [s.id, s])), [experience.screens]);
  const initial = useCallback(
    (): RunState => ({ screenId: experience.start, values: { ...experience.initialValues }, history: [] }),
    [experience.start, experience.initialValues]
  );
  const [state, setState] = useState<RunState>(() => {
    const saved = readStore<RunState | null>(storeKey, null);
    return saved && byId.has(saved.screenId) ? saved : initial();
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const { evidenceMode, setEvidenceMode } = useLab();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  const screen = byId.get(state.screenId) ?? byId.get(experience.start)!;

  useEffect(() => { writeStore(storeKey, state); }, [state, storeKey]);

  // Move focus to the new screen's heading for keyboard and screen-reader users.
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    headingRef.current?.focus();
    window.scrollTo({ top: 0 });
  }, [state.screenId]);

  const restart = useCallback(() => {
    clearStore(storeKey);
    setErrors({});
    setBusy(null);
    setState(initial());
  }, [initial, storeKey]);
  useRegisterRestart(restart);

  const set = useCallback((patch: Values) => {
    setState((s) => ({ ...s, values: { ...s.values, ...patch } }));
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(patch)) delete next[k];
      return next;
    });
  }, []);

  const go = useCallback((screenId: string) => {
    if (!byId.has(screenId)) throw new Error(`[${experience.id}] unknown screen "${screenId}"`);
    setErrors({});
    setState((s) => ({ ...s, screenId, history: [...s.history, s.screenId] }));
  }, [byId, experience.id]);

  const back = useCallback(() => {
    setErrors({});
    setState((s) => {
      if (s.history.length === 0) return s;
      const history = s.history.slice(0, -1);
      return { ...s, screenId: s.history[s.history.length - 1], history };
    });
  }, []);

  const run = useCallback(async (action: ActionDef) => {
    if (busy) return;
    if (action.back) { back(); return; }
    const shouldValidate = action.validate ?? action.variant === 'primary';
    if (shouldValidate) {
      const errs = validateScreen(screen, state.values, experience.requiredMessage);
      if (Object.keys(errs).length) {
        setErrors(errs);
        return;
      }
    }
    if (action.loading) {
      setBusy(action.loading.label ?? 'Please wait…');
      await wait(action.loading.ms);
      setBusy(null);
    }
    let values = state.values;
    if (action.set) {
      values = { ...values, ...action.set(values) };
      setState((s) => ({ ...s, values: { ...s.values, ...action.set!(s.values) } }));
    }
    const to = resolve(action.to, values);
    if (to) go(to);
  }, [busy, back, screen, state.values, experience.requiredMessage, go]);

  const onBlur = useCallback((name: string) => {
    const f = visibleFields(screen, state.values).find((x) => x.name === name);
    if (!f || !f.validate) return;
    const v = state.values[name];
    if (isEmpty(v)) return;
    const msg = f.validate(v, state.values);
    setErrors((e) => {
      const next = { ...e };
      if (msg) next[name] = msg; else delete next[name];
      return next;
    });
  }, [screen, state.values]);

  const ctx: FlowCtx = {
    values: state.values, set, go, back, screen, experience, errors,
    run: (a) => { void run(a); },
    busy: !!busy
  };

  const stageIndex = experience.stages.findIndex((s) => s.id === screen.stage);
  const title = resolve(screen.title, state.values) ?? '';
  const subtitle = resolve(screen.subtitle, state.values);
  const actions = screen.actions.filter((a) => !a.when || a.when(state.values));
  const canBack = !screen.noBack && state.history.length > 0;

  const body = (
    <>
      <div className="fx-screen-head">
        <h1 className="fx-title" ref={headingRef} tabIndex={-1}>{title}</h1>
        {subtitle && <p className="fx-subtitle">{subtitle}</p>}
      </div>
      <form
        className="fx-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const primary = actions.find((a) => a.variant === 'primary');
          if (primary && (!primary.enabledWhen || primary.enabledWhen(state.values))) void run(primary);
        }}
      >
        <div className="fx-blocks">
          {screen.blocks.map((b, i) => (
            <BlockView key={i} block={b} ctx={ctx} onChange={(n, v) => set({ [n]: v })} onBlur={onBlur} />
          ))}
        </div>
        {Object.keys(errors).length > 0 && (
          <p className="fx-form-error" role="alert">
            Check the highlighted field{Object.keys(errors).length > 1 ? 's' : ''}.
          </p>
        )}
        <div className="fx-actions">
          {canBack && !actions.some((a) => a.back) && (
            <button type="button" className="fx-btn fx-btn-ghost fx-back" onClick={back} disabled={!!busy}>
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Back
            </button>
          )}
          <span className="fx-actions-spacer" />
          {actions.map((a, i) => {
            const enabled = !a.enabledWhen || a.enabledWhen(state.values);
            const label = resolve(a.label, state.values);
            const isPrimary = a.variant === 'primary';
            return (
              <button
                key={i}
                type={isPrimary ? 'submit' : 'button'}
                className={`fx-btn fx-btn-${a.variant ?? 'secondary'}`}
                disabled={!!busy || !enabled}
                aria-busy={isPrimary && !!busy}
                onClick={isPrimary ? undefined : () => void run(a)}
              >
                {busy && isPrimary ? <><span className="fx-spinner" aria-hidden="true" />{busy}</> : label}
              </button>
            );
          })}
          {screen.terminal && (
            <button type="button" className="fx-btn fx-btn-secondary" onClick={restart}>Start again</button>
          )}
        </div>
      </form>
    </>
  );

  return (
    <div className={`fx-root ${experience.themeClass} ${evidenceMode ? 'with-evidence' : ''}`} data-experience={experience.id} data-screen={screen.id}>
      <div className="fx-lab-strip" aria-label="Lab controls for this experience">
        <div className="fx-lab-strip-left">
          <span className="fx-lab-kind">{experience.kind}</span>
          <span className="fx-lab-screen">
            Screen: <strong>{title}</strong>
          </span>
          <StatusBadge status={screen.status} note={screen.statusNote} />
        </div>
        <div className="fx-lab-strip-right">
          {experience.presets && experience.presets.length > 0 && (
            <div className="fx-presets">
              <button type="button" className="lab-chip-btn" aria-expanded={presetsOpen} onClick={() => setPresetsOpen((o) => !o)}>
                Jump to branch
              </button>
              {presetsOpen && (
                <div className="fx-presets-menu" role="menu">
                  {experience.presets.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      role="menuitem"
                      className="fx-preset"
                      onClick={() => {
                        setPresetsOpen(false);
                        setErrors({});
                        setState({ screenId: p.screen, values: { ...experience.initialValues, ...p.values }, history: [experience.start] });
                      }}
                    >
                      <span className="fx-preset-label">{p.label}</span>
                      <span className="fx-preset-desc">{p.description}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button
            type="button"
            className={`lab-chip-btn ${evidenceMode ? 'is-on' : ''}`}
            aria-pressed={evidenceMode}
            onClick={() => setEvidenceMode(!evidenceMode)}
          >
            Evidence
          </button>
        </div>
      </div>

      <div className="fx-layout">
        <div className="fx-stage">
          <div className="fx-header">{experience.header(ctx)}</div>
          {!screen.hideProgress && experience.stages.length > 1 && stageIndex >= 0 && (
            <ol className="fx-progress" aria-label="Progress">
              {experience.stages.map((s, i) => (
                <li key={s.id} className={i < stageIndex ? 'is-done' : i === stageIndex ? 'is-current' : ''} aria-current={i === stageIndex ? 'step' : undefined}>
                  <span className="fx-progress-dot" aria-hidden="true" />
                  <span className="fx-progress-label">{s.label}</span>
                </li>
              ))}
            </ol>
          )}
          {screen.variant === 'modal' ? (
            <div className="fx-modal-backdrop">
              <div className="fx-modal" role="dialog" aria-modal="false" aria-label={title}>{body}</div>
            </div>
          ) : (
            <main className={`fx-card ${screen.variant === 'center' ? 'fx-center' : ''}`} id="main">{body}</main>
          )}
        </div>
        {evidenceMode && (
          <EvidencePanel
            title={title}
            status={screen.status}
            statusNote={screen.statusNote}
            items={screen.evidence ?? []}
            onClose={() => setEvidenceMode(false)}
          />
        )}
      </div>
      <p className="fx-reach"><strong>Evidence reach.</strong> {experience.reachNote}</p>
    </div>
  );
}

function BlockView({ block, ctx, onChange, onBlur }: { block: Block; ctx: FlowCtx; onChange: (n: string, v: unknown) => void; onBlur: (n: string) => void }) {
  const v = ctx.values;
  if ('when' in block && block.when && !block.when(v)) return null;
  switch (block.type) {
    case 'field':
      if (block.field.when && !block.field.when(v)) return null;
      return <FieldView field={block.field} values={v} error={ctx.errors[block.field.name]} onChange={onChange} onBlur={onBlur} />;
    case 'heading':
      return <h2 className="fx-h2">{resolve(block.text, v)}</h2>;
    case 'text':
      return <p className={`fx-text ${block.muted ? 'fx-muted' : ''}`}>{resolve(block.text, v)}</p>;
    case 'notice': {
      const t = resolve(block.title, v);
      return (
        <div className={`fx-notice fx-notice-${block.tone}`} role={block.tone === 'error' ? 'alert' : 'status'}>
          {t && <p className="fx-notice-title">{t}</p>}
          <p>{resolve(block.text, v)}</p>
        </div>
      );
    }
    case 'list': {
      const items = resolve(block.items, v) ?? [];
      const L = block.ordered ? 'ol' : 'ul';
      return <L className="fx-list">{items.map((it, i) => <li key={i}>{it}</li>)}</L>;
    }
    case 'summary': {
      const rows = block.rows(v);
      return (
        <section className="fx-summary">
          {(block.title || block.editTo) && (
            <div className="fx-summary-head">
              {block.title && <h2 className="fx-h2">{block.title}</h2>}
              {block.editTo && (
                <button type="button" className="fx-link" onClick={() => ctx.go(block.editTo!)}>Edit</button>
              )}
            </div>
          )}
          <dl>
            {rows.map(([k, val]) => (
              <div key={k} className="fx-summary-row">
                <dt>{k}</dt>
                <dd>{val || '-'}</dd>
              </div>
            ))}
          </dl>
        </section>
      );
    }
    case 'custom':
      return <>{block.render(ctx)}</>;
    default:
      return null;
  }
}
