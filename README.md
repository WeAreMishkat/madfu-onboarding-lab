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
| `/madfu/proposed` | Madfu Proposed | Agreed product decisions, 27 Oct 2026 (v5: Eligible / Not Eligible; supersede the 23 Oct KYB-first journey where they differ) |
| `/madfu/proposed?view=boards` | Master Board (visual screen flow) and Detailed Logic Board | Same model and screens as the prototype |
| `/madfu/proposed?view=rules` | Confirmed decisions, rule tables, open decisions | Computed from the prototype rules |
| `/compare` | Comparison: Current vs Proposed, or all four | No scores, no ranking |

Documents, all generated from the same model and components as the app:
- [`Madfu_Proposed_Simple_Master_Board.pdf`](https://wearemishkat.github.io/madfu-onboarding-lab/Madfu_Proposed_Simple_Master_Board.pdf) — Master Board: one large landscape page of the real screens connected by arrows (management view). Editable source: `src/experiences/proposed/model/masterBoard.ts`
- [`Madfu_Proposed_Detailed_Master_Board.pdf`](https://wearemishkat.github.io/madfu-onboarding-lab/Madfu_Proposed_Detailed_Master_Board.pdf) — Detailed Logic Board (one panel per area)
- [`Madfu_Merchant_Onboarding_Wireframes.pdf`](https://wearemishkat.github.io/madfu-onboarding-lab/Madfu_Merchant_Onboarding_Wireframes.pdf) (every screen, boards, rule tables)
- [`docs/MADFU_PROPOSED_JOURNEY.md`](docs/MADFU_PROPOSED_JOURNEY.md) (product rules, open decisions, scenarios)

## Madfu Proposed in brief

**Source of truth:** agreed product decisions of 27 Oct 2026 (v5: eligibility simplified to Eligible / Not Eligible). They supersede the 23 Oct KYB-first journey where they differ.

**Principle:** ask cheaply first, verify expensively later, never ask twice, never repeat a paid verification unnecessarily, and never open an existing application without its registered mobile.

**Eight stages:** 1 Know Your Business · 2 Identify & Verify · 3 Business Verification · 4 Business Details · 5 Commercial Offer · 6 Review · 7 Contract · 8 Submit / Application Status.

- **Page 1 — Know Your Business:** applicant type, category, subcategory, annual revenue, sales channel. Nothing else (no URL, identity, mobile or OTP). Preliminary eligibility has **two outcomes only: Eligible or Not Eligible**. Revenue never routes (every band self-onboards when otherwise eligible; revenue is a risk input). Freelancer without a certificate → **Not Eligible immediately** (no Identify, no OTP). Unsupported category → continues to Identify + OTP (verified contact saved) → **Not Eligible** ("We’ve received your details"), with no paid check.
- **Page 2 — identifier + mobile** (Registered Business or Freelancer with certificate only): CR / National ID, mobile and, for eligible applicants, one prerequisite declaration (CR: "Are you an owner or manager registered on this CR?"; Freelancer: "Is your IBAN linked to your Freelancer Certificate?"). An **internal existence check** (no provider) decides where the OTP goes: new → the entered mobile; incomplete / submitted / paused / not-eligible record or live merchant → the **registered** mobile (last 3 digits shown; no takeover).
- **Routing after OTP** reads the **lifecycle status**: Not Eligible (details saved, personalised reason) · new CR · new Freelancer · resume (first unfinished stage) · Application Progress (submitted — never Review / Contract again) · merchant login (live). There is no Sales-lead route.
- **Business Verification (CR):** CR data (status, age, several activities, National Address, entity) and owners / managers in the backend — no CR confirmation page. Expired / suspended CR → saved + Sales recovery (no Refresh). CR age is a **risk attribute** (synthetic backend risk model, separate from Not Eligible rules). The government activity becomes the **verified category** (pricing too).
- **Freelancer cost order:** the certificate existence check runs **before Nafath** in the backend (rule flag; no certificate → Not Eligible, no Nafath cost); the applicant still sees Nafath → certificate.
- **Mobile ↔ National ID before Nafath:** on a mismatch the applicant can use another mobile (new OTP, check again) without restarting; a second mismatch pauses verification.
- **Business Details:** online store / Google Maps branch link by channel (scheme optional, Saudi / Arabic domains accepted); Freelancer IBAN linkage verified. No CR IBAN, VAT or branch count.
- **Commercial Offer:** "Your Standard Offer" → Continue. No payment-plan selection (Merchant Portal later). "Want us to review a better commercial rate?" is a small collapsed link; the request is kept even without a file.
- **Review:** verified sections locked; store presence and the rate review use a transactional edit (Cancel restores everything). **Contract:** Agree & Submit. **Resume:** Save & exit link → registered-mobile OTP → status-aware routing; an ordinary resume costs one OTP.

**Prototype Controls** (not merchant UI, open by default, light reviewer theme; a bottom sheet on phones): **This step** — Page Scenarios for the current screen only; **Start demo** — journey presets and received Continue links; **Internal view** — lifecycle, routing, eligibility, preliminary vs verified category, CR activities, risk, Not Eligible reason, registered / contact / authorised-person mobile, checks called / reused / invalidated, cost assumptions, next paid call, rate review, ledger.

All values are synthetic. Open product and compliance decisions are listed in the app (Rules & decisions) and in the generated doc.

## Run locally

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
