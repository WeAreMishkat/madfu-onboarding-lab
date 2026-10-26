/**
 * Cross-artifact consistency: the Master Board, the Detailed Logic Board, the prototype screens, the
 * state model and Rules & Decisions must describe the same journey — and none of them may carry a
 * behaviour the 2026-10-27 decisions removed.
 */
import { describe, expect, it } from 'vitest';
import { ALL_BOARDS, DETAILED_BOARD, NODE_KIND_LABEL, REUSE_NOTE, SIMPLE_BOARD, routeEdge } from './model/boards';
import { STAGES } from './model/config';
import { OUTCOME_COPY } from './model/copy';
import { CONFIRMED_DECISIONS, DECISION_TABLES, OPEN_ITEMS } from './model/decisions';
import { renderJourneyDoc } from './model/docs';
import { GOV_RULES } from './model/government';
import { PAGE_SCENARIOS } from './model/pageScenarios';
import { SCENARIOS } from './model/scenarios';
import { initialApplication } from './model/state';
import type { OutcomeKind, StepId } from './model/types';
import { STEP_VIEW } from './ProposedPage';

const STEP_IDS = Object.keys(STEP_VIEW) as StepId[];
const OUTCOMES = Object.keys(OUTCOME_COPY) as OutcomeKind[];
const boardSteps = new Set(ALL_BOARDS.flatMap((m) => m.nodes.map((n) => n.step).filter(Boolean)));
const boardOutcomes = new Set(ALL_BOARDS.flatMap((m) => m.nodes.map((n) => n.outcome).filter(Boolean)));
const boardText = (m = ALL_BOARDS) => m.flatMap((b) => [b.caption, ...b.nodes.map((n) => `${n.label} ${n.detail ?? ''}`)]).join(' | ');

