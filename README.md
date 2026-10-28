# Merchant Onboarding Lab

**Live:** https://wearemishkat.github.io/madfu-onboarding-lab/

An interactive product prototype for comparing merchant onboarding journeys side by side.

- **Product prototype, not a production application.** Nothing here onboards a real merchant.
- **Integrations are simulated.** The SMS code, registry and CR verification, Nafath, certificates, bank ownership and contract acceptance are deterministic mocks in the browser.
- **All data is synthetic.** Business names, people, numbers, mobiles, IBANs and codes are made up.
- **Competitor flows are reconstructed from research evidence.** Every screen carries an evidence label: **Observed** (walked live), **Documented** (help centre), **Inferred** (client code or payload; screen not reached) or **Unknown**. Research screenshots are never published; the Evidence drawer shows record references only.
- **Madfu Proposed is a product-design concept.** It is labelled *Proposed / Product Design* throughout and is not production behaviour.

## Experiences

| Route | Experience | Basis |
|---|---|---|
| `/` | Home | |
| `/tabby` | Tabby (benchmark) | Research evidence up to 2026-10-14 |
| `/tamara` | Tamara (benchmark) | Research evidence up to 2026-10-14 |
| `/madfu/current` | Madfu Current | Research evidence (TEST walks, 2026-10-12/13) |
| `/madfu/proposed` | Madfu Proposed | Agreed product decisions, 28 Oct 2026 (v6: internal Not Eligible, CR authorization + signer handoff; build on 27 Oct) |
| `/madfu/proposed?view=boards` | Master Board (visual screen flow) and Detailed Logic Board | Same model and screens as the prototype |
| `/madfu/proposed?view=rules` | Confirmed decisions, rule tables, open decisions | Computed from the prototype rules |
| `/compare` | Comparison: Current vs Proposed, or all four | No scores, no ranking |

