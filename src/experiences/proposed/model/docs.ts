/**
 * The Madfu Proposed product-rule document, rendered from the same model the prototype and boards use.
 * Written to docs/MADFU_PROPOSED_JOURNEY.md by `npm run docs`; a test fails if the file is stale.
 */
import { DETAILED_BOARD, REUSE_NOTE } from './boards';
import { HANDOFF_RULES, LIMITS, STAGES } from './config';
import { ASSUMPTIONS, CONFIRMED_DECISIONS, CONFLICTS_RESOLVED, DECISIONS_DATE, DECISION_TABLES, OPEN_ITEMS, OTHER_OPEN_POINTS, PHASE_1, PHASE_2, type Table } from './decisions';
import { BOARD_ARROWS, BOARD_BOXES, BOARD_SUBTITLE } from './masterBoard';
import { PAGE_SCENARIOS, pageScenarios } from './pageScenarios';
import { JOURNEY_PRESETS, SCENARIOS, SCENARIO_GROUPS, WORKFLOWS, scenarioById } from './scenarios';
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
  'Unlimited OTP resends resetting the attempts.',
  'Contract Decline action and the "contract declined" outcome (the Contract page has Back to Review and Agree & Submit only).',
  'Sales-lead routing at initial eligibility: registered business above SAR 20M → Sales, below SAR 100K → lead, and the Sales / lead thank-you pages (every revenue band now self-onboards when otherwise eligible).',
  '"Blocked" / "Sales lead" outcome terminology.',
  'Merchant-facing "Not Eligible" pages with a personalised reason, and the Page-1 Not Eligible stop for a Freelancer without certificate (v5) — Not Eligible is now internal; the applicant sees Application submitted.',
  'The registered-business Page-2 question "Are you an owner or manager registered on this CR?" (No = Not Eligible).',
  'Owner / manager selection and Nafath before Business Details for a registered business (now after Review, at the Authorization choice).',
  'Hidden Freelancer Certificate pre-check before Nafath with the certificate shown after Nafath (now the certificate screen comes before Nafath).',
  'Automatic hand-off of a live merchant to the login screen (now a popup with a Log in button).'
];

/** Representative catalogue states used to list each screen's Page Scenarios in the doc. */
const PAGE_DOC_STATES: Array<[StepId, string]> = [
  ['kyb', 'kyb-cr-online'], ['identify', 'id-new-fl'], ['otp', 'otp-errors'], ['cr', 'cr-business'], ['certificates', 'fl-certs-multi'], ['nafath', 'fl-nafath'],
  ['business', 'biz-fl'], ['commercial', 'com-standard'], ['review', 'review'], ['authorize', 'auth-choice'], ['handoff', 'handoff-active'], ['signer', 'signer-link'],
  ['delegation', 'delegation-demo'], ['contract', 'contract'], ['status', 'status-approved']
];

