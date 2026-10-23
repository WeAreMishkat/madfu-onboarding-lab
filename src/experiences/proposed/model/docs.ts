/**
 * The Madfu Proposed product-rule document, rendered from the same model the prototype and boards use.
 * Written to docs/MADFU_PROPOSED_JOURNEY.md by `npm run docs`; a test fails if the file is stale.
 */
import { DETAILED_BOARD, REUSE_NOTE } from './boards';
import { LIMITS, STAGES } from './config';
import { ASSUMPTIONS, DECISION_TABLES, NOT_IMPLEMENTED, OPEN_ITEMS, OTHER_OPEN_POINTS, type Table } from './decisions';
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
  'Onboarding Decision & Validation Inventory': ['Source', 'Field', 'Condition', 'Rule type', 'Regulatory / business / internal', 'Evaluation stage', 'Blocking / non-blocking', 'User-visible action / message', 'Internal status', 'Manual follow-up', 'External-call / cost impact', 'Rule version'],
  'Eligibility Matrix': ['Category', 'Subcategory', 'Applicant type', 'Sales channel', 'Revenue band (if relevant)', 'Eligibility result', 'Required CR / certificate', 'Manual review flag', 'Regulatory restriction', 'Internal reason code', 'Rule version'],
  'Pricing & Commission Matrix': ['Category', 'Subcategory', 'Merchant / revenue tier', 'Payment tenure', 'Standard / default commission', 'Improved / negotiated commission logic', 'Proof requirement', 'Effective date / version']
};

const REMOVED = [
  'CR / National ID as the first page; OTP before KYB eligibility.',
  'Category screening after identity (now part of Know Your Business).',
  'Plan selection in the Contract (now in the Commercial Offer).',
  'Automatic better commission from declared revenue alone.',
  'Repeated CR fetch, Nafath, IBAN verification or certificate retrieval on resume.',
  'Re-entry of Stage-1 answers (shown with Edit instead).',
  'Source of Revenue / Source of Income; standard-path document uploads; manual certificate-number fallback.'
];

/** Representative catalogue states used to list each screen's Page Scenarios in the doc. */
const PAGE_DOC_STATES: Array<[StepId, string]> = [
  ['kyb', 'kyb-cr-both'], ['lead', 'kyb-fl-no-cert'], ['identify', 'id-new-cr'], ['otp', 'x-otp-errors'], ['cr-verify', 'act-match'], ['persons', 'x-no-people'],
  ['nafath', 'nafath-ok'], ['certificates', 'fl-cert'], ['business', 'fl-bank-yes'], ['commercial', 'com-6'], ['review', 'edit-website'], ['contract', 'contract-accept']
];

