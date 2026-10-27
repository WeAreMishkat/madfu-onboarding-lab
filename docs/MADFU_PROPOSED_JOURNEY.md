# Madfu Proposed — merchant self-onboarding (v5: Eligible / Not Eligible, identifier before OTP, lifecycle routing)

> Generated from the Merchant Onboarding Lab model (`src/experiences/proposed/model/`) by `npm run docs`. Do not edit by hand: change the model and regenerate. A test fails when this file is out of date.

**Status:** Proposed / Product Design. Synthetic data; simulated integrations. Not production behaviour.

**Source of truth:** the agreed product decisions of 2026-10-27. They supersede the KYB-first v3 journey (2026-10-23) and the 2026-10-15 wireframe specification where they differ. Madfu Current, Tamara and Tabby are unchanged.

**Principle:** ask cheaply first, verify expensively later, never ask twice, never repeat a paid verification unnecessarily, and never open an existing application without its registered mobile.

**Cost rule:** Successful CR / owner / mobile / Nafath / certificate / IBAN checks are reused. Resume normally costs one OTP to the registered mobile.

## Journey

1. Page 1 — Know Your Business: applicant type, category, subcategory, annual revenue, sales channel. Preliminary eligibility (internal): only **Eligible** or **Not Eligible**. Revenue never routes (risk input only).
   - Freelancer without a certificate → Not Eligible immediately (no Identify, no National ID, no OTP).
   - Unsupported category → continues to Identify + OTP so a verified contact is kept, then Not Eligible (no paid check).
2. Page 2 — Registered Business or Freelancer with certificate only: identifier (CR / National ID) + mobile + one prerequisite question (eligible applicants only).
3. Internal existence check (no provider): new · incomplete · submitted · live · paused · not eligible.
4. OTP — new: to the entered mobile (contact_mobile_verified); existing: to the REGISTERED mobile, last three digits shown.
5. Routing by lifecycle status, eligibility and declaration: Not Eligible (details received) · new CR · new Freelancer · resume · Application Progress · login. There is no Sales-lead route.
6. Self-onboarding: Business Verification (CR data + owners / managers, or certificate pre-check) → mobile ↔ National ID → Nafath → (Freelancer: certificate) → Business Details → Commercial Offer → Review → Contract → Submit → Application Progress.

## Stages

| # | Stage | Screens |
| --- | --- | --- |
| 1 | Know Your Business | kyb |
| 2 | Identify & Verify | identify, otp |
| 3 | Business Verification | persons, nafath, certificates |
| 4 | Business Details | business |
| 5 | Commercial Offer | commercial |
| 6 | Review | review |
| 7 | Contract | contract |
| 8 | Submit / Application Status | outcome, status, login |

## Confirmed product decisions

- Know Your Business (Page 1) asks only applicant type, category, subcategory, annual revenue and sales channel — no website or Google Maps link.
- Initial eligibility has only two outcomes: Eligible and Not Eligible. There is no Sales-lead, Blocked or manual-review route at initial eligibility.
- Annual revenue is still collected on Page 1 but never routes: every band (below SAR 100,000, SAR 100,000–20,000,000, above SAR 20,000,000) self-onboards when otherwise eligible. Revenue is a risk input only.
- A Freelancer without a Freelancer Certificate sees Not Eligible directly on Page 1: no Identify page, no National ID, no OTP.
- An unsupported (blacklisted) category or activity continues through Identify + OTP so a verified contact is kept; after the OTP the applicant sees Not Eligible ("We’ve received your details") — no CR, Nafath, certificate, banking, offer or contract, and no paid verification after the OTP.
- Only Registered Businesses and Freelancers with a certificate reach Identify. Identifier + mobile are Page 2, with one prerequisite question for eligible applicants.
- An internal existence check runs before any OTP; it calls no provider.
- Existing applications and merchant accounts are opened only by an OTP to the REGISTERED mobile (last three digits shown); the newly entered mobile is never used for them.
- No automatic account / application takeover, no access-request and no replacement-mobile workflow in V1.
- Registered-business applicants declare "Are you an owner or manager registered on this CR?"; No stops self-onboarding before any paid check.
- Delegated-person onboarding is out of V1.
- Freelancers declare "Is your IBAN linked to your Freelancer Certificate?"; No stops self-onboarding before any paid check. The linkage is still verified technically later.
- The Freelancer Certificate existence check runs before Nafath when provider / compliance permits (rule flag); the applicant still sees Nafath → certificate.
- Mobile ↔ National ID ownership is checked before every Nafath request; on a mismatch the mobile can be corrected with a new OTP, without restarting.
- "Not Eligible" is the only merchant-facing term (never Blocked, Blacklisted or Rejected); each Not Eligible page shows a personalised reason per rule; reason codes and internal scoring are never exposed.
- A returning applicant with a saved Not Eligible record gets the code on the registered mobile, then the Not Eligible confirmation (saved details).
- After retrieval, the government CR activity (or certificate activity) is the source of truth for the category; the declared category cannot be edited to bypass it.
- Commercial pricing uses the verified, mapped category.
- Multiple CR activities are supported in the data model; many activities can map to one Madfu subcategory.
- CR age is a backend risk attribute, not a fixed rejection. Hard blocks and risk scores are separate.
- Expired / suspended CR: the application is saved and handed to Sales for recovery; no merchant-facing Refresh and no further paid checks.
- There is no separate CR confirmation page: the merchant sees a screen only when they must act.
- Website / Google Maps store-presence links moved to Business Details; Google Maps is the selling branch, not the National Address.
- Registered businesses give no IBAN during onboarding (payout account added later, at activation).
- Freelancer IBAN is kept and its linkage to the Freelancer Certificate is verified.
- VAT and the number of branches are removed from onboarding.
- Payment-plan selection is removed from onboarding (configured later in the Merchant Portal). The Commercial Offer shows the standard offer and Continue.
- The better-rate request stays optional and low-priority (collapsed; uploads only after "Request rate review"); the interest is kept even without a file.
- The Contract page has no Decline action: Back to Review, or Agree & Submit.
- Submitted applications open Application Progress; they never reopen Review, Contract or submission.
- Resume continues incomplete applications at the first unfinished stage, reusing every valid check.
- Verified, sensitive sections are locked; the few editable sections use a transactional edit (draft → Save; Cancel restores all).
- Negative / freshness policy depends on the result type; there is no universal expiry.
- OTP is not the only abuse control: rate limiting, IP / device throttling, eligibility limits, bounded resends and attempts, and a bot challenge when suspicious.

## Master Board

Master Board — the journey, screen by screen. Visual screen flow (real screens), source: `model/masterBoard.ts`; PDF: `public/Madfu_Proposed_Simple_Master_Board.pdf`.

