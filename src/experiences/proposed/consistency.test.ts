/**
 * Cross-artifact consistency: the Master Board, the Detailed Logic Board, the prototype screens, the
 * state model and Rules & Decisions must describe the same journey — and none of them may carry a
 * behaviour the 2026-10-27 / 2026-10-28 decisions removed.
 */
import { describe, expect, it } from 'vitest';
import { ALL_BOARDS, DETAILED_BOARD, NODE_KIND_LABEL, routeEdge } from './model/boards';
import { BOARD_ARROWS, BOARD_BOXES, BOARD_GEOMETRY } from './model/masterBoard';
import { HANDOFF_RULES, STAGES } from './model/config';
import { OUTCOME_COPY, PREPARER_AUTH_VIEW, REASON_USER_COPY, SIGNER_DONE_COPY, STATUS_COPY, STATUS_LABEL } from './model/copy';
import { CONFIRMED_DECISIONS, DECISION_TABLES, OPEN_ITEMS, PHASE_1, PHASE_2 } from './model/decisions';
import { ELIGIBILITY_RULES } from './model/eligibility';
import { renderJourneyDoc } from './model/docs';
import { GOV_RULES } from './model/government';
import { PAGE_SCENARIOS } from './model/pageScenarios';
import { JOURNEY_PRESETS, SCENARIOS, WORKFLOWS } from './model/scenarios';
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
    expect(STAGES.map((s) => s.label)).toEqual(['Know Your Business', 'Identify & Verify', 'Business Verification', 'Business Details', 'Commercial Offer', 'Review', 'Authorization & Contract', 'Submit / Application Status']);
    expect(STAGES.flatMap((s) => s.steps).sort()).toEqual([...STEP_IDS].sort());
    expect(Object.keys(PAGE_SCENARIOS).sort()).toEqual([...STEP_IDS].sort());
  });

  it('the eight target workflows are the Start demo groups, each with at least one preset', () => {
    expect([...WORKFLOWS]).toEqual(['New Eligible CR Merchant', 'New Eligible Freelancer', 'Not Eligible Application', 'Existing In-Progress CR Merchant — Resume', 'Existing In-Progress Freelancer — Resume', 'Submitted Application', 'Existing Live Merchant', 'CR Merchant Signer Flow']);
    for (const w of WORKFLOWS) expect(JOURNEY_PRESETS.some((p) => p.workflow === w), w).toBe(true);
    for (const p of JOURNEY_PRESETS) expect(SCENARIOS.some((s) => s.id === p.id), p.id).toBe(true);
  });

  it('the Master Board is a visual screen flow: shared start, routing, CR, signer and Freelancer lanes', () => {
    const row = (r: number) => BOARD_BOXES.filter((b) => b.row === r).sort((a, b) => a.col - b.col).map((b) => b.title);
    expect(row(0)).toEqual(['Know Your Business', 'Identify', 'OTP', 'Application Submitted', 'Resume · CR', 'Resume · Freelancer', 'Application Progress', 'Active Account']);
    expect(row(1)).toEqual(['Registered Business', 'CR Verification', 'Business Details', 'Commercial Offer', 'Review', 'Authorization Choice', 'Nafath', 'Contract', 'Submitted']);
    expect(row(2)).toEqual(['Signer', 'Waiting for Authorization', 'Secure Link', 'Nafath', 'Read-only Review', 'Contract', 'Submitted', 'Delegated Signer · Phase 2']);
    expect(row(3)).toEqual(['Freelancer', 'Certificate', 'Nafath', 'Business Details + IBAN', 'Commercial Offer', 'Review', 'Contract', 'Submitted']);
    const pills = BOARD_ARROWS.flatMap((a) => a.pills ?? []);
    expect(pills.filter((p) => p.kind === 'label').map((p) => p.text).sort()).toEqual(['Live', 'New', 'New Freelancer', 'Not Eligible', 'Phase 2', 'Resume CR', 'Resume Freelancer', 'SMS link', 'Self', 'Send to signer', 'Submitted']);
    expect(pills.filter((p) => p.kind === 'check').map((p) => p.text)).toEqual(['Mobile match', 'Mobile match']);
    expect(BOARD_ARROWS.filter((a) => a.dashed).map((a) => a.id)).toEqual(['signer-delegation']);
    // Simple and visual: short captions, no technical vocabulary.
    const text = BOARD_BOXES.map((b) => `${b.title} ${b.caption ?? ''}`).join(' | ') + pills.map((p) => p.text).join(' | ');
    expect(text).not.toMatch(/sales|lead|blocked|reject|API|adapter|KYB-R|rule id|fingerprint|ledger/i);
    for (const b of BOARD_BOXES) expect((b.caption ?? '').split(' ').length, b.id).toBeLessThanOrEqual(8);
  });

  it('every Master Board box shows the real screen it names (built with the prototype transitions)', () => {
    for (const b of BOARD_BOXES.filter((x) => x.tone !== 'lane')) {
      const app = b.state!().app;
      expect(app.step, b.id).toBe(b.step);
      if (b.outcome) expect(app.outcome, b.id).toBe(b.outcome);
    }
    expect(BOARD_BOXES.find((b) => b.id === 'not-eligible')!.state!().app).toMatchObject({ status: 'NOT_ELIGIBLE', outcome: 'RECEIVED', outcomeReason: 'CATEGORY_NOT_SUPPORTED' });
    for (const id of ['signer-link', 'signer-nafath', 'signer-review', 'signer-contract']) expect(BOARD_BOXES.find((b) => b.id === id)!.state!().app.actor, id).toBe('signer');
    expect(BOARD_BOXES.find((b) => b.id === 'handoff')!.state!().app.status).toBe('AWAITING_AUTHORIZATION');
  });

  it('Master Board geometry: boxes inside the canvas and apart; every arrow ends on a box edge and is orthogonal', () => {
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
    const inside = (p: { x: number; y: number }) => BOARD_BOXES.some((b) => { const r = rect(b); return p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h; });
    for (const a of BOARD_ARROWS) {
      expect(onEdge(a.points.at(-1)!), `${a.id} end`).toBe(true);
      for (let i = 1; i < a.points.length; i++) expect(a.points[i].x === a.points[i - 1].x || a.points[i].y === a.points[i - 1].y, `${a.id} orthogonal`).toBe(true);
      // Bends never sit inside a box.
      for (const p of a.points.slice(1, -1)) expect(inside(p), `${a.id} bend inside a box`).toBe(false);
    }
  });

  it('every prototype screen and every outcome appears on a board', () => {
    for (const step of STEP_IDS) expect(boardSteps.has(step), step).toBe(true);
    for (const o of OUTCOMES) expect(boardOutcomes.has(o), o).toBe(true);
  });

  it('the Detailed Logic Board covers each area as its own panel and labels node kinds', () => {
    expect(DETAILED_BOARD.map((m) => m.id)).toEqual(['kyb', 'identify', 'cr', 'fl', 'nafath', 'details', 'commercial', 'review', 'authorize', 'signer', 'contract', 'reuse', 'states']);
    expect(NODE_KIND_LABEL).toMatchObject({ screen: 'Merchant-facing step', backend: 'Backend / internal step', external: 'External / provider call', decision: 'Decision' });
    const kinds = new Set(DETAILED_BOARD.flatMap((m) => m.nodes.map((n) => n.kind)));
    for (const k of ['screen', 'decision', 'backend', 'external', 'cached', 'manual', 'outcome', 'open'] as const) expect(kinds.has(k), k).toBe(true);
    for (const m of DETAILED_BOARD) expect(Math.max(...m.nodes.map((n) => n.col))).toBeLessThanOrEqual(6);
    const text = boardText();
    for (const topic of ['Lifecycle + authorization', 'Entered mobile ≠ stored', 'active account', 'Application + offer frozen', 'Secure SMS link', 'Read-only Review', `≤ ${HANDOFF_RULES.maxVersions} in ${HANDOFF_RULES.windowDays} days?`, 'Expired / ended', 'PHASE 2 · Delegated signer', 'PHASE 1', 'PHASE 2 / FUTURE', 'AWAITING_AUTHORIZATION', 'NAFATH_VERIFIED']) {
      expect(text, topic).toContain(topic);
    }
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

  it('Rules & Decisions: confirmed decisions recorded, Phase 1 / Phase 2 split, open decisions kept open, tables generated', () => {
    expect(CONFIRMED_DECISIONS.length).toBeGreaterThanOrEqual(30);
    expect(OPEN_ITEMS).toHaveLength(20);
    expect(PHASE_1).toEqual(expect.arrayContaining(['Signer secure SMS link — no signer OTP', 'No send-back / request-changes loop', `Maximum ${HANDOFF_RULES.maxVersions} handoff versions within ${HANDOFF_RULES.windowDays} days (then internal unlock)`]));
    expect(PHASE_2).toEqual(expect.arrayContaining(['Delegated signer production implementation', 'Ministry of Justice delegation integration', 'Resend / revoke workflow']));
    expect(DECISION_TABLES.map((t) => t.id)).toEqual(expect.arrayContaining(['phases', 'routing', 'lifecycle', 'authorization', 'handoff', 'eligibility', 'government', 'hard-blocks', 'risk', 'activity', 'cost', 'reuse', 'negative', 'edit', 'abuse', 'pricing', 'contract', 'outcomes', 'conflicts']));
    expect(OPEN_ITEMS.some((o) => /mobile ↔ national id provider/i.test(o.title))).toBe(true);
    expect(OPEN_ITEMS.some((o) => /not implemented/i.test(`${o.title} ${o.detail}`))).toBe(false);
  });

  it('every scenario starts on a screen the boards know', () => {
    for (const sc of SCENARIOS) expect(boardSteps.has(sc.build().app.step), sc.id).toBe(true);
  });
});