export function renderJourneyDoc(): string {
  const out: string[] = [];
  out.push('# Madfu Proposed — merchant self-onboarding (KYB-first)', '');
  out.push('> Generated from the Merchant Onboarding Lab model (`src/experiences/proposed/model/`) by `npm run docs`. Do not edit by hand: change the model and regenerate. A test fails when this file is out of date.', '');
  out.push('**Status:** Proposed / Product Design. Synthetic data; simulated integrations. Not production behaviour.', '');
  out.push('**Source of truth:** the KYB-first journey update of 2026-10-23. Where it conflicts with older Madfu Proposed requirements (wireframe specification of 2026-10-15), it wins. Madfu Current, Tamara and Tabby are unchanged.', '');
  out.push('**Principle:** ask cheaply first, verify expensively later, never ask twice, never repeat a paid verification unnecessarily, and do not lose a commercially valid lead because one operational requirement is incomplete.', '');
  out.push(`**Cost rule:** ${REUSE_NOTE} Previously successful external checks are reused until their dependent data changes or an explicit freshness policy invalidates them.`, '');

  out.push('## Stages', '');
  out.push('| # | Stage | Screens |', '| --- | --- | --- |');
  for (const s of STAGES) out.push(`| ${s.n} | ${s.label} | ${s.steps.join(', ')} |`);
  out.push('');

  out.push('## Detailed journey (one panel per area)', '');
  for (const m of DETAILED_BOARD) {
    out.push(`### ${m.title}`, '', m.caption, '');
    for (const n of m.nodes.filter((x) => x.kind !== 'connector' && x.kind !== 'note')) {
      out.push(`- **${n.label}** _(${n.kind})_${n.detail ? ` — ${n.detail}` : ''}`);
    }
    out.push('');
  }

  out.push('## Resume / Continue Application', '');
  out.push('1. After the application exists (identity + mobile + OTP), **Save & exit** sends a secure Continue Application link to the verified mobile.');
  out.push('2. Opening the link identifies the application but does **not** authorise access: the OTP screen opens directly, with the application, masked CR / National ID and masked mobile shown.');
  out.push('3. After the code, the applicant lands on the first incomplete valid screen. Completed stages are not repeated; every stored successful verification is reused (ledger entry "reused — no new provider call").');
  out.push(`4. The same applies when the applicant re-enters through Know Your Business with the same identity and mobile (the saved application is reopened; today's draft answers are discarded). OTP: ${LIMITS.otpAttempts} attempts per code.`, '');

  out.push('## Rules and decision tables', '');
  for (const t of DECISION_TABLES) out.push(md(t));

  out.push('## Open decisions and product tasks', '');
  out.push('These are **not confirmed rules**. The prototype implements each configurably with synthetic values.', '');
  for (const o of OPEN_ITEMS) {
    out.push(`- **${o.type} — ${o.title}.**${o.notImplemented ? ` **${NOT_IMPLEMENTED}.**` : ''} ${o.detail}`);
    for (const c of o.clarify ?? []) out.push(`  - ${c}`);
  }
  out.push('', 'Other open points:', '');
  for (const p of OTHER_OPEN_POINTS) out.push(`- ${p}`);
  out.push('');

  out.push('## Backlog templates (columns to fill)', '');
  for (const [title, cols] of Object.entries(BACKLOG_COLUMNS)) {
    out.push(`### ${title} — PRODUCT TASK`, '', `| ${cols.join(' | ')} |`, `| ${cols.map(() => '---').join(' | ')} |`, `| ${cols.map(() => '…').join(' | ')} |`, '');
  }

  out.push('## Prototype Controls', '');
  out.push('Three separate areas, none of them merchant UI: **This step** (Page Scenarios: only what can happen on the current screen), **Start demo** (journey presets, received Continue links) and **Internal view** (reuse / calls, eligibility, flags, pricing, rule version, ledger).', '');
  out.push('Journey presets (Start demo): ' + JOURNEY_PRESETS.map((p) => p.label).join(' · ') + '.', '');
  out.push('### Page Scenarios per screen', '');
  out.push('Generated from `model/pageScenarios.ts`; options depend on the current state (e.g. channel, applicant type). The mobile ↔ selected-owner mismatch (OD-8) is deliberately not simulated.', '');
  for (const [step, sample] of PAGE_DOC_STATES) {
    const s = scenarioById(sample)!.build();
    const { page, groups } = pageScenarios({ ...s, app: { ...s.app, step } });
    out.push(`- **${PAGE_SCENARIOS[step].title}** (${page.integrations.join(', ') || 'no integration'}): ${groups.map((g) => `${g.title}: ${g.options.map((o) => o.label).join(' / ')}`).join(' — ') || 'no simulated outcomes'}`);
  }
  out.push('');
  out.push('## Scenario catalogue (automated test coverage)', '');
  for (const g of SCENARIO_GROUPS) {
    out.push(`### ${g}`, '');
    for (const s of SCENARIOS.filter((x) => x.group === g)) out.push(`- **${s.n ?? '+'}. ${s.label}** — ${s.hint}`);
    out.push('');
  }

  out.push('## Assumptions in the prototype', '');
  for (const a of ASSUMPTIONS) out.push(`- ${a}`);
  out.push('', '## Superseded in Madfu Proposed (still valid in Madfu Current where observed)', '');
  for (const r of REMOVED) out.push(`- ${r}`);
  out.push('');
  return out.join('\n');
}