- **Not Eligible** — Freelancer without a certificate · no OTP
- **Know Your Business** — Five questions · eligibility check
- **Identify** — CR or National ID + mobile
- **OTP** — SMS code to verify the mobile
- **Not Eligible · Details Received** — Unsupported category · contact saved
- **Resume Application** — Opens where they left off
- **Application Progress** — Submitted application · status only
- **Login** — Already a Madfu merchant
- **Registered Business** — Self-Onboarding
- **Owner / Manager** — CR verified · choose who applies
- **Nafath** — Identity verified in the Nafath app
- **Business Details** — Website / Google Maps link
- **Offer** — Standard commission → Continue
- **Review** — Verified details locked
- **Contract** — Agree & Submit
- **Submitted** — Then: Application Progress
- **Freelancer** — Self-Onboarding
- **Nafath** — Identity verified in the Nafath app
- **Certificate** — Choose the Freelancer Certificate
- **Business Details + IBAN** — Website · IBAN linked to the certificate
- **Offer** — Standard commission → Continue
- **Review** — Verified details locked
- **Contract** — Agree & Submit
- **Submitted** — Then: Application Progress

Arrow labels: Freelancer without Certificate · Registered Business / Freelancer with Certificate · Not Eligible category · Resume · Submitted · Live · New · ✓ CR verification · ✓ Certificate check · ✓ Mobile match.

## Detailed Logic Board (one panel per area)

### A · Know Your Business (Page 1): Eligible or Not Eligible

No identity, mobile, OTP or URL. Only two outcomes. Revenue is collected but never routes (risk input only). The declared category is preliminary; it is replaced by the government activity once retrieved.

- **Not Eligible (Page 1)** _(outcome)_ — Freelancer without certificate · no Identify, no National ID, no OTP
- **PRODUCT TASK: Eligibility Matrix** _(open)_ — Production catalogue not defined (fixture)
- **Know Your Business** _(screen)_ — Applicant type · Category · Subcategory · Annual revenue · Sales channel
- **Qualification record (KYB-…)** _(backend)_ — Temporary until linked after OTP
- **Eligibility engine** _(decision)_ — 6 ordered rules · Eligible / Not Eligible

### B · Identifier + mobile, existence check, OTP and routing

Only a Registered Business or a Freelancer with a certificate reaches Page 2. An internal lookup decides where the code goes. Existing records open only with the REGISTERED mobile. There is no Sales-lead route.

- **Rate limit / bot challenge** _(backend)_ — 5 submissions / session
- **Not Eligible — details received** _(outcome)_ — Unsupported category · verified contact saved · no paid check
- **Identifier + mobile** _(screen)_ — CR or National ID · mobile · "owner / manager?" or "IBAN linked?" (eligible only)
- **Existence check** _(backend)_ — Internal database: new · incomplete · submitted · live · paused · not eligible
- **Existing record?** _(decision)_
- **OTP → entered mobile** _(screen)_ — contact_mobile_verified · 3 attempts, 3 resends
- **Create record + route** _(decision)_ — Eligibility + declaration
- **Not Eligible confirmation** _(outcome)_ — Saved Not Eligible record (registered mobile)
- **OTP → REGISTERED mobile** _(screen)_ — "Code sent to the registered mobile ending •••123" · also the Continue link
- **Code not completed** _(outcome)_ — No access · nothing exposed · no new application
- **Not Eligible** _(outcome)_ — Prerequisite = No: not owner / manager · IBAN not linked
- **DRAFT → resume** _(cached)_ — First unfinished stage · checks reused
- **Lifecycle status** _(decision)_ — Status + outcome, then completion
- **Live → merchant login** _(screen)_
- **PAUSED_CR** _(manual)_ — Sales follow-up message
- **Submitted → Application Progress** _(screen)_

### C · Business Verification: registered business

CR data and owners / managers are retrieved in the backend once and reused. The merchant sees a screen only when they must act. CR age feeds the risk score; it never rejects.

- **Stored CR data** _(cached)_ — Reused on resume
- **Expired / suspended** _(manual)_ — Your application is saved.
- **Risk score (synthetic)** _(backend)_ — CR age · entity · address · revenue · category — never a block
- **CR data** _(external)_ — Status · age · activities (several) · National Address · entity
- **CR status (hard rule)** _(decision)_
- **Activities → verified category** _(backend)_ — Government wins · prices the offer
- **Owners / managers** _(external)_ — Individuals only; delegates out of V1
- **Select owner / manager** _(screen)_ — Masked names · role · single choice
- **Provider unavailable** _(screen)_ — Retry (2/session) · Save & exit · reset on resume
- **Not Eligible** _(outcome)_ — Regulated activity
- **Not Eligible** _(outcome)_ — No owner / manager: declaration not confirmed
- **PRODUCT TASK: activity mapping** _(open)_
- **Multi-activity reconciliation** _(open)_
- **Not Eligible inventory** _(open)_
- **Risk weights / thresholds** _(open)_

### D · Business Verification: Freelancer

Cost order (rule flag ON): the backend checks that a certificate exists BEFORE Nafath, silently. The applicant still sees Nafath → certificate; no certificate detail is shown before Nafath.

- **Not Eligible** _(outcome)_ — No certificate found: NO Nafath call
- **Pre-check result reused** _(cached)_ — Details shown now, no new call
- **Not Eligible** _(outcome)_ — Certificate activity requires a CR
- **Certificate pre-check** _(external)_ — Backend only · by National ID
- **Select certificate** _(screen)_ — Expired / already linked cannot be selected
- **Certificate activity → verified category** _(decision)_
- **Service unavailable** _(screen)_ — Retry later; no Nafath yet
- **PROVIDER / COMPLIANCE: pre-check before Nafath permitted?** _(open)_

### E · Mobile ↔ National ID, then Nafath (registered business and Freelancer)

Send to Nafath first confirms that the verified mobile belongs to the verifying person (authorized_person_mobile_verified). A mismatch never restarts onboarding: CR data, eligibility, selection and progress are kept.

- **Technical failure** _(backend)_ — No attempt used · 3 / session
- **Nafath verified** _(cached)_ — Reused on resume; person locked
- **Send to Nafath** _(screen)_ — Selected owner / manager, or the Freelancer
- **Mobile ↔ National ID** _(external)_ — 2 checks / application
- **Nafath** _(external)_ — 2 attempts / application
- **Mismatch** _(screen)_ — "The mobile number must belong to the selected owner or manager." · Use another mobile number
- **OTP → new mobile** _(screen)_ — Becomes the registered mobile
- **Rejected / timed out** _(screen)_ — Retry while attempts remain
- **Failed twice** _(manual)_ — CR: details collected, no contract · FL: manual verification
- **PROVIDER: mobile ownership service** _(open)_
- **Still a mismatch** _(manual)_ — Verification paused · progress saved · no Nafath call
- **COMPLIANCE: after repeated mismatch** _(open)_

### F · Business Details

Store presence for the channel declared on Page 1 (fraud / presence evidence). Google Maps = actual selling branch, not the National Address. Freelancers verify the IBAN linkage.