describe('Not Eligible is internal only; consistent merchant terminology', () => {
  it('eligibility has two internal results; no Sales-lead, Blocked or revenue routing anywhere in the model', () => {
    expect(new Set(ELIGIBILITY_RULES.map((r) => r.result))).toEqual(new Set(['ELIGIBLE', 'NOT_ELIGIBLE']));
    expect(Object.keys(STATUS_LABEL)).not.toEqual(expect.arrayContaining(['SALES_LEAD']));
    expect(Object.keys(STATUS_LABEL)).not.toContain('BLOCKED');
    expect(Object.keys(OUTCOME_COPY).sort()).toEqual(['PAUSED_CR', 'RECEIVED', 'SUBMITTED', 'SUBMITTED_MANUAL']);
    expect(STEP_IDS).not.toContain('lead' as StepId);
  });

  it('merchant-facing copy never says Not eligible / Rejected / Blacklisted / Blocked, and has no not-eligible reasons', () => {
    const copy = [
      ...Object.values(OUTCOME_COPY).flatMap((c) => [c.title, c.body]),
      ...Object.values(REASON_USER_COPY).flatMap((c) => [c!.title ?? '', c!.text]),
      ...Object.values(STATUS_COPY).flatMap((c) => [c!.title, c!.body]),
      SIGNER_DONE_COPY.title, SIGNER_DONE_COPY.body,
      ...Object.values(PREPARER_AUTH_VIEW).flatMap((v) => [v.label, v.body])
    ].join(' | ');
    expect(copy).not.toMatch(/not eligible|ineligible|blocked|blacklist|reject|sales lead/i);
    expect(Object.keys(REASON_USER_COPY).sort()).toEqual(['CR_EXPIRED', 'CR_RESTRICTED', 'CR_SUSPENDED']);
    expect(OUTCOME_COPY.RECEIVED).toEqual(OUTCOME_COPY.SUBMITTED);
  });

  it('boards show every internal Not Eligible stop as "Application submitted" to the merchant', () => {
    const captured = ALL_BOARDS.flatMap((m) => m.nodes.filter((n) => n.outcome === 'RECEIVED'));
    expect(captured.length).toBeGreaterThanOrEqual(5);
    for (const n of captured) expect(n.label).toBe('Application submitted');
    expect(ALL_BOARDS.flatMap((m) => m.nodes.filter((n) => n.kind !== 'note').map((n) => n.label)).join(' | ')).not.toMatch(/\bBlocked\b|Sales lead/);
  });
});

