/**
 * Cross-artifact consistency: the Master Board, the Detailed Logic Board, the prototype screens, the
 * state model and Rules & Decisions must describe the same journey — and none of them may carry a
 * behaviour the 2026-10-27 decisions removed.
 */
import { describe, expect, it } from 'vitest';
import { ALL_BOARDS, DETAILED_BOARD, NODE_KIND_LABEL, routeEdge } from './model/boards';
import { BOARD_ARROWS, BOARD_BOXES, BOARD_GEOMETRY } from './model/masterBoard';
import { STAGES } from './model/config';
import { NOT_ELIGIBLE_SAVED_COPY, OUTCOME_COPY, REASON_USER_COPY, STATUS_LABEL } from './model/copy';
import { CONFIRMED_DECISIONS, DECISION_TABLES, OPEN_ITEMS } from './model/decisions';
import { ELIGIBILITY_RULES } from './model/eligibility';
import { renderJourneyDoc } from './model/docs';
import { GOV_RULES } from './model/government';
import { PAGE_SCENARIOS } from './model/pageScenarios';
import { SCENARIOS } from './model/scenarios';
import { initialApplication } from './model/state';
import type { OutcomeKind, StepId } from './model/types';
import { STEP_VIEW } from './ProposedPage';

const STEP_IDS = Object.keys(STEP_VIEW) as StepId[];
const OUTCOMES = Object.keys(OUTCOME_COPY) as OutcomeKind[];
const boardSteps = new Set([...ALL_BOARDS.flatMap((m) => m.nodes.map((n) => n.step)), ...BOARD_BOXES.map((b) => b.step)].filter(Boolean));
const boardOutcomes = new Set(ALL_BOARDS.flatMap((m) => m.nodes.map((n) => n.outcome).filter(Boolean)));
const boardText = (m = ALL_BOARDS) => m.flatMap((b) => [b.caption, ...b.nodes.map((n) => `${n.label} ${n.detail ?? ''}`)]).join(' | ');