- **Online: store / website URL** _(backend)_ — Scheme optional · no social / WhatsApp / shorteners
- **Business Details** _(screen)_ — Channel shown from Page 1
- **Channel** _(decision)_
- **Both: both links** _(backend)_
- **Applicant type** _(decision)_
- **Offline: Google Maps branch link** _(backend)_ — Any Google Maps domain
- **Freelancer IBAN ↔ certificate** _(external)_ — 2 mismatches / IBAN; technical errors free
- **Not linked twice** _(manual)_ — Enter another IBAN · contract needs a verified IBAN

### G · Commercial Offer

Your Standard Offer → Continue. The rate comes from the VERIFIED category. A better-rate review is optional, collapsed and low-priority; the interest is kept even with no file.

- **Your Standard Offer** _(screen)_ — One commission · short explanation · Continue
- **Pricing matrix** _(backend)_ — Verified (government-mapped) category
- **"Want us to review a better rate?"** _(screen)_ — Collapsed link under the offer
- **Request rate review** _(backend)_ — COMMERCIAL_RATE_REVIEW_REQUESTED · no file needed
- **Optional evidence** _(screen)_ — Shown only after the request
- **Commercial rate review** _(manual)_ — Never blocks; standard rate applies
- **PRODUCT TASK: Pricing matrix** _(open)_
- **COMMERCIAL: evidence for a better rate** _(open)_

### H · Review: locked sections, transactional edit

Verified and sensitive sections are locked. Only store presence and the rate-review request can be edited: changes stay in a draft until Save; Cancel restores the whole application; nothing is invalidated before Save.

- **Locked** _(cached)_ — Type · identifier · category · government data · owner / manager · mobile · certificate · FL IBAN
- **Review** _(screen)_ — Applicant · verified identity · store presence · status · banking (FL) · offer
- **Editable section?** _(decision)_ — Store presence · rate review
- **Draft copy** _(backend)_ — Nothing applied yet
- **Save** _(backend)_ — Apply · invalidate dependants only (none here)
- **Cancel** _(backend)_ — Restore the whole application

### I · Contract, submission and Application Progress

Back to Review, or one action: Agree & Submit records acceptance and submits (no Decline). A submitted application opens Application Progress — never Review, Contract or a second submission. No activation is claimed before it happens.

- **Review** _(screen)_
- **Contract gate** _(decision)_ — Nafath · mobile ownership · owner (CR) · certificate + IBAN (FL)
- **Contract** _(screen)_ — Standard commission as Schedule 1 · Agree & Submit
- **Submitted** _(outcome)_ — Your application has been submitted successfully.
- **Application Progress** _(screen)_ — Return later with the registered-mobile code
- **Live → login** _(screen)_
- **Submitted for manual verification** _(manual)_ — We have received your application.
- **Statuses** _(backend)_ — Submitted · Under review · Action required · Approved · Unable to proceed
- **OPERATIONS: final status lifecycle / SLA** _(open)_

### J · Resume, reuse, invalidation and freshness

Ordinary resume costs one OTP to the registered mobile. Positive results are reused until a dependency changes; negative and technical results follow a policy per result type.

- **Freshness policy per verification** _(open)_ — Open: reusable until invalidated
- **Registered-mobile OTP** _(screen)_ — Page 2 re-entry or Continue link
- **Valid checks reused** _(cached)_ — CR · owners · mobile match · Nafath · certificate · IBAN
- **Negative results** _(backend)_ — Outage: retry, counters reset per session · expired CR: Sales only · CR age: re-scored
- **Invalidation** _(backend)_ — Mobile → match · certificate → IBAN · IBAN → IBAN only

## Resume / Continue Application

1. **Save & exit** (DRAFT only) sends a Continue Application link to the registered mobile. Links stop working on submission or when the mobile changes.
2. Opening the link — or entering the same identifier on Page 2 — identifies the application but does **not** authorise access: the code goes to the registered mobile.
3. After the code, routing reads the lifecycle status: DRAFT → first unfinished stage (every valid check reused); submitted → Application Progress; live → login; paused → Sales follow-up.
4. OTP: 3 attempts per code, 3 resends; a resend never restores the budget. Provider retry counters and Nafath technical failures reset per session.

## Rules and decision tables

### Stages

| # | Stage | Screens |
| --- | --- | --- |
| 1 | Know Your Business | kyb |
| 2 | Identify & Verify | identify · otp |
| 3 | Business Verification | persons · nafath · certificates |
| 4 | Business Details | business |
| 5 | Commercial Offer | commercial |
| 6 | Review | review |
| 7 | Contract | contract |
| 8 | Submit / Application Status | outcome · status · login |

### Page 1 → Page 2 → existence check → OTP → routing

| Situation | OTP sent to | After the code |
| --- | --- | --- |
| Freelancer without certificate (Page 1) | — (no Identify, no OTP) | Not Eligible immediately, personalised reason |
| New identifier, unsupported category / activity | Entered mobile | Details saved (verified contact) → Not Eligible "We’ve received your details"; no paid check |
| New identifier, eligible, prerequisite = No | Entered mobile | Not Eligible with a personalised reason (owner / manager, or IBAN linkage) |
| New identifier, eligible registered business (any revenue band) | Entered mobile | Application created (DRAFT) → Business verification |
| New identifier, eligible Freelancer with certificate (any revenue band) | Entered mobile | Application created (DRAFT) → certificate pre-check → Nafath |
| Incomplete application (DRAFT) | Registered application mobile (•••••••123) | Resume at the first unfinished stage; valid checks reused |
| Submitted, not live | Registered application mobile | Application Progress (status only) |
| Saved Not Eligible record | Registered mobile | Not Eligible confirmation (saved details) |
| Paused (CR expired / suspended) | Registered application mobile | Saved; Sales will help you continue |
| Live merchant | Registered account mobile | Merchant login; no application created |
| Code not completed | — | No access; nothing exposed; no new application |

_There is no Sales-lead route. Throttled after 5 Page-2 submissions per session (simulated rate limit / bot challenge)._

### Application lifecycle → where the application opens

| Status | Meaning | Opens at |
| --- | --- | --- |
| QUALIFICATION | Qualification (Page 1 / Page 2) — no application yet | Page 1 / Page 2 (nothing persisted) |
| OTP_PENDING | OTP pending — no application yet | OTP screen |
| DRAFT | Draft application (self-onboarding in progress) | First unfinished stage |
| NOT_ELIGIBLE | Not eligible (verified contact saved; personalised reason shown) | Not Eligible confirmation (saved details) |
| PAUSED_CR | Paused — CR expired / suspended; saved and handed to Sales | Sales / manual follow-up message |
| SUBMITTED | Submitted | Application Progress |
| UNDER_REVIEW | Under review | Application Progress |
| ACTION_REQUIRED | Action required | Application Progress |
| APPROVED | Approved (not yet live) | Application Progress |
| UNABLE_TO_PROCEED | Unable to proceed | Application Progress |
| LIVE | Live merchant (account exists) | Merchant login |

