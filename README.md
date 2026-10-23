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
| `/madfu/proposed` | Madfu Proposed | KYB-first journey update, 23 Oct 2026 (supersedes the 15 Oct wireframe specification where they differ) |
| `/madfu/proposed?view=boards` | Simple and Detailed Master Boards | Same model as the prototype |
| `/madfu/proposed?view=rules` | Rules, decision tables, open decisions | Computed from the prototype rules |
| `/compare` | Comparison: Current vs Proposed, or all four | No scores, no ranking |

Documents, all generated from the same model and components as the app:
- [`Madfu_Proposed_Simple_Master_Board.pdf`](https://wearemishkat.github.io/madfu-onboarding-lab/Madfu_Proposed_Simple_Master_Board.pdf) (1 page)
- [`Madfu_Proposed_Detailed_Master_Board.pdf`](https://wearemishkat.github.io/madfu-onboarding-lab/Madfu_Proposed_Detailed_Master_Board.pdf) (one panel per area)
- [`Madfu_Merchant_Onboarding_Wireframes.pdf`](https://wearemishkat.github.io/madfu-onboarding-lab/Madfu_Merchant_Onboarding_Wireframes.pdf) (every screen, boards, rule tables)
- [`docs/MADFU_PROPOSED_JOURNEY.md`](docs/MADFU_PROPOSED_JOURNEY.md) (product rules, open decisions, scenarios)

## Madfu Proposed in brief

**Principle:** ask cheaply first, verify expensively later, never ask twice, never repeat a paid verification unnecessarily, and do not lose a commercially valid lead.

**Eight stages:** 1 Know Your Business · 2 Identify & Verify · 3 Business Verification · 4 Business & Banking Details · 5 Commercial Offer · 6 Review · 7 Contract · 8 Submit / Outcome.

- **Know Your Business first:** applicant type (CR / Freelancer with certificate / Freelancer without certificate), category, subcategory, annual revenue, sales channel, website and / or Google Maps link (validated; social-media and WhatsApp links rejected). No CR, ID, mobile or OTP yet. A configurable eligibility engine decides: eligible, Sales lead, temporarily not eligible, not eligible, or manual review. Freelancers without a certificate become leads.
- **Identify & Verify:** CR / Unified Number or National ID + mobile, duplicate / existing checks, SMS OTP. The Stage-1 record is then linked to the new application and never asked again.
- **Business Verification:** government CR data (status, age ≤ 3 months = temporarily not eligible, entity, activities, National Address), category ↔ activity reconciliation, authorised person + Nafath; for Freelancers Nafath + retrieved certificates (zero documents).
- **Business & Banking:** only what is still missing. Freelancers are asked whether the bank account is linked to their certificate; "No" skips the IBAN and continues with "banking setup required".
- **Commercial Offer:** standard commission from the pricing matrix (never lowered by declared revenue), optional better-rate evidence that never blocks, 3 and 4-month plans always included, 6 / 9 / 12 optional.
- **Review** with section Edit and dependency invalidation; **Contract** only (plans shown as contract content); **Submit / Outcome** with clean user messages and internal reason codes.
- **Resume:** Save & exit sends a Continue Application link; it opens the OTP screen; after the code the applicant lands on the first incomplete screen. Stored successful checks (CR, people, Nafath, certificates, IBAN) are reused: an ordinary resume costs one OTP.

**Prototype Controls** (not merchant UI): 60 numbered scenarios plus extras, simulated provider answers, and an Internal state view showing checks reused / invalidated, the expected next paid call, flags, eligibility rule version and commercial state.

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
  - `model/` holds the single journey model: rules (`eligibility`, `urls`, `government`, `activity`, `pricing`, `verifications`), transitions (`state`), mock adapters, scenarios, boards, decision tables and the docs renderer.
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