export function renderJourneyDoc(): string {
  const out: string[] = [];
  out.push('# Madfu Proposed — merchant self-onboarding (v6: identifier before OTP, internal Not Eligible, CR authorization + signer handoff, lifecycle routing)', '');
  out.push('> Generated from the Merchant Onboarding Lab model (`src/experiences/proposed/model/`) by `npm run docs`. Do not edit by hand: change the model and regenerate. A test fails when this file is out of date.', '');
  out.push('**Status:** Proposed / Product Design. Synthetic data; simulated integrations. Not production behaviour.', '');
  out.push(`**Source of truth:** the agreed product decisions of ${DECISIONS_DATE}, building on those of 2026-10-27. They supersede the v5 prototype, the KYB-first v3 journey (2026-10-23) and the 2026-10-15 wireframe specification where they differ. Madfu Current, Tamara and Tabby are unchanged.`, '');
  out.push('**Principle:** ask cheaply first, verify expensively later, never ask twice, never repeat a paid verification unnecessarily, never open an existing application without its stored mobile, and never show an automatic rejection reason.', '');
  out.push(`**Cost rule:** ${REUSE_NOTE}`, '');

  out.push('## Workflows', '');
  WORKFLOWS.forEach((w, i) => out.push(`${i + 1}. ${w}`));
  out.push('');
  out.push('## Journey', '');
  out.push('1. Shared start — Know Your Business (applicant type, category, subcategory, annual revenue, sales channel) → Identification → OTP. Eligibility is decided internally (**Eligible** / **Not Eligible**) and never shown. Revenue never routes (risk input only).');
  out.push('2. Internal existence check (no provider): new · incomplete · awaiting authorization · submitted · live · paused · not eligible. New → code to the entered mobile; existing → code to the STORED mobile only (a different entered mobile is never used).');
  out.push('3. Not Eligible Application → captured with the internal reason → "Application submitted" (later "Under review"); the team contacts the applicant. No paid check.');
  out.push('4. New Eligible CR Merchant → CR Verification → Business Details → Commercial Offer → Review → Authorization choice → (myself) owner / manager → mobile ↔ National ID → Nafath → Contract → Submitted, or (another signer) Signer Handoff.');
  out.push(`5. CR Merchant Signer Flow → application + offer frozen → secure SMS link (${HANDOFF_RULES.expiryDays} days, configurable) → masked signer confirmation → mobile ↔ National ID → Nafath → read-only Review → Contract → Agree & Sign → Submitted. No signer OTP. Max ${HANDOFF_RULES.maxVersions} versions of the same application in ${HANDOFF_RULES.windowDays} days.`);
  out.push('6. New Eligible Freelancer → Certificate → mobile ↔ National ID → Nafath → Business Details (+ IBAN linked to the certificate) → Commercial Offer → Review → Contract → Submitted.');
  out.push('7. Resume (CR / Freelancer) → first unfinished step · Submitted → Application Progress · Live → "active account" popup → Log in.', '');

  out.push('## Phase 1 vs Phase 2', '');
  out.push('**PHASE 1**', '');
  for (const p of PHASE_1) out.push(`- ${p}`);
  out.push('', '**PHASE 2 / FUTURE**', '');
  for (const p of PHASE_2) out.push(`- ${p}`);
  out.push('');

  out.push('## Conflicts with the previous prototype (resolved)', '');
  for (const c of CONFLICTS_RESOLVED) out.push(`- ${c}`);
  out.push('');

  out.push('## Stages', '');
  out.push('| # | Stage | Screens |', '| --- | --- | --- |');
  for (const s of STAGES) out.push(`| ${s.n} | ${s.label} | ${s.steps.join(', ')} |`);
  out.push('');

  out.push('## Confirmed product decisions', '');
  for (const d of CONFIRMED_DECISIONS) out.push(`- ${d}`);
  out.push('');

  out.push('## Master Board', '', `${BOARD_SUBTITLE}. Visual screen flow (real screens), source: \`model/masterBoard.ts\`; PDF: \`public/Madfu_Proposed_Simple_Master_Board.pdf\`.`, '');
  for (const b of BOARD_BOXES) out.push(`- **${b.title}**${b.caption ? ` — ${b.caption}` : ''}`);
  out.push('', `Arrow labels: ${[...new Set(BOARD_ARROWS.flatMap((a) => (a.pills ?? []).map((p) => (p.kind === 'check' ? `✓ ${p.text}` : p.text))))].join(' · ')}.`, '');

  out.push('## Detailed Logic Board (one panel per area)', '');
  for (const m of DETAILED_BOARD) {
    out.push(`### ${m.title}`, '', m.caption, '');
    for (const n of m.nodes.filter((x) => x.kind !== 'connector' && x.kind !== 'note')) {
      out.push(`- **${n.label}** _(${n.kind})_${n.detail ? ` — ${n.detail}` : ''}`);
    }
    out.push('');
  }

  out.push('## Resume / Continue Application', '');
  out.push('1. **Save & exit** (DRAFT only) sends a Continue Application link to the stored mobile. Links stop working on submission, handoff or when the mobile changes.');
  out.push('2. Opening the link — or entering the same identifier on Page 2 (with any mobile) — identifies the application but does **not** authorise access: the code goes to the stored mobile only.');
  out.push('3. After the code, routing reads the lifecycle and authorization status: DRAFT → first unfinished CR / Freelancer stage (every valid check reused); awaiting authorization → status page; submitted or internally Not Eligible → Application Progress; live → active-account popup; paused → Sales follow-up.');
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
  out.push('A reviewer-only **Back to previous step** button sits at the top of the controls (not merchant UX): it only changes the screen shown — no verification, lifecycle status or saved value is reset, and locked screens show their existing values. It is unavailable during an edit, on code screens, in a signer session and once the application has left DRAFT.', '');
  out.push('Three separate areas, none of them merchant UI: **This step** (Page Scenarios: only what can happen on the current screen), **Start demo** (presets grouped by the eight workflows, received Continue and signer links) and **Internal view** (actor, lifecycle, routing, resume stage, internal eligibility and not-eligible reason, verified category, activities, risk + illustrative decision, mobiles, authorization status / version / signer / expiry / attempts / freeze / delegation / signing, checks called / reused / invalidated, cost assumptions, ledger).', '');
  for (const w of WORKFLOWS) out.push(`- **${w}:** ${JOURNEY_PRESETS.filter((p) => p.workflow === w).map((p) => p.label).join(' · ')}`);
  out.push('');
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