_Routing reads status + outcome first; only a DRAFT is routed by completion (first unfinished stage). Merchant entity (CR / National ID), Application and User / mobile are separate: knowing the CR never grants access._

### Page 1 preliminary eligibility rules (ordered, KYB-RULES-v5-demo (2026-10-27))

| Rule | Condition | Result | Not Eligible shown | Reason code | Type |
| --- | --- | --- | --- | --- | --- |
| KYB-R01 | Freelancer without a Freelancer Certificate | NOT_ELIGIBLE | Immediately on Page 1 (no Identify, no OTP) | FL_CERT_REQUIRED | business |
| KYB-R02 | Category not supported (blacklisted) | NOT_ELIGIBLE | After Identify + OTP (details saved) | CATEGORY_NOT_SUPPORTED | business |
| KYB-R03 | Regulatory prohibition for this applicant type | NOT_ELIGIBLE | After Identify + OTP (details saved) | REGULATORY_RESTRICTION | regulatory |
| KYB-R04 | Activity requires a CR and the applicant is a Freelancer | NOT_ELIGIBLE | After Identify + OTP (details saved) | ACTIVITY_REQUIRES_CR | regulatory |
| KYB-R05 | Freelancer category allowed online only, applicant sells offline | NOT_ELIGIBLE | After Identify + OTP (details saved) | CHANNEL_NOT_SUPPORTED | business |
| KYB-R06 | Everything else, any revenue band: eligible for self-onboarding | ELIGIBLE | — | OK | internal |

_First matching rule wins. Internal, before any external call. Only two results: ELIGIBLE / NOT_ELIGIBLE. Revenue (bands at SAR 100,000 / SAR 20,000,000) is collected but no rule reads it — it is a risk input. Production Eligibility Matrix: PRODUCT TASK._

### Category rules (synthetic fixture catalogue)

| Madfu subcategory | Registered business | Freelancer |
| --- | --- | --- |
| Retail & e-commerce › Fashion & accessories | Allowed | Allowed |
| Retail & e-commerce › Electronics | Allowed | Freelancer online only |
| Retail & e-commerce › Gold & jewellery (example) | Regulatory prohibition | Regulatory prohibition |
| Food & beverage › Cafés & coffee | Allowed | Requires a CR |
| Food & beverage › Home-made food | Allowed | Freelancer online only |
| Services › Design & creative services | Allowed | Allowed |
| Services › Photography | Allowed | Allowed |
| Services › Business consulting | Allowed | Allowed |
| Fixture examples (demo rules) › Example: unsupported (blacklisted) category | Not supported (blacklisted) | Not supported (blacklisted) |

_A category is allowed or not supported (Not Eligible); there is no manual-review category route. Example only (e.g. gold & jewellery)._

### Government CR rules — hard (GOV-CR-v4-demo (2026-10-27))

| Check | Condition | Action |
| --- | --- | --- |
| CR status | ACTIVE | continue |
| CR status | EXPIRED | saved + Sales recovery (CR_EXPIRED) |
| CR status | SUSPENDED | saved + Sales recovery (CR_SUSPENDED) |
| CR status | RESTRICTED | saved + Sales recovery (CR_RESTRICTED) |
| CR age | any | No hard rule: risk attribute (see risk model) |
| National Address | Missing / expired | continue + flag |
| Legal entity | NON_SAUDI | continue + "additional documents required" (collected later) |

_RESTRICTED follows the Sales route provisionally; the Not Eligible inventory is open._

### Not Eligible rules (and the paused CR route) — separate from the risk score

| Reason | Where | Source | Route |
| --- | --- | --- | --- |
| FL_CERT_REQUIRED | Page 1 | Applicant type | Not Eligible immediately — no Identify, no OTP |
| CATEGORY_NOT_SUPPORTED | Page 1 (declared) and after retrieval (verified) | Eligibility Matrix | Identify → OTP → Not Eligible (details saved, no paid check) |
| REGULATORY_RESTRICTION | Page 1 | Eligibility Matrix (regulatory) | Identify → OTP → Not Eligible (details saved, no paid check) |
| ACTIVITY_REQUIRES_CR | Page 1 / certificate activity | Eligibility Matrix (regulatory) | Identify → OTP → Not Eligible (details saved, no paid check) |
| CHANNEL_NOT_SUPPORTED | Page 1 | Eligibility Matrix | Identify → OTP → Not Eligible (details saved, no paid check) |
| ACTIVITY_REGULATED | After CR / certificate retrieval | Government activity mapping | Not Eligible, personalised reason |
| NOT_OWNER_MANAGER | Page 2 declaration (after OTP) | Applicant declaration | Not Eligible; delegated onboarding is out of V1 |
| NO_OWNER_MANAGER_ON_CR | After people retrieval | Government associated parties | Not Eligible; declaration not confirmed by government data |
| FL_IBAN_NOT_LINKED | Page 2 declaration (after OTP) | Applicant declaration | Not Eligible until the bank account is linked |
| FL_CERT_NOT_FOUND | Certificate pre-check (before Nafath) | Freelance platform | Not Eligible; no Nafath call |
| CR_EXPIRED | After CR retrieval | Government CR status | Paused: saved application + Sales recovery |
| CR_SUSPENDED | After CR retrieval | Government CR status | Paused: saved application + Sales recovery |
| CR_RESTRICTED | After CR retrieval | Government CR status (provisional) | Paused: saved application + Sales recovery |

_A regulatory or business Not Eligible rule is never converted into a score to let a merchant continue. Revenue is never a Not Eligible rule._

### Backend risk model (RISK-v1-demo (2026-10-27), synthetic)

| Factor | Values → demo points |
| --- | --- |
| CR age | Under 12 months: 3 · 12–24 months: 2 · Over 24 months: 1 |
| Declared revenue | BELOW_100K: 2 · MID_BAND: 1 · ABOVE_20M: 0 |
| Verified category group | retail: 2 · food: 1 · services: 1 · fixture: 1 |
| Entity | SAUDI: 0 · NON_SAUDI: 2 |
| National Address | VALID: 0 · MISSING: 1 · EXPIRED: 1 |
| Not modelled | Fraud signals · Credit signals · Compliance / screening signals |
| Level | LOW < 4 ≤ MEDIUM < 7 ≤ HIGH |

_Backend only; never shown to the merchant; never rejects on its own. Production factors, weights and thresholds: RISK DECISION._

### Government activity → Madfu category (ACT-MAP-v4-demo (2026-10-27))

