/**
 * The Madfu Proposed product-rule document, rendered from the same model the prototype and boards use.
 * Written to docs/MADFU_PROPOSED_JOURNEY.md by `npm run docs`; a test fails if the file is stale.
 */
import { DETAILED_BOARD, REUSE_NOTE, SIMPLE_BOARD } from './boards';
import { LIMITS, STAGES } from './config';
import { ASSUMPTIONS, CONFIRMED_DECISIONS, DECISION_TABLES, OPEN_ITEMS, OTHER_OPEN_POINTS, type Table } from './decisions';
import { PAGE_SCENARIOS, pageScenarios } from './pageScenarios';
import { JOURNEY_PRESETS, SCENARIOS, SCENARIO_GROUPS, scenarioById } from './scenarios';
import type { StepId } from './types';

const esc = (s: string) => s.replace(/\|/g, '\\|');
const md = (t: Table) => [
  `### ${t.title}`,
  '',
  `| ${t.head.map(esc).join(' | ')} |`,
  `| ${t.head.map(() => '---').join(' | ')} |`,
  ...t.rows.map((r) => `| ${r.map(esc).join(' | ')} |`),
  ...(t.note ? ['', `_${t.note}_`] : []),
  ''
].join('\n');

const BACKLOG_COLUMNS = {
  'Onboarding Decision & Validation Inventory (incl. hard blocks)': ['Source', 'Field', 'Condition', 'Hard block or risk factor', 'Regulatory / business / internal', 'Evaluation stage', 'User-visible message', 'Lifecycle status', 'Manual / Sales follow-up', 'External-call / cost impact', 'Rule version'],
  'Eligibility Matrix': ['Category', 'Subcategory', 'Applicant type', 'Sales channel', 'Revenue band (if relevant)', 'Result (self-onboarding / Sales / blocked)', 'Required CR / certificate', 'Regulatory restriction', 'Personalised reason', 'Rule version'],
  'Government activity → category mapping': ['Activity code', 'Activity name', 'Madfu category', 'Madfu subcategory', 'Eligible for (CR / FL)', 'Multi-activity precedence', 'Version'],
  'Pricing & Commission Matrix': ['Verified category', 'Subcategory', 'Merchant tier', 'Standard commission', 'Rate-review logic', 'Proof requirement', 'Effective date / version']
};

/** Superseded by the 2026-10-27 decisions (still visible in older PDFs / Madfu Current where observed). */
const REMOVED = [
  'Website / Google Maps link on Page 1 (now Business Details).',
  'Page-1 manual-review and temporarily-paused category routes (categories are allowed or blocked).',
  'Lead-contact form (name + mobile) before OTP: Sales leads now give identifier + mobile on Page 2.',
  'A new application for an identifier that already has one; access with a newly entered mobile.',
  'Submitted applications reopening Review / Contract on resume (status-blind routing).',
  'Separate CR confirmation page with only "Next".',
  'CR age ≤ 3 months → temporarily not eligible (now a risk attribute).',
  'Expired CR → manual verification; suspended → not eligible (both now: saved + Sales recovery).',
  'Pairwise category ↔ activity table (MATCH / COMPATIBLE / AMBIGUOUS / CONFLICT) and the "Continue; Madfu will confirm" screen.',
  'Pricing from the declared category after verification.',
  'Nafath before the Freelancer Certificate check (backend order).',
  'Mobile ↔ selected-owner mismatch as a note only (now functional before Nafath).',
  'Registered-business IBAN, VAT question / number, number of branches, Freelancer "bank not linked → continue".',
  '3 / 4 / 6 / 9 / 12-month plan selection in the Commercial Offer and plans in the Contract.',
  'Unrestricted Review editing; Cancel that did not restore selections.',
  'Unlimited OTP resends resetting the attempts.'
];

/** Representative catalogue states used to list each screen's Page Scenarios in the doc. */
const PAGE_DOC_STATES: Array<[StepId, string]> = [
  ['kyb', 'kyb-cr-online'], ['identify', 'id-new-cr'], ['otp', 'otp-errors'], ['persons', 'cr-business'], ['nafath', 'fl-nafath'], ['certificates', 'fl-certs-multi'],
  ['business', 'biz-fl'], ['commercial', 'com-standard'], ['review', 'review'], ['contract', 'contract'], ['status', 'status-approved']
];