Documents, all generated from the same model and components as the app:
- [`Madfu_Proposed_Simple_Master_Board.pdf`](https://wearemishkat.github.io/madfu-onboarding-lab/Madfu_Proposed_Simple_Master_Board.pdf) — Master Board: one large landscape page of the real screens connected by arrows (management view). Editable source: `src/experiences/proposed/model/masterBoard.ts`
- [`Madfu_Proposed_Detailed_Master_Board.pdf`](https://wearemishkat.github.io/madfu-onboarding-lab/Madfu_Proposed_Detailed_Master_Board.pdf) — Detailed Logic Board (one panel per area)
- [`Madfu_Merchant_Onboarding_Wireframes.pdf`](https://wearemishkat.github.io/madfu-onboarding-lab/Madfu_Merchant_Onboarding_Wireframes.pdf) (every screen, boards, rule tables)
- [`docs/MADFU_PROPOSED_JOURNEY.md`](docs/MADFU_PROPOSED_JOURNEY.md) (product rules, open decisions, scenarios)

## Madfu## Madfu Proposed in brief

**Source of truth:** agreed product decisions of 28 Oct 2026 (v6), building on those of 27 Oct. They supersede v5, the 23 Oct KYB-first journey and the 15 Oct wireframe spec where they differ. Conflicts with v5 are listed in Rules & decisions ("Conflicts with the previous prototype").

**Principle:** ask cheaply first, verify expensively later, never ask twice, never repeat a paid verification unnecessarily, never open an existing application without its stored mobile, and never show an automatic rejection reason.

**Eight workflows:** New Eligible CR Merchant · New Eligible Freelancer · Not Eligible Application · Existing In-Progress CR — Resume · Existing In-Progress Freelancer — Resume · Submitted Application · Existing Live Merchant · CR Merchant Signer Flow.

**Eight stages:** 1 Know Your Business · 2 Identify & Verify · 3 Business Verification · 4 Business Details · 5 Commercial Offer · 6 Review · 7 Authorization & Contract · 8 Submit / Application Status.

- **Shared start:** Know Your Business (applicant type, category, subcategory, annual revenue, sales channel — no URL) → Identification (CR / National ID + mobile; Freelancer also "IBAN linked to the certificate?") → OTP. Eligibility is decided **internally** (Eligible / Not Eligible) and never shown. Revenue never routes.
- **Not Eligible Application:** Identify + OTP, the application is captured with the internal reason (`backend.notEligible`), and the merchant sees the normal **"Application submitted"** page (re-entry: "Under review"). The team contacts them. No paid check.
- **Existing records:** internal existence check → OTP to the **stored** mobile only; a different entered mobile is never used or switched to. In progress → first unfinished CR / Freelancer step; awaiting authorization → status page; submitted → Application Progress; live → popup **"You already have an active account under this CR."** with a **Log in** button (no auto-redirect).
- **New CR:** CR Verification (retrieved data; nobody chosen) → Business Details → Commercial Offer → Review → **Authorization choice**: myself (select yourself among owners / managers → mobile ↔ National ID → Nafath → Contract) or **Send to another signer** (owner / manager on the CR + their Nafath mobile).
- **Signer handoff:** freezes application + offer, creates an authorization **version** of the same application, sends a secure SMS link (valid **7 days**, configurable), preparer sees status only (signer / mobile change = Phase 2). Signer: masked confirmation (no OTP) → mobile ↔ National ID → Nafath → read-only Review → Contract → Agree & Sign. Max **2 versions in 30 days**, then an internal unlock. Configuration: `model/config.ts` `HANDOFF_RULES`.
- **New Freelancer** (same shape as CR, updated 28 Oct 2026): Business Details (+ IBAN) → Commercial Offer → Review → **Certificate** (after Review, before Nafath; no certificate → no Nafath cost) → mobile ↔ National ID → Nafath → Contract → Submitted.
- **Two state machines:** application lifecycle (QUALIFICATION … DRAFT · AWAITING_AUTHORIZATION · NOT_ELIGIBLE (internal) · PAUSED_CR · SUBMITTED … LIVE) and authorization lifecycle (NOT_STARTED · HANDOFF_CREATED · AWAITING_SIGNER · NAFATH_PENDING · NAFATH_VERIFIED · CONTRACT_PENDING · COMPLETED · EXPIRED · CANCELLED).
- Unchanged: expired / suspended CR → saved + Sales; CR age = risk input (illustrative Proceed fully / controlled / Hold); no CR IBAN, VAT or branch count; standard offer only; transactional Review edit; Contract has no Decline.
- **Phase 2 / future (demo only):** delegated signer (MOJ delegation, company / other document → Quality review, verified before Nafath), change signer / mobile, resend / revoke.

**Prototype Controls** (not merchant UI): **This step** — Page Scenarios for the current screen (incl. handoff expiry, signer link, signer Nafath success / failure, internal unlock, delegation demo); **Start demo** — presets grouped by the eight workflows, received Continue and signer links; **Internal view** — actor, lifecycle, routing, resume stage, internal eligibility + not-eligible reason, risk, mobiles (stored vs entered), authorization status / version / signer / expiry / attempts / freeze / delegation / signing, checks and ledger. Reviewer-only "← Back to previous step" is kept.

All values are synthetic. Open product and compliance decisions are listed in the app (Rules & decisions) and in the generated doc.

ocally

```bash
npm install
npm run dev            # http://localhost:5173
```

## Test and build

```bash
npm test               # Vitest + Testing Library (unit, rules, journeys)
npm run e2e            # Playwright against a GitHub-Pages-like server (deep links, refresh, PDF)
npm run build          # type-check + production build (base "/")
npm run build:pages    # production build for https://wearemishkat.github.io/madfu-onboarding-lab/
npm run pdf            # regenerate the wireframes and both master-board PDFs in public/
npm run docs           # regenerate docs/MADFU_PROPOSED_JOURNEY.md (a test fails if it is stale)
```

## Architecture

```
Browser → React 19 + TypeScript (Vite) → deterministic in-browser mock engine
```

- `src/engine/`: declarative flow engine (screens, conditional fields, branching, simulated latency) used by Tabby, Tamara and Madfu Current.
- `src/experiences/<id>/`: one folder per experience, with its comparison facts and tests.
- `src/experiences/proposed/`: Madfu Proposed.
  - `model/` holds the single journey model: rules (`eligibility`, `urls`, `government`, `activity`, `pricing`, `verifications`), transitions (`state`), mock adapters, scenarios, boards (`masterBoard` = visual Master Board source, `boards` = Detailed Logic Board), decision tables and the docs renderer.
  - `steps/` holds the screens; `ui/` holds the components.
- `src/pages/PrintWireframes.tsx`: print-only routes used to build the PDFs (`/print/wireframes`, `/print/board-simple`, `/print/board-detailed`).
- Persistence: the Proposed application is kept in `localStorage`, so refresh and resume work. **Restart** clears it.

## Deployment

GitHub Actions (`.github/workflows/deploy-pages.yml`) runs on every push to `main`:
1. Install.
2. Test.
3. `npm run build:pages`.
4. Deploy to GitHub Pages.

Deep links work because the build also writes `404.html` (a copy of the app shell); the router reads the `/madfu-onboarding-lab/` base path.

## Known evidence limitations

| Experience | Limitations |
|---|---|
| **Tamara** | Below SAR 20M, a new application was walked only to Nafath (approval, then bank, channel, VAT, documents, review and submit are reconstructed and labelled). Freelancer is not walked past Step 1. Contract is help-centre only. |
| **Tabby** | Registered-business success was not submitted live; the "We're reviewing your application" screen is shared from the Freelancer path and labelled Inferred. Most sub-category names are not recorded. Approval and contract are help-centre only. |
| **Madfu Current** | The SAR 20M+ Relationship Manager outcome is from shipped copy (the SMS never arrived on TEST). Several owners or a delegate applicant are not observed. The review outcome and activation are not observed. |