describe('one journey model across prototype, boards, rules and docs', () => {
  it('8 stages, in order; every stage maps to prototype screens and every screen to a stage', () => {
    expect(STAGES.map((s) => s.label)).toEqual(['Know Your Business', 'Identify & Verify', 'Business Verification', 'Business Details', 'Commercial Offer', 'Review', 'Contract', 'Submit / Application Status']);
    expect(STAGES.flatMap((s) => s.steps).sort()).toEqual([...STEP_IDS].sort());
    expect(Object.keys(PAGE_SCENARIOS).sort()).toEqual([...STEP_IDS].sort());
  });

  it('the Master Board is a visual screen flow: entry, routing fan-out and both self-onboarding paths', () => {
    const row = (r: number) => BOARD_BOXES.filter((b) => b.row === r).sort((a, b) => a.col - b.col).map((b) => b.title);
    expect(row(0)).toEqual(['Not Eligible', 'Know Your Business', 'Identify', 'OTP', 'Not Eligible · Details Received', 'Resume Application', 'Application Progress', 'Login']);
    expect(row(1)).toEqual(['Registered Business', 'Owner / Manager', 'Nafath', 'Business Details', 'Offer', 'Review', 'Contract', 'Submitted']);
    expect(row(2)).toEqual(['Freelancer', 'Nafath', 'Certificate', 'Business Details + IBAN', 'Offer', 'Review', 'Contract', 'Submitted']);
    const labels = BOARD_ARROWS.flatMap((a) => a.pills ?? []);
    expect(labels.filter((p) => p.kind === 'label').map((p) => p.text).sort()).toEqual(['Freelancer without Certificate', 'Live', 'New', 'Not Eligible category', 'Registered Business / Freelancer with Certificate', 'Resume', 'Submitted']);
    expect(labels.filter((p) => p.kind === 'check').map((p) => p.text).sort()).toEqual(['CR verification', 'Certificate check', 'Mobile match', 'Mobile match']);
    // Simple and visual: short captions, no technical vocabulary.
    const text = BOARD_BOXES.map((b) => `${b.title} ${b.caption ?? ''}`).join(' | ') + labels.map((p) => p.text).join(' | ');
    expect(text).not.toMatch(/sales|lead|blocked|API|adapter|KYB-R|rule id|fingerprint|ledger/i);
    for (const b of BOARD_BOXES) expect((b.caption ?? '').split(' ').length, b.id).toBeLessThanOrEqual(8);
  });

  it('every Master Board box shows the real screen it names (built with the prototype transitions)', () => {
    for (const b of BOARD_BOXES.filter((x) => x.tone !== 'lane')) {
      const app = b.state!().app;
      expect(app.step, b.id).toBe(b.step);
      if (b.outcome) expect(app.outcome, b.id).toBe(b.outcome);
    }
    expect(BOARD_BOXES.find((b) => b.id === 'fl-no-cert')!.state!().app.id).toBeNull();
    expect(BOARD_BOXES.find((b) => b.id === 'not-eligible')!.state!().app).toMatchObject({ status: 'NOT_ELIGIBLE', outcomeReason: 'CATEGORY_NOT_SUPPORTED' });
  });

  it('Master Board geometry: boxes inside the canvas and apart; every arrow starts and ends on a box edge', () => {
    const G = BOARD_GEOMETRY;
    const rect = (b: (typeof BOARD_BOXES)[number]) => ({ x: G.colX(b.col), y: G.rowY[b.row], w: G.boxW, h: G.boxH });
    const cells = BOARD_BOXES.map((b) => `${b.col}:${b.row}`);
    expect(new Set(cells).size).toBe(cells.length);
    for (const b of BOARD_BOXES) { const r = rect(b); expect(r.x + r.w, b.id).toBeLessThanOrEqual(G.width); expect(r.y + r.h, b.id).toBeLessThanOrEqual(G.height); }
    const onEdge = (p: { x: number; y: number }) => BOARD_BOXES.some((b) => {
      const r = rect(b);
      const inX = p.x >= r.x && p.x <= r.x + r.w;
      const inY = p.y >= r.y && p.y <= r.y + r.h;
      return (inY && (p.x === r.x || p.x === r.x + r.w)) || (inX && (p.y === r.y || p.y === r.y + r.h));
    });
    for (const a of BOARD_ARROWS) {
      expect(onEdge(a.points.at(-1)!), `${a.id} end`).toBe(true);
      for (let i = 1; i < a.points.length; i++) expect(a.points[i].x === a.points[i - 1].x || a.points[i].y === a.points[i - 1].y, `${a.id} orthogonal`).toBe(true);
    }
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

describe('eligibility: only Eligible / Not Eligible, consistent terminology', () => {
  it('no Sales-lead, Blocked or revenue routing anywhere in the model', () => {
    expect(new Set(ELIGIBILITY_RULES.map((r) => r.result))).toEqual(new Set(['ELIGIBLE', 'NOT_ELIGIBLE']));
    expect(ELIGIBILITY_RULES.map((r) => r.reason)).not.toEqual(expect.arrayContaining(['REVENUE_ABOVE_BAND']));
    expect(Object.keys(STATUS_LABEL)).not.toEqual(expect.arrayContaining(['SALES_LEAD']));
    expect(Object.keys(STATUS_LABEL)).not.toContain('BLOCKED');
    expect(Object.keys(OUTCOME_COPY).sort()).toEqual(['NOT_ELIGIBLE', 'PAUSED_CR', 'SUBMITTED', 'SUBMITTED_MANUAL']);
    expect(STEP_IDS).not.toContain('lead' as StepId);
  });

  it('merchant-facing copy says "Not Eligible", never Blocked / Blacklisted / Rejected / Sales lead', () => {
    const copy = [...Object.values(OUTCOME_COPY).flatMap((c) => [c.title, c.body]), ...Object.values(REASON_USER_COPY).flatMap((c) => [c!.title ?? '', c!.text]), NOT_ELIGIBLE_SAVED_COPY.title, NOT_ELIGIBLE_SAVED_COPY.body].join(' | ');
    expect(copy).not.toMatch(/blocked|blacklist|rejected|sales lead/i);
    expect(OUTCOME_COPY.NOT_ELIGIBLE.title).toMatch(/Not eligible/i);
    expect(`${NOT_ELIGIBLE_SAVED_COPY.title} ${REASON_USER_COPY.CATEGORY_NOT_SUPPORTED!.text} ${NOT_ELIGIBLE_SAVED_COPY.body}`).toBe('Thank you. We’ve received your details. This business activity is currently not eligible for Madfu onboarding. We may contact you if eligibility changes in the future.');
  });

  it('boards label every stop as Not Eligible (the paused CR route keeps its Sales follow-up)', () => {
    const outcomes = ALL_BOARDS.flatMap((m) => m.nodes.filter((n) => n.outcome === 'NOT_ELIGIBLE'));
    expect(outcomes.length).toBeGreaterThanOrEqual(6);
    for (const n of outcomes) expect(n.label).toMatch(/Not Eligible/);
    expect(ALL_BOARDS.flatMap((m) => m.nodes.filter((n) => n.kind !== 'note').map((n) => n.label)).join(' | ')).not.toMatch(/\bBlocked\b|Sales lead/);
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