| Government activity | Madfu subcategory |
| --- | --- |
| ACT-4771 · Retail sale of clothing (demo) | Retail & e-commerce › Fashion & accessories |
| ACT-4772 · Retail sale of footwear and leather goods (demo) | Retail & e-commerce › Fashion & accessories |
| ACT-4741 · Retail sale of electronic equipment (demo) | Retail & e-commerce › Electronics |
| ACT-4777 · Retail sale of gold and jewellery (demo) | Retail & e-commerce › Gold & jewellery (example) |
| ACT-5630 · Coffee shops (demo) | Food & beverage › Cafés & coffee |
| ACT-5610 · Restaurants and cafés (demo) | Food & beverage › Cafés & coffee |
| ACT-1079 · Home food production (demo) | Food & beverage › Home-made food |
| ACT-7410 · Specialised design activities (demo) | Services › Design & creative services |
| ACT-7420 · Photographic activities (demo) | Services › Photography |
| ACT-7020 · Management consultancy (demo) | Services › Business consulting |
| ACT-4719 · General retail trade (demo) | Not mapped |
| ACT-9999 · Activity not in the mapping (demo) | Not mapped |

_Many-to-one. A CR carries several activities. Demo reconciliation: a regulated activity blocks; an activity matching the declaration confirms it; otherwise the primary mapped activity reclassifies; nothing mapped keeps the declaration provisionally (internal flag). Final mapping and multi-activity rules: open._

### External-call order and cost assumptions

| Applicant | Order of paid calls (backend) | What the applicant sees |
| --- | --- | --- |
| Before the first OTP | None (eligibility and existence checks are internal) | Page 1 → Page 2 → code |
| Freelancer without certificate | None | Page 1 → Not Eligible |
| Registered business | OTP → CR_DATA → PERSONS → MOBILE_MATCH → NAFATH | Code → owner / manager → Send to Nafath |
| Freelancer | OTP → FL_CERTS → MOBILE_MATCH → NAFATH → IBAN | Code → Nafath → certificate → IBAN |
| Unsupported category / prerequisite No | OTP only | Code → Not Eligible (details saved) |
| Expired / suspended CR | OTP → CR data (then stop) | Code → saved, Sales follow-up |
| Ordinary resume | OTP only (valid checks reused) | Code → first unfinished stage |

_Product cost assumptions (Internal view only): FL_CERTS ≈ SAR 9 · NAFATH ≈ SAR 6 · CR_DATA unknown · PERSONS unknown · MOBILE_MATCH unknown · IBAN unknown · OTP unknown. Certificate pre-check rule flag: ON (pending provider / compliance permission)._

### Verification reuse (positive results)

| Verification | Depends on | Freshness policy | On ordinary resume |
| --- | --- | --- | --- |
| CR data (status, age, activities, National Address, entity) | CR identity | Reusable until invalidated (policy open) | Reused — no new provider call |
| Owners / managers on the CR | CR identity | Reusable until invalidated (policy open) | Reused — no new provider call |
| Mobile ↔ National ID ownership | Mobile + National ID of the verifying person | Reusable until invalidated (policy open) | Reused — no new provider call |
| Nafath | Application + verifying person (National ID) | Reusable until invalidated (policy open) | Reused — no new provider call |
| Freelancer Certificate (existence + details) | National ID | Reusable until invalidated (policy open) | Reused — no new provider call |
| Freelancer IBAN ↔ certificate linkage | IBAN + National ID + selected certificate | Reusable until invalidated (policy open) | Reused — no new provider call |

_Resume normally costs one SMS OTP._

### Negative / technical results — policy per result type

| Result | Policy | Merchant sees | Repeat call |
| --- | --- | --- | --- |
| Provider unavailable (CR, people, certificate, IBAN) | Retry later. Retries are counted per session and reset on resume; nothing is cached as a result. | Try again / Save & exit | Yes, on retry or resume |
| Nafath technical failure | Does not use an attempt; bounded per session, reset on resume. | Try again later | Yes, bounded |
| CR expired / suspended | Application saved as PAUSED_CR and handed to Sales. The CR is re-checked only in the controlled Sales recovery after correction. | Update your CR; Sales will help you continue (no Refresh button) | Only in the controlled recovery |
| CR age | Not a negative result: a risk attribute, recalculated whenever the CR is retrieved again. | Nothing | No |
| Mobile ↔ National ID mismatch | A corrected mobile needs a new OTP and a new match check; after the configured checks the verification step pauses. | Use another mobile number | One new check per corrected mobile |
| Nafath rejected / timed out | Uses one of the application’s attempts; after the last one, details are still collected and the application goes to manual verification without a contract. | Retry while attempts remain | Bounded |
| Certificate changed | Invalidates the checks that depend on it (IBAN linkage, category). | Re-verify the IBAN | IBAN only |
| IBAN changed | Invalidates the IBAN check only; a different IBAN starts with fresh attempts. | Verify the new IBAN | IBAN only |
| IBAN ownership mismatch | Two mismatches for the same IBAN; then a different IBAN is required. Technical errors do not count. | Enter another IBAN | Only for a different IBAN |
| Nafath / certificate / CR success | Reusable until a dependency changes or a freshness policy (open) says otherwise. | Nothing | No |

### Review: locked vs editable sections

| Section | Editable | Invalidates | Note |
| --- | --- | --- | --- |
| Applicant type, CR / National ID | Locked | Nothing | Locked: start a new application for another business |
| Declared category (Page 1) | Locked | Nothing | Locked once the application exists; the verified government category is authoritative |
| Verified government data, activities, verified category | Locked | Nothing | Locked: retrieved, never typed |
| Selected owner / manager, verified mobile | Locked | Nothing | Locked after Nafath |
| Freelancer Certificate | Locked | Nothing | Locked after selection is confirmed |
| Freelancer IBAN (verified) | Locked | Nothing | Locked once verified; before that it is edited on Business Details (IBAN check only) |
| Store presence (website / Google Maps) | Yes (transactional) | Nothing | Re-validates the URL format only |
| Commercial rate review request | Yes (transactional) | Nothing | Standard offer unchanged; internal flag only |

_Transactional edit: values change in a draft; Save applies; Cancel restores the whole application; nothing is invalidated before Save._

### Business Details: store-presence validation (configurable)

| Field | Asked when | Accepted | Rejected |
| --- | --- | --- | --- |
| Online store / business website | Channel Online or Both | Any real domain, with or without https:// (Saudi and Arabic domains, store platforms) | Social media (instagram.com, facebook.com, fb.com, tiktok.com…) · WhatsApp · link shorteners · invalid format |
| Google Maps branch / store link | Channel Offline or Both | maps.app.goo.gl, g.page, g.co · goo.gl/maps · maps.google.* · google.*/maps (any country domain) | Any other host or path, invalid format |

_Fraud / store-presence evidence. Google Maps = actual selling location; National Address = legal / HQ data from the CR. A format check does not prove ownership._

### Abuse protection (architecture; prototype simulates the bounded parts)