describe('one journey model across prototype, boards, rules and docs', () => {
  it('8 stages, in order; every stage maps to prototype screens and every screen to a stage', () => {
    expect(STAGES.map((s) => s.label)).toEqual(['Know Your Business', 'Identify & Verify', 'Business Verification', 'Business Details', 'Commercial Offer', 'Review', 'Contract', 'Submit / Application Status']);
    expect(STAGES.flatMap((s) => s.steps).sort()).toEqual([...STEP_IDS].sort());
    expect(Object.keys(PAGE_SCENARIOS).sort()).toEqual([...STEP_IDS].sort());
  });

  it('the Master Board shows the new top-level flow and the routing fan-out', () => {
    const text = boardText([SIMPLE_BOARD]);
    for (const s of ['Know Your Business', 'Identifier + mobile', 'Existing check', 'OTP', 'Routing', 'Sales lead', 'Blocked', 'New CR', 'New Freelancer', 'Resume', 'Application Progress', 'login']) expect(text).toContain(s);
    for (const s of ['backend only, before Nafath', 'Mobile ↔ National ID → Nafath', 'no CR IBAN, VAT, branches', 'no plan selection', 'Sales recovery']) expect(text).toContain(s);
    expect(text).toContain(REUSE_NOTE);
  });

  it('every prototype screen and every outcome appears on a board', () => {
    for (const step of STEP_IDS) expect(boardSteps.has(step), step).toBe(true);
    for (const o of OUTCOMES) expect(boardOutcomes.has(o), o).toBe(true);
  });

  it('the Detailed Logic Board covers each area as its own panel and labels node kinds', () => {
    expect(DETAILED_BOARD.map((m) => m.id)).toEqual(['kyb', 'identify', 'cr', 'fl', 'nafath', 'details', 'commercial', 'review', 'contract', 'reuse']);
    expect(NODE_KIND_LABEL).toMatchObject({ screen: 'Merchant-facing step', backend: 'Backend / internal step', external: 'External / provider call', decision: 'Decision' });
    const kinds = new Set(DETAILED_BOARD.flatMap((m) => m.nodes.map((n) => n.kind)));
    for (const k of ['screen', 'decision', 'backend', 'external', 'cached', 'manual', 'outcome', 'open'] as const) expect(kinds.has(k), k).toBe(true);
    for (const m of DETAILED_BOARD) expect(Math.max(...m.nodes.map((n) => n.col))).toBeLessThanOrEqual(6);
  });

  it('board geometry: edges point at real nodes, no two nodes share a cell, no edge crosses a node', () => {
    for (const m of ALL_BOARDS) {
      const ids = new Set(m.nodes.map((n) => n.id));
      for (const e of m.edges) {
        expect(ids.has(e.from), `${m.id}: ${e.from}`).toBe(true);
        expect(ids.has(e.to), `${m.id}: ${e.to}`).toBe(true);
      }
      const cells = m.nodes.flatMap((n) => (n.kind === 'note' ? [0, 1, 2] : [0]).map((d) => `${n.col + d}:${n.row}`));
      expect(new Set(cells).size, m.id).toBe(cells.length);
    }
    const crossing = ALL_BOARDS.flatMap((m) => m.edges.filter((e) => routeEdge(m, e).blocked).map((e) => `${m.id}: ${e.from}->${e.to}`));
    expect(crossing, 'edges crossing a node').toEqual([]);
  });

  it('Rules & Decisions: confirmed decisions recorded, open decisions kept open, tables generated', () => {
    expect(CONFIRMED_DECISIONS.length).toBeGreaterThanOrEqual(25);
    expect(OPEN_ITEMS).toHaveLength(16);
    expect(DECISION_TABLES.map((t) => t.id)).toEqual(expect.arrayContaining(['routing', 'lifecycle', 'eligibility', 'government', 'hard-blocks', 'risk', 'activity', 'cost', 'reuse', 'negative', 'edit', 'abuse', 'pricing', 'contract', 'outcomes']));
    // The mobile ↔ National ID check is now logic, not an open "not implemented" note.
    expect(OPEN_ITEMS.some((o) => /mobile ↔ national id provider/i.test(o.title))).toBe(true);
    expect(OPEN_ITEMS.some((o) => /not implemented/i.test(`${o.title} ${o.detail}`))).toBe(false);
  });

  it('every scenario starts on a screen the boards know', () => {
    for (const sc of SCENARIOS) expect(boardSteps.has(sc.build().app.step), sc.id).toBe(true);
  });
});

describe('no leftover behaviour from before 2026-10-27', () => {
  const doc = renderJourneyDoc();
  const live = boardText() + ' | ' + DECISION_TABLES.flatMap((t) => t.rows.flat()).join(' | ');

  it('Page 1 has no website / Maps fields', () => {
    expect(Object.keys(initialApplication().kyb)).not.toContain('websiteUrl');
    expect(Object.keys(initialApplication().kyb)).not.toContain('mapsUrl');
  });

  it('no CR-age hard reject, no CR IBAN, VAT, branch count or plan selection in the model', () => {
    expect(GOV_RULES).not.toHaveProperty('minCrAgeMonths');
    const b = initialApplication().business;
    for (const k of ['vat', 'vatNumber', 'branches', 'bankLinked']) expect(b).not.toHaveProperty(k);
    expect(initialApplication().commercial).not.toHaveProperty('optional');
    expect(live).not.toMatch(/6 \/ 9 \/ 12 optional|plans are multi-selected|VAT yes|branches \(offline\)|IBAN ownership \(business\)/i);
  });

  it('there is no lead form or CR confirmation screen any more', () => {
    expect(STEP_IDS).not.toContain('lead' as StepId);
    expect(STEP_IDS).not.toContain('cr-verify' as StepId);
  });

  it('the generated document records the new journey and lists what was superseded', () => {
    expect(doc).toContain('identifier before OTP');
    expect(doc).toContain('CR age ≤ 3 months → temporarily not eligible (now a risk attribute).');
    expect(doc).toContain('Submitted applications reopening Review / Contract');
  });
});