describe('no leftover behaviour from before 2026-10-27 / 2026-10-28', () => {
  const doc = renderJourneyDoc();
  // The conflicts table documents removed behaviour on purpose; everything else must not carry it.
  const live = boardText() + ' | ' + DECISION_TABLES.filter((t) => t.id !== 'conflicts').flatMap((t) => t.rows.flat()).join(' | ');

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

  it('there is no lead form, CR confirmation-only page, owner question on Page 2 or hidden certificate pre-check', () => {
    expect(STEP_IDS).not.toContain('lead' as StepId);
    expect(STEP_IDS).not.toContain('persons' as StepId);
    expect(initialApplication().certs).not.toHaveProperty('precheck');
    expect(live).not.toMatch(/Are you an owner or manager registered on this CR/);
  });

  it('the generated document records the new journey and lists what was superseded', () => {
    expect(doc).toContain('identifier before OTP');
    expect(doc).toContain('## Phase 1 vs Phase 2');
    expect(doc).toContain('CR Merchant Signer Flow');
    expect(doc).toContain('CR age ≤ 3 months → temporarily not eligible (now a risk attribute).');
    expect(doc).toContain('Submitted applications reopening Review / Contract');
    expect(doc).toContain('Merchant-facing "Not Eligible" pages with a personalised reason');
  });
});