export function renderJourneyDoc(): string {
  const out: string[] = [];
  out.push('# Madfu Proposed — merchant self-onboarding (v4: identifier before OTP, lifecycle routing)', '');
  out.push('> Generated from the Merchant Onboarding Lab model (`src/experiences/proposed/model/`) by `npm run docs`. Do not edit by hand: change the model and regenerate. A test fails when this file is out of date.', '');
  out.push('**Status:** Proposed / Product Design. Synthetic data; simulated integrations. Not production behaviour.', '');
  out.push('**Source of truth:** the agreed product decisions of 2026-10-27. They supersede the KYB-first v3 journey (2026-10-23) and the 2026-10-15 wireframe specification where they differ. Madfu Current, Tamara and Tabby are unchanged.', '');
  out.push('**Principle:** ask cheaply first, verify expensively later, never ask twice, never repeat a paid verification unnecessarily, and never open an existing application without its registered mobile.', '');
  out.push(`**Cost rule:** ${REUSE_NOTE}`, '');

  out.push('## Journey', '');
  out.push('1. Page 1 — Know Your Business: applicant type, category, subcategory, annual revenue, sales channel. Preliminary eligibility (internal).');
  out.push('2. Page 2 — identifier (CR / National ID) + mobile + one prerequisite question (self-onboarding only).');
  out.push('3. Internal existence check (no provider): new · incomplete · submitted · live · paused.');
  out.push('4. OTP — new: to the entered mobile (contact_mobile_verified); existing: to the REGISTERED mobile, last three digits shown.');
  out.push('5. Routing by lifecycle status, eligibility and declaration: Sales lead · blocked · new CR · new Freelancer · resume · Application Progress · login.');
  out.push('6. Self-onboarding: Business Verification (CR data + owners / managers, or certificate pre-check) → mobile ↔ National ID → Nafath → (Freelancer: certificate) → Business Details → Commercial Offer → Review → Contract → Submit → Application Progress.', '');

  out.push('## Stages', '');
  out.push('| # | Stage | Screens |', '| --- | --- | --- |');
  for (const s of STAGES) out.push(`| ${s.n} | ${s.label} | ${s.steps.join(', ')} |`);
  out.push('');

  out.push('## Confirmed product decisions', '');
  for (const d of CONFIRMED_DECISIONS) out.push(`- ${d}`);
  out.push('');

  out.push('## Master Board', '', SIMPLE_BOARD.caption, '');
  for (const n of SIMPLE_BOARD.nodes.filter((x) => x.kind !== 'note')) out.push(`- **${n.label}** _(${n.kind})_${n.detail ? ` — ${n.detail}` : ''}`);
  out.push('');

  out.push('## Detailed Logic Board (one panel per area)', '');
  for (const m of DETAILED_BOARD) {
    out.push(`### ${m.title}`, '', m.caption, '');
    for (const n of m.nodes.filter((x) => x.kind !== 'connector' && x.kind !== 'note')) {
      out.push(`- **${n.label}** _(${n.kind})_${n.detail ? ` — ${n.detail}` : ''}`);
    }
    out.push('');
  }

  out.push('## Resume / Continue Application', '');
  out.push('1. **Save & exit** (DRAFT only) sends a Continue Application link to the registered mobile. Links stop working on submission or when the mobile changes.');
  out.push('2. Opening the link — or entering the same identifier on Page 2 — identifies the application but does **not** authorise access: the code goes to the registered mobile.');
  out.push('3. After the code, routing reads the lifecycle status: DRAFT → first unfinished stage (every valid check reused); submitted → Application Progress; live → login; paused → Sales follow-up.');
  out.push(`4. OTP: ${LIMITS.otpAttempts} attempts per code, ${LIMITS.otpResends} resends; a resend never restores the budget. Provider retry counters and Nafath technical failures reset per session.`, '');

  out.push('## Rules and decision tables', '');
  for (const t of DECISION_TABLES) out.push(md(t));

  out.push('## Open decisions', '');
  out.push('These are **not confirmed rules**. The prototype implements each configurably with synthetic values.', '');
  for (const o of OPEN_ITEMS) out.push(`- **${o.id} · ${o.type} — ${o.title}.** ${o.detail}`);
  out.push('', 'Other open points:', '');
  for (const p of OTHER_OPEN_POINTS) out.push(`- ${p}`);
  out.push('');

  out.push('## Backlog templates (columns to fill)', '');
  for (const [title, cols] of Object.entries(BACKLOG_COLUMNS)) {
    out.push(`### ${title} — PRODUCT TASK`, '', `| ${cols.join(' | ')} |`, `| ${cols.map(() => '---').join(' | ')} |`, `| ${cols.map(() => '…').join(' | ')} |`, '');
  }

  out.push('## Prototype Controls', '');
  out.push('Three separate areas, none of them merchant UI: **This step** (Page Scenarios: only what can happen on the current screen), **Start demo** (journey presets, received Continue links) and **Internal view** (lifecycle, routing, eligibility, verified category, activities, risk, hard blocks, mobiles, checks called / reused / invalidated, cost assumptions, next paid call, rate review, ledger).', '');
  out.push('Journey presets (Start demo): ' + JOURNEY_PRESETS.map((p) => p.label).join(' · ') + '.', '');
  out.push('### Page Scenarios per screen', '');
  out.push('Generated from `model/pageScenarios.ts`; options depend on the current state (e.g. applicant type, channel).', '');
  for (const [step, sample] of PAGE_DOC_STATES) {
    const s = scenarioById(sample)!.build();
    const { page, groups } = pageScenarios({ ...s, app: { ...s.app, step } });
    out.push(`- **${PAGE_SCENARIOS[step].title}** (${page.integrations.join(', ') || 'no integration'}): ${groups.map((g) => `${g.title}: ${g.options.map((o) => o.label).join(' / ')}`).join(' — ') || 'no simulated outcomes'}`);
  }
  out.push('');
  out.push('## Scenario catalogue (automated test coverage)', '');
  for (const g of SCENARIO_GROUPS) {
    out.push(`### ${g}`, '');
    for (const s of SCENARIOS.filter((x) => x.group === g)) out.push(`- **${s.label}** — ${s.hint}`);
    out.push('');
  }

  out.push('## Assumptions in the prototype', '');
  for (const a of ASSUMPTIONS) out.push(`- ${a}`);
  out.push('', '## Superseded in Madfu Proposed', '');
  for (const r of REMOVED) out.push(`- ${r}`);
  out.push('');
  return out.join('\n');
}