| Control | Where | Prototype |
| --- | --- | --- |
| Request rate limiting | Page 1 and Page 2 endpoints | Page 2 throttled after 5 submissions / session; simulator toggle |
| IP / device throttling | Edge / API gateway | Documented (not simulated) |
| Eligibility request limits | Page 1 | Documented (not simulated) |
| OTP resend limit | OTP | 3 resends, 30 s cooldown; resend never restores the budget |
| OTP attempt limit | OTP | 3 wrong codes per code; locked after the last code |
| Bot protection / challenge when suspicious | Page 2 | Shown as the throttled state |
| Paid-call bounds | Providers | Mobile check 2 / application · Nafath 2 failures / application, 3 technical / session · IBAN 2 mismatches / IBAN · provider retries 2 / session |

### Pricing & Commission Matrix (PRICING-v4-demo (2026-10-27), synthetic)

| Category / subcategory | Standard commission |
| --- | --- |
| retail | 7.0% |
| retail-electronics | 6.5% |
| food | 6.0% |
| services | 7.5% |
| fixture | 7.0% |

_Priced on the VERIFIED (government-mapped) category; never on declared revenue. No plan selection in onboarding. A rate review never blocks: the standard offer applies._

### Contract gate (computed from the prototype rule)

| Applicant | Situation | Contract |
| --- | --- | --- |
| Registered business | Mobile matched, Nafath verified | Contract available |
| Registered business | Nafath failed twice | No contract |
| Registered business | Mobile ownership not confirmed | No contract |
| Freelancer | Nafath verified, certificate confirmed, IBAN linkage verified | Contract available |
| Freelancer | IBAN linkage not verified | No contract |

_Freelancer IBAN linkage must be verified before Review can continue; without Nafath the application is submitted for manual verification without a contract._

### Outcome pages (merchant-facing)

| Outcome | Applicant sees |
| --- | --- |
| SUBMITTED | Your application has been submitted successfully. |
| SUBMITTED_MANUAL | We have received your application. |
| NOT_ELIGIBLE | Not eligible for Madfu onboarding |
| PAUSED_CR | Your application is saved. |

### Internal reason codes (shown to the merchant only as a personalised sentence)

| Code | Meaning |
| --- | --- |
| OK | No restriction |
| CATEGORY_NOT_SUPPORTED | Category not supported (blacklisted) |
| REGULATORY_RESTRICTION | Regulatory prohibition |
| ACTIVITY_REQUIRES_CR | Activity requires a CR |
| CHANNEL_NOT_SUPPORTED | Channel not allowed for this applicant type |
| FL_CERT_REQUIRED | Freelancer without certificate (Not Eligible on Page 1) |
| FL_CERT_NOT_FOUND | No usable Freelancer Certificate found (pre-check) |
| NOT_OWNER_MANAGER | Declared "No" to: Are you an owner or manager registered on this CR? |
| NO_OWNER_MANAGER_ON_CR | No individual owner / manager on the CR (declaration not confirmed) |
| FL_IBAN_NOT_LINKED | Declared "No" to: Is your IBAN linked to your Freelancer Certificate? |
| ACTIVITY_REGULATED | Verified government activity is not eligible |
| CR_EXPIRED | CR expired |
| CR_SUSPENDED | CR suspended |
| CR_RESTRICTED | CR restricted (provisional route) |

## Open decisions

These are **not confirmed rules**. The prototype implements each configurably with synthetic values.

- **OD-1 · PRODUCT TASK — Exact Eligibility Matrix.** Category · subcategory · applicant type · channel · result (Eligible / Not Eligible) · CR / certificate required · regulatory restriction · personalised reason · rule version. Revenue does not decide eligibility. Prototype: fixture catalogue.
- **OD-2 · PRODUCT TASK — Exact government activity → category mapping.** Every activity code → Madfu subcategory (many-to-one). Prototype: synthetic codes.
- **OD-3 · PRODUCT / COMPLIANCE DECISION — Multi-activity reconciliation behaviour.** Which activity wins (primary, any, most restrictive), and what happens when several map to different categories. Prototype: demo order (regulated blocks → match confirms → primary reclassifies → unmapped keeps the declaration).
- **OD-4 · RISK DECISION — Risk scoring weights / formula.** Factors and weights (CR age, status, revenue, category, fraud, credit, compliance). Prototype: synthetic demo weights.
- **OD-5 · PRODUCT / COMPLIANCE DECISION — Not Eligible inventory.** The complete list of regulatory / business conditions that cannot continue, incl. how a restricted CR is handled (prototype: Sales route, provisional).
- **OD-6 · RISK DECISION — Low / Medium / High thresholds and their effect.** Thresholds and what each level changes (review depth, limits, pricing). Prototype: demo thresholds, no effect on the journey.
- **OD-7 · PROVIDER / COMPLIANCE DECISION — Certificate lookup before Nafath.** Whether the freelance platform / privacy rules permit an existence check by National ID before Nafath. Prototype rule flag flCertificatePrecheckBeforeNafath = true.
- **OD-8 · PROVIDER / COMPLIANCE DECISION — Mobile ↔ National ID provider / service behaviour.** Which service confirms mobile ownership, its cost, latency, coverage (e.g. prepaid / non-Saudi numbers) and reuse. Prototype: simulated service.
- **OD-9 · COMPLIANCE DECISION — Behaviour after repeated mobile mismatch.** Prototype: 2 checks per application, then the verification step pauses with progress saved. Whether this escalates, blocks or routes to manual is open.
- **OD-10 · PRODUCT TASK — Exact Pricing & Commission Matrix.** Verified category / subcategory → standard commission; tiers; effective dates. Prototype: synthetic.
- **OD-11 · PRODUCT/COMMERCIAL DECISION — Evidence requested for a better rate.** Which documents or data qualify a rate review, and how an improved rate is applied after the contract. Prototype: two placeholder documents.
- **OD-12 · LEGAL DECISION — Final Freelancer IBAN regulatory / legal wording.** The Page-2 question, the Not Eligible message and the linkage requirement wording.
- **OD-13 · PRODUCT/ENGINEERING DECISION — Freshness rules by verification / result.** How long CR data, people, mobile match, Nafath, certificate and IBAN results stay valid. Prototype: reusable until invalidated; negative results per NEGATIVE_POLICY.
- **OD-14 · OPERATIONS DECISION — Sales / manual recovery workflow after an expired / suspended CR.** Who owns it, how the CR is re-checked after correction (prototype: one controlled re-check by Sales), and how the merchant continues.
- **OD-15 · OPERATIONS DECISION — Final application status lifecycle / SLA.** Statuses after submission (prototype: Submitted, Under review, Action required, Approved, Unable to proceed) and any SLA. None invented.
- **OD-16 · LEGAL DECISION — Authorisation of CR owners / managers.** Whether Legal requires a finer distinction (e.g. signatory powers, partner types) than "owner or manager registered on the CR".

Other open points:

- Exact revenue band boundaries at SAR 100,000 and SAR 20,000,000 and their risk weights (revenue no longer routes to Sales).
- How Madfu contacts saved Not Eligible records when a category becomes supported, and whether such a record can then continue online (prototype: re-entry shows the Not Eligible confirmation).
- Providers behind CR data, associated parties, mobile ownership, certificates, IBAN linkage and the contract (prototype: neutral simulated adapters).
- Which additional documents non-Saudi entities need, and when operations collect them.
- Payout IBAN for registered businesses: collected at activation in the Merchant Portal (not built here).

## Backlog templates (columns to fill)

### Onboarding Decision & Validation Inventory (incl. hard blocks) — PRODUCT TASK

| Source | Field | Condition | Hard block or risk factor | Regulatory / business / internal | Evaluation stage | User-visible message | Lifecycle status | Manual / Sales follow-up | External-call / cost impact | Rule version |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| … | … | … | … | … | … | … | … | … | … | … |

### Eligibility Matrix — PRODUCT TASK

| Category | Subcategory | Applicant type | Sales channel | Revenue band (if relevant) | Result (self-onboarding / Sales / blocked) | Required CR / certificate | Regulatory restriction | Personalised reason | Rule version |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| … | … | … | … | … | … | … | … | … | … |

### Government activity → category mapping — PRODUCT TASK

| Activity code | Activity name | Madfu category | Madfu subcategory | Eligible for (CR / FL) | Multi-activity precedence | Version |
| --- | --- | --- | --- | --- | --- | --- |
| … | … | … | … | … | … | … |

### Pricing & Commission Matrix — PRODUCT TASK

| Verified category | Subcategory | Merchant tier | Standard commission | Rate-review logic | Proof requirement | Effective date / version |
| --- | --- | --- | --- | --- | --- | --- |
| … | … | … | … | … | … | … |

## Prototype Controls

A reviewer-only **Back to previous step** button sits at the top of the controls (not merchant UX): it only changes the screen shown — no verification, lifecycle status or saved value is reset, and locked screens show their existing values. It is unavailable during an edit, on code screens and once the application has left DRAFT.

Three separate areas, none of them merchant UI: **This step** (Page Scenarios: only what can happen on the current screen), **Start demo** (journey presets, received Continue links) and **Internal view** (lifecycle, routing, eligibility, verified category, activities, risk, hard blocks, mobiles, checks called / reused / invalidated, cost assumptions, next paid call, rate review, ledger).

Journey presets (Start demo): Happy path — registered business · Happy path — Freelancer · Registered business above SAR 20M · Freelancer without certificate · Unsupported category · Existing incomplete application · Submitted application · Live merchant · Mobile mismatch before Nafath · Expired CR · Resume (Continue link) · Review & edit.

### Page Scenarios per screen

Generated from `model/pageScenarios.ts`; options depend on the current state (e.g. applicant type, channel).

- **Know Your Business** (None — internal eligibility rules only): Eligibility: Eligible Registered Business / Eligible Freelancer / Freelancer without Certificate → Not Eligible / Unsupported Category → Identify / OTP → Not Eligible
- **Identifier + mobile** (Madfu application and merchant records (internal), SMS OTP service (next)): Record lookup (internal): New applicant / Application already in progress / Application already submitted / Already a Madfu merchant / Saved as Not Eligible earlier — Owner or manager on the CR?: Yes → continue / No → Not Eligible (V1) — Abuse controls: Too many requests (rate limit)
- **OTP verification** (SMS OTP service): OTP result: Verified / Incorrect code / Invalid code (wrong format) / Expired / timed out — Actions: Resend code (3 left) / Edit mobile number
- **Business verification (CR) + owner / manager** (Government CR data (status, age, activities, National Address, entity), Government associated parties): CR result: Active CR / Expired → saved + Sales / Suspended → saved + Sales / Provider unavailable / Several activities (government category differs) / Regulated activity among several — Risk attributes (backend only): CR 2 months old / CR 18 months old / National Address missing / Non-Saudi entity (documents later) — Owners / managers: One owner / manager / Several owners / managers / None (only a delegate / company) / People data unavailable
- **Mobile ownership + Nafath** (Freelancer Certificate pre-check (backend, Freelancer), Mobile ownership service, Nafath): Certificate pre-check (backend, before Nafath): Certificate exists / No certificate → Not Eligible, no Nafath / Certificate service unavailable — Mobile ↔ National ID: Mobile matches / Mismatch, then the corrected mobile matches / Mismatch twice → verification paused — Nafath answer: Verified / Rejected / Timeout / Technical failure — Attempts: First failure — retry available / Final failed attempt → manual route
- **Freelancer certificate** (Freelance platform (certificates)): Retrieval result: One certificate / Several certificates / One expired, one active / Already linked to another account / Certificate activity requires a CR
- **Business Details** (Store-presence URL validation (format only), Freelancer IBAN linkage provider): Channel declared on Page 1 (simulator): Online / Offline / Both — Store presence links: Valid website / Maps links / Website: social-media page / Website: invalid / Maps: not a Google Maps link — Freelancer IBAN linkage: Verified / Not linked (first mismatch) / Not linked twice → another IBAN needed / Technical error (no attempt used) / Enter a different IBAN
- **Commercial Offer** (Pricing & Commission Matrix (mock)): Better rate (optional): Standard offer only / Rate review requested (no file) / Evidence uploaded / Optional upload failed
- **Review** (None): Controlled edit: Edit store presence / Edit rate review request
- **Contract** (Contract acceptance (generic, provider not approved)): no simulated outcomes
- **Application Progress** (Madfu application records (internal)): Application status: Submitted / Under review / Action required / Approved / Unable to proceed — Activation (outside onboarding): Merchant goes live

## Scenario catalogue (automated test coverage)

### Know Your Business

- **Eligible registered business** — Five answers, no URL. Check eligibility, then Page 2.
- **Eligible Freelancer** — Freelancer with a certificate: National ID + mobile on Page 2.
- **Eligible registered business — sells online and in store** — Channel captured now; the URLs are asked later in Business Details.
- **Registered business below SAR 100K** — Eligible: revenue never routes. Self-onboarding as normal.
- **Registered business above SAR 20M** — Eligible: self-onboarding as normal (no Sales route).
- **Freelancer without certificate → Not Eligible** — Not Eligible directly on Page 1: no Identify, no National ID, no OTP.
- **Unsupported category → Identify → OTP → Not Eligible** — Continues to Page 2 and the code so a verified contact is kept; then Not Eligible. No paid check.
- **Freelancer in an unsupported category** — National ID + mobile + code, then Not Eligible (details saved).
- **Freelancer in a CR-only category** — Identify + OTP, then Not Eligible: the activity requires a CR.
- **Freelancer category online only, sells offline** — Identify + OTP, then Not Eligible (channel rule).

### Identify & routing

