/**
 * Cross-artifact consistency: the Simple Master Board, the Detailed Master Board, the prototype screens
 * and the decision tables must describe the same journey (stages, screens, outcomes, rules).
 */
import { describe, expect, it } from 'vitest';
import { ALL_BOARDS, DETAILED_BOARD, REUSE_NOTE, SIMPLE_BOARD, routeEdge } from './model/boards';
import { STAGES } from './model/config';
import { OUTCOME_COPY } from './model/copy';
import { DECISION_TABLES, OPEN_ITEMS } from './model/decisions';
import { SCENARIOS } from './model/scenarios';
import type { OutcomeKind, StepId } from './model/types';
import { STEP_VIEW } from './ProposedPage';

const STEP_IDS = Object.keys(STEP_VIEW) as StepId[];
const OUTCOMES = Object.keys(OUTCOME_COPY) as OutcomeKind[];
const boardSteps = new Set(ALL_BOARDS.flatMap((m) => m.nodes.map((n) => n.step).filter(Boolean)));
const boardOutcomes = new Set(ALL_BOARDS.flatMap((m) => m.nodes.map((n) => n.outcome).filter(Boolean)));

describe('one journey model across boards, prototype and docs', () => {
  it('8 stages, in order, starting with Know Your Business; every stage maps to prototype screens', () => {
    expect(STAGES.map((s) => s.label)).toEqual(['Know Your Business', 'Identify & Verify', 'Business Verification', 'Business & Banking Details', 'Commercial Offer', 'Review', 'Contract', 'Submit / Outcome']);
    for (const s of STAGES) for (const step of s.steps) expect(STEP_IDS).toContain(step);
    expect(STAGES.flatMap((s) => s.steps).sort()).toEqual([...STEP_IDS].sort());
  });

  it('the Simple Master Board shows every stage, the side branches and the resume path', () => {
    const text = SIMPLE_BOARD.nodes.map((n) => `${n.label} ${n.detail ?? ''}`).join(' | ');
    for (const s of STAGES) expect(text).toContain(s.label);
    for (const b of ['Not eligible', 'Freelancer without certificate → Lead', 'CR revenue → Sales route', 'Manual verification', 'Banking setup required', 'Resume link', 'OTP', 'Last valid stage']) expect(text).toContain(b);
    expect(text).toContain(REUSE_NOTE);
  });

  it('every prototype screen and every outcome appears on a board', () => {
    for (const step of STEP_IDS) expect(boardSteps.has(step), step).toBe(true);
    for (const o of OUTCOMES) expect(boardOutcomes.has(o), o).toBe(true);
  });

  it('the Detailed Master Board covers each area as its own panel (no single giant chain)', () => {
    expect(DETAILED_BOARD.map((m) => m.id)).toEqual(['kyb', 'identify', 'cr', 'fl', 'banking', 'commercial', 'review', 'contract']);
    const kinds = new Set(DETAILED_BOARD.flatMap((m) => m.nodes.map((n) => n.kind)));
    for (const k of ['screen', 'decision', 'external', 'cached', 'manual', 'outcome', 'open'] as const) expect(kinds.has(k), k).toBe(true);
    for (const m of DETAILED_BOARD) expect(Math.max(...m.nodes.map((n) => n.col))).toBeLessThanOrEqual(6);
  });

  it('board geometry: edges point at real nodes and no two nodes share a cell', () => {
    for (const m of ALL_BOARDS) {
      const ids = new Set(m.nodes.map((n) => n.id));
      for (const e of m.edges) {
        expect(ids.has(e.from), `${m.id}: ${e.from}`).toBe(true);
        expect(ids.has(e.to), `${m.id}: ${e.to}`).toBe(true);
      }
      const cells = m.nodes.map((n) => `${n.col}:${n.row}`);
      expect(new Set(cells).size, m.id).toBe(cells.length);
    }
    const crossing = ALL_BOARDS.flatMap((m) => m.edges.filter((e) => routeEdge(m, e).blocked).map((e) => `${m.id}: ${e.from}->${e.to}`));
    expect(crossing, 'edges crossing a node').toEqual([]);
  });

  it('plans belong to the Commercial Offer, not the Contract, on the boards too', () => {
    const contract = DETAILED_BOARD.find((m) => m.id === 'contract')!;
    const commercial = DETAILED_BOARD.find((m) => m.id === 'commercial')!;
    expect(commercial.nodes.some((n) => n.label === 'Payment plans' && n.step === 'commercial')).toBe(true);
    expect(contract.nodes.some((n) => /plan/i.test(n.label))).toBe(false);
  });

  it('the 8 open items are all marked as tasks / decisions, and the rules tables are generated', () => {
    expect(OPEN_ITEMS).toHaveLength(8);
    expect(OPEN_ITEMS.filter((o) => o.type === 'PRODUCT TASK')).toHaveLength(4);
    expect(OPEN_ITEMS.filter((o) => o.type === 'COMPLIANCE DECISION')).toHaveLength(1);
    expect(DECISION_TABLES.map((t) => t.id)).toEqual(expect.arrayContaining(['eligibility', 'government', 'activity', 'reuse', 'invalidation', 'pricing', 'contract', 'outcomes']));
  });

  it('every scenario starts on a screen the boards know', () => {
    for (const sc of SCENARIOS) expect(boardSteps.has(sc.build().app.step), sc.id).toBe(true);
  });
});
