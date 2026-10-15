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
| `/madfu/proposed` | Madfu Proposed | Wireframe system specification, 15 Oct 2026 |
| `/madfu/proposed?view=maps` | Journey maps (overview, registered business, Freelancer, manual review) | Same model as the prototype |
| `/madfu/proposed?view=rules` | Decision tables, assumptions, pending decisions | Computed from the prototype rules |
| `/compare` | Comparison: Current vs Proposed, or all four | No scores, no ranking |

The wireframes PDF is at [`Madfu_Merchant_Onboarding_Wireframes.pdf`](https://wearemishkat.github.io/madfu-onboarding-lab/Madfu_Merchant_Onboarding_Wireframes.pdf). It is generated from the same components and model as the app (`npm run pdf`).

## Madfu Proposed in brief

**Entry and verification**
- One entry page: applicant type, CR number (registered business) or National ID (Freelancer), annual revenue, mobile.
- Identity and duplicate checks run first, before mobile matching. A reused mobile alone never rejects.
- Then an SMS code: 3 attempts, expiry, resend.

**Routing after the code**
- A registered business **below SAR 100,000** or **above SAR 20,000,000** becomes a Sales lead.
- Freelancers self-onboard at every revenue level.
- The SAR 100,000 boundary is provisional and configurable.

**Self-onboarding**
- **Category screening** on Madfu's own taxonomy (fixture catalogue): allowed, restricted, CR-only or manual review. A restricted category ends neutrally before any paid check.
- **Registered business:**
  1. CR verification (mock adapter): valid, expired (continues with a flag), not found, or unavailable / error (bounded retry).
  2. Choose a masked authorised person; companies are never offered.
  3. Nafath: 2 attempts per application, shared across people.
- **Freelancer:** Nafath with the entry National ID, then retrieved freelance certificates. Two Nafath failures lead to a manual route: certificate number by hand and no contract.
- **Business details:**
  - IBAN only: the bank is derived; no SWIFT, beneficiary or certificate. Ownership is checked twice, then the application is flagged for review.
  - VAT: Yes / No.
  - Sales channel with website and / or Google Maps link; branch count optional.
  - No Source of Revenue or Income and no document uploads.
- **Review, agreement, submission:**
  - Review with section-level Edit.
  - A generic agreement acceptance, separate from Nafath and available only when Nafath is verified.
  - The application is then submitted for review. It is never shown as activated.

**Application vs account:** applicants work on an application; a merchant account is set up only after approval.

**Prototype Controls** (a separate panel, not merchant UI) offer:
- 39 scenarios, including all 24 required ones
- simulated backend answers for every integration
- the internal status and review flags

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
npm run pdf            # regenerate public/Madfu_Merchant_Onboarding_Wireframes.pdf
```

## Architecture

```
Browser → React 19 + TypeScript (Vite) → deterministic in-browser mock engine
```

- `src/engine/`: declarative flow engine (screens, conditional fields, branching, simulated latency) used by Tabby, Tamara and Madfu Current.
- `src/experiences/<id>/`: one folder per experience, with its comparison facts and tests.
- `src/experiences/proposed/`: Madfu Proposed.
  - `model/` holds pure rules and transitions, mock adapters, scenarios, decision tables and journey-map data.
  - `steps/` holds the screens; `ui/` holds the components.
- `src/pages/PrintWireframes.tsx`: print-only route used to build the PDF.
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