- **New registered business** — CR + mobile + owner / manager = Yes → existence check → OTP to the entered mobile.
- **New Freelancer** — National ID + mobile + IBAN linked = Yes → OTP.
- **Unsupported category: registered business** — CR + mobile (no prerequisite question) → OTP → Not Eligible, details saved. No CR, Nafath or other paid check.
- **Unsupported category: Freelancer** — National ID + mobile → OTP → Not Eligible, details saved. No certificate or Nafath check.
- **Not an owner or manager** — Owner / manager = No → OTP → Not Eligible with the reason. Delegation is out of V1.
- **Freelancer IBAN not linked** — IBAN linked = No → OTP → Not Eligible with linkage instructions.
- **Application already in progress** — Code goes to the REGISTERED mobile (•••••••123), not the entered one; then resume.
- **Application already submitted** — Registered-mobile code → Application Progress. Never Review or Contract.
- **Saved as Not Eligible earlier** — Registered-mobile code → the Not Eligible confirmation (saved details). No new record.
- **Already a Madfu merchant** — Account-mobile code → merchant login. No application is created.
- **Too many requests** — Rate limit / bot challenge on Page 2 (simulated).
- **OTP errors** — Wrong codes, expiry, bounded resends.
- **Continue link → OTP → resume** — Saved at the Commercial Offer: only the code, then the offer; nothing re-verified.

### Registered business

- **Walk the registered-business journey** — From Page 1 to Submit (code 246810).
- **Business verification (auto)** — CR data and owners / managers are retrieved on the owner / manager screen; no separate CR page.
- **CR expired** — Saved + Sales recovery; no people, Nafath or IBAN call; no Refresh button.
- **CR suspended** — Same Sales recovery route.
- **CR 2 months old** — Continues: CR age is a risk attribute (Internal view), not a rejection.
- **Several CR activities, government category differs** — Declared café; registered consultancy + general trade: verified category = consultancy (pricing too).
- **Regulated registered activity** — A gold & jewellery activity → Not Eligible, whatever was declared.
- **CR provider unavailable** — Bounded retries in this session; Save & exit; retries reset on resume.
- **No owner or manager on the CR** — Only a delegate and a company: the declaration is not confirmed → Not Eligible.

### Mobile & Nafath

- **Mobile matches the owner** — Send to Nafath: ownership check passes, Nafath request sent.
- **Mobile does not belong to the selected owner** — Use another mobile → OTP → check again → Nafath. CR progress kept.
- **Still a mismatch after the correction** — Verification step paused; progress saved; no Nafath call.
- **Nafath first failure** — Rejected once: one attempt left.
- **Nafath failed twice** — Details still collected; manual verification, no contract.
- **Nafath technical failures** — No attempt used; bounded per session.

### Freelancer

- **Walk the Freelancer journey** — From Page 1 to Submit.
- **Certificate pre-check, then Nafath** — Backend checks the certificate first (cost order); the applicant sees Nafath.
- **No certificate found** — Stops before Nafath: Not Eligible (no Nafath cost).
- **Certificate service unavailable** — Retry later; no Nafath call yet.
- **Mobile not registered to the National ID** — Same mobile correction as for owners.
- **Several certificates** — Choose one; its activity becomes the verified category.
- **Certificate activity requires a CR** — Not Eligible after confirmation.

### Business Details

- **Registered business: website + Google Maps** — No IBAN, VAT or branch count for a registered business.
- **Freelancer: website + IBAN linkage** — IBAN verified against the National ID and certificate.
- **Freelancer IBAN not linked** — Two mismatches for an IBAN: enter another IBAN. Technical errors do not count.

### Commercial Offer

- **Standard offer** — One rate from the verified category → Continue. No plan selection.
- **Rate review requested** — Interest kept without a file; standard offer continues.
- **Rate review with evidence** — Optional file added; never blocks.

### Review & contract

- **Review with locked verified sections** — Only store presence and the rate review can be edited; Cancel restores everything.
- **Freelancer review** — Certificate, IBAN and verified category locked.
- **Contract** — Agree & Submit: one action. Standard commission only.
- **Submitted for manual verification** — Nafath failed twice: Review submits without a contract.

### Application status

- **Submitted** — Application Progress after the registered-mobile code.
- **Under review** — Status only; nothing editable.
- **Action required** — The team contacts the merchant; onboarding is not reopened.
- **Approved** — Approved is not live: no activation claim.

## Assumptions in the prototype

- Page 1 has no identity, mobile, OTP or URL; Page 2 has identifier, mobile and the prerequisite question.
- Merchant entity, Application and User / mobile are separate; access to an existing record = OTP to its registered mobile.
- Application and merchant account are separate: no login or password during onboarding.
- A Continue link identifies a DRAFT; OTP to the registered mobile is always required; links stop working on submission or mobile change.
- Nafath verifies identity; it is not the contract signature.
- No standard-path document uploads; Freelancers upload nothing.
- Payment plans are not configured in onboarding; the Contract shows the standard commission only.
- Source of Revenue / Source of Income, VAT and branch count are not asked.

## Superseded in Madfu Proposed

- Website / Google Maps link on Page 1 (now Business Details).
- Page-1 manual-review and temporarily-paused category routes (categories are allowed or blocked).
- Lead-contact form (name + mobile) before OTP: Sales leads now give identifier + mobile on Page 2.
- A new application for an identifier that already has one; access with a newly entered mobile.
- Submitted applications reopening Review / Contract on resume (status-blind routing).
- Separate CR confirmation page with only "Next".
- CR age ≤ 3 months → temporarily not eligible (now a risk attribute).
- Expired CR → manual verification; suspended → not eligible (both now: saved + Sales recovery).
- Pairwise category ↔ activity table (MATCH / COMPATIBLE / AMBIGUOUS / CONFLICT) and the "Continue; Madfu will confirm" screen.
- Pricing from the declared category after verification.
- Nafath before the Freelancer Certificate check (backend order).
- Mobile ↔ selected-owner mismatch as a note only (now functional before Nafath).
- Registered-business IBAN, VAT question / number, number of branches, Freelancer "bank not linked → continue".
- 3 / 4 / 6 / 9 / 12-month plan selection in the Commercial Offer and plans in the Contract.
- Unrestricted Review editing; Cancel that did not restore selections.
- Unlimited OTP resends resetting the attempts.
- Contract Decline action and the "contract declined" outcome (the Contract page has Back to Review and Agree & Submit only).
- Sales-lead routing at initial eligibility: registered business above SAR 20M → Sales, below SAR 100K → lead, and the Sales / lead thank-you pages (every revenue band now self-onboards when otherwise eligible).
- Freelancer without certificate entering National ID + mobile + OTP as a lead (now Not Eligible directly on Page 1).
- Blacklisted / unsupported category stopping on Page 1 with no contact captured (now Identify + OTP, details saved, then Not Eligible).
- "Blocked" / "Sales lead" outcome terminology (now "Not Eligible"; internal reason codes kept).
