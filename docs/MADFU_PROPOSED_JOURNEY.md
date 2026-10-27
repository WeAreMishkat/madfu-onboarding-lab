# Madfu Proposed — merchant self-onboarding (v6: identifier before OTP, internal Not Eligible, CR authorization + signer handoff, lifecycle routing)

> Generated from the Merchant Onboarding Lab model (`src/experiences/proposed/model/`) by `npm run docs`. Do not edit by hand: change the model and regenerate. A test fails when this file is out of date.

**Status:** Proposed / Product Design. Synthetic data; simulated integrations. Not production behaviour.

**Source of truth:** the agreed product decisions of 2026-10-28, building on those of 2026-10-27. They supersede the v5 prototype, the KYB-first v3 journey (2026-10-23) and the 2026-10-15 wireframe specification where they differ. Madfu Current, Tamara and Tabby are unchanged.

**Principle:** ask cheaply first, verify expensively later, never ask twice, never repeat a paid verification unnecessarily, never open an existing application without its stored mobile, and never show an automatic rejection reason.

**Cost rule:** Successful CR / owner / mobile / Nafath / certificate / IBAN checks are reused by the preparer. Resume normally costs one OTP to the stored mobile. A signer verifies with Nafath again in every session.

## Workflows

1. New Eligible CR Merchant
2. New Eligible Freelancer
3. Not Eligible Application
4. Existing In-Progress CR Merchant — Resume
5. Existing In-Progress Freelancer — Resume
6. Submitted Application
7. Existing Live Merchant
8. CR Merchant Signer Flow

## Journey

1. Shared start — Know Your Business (applicant type, category, subcategory, annual revenue, sales channel) → Identification → OTP. Eligibility is decided internally (**Eligible** / **Not Eligible**) and never shown. Revenue never routes (risk input only).
2. Internal existence check (no provider): new · incomplete · awaiting authorization · submitted · live · paused · not eligible. New → code to the entered mobile; existing → code to the STORED mobile only (a different entered mobile is never used).
3. Not Eligible Application → captured with the internal reason → "Application submitted" (later "Under review"); the team contacts the applicant. No paid check.
4. New Eligible CR Merchant → CR Verification → Business Details → Commercial Offer → Review → Authorization choice → (myself) owner / manager → mobile ↔ National ID → Nafath → Contract → Submitted, or (another signer) Signer Handoff.
5. CR Merchant Signer Flow → application + offer frozen → secure SMS link (7 days, configurable) → masked signer confirmation → mobile ↔ National ID → Nafath → read-only Review → Contract → Agree & Sign → Submitted. No signer OTP. Max 2 versions of the same application in 30 days.
6. New Eligible Freelancer → Certificate → mobile ↔ National ID → Nafath → Business Details (+ IBAN linked to the certificate) → Commercial Offer → Review → Contract → Submitted.
7. Resume (CR / Freelancer) → first unfinished step · Submitted → Application Progress · Live → "active account" popup → Log in.

## Phase 1 vs Phase 2

**PHASE 1**

- Core CR and Freelancer onboarding (shared KYB → Identify → OTP)
- Not Eligible captured internally; merchant sees Application submitted / Under review
- Resume (CR and Freelancer) with the stored mobile only
- Submitted application → Application Progress
- Live merchant popup with a Log in button
- CR Authorization choice: self authorization or signer handoff
- Signer secure SMS link — no signer OTP
- Nafath before the signer sees the full application; read-only signer review
- Application + Commercial Offer freeze at handoff
- 7-day configurable handoff validity
- Maximum 2 handoff versions within 30 days (then internal unlock)
- No preparer signer / mobile change after the handoff starts
- No send-back / request-changes loop

**PHASE 2 / FUTURE**

- Change signer or signer mobile after a handoff (revoke the old link, new version, new link)
- Resend / revoke workflow
- Delegated signer production implementation
- Ministry of Justice delegation integration
- Manual delegation Quality-review workflow
- Low-priority "change to another owner / manager / signatory" option
- Any more advanced signer workflow (multiple signers, send-back)

## Conflicts with the previous prototype (resolved)

- v5 showed "Not Eligible" pages (with a personalised reason) and stopped a Freelancer without certificate on Page 1 → now internal only: everyone goes through Identify + OTP and sees Application submitted.
- v5 asked registered businesses "Are you an owner or manager registered on this CR?" (No = Not Eligible) → removed: the preparer can be anyone; the owner / manager is chosen at the Authorization step.
- v5 put owner / manager selection and Nafath before Business Details for a CR → now after Review (Authorization choice).
- v5 showed the Freelancer Certificate after Nafath (a hidden pre-check ran before) → now visible before Nafath; the separate pre-check and its rule flag are gone.
- v5 sent a live merchant straight to a login hand-off screen → now a popup; login only on click.
- v5 Nafath attempts were counted per application → now per authorization (a new signer version starts fresh attempts).

## Stages

| # | Stage | Screens |
| --- | --- | --- |
| 1 | Know Your Business | kyb |
| 2 | Identify & Verify | identify, otp |
| 3 | Business Verification | cr, certificates, nafath |
| 4 | Business Details | business |
| 5 | Commercial Offer | commercial |
| 6 | Review | review |
| 7 | Authorization & Contract | authorize, handoff, delegation, signer, contract |
| 8 | Submit / Application Status | outcome, status, login |

## Confirmed product decisions

- Eight target workflows: New Eligible CR Merchant · New Eligible Freelancer · Not Eligible Application · Existing In-Progress CR Merchant — Resume · Existing In-Progress Freelancer — Resume · Submitted Application · Existing Live Merchant · CR Merchant Signer Flow. Sub-cases sit inside them.
- Shared start for everyone: Know Your Business / Eligibility → Identification → OTP; then routing by the application lifecycle AND the authorization state.
- Know Your Business (one page) asks only applicant type (Registered Business with CR / Freelancer with Certificate / Freelancer without Certificate), category, subcategory, annual revenue and sales channel (online / offline / both) — no website or Google Maps link.
- Eligibility has two INTERNAL outcomes, Eligible and Not Eligible. Not Eligible is never shown: no "Rejected", "Blacklisted", "Blocked", "Not eligible" or reason on any merchant screen.
- Not Eligible applicants (Freelancer without certificate, unsupported / regulated category, CR-only activity, channel, IBAN not linked, no certificate found, regulated CR activity, no owner / manager on the CR) are treated as leads: Identify + OTP, the application is captured with the internal reason, and the merchant sees "Application submitted" (later "Under review"). The team contacts them and explains the reason manually. No paid check runs after capture.
- Annual revenue is collected but never routes: every band (below SAR 100,000, SAR 100,000–20,000,000, above SAR 20,000,000) self-onboards when otherwise eligible. Revenue is a risk input only.
- An internal existence check runs before any OTP; it calls no provider.
- Existing applications and accounts are opened only by an OTP to their STORED mobile (last three digits shown). A different mobile entered on Page 2 is never used, cannot be switched to and cannot take over an in-progress application.
- Resume does not create a new application and does not restart: it opens the first unfinished stage; completed, verified steps stay locked / reused. CR and Freelancer resume are separate workflows because their steps differ.
- Submitted applications (and internally Not Eligible ones) open Application Progress after the code; they never reopen Review, Contract or submission.
- Existing live merchant: a popup "You already have an active account under this CR." with a "Log in" button; nothing navigates until the merchant clicks. No application is created.
- Registered business: CR Verification / CR data → Business Details → Commercial Offer → Review → Authorization choice → (self) Nafath → Contract → Submitted, or Signer Handoff. The preparer is never asked to pick an owner / manager earlier only for signing, and is not asked whether they are an owner / manager on Page 2.
- Freelancer: Certificate list / selection → mobile ↔ National ID → Nafath → Business Details → Commercial Offer → Review → Contract → Submitted. The certificate is visible BEFORE Nafath; the retrieval is also the cost check (no certificate → no Nafath). Freelancers declare "Is your IBAN linked to your Freelancer Certificate?" on Page 2.
- CR IBAN, VAT and number of branches are not required in onboarding. Freelancer IBAN stays required and must be linked to the Freelancer Certificate.
- Website / Google Maps are asked in Business Details by sales channel (online → website · offline → Google Maps · both → both). National Address is separate and not a store-presence substitute.
- Commercial Offer belongs to the preparer and comes before the authorization choice: standard terms / rate → Continue, optional low-priority better-rate review. No payment-plan configuration, no 6 / 9 / 12-month selection. The signer can never modify it.
- After Review the CR preparer chooses: "I can complete the authorization myself" (select yourself among the owners / managers → mobile ↔ National ID → Nafath → Contract) or "Send to another signer".
- Send to another signer: select one owner / manager on the CR + enter their primary Nafath mobile → Send Authorization. This creates an authorization version, freezes the application and the Commercial Offer, makes them read-only for the preparer, sends a secure SMS link and opens the preparer's Authorization status page.
- Preparer after a handoff: status only, from configurable statuses (displayed as In progress / Approved / Expired / Not completed). No edit; no signer or mobile change in Phase 1.
- Signer: Secure SMS link → masked Signer confirmation (business, first + last name, masked National ID and mobile) → Start Nafath Verification (mobile ↔ National ID first) → Nafath → full read-only Review (application + frozen offer) → Contract → Agree & Sign → Submitted. No signer OTP in Phase 1; the link alone authorizes nothing and never exposes the application; Nafath runs again in every signer session.
- Signer review is read-only and one-directional: no edit, no send-back, no request-changes loop.
- Handoff validity: 7 days by default, configurable. Each version stores created / expiry timestamps, status and version number. When expired: the link stops working, the application stays saved, nothing disappears, no duplicate application is created.
- No blanket 30-day CR lock. At most 2 signer handoffs (authorization versions) of the SAME application within any 30-day window; a further one needs an internal / manual unlock. Versions are tracked separately with an audit trail; the application ID never changes.
- Once a handoff starts, application data, Commercial Offer, CR / business details and onboarding answers are frozen; the signer authorizes exactly the frozen version.
- Application lifecycle and authorization lifecycle are separate state machines: QUALIFICATION · OTP_PENDING · DRAFT · AWAITING_AUTHORIZATION · NOT_ELIGIBLE (internal) · PAUSED_CR · SUBMITTED · UNDER_REVIEW · ACTION_REQUIRED · APPROVED · UNABLE_TO_PROCEED · LIVE — and NOT_STARTED · HANDOFF_CREATED · AWAITING_SIGNER · NAFATH_PENDING · NAFATH_VERIFIED · CONTRACT_PENDING · COMPLETED · EXPIRED · CANCELLED.
- Progressive risk scoring stays modular and separate from hard regulatory blockers; its objective is a merchant risk level (conceptually Proceed fully / Proceed controlled / Hold), not an automatic rejection. CR age is a risk input, never a rejection.
- Expired / suspended CR: no further downstream spend, the application is saved, a controlled state is shown and internal / Sales follow-up recovers it.
- After retrieval, the government CR activity (or certificate activity) is the source of truth for the category and the price.
- Mobile ↔ National ID ownership is checked before every Nafath request; a preparer / Freelancer mismatch can be corrected with a new OTP, without restarting. A signer mismatch ends that authorization version (no self-service correction in Phase 1).
- Verified, sensitive sections are locked; the few editable sections use a transactional edit (draft → Save; Cancel restores all) until a handoff freezes the application.
- The Contract page has one action and no Decline: Agree & Submit (preparer) or Agree & Sign (signer).
- Delegated signers (Ministry of Justice delegation, company / commercial delegation document, other official document) stay represented in the demo but are Phase 2. Delegation authority is verified BEFORE Nafath; manual reviews never need an open session.
- OTP is not the only abuse control: rate limiting, IP / device throttling, eligibility limits, bounded resends and attempts, and a bot challenge when suspicious.

## Master Board

Master Board — the journey, screen by screen. Visual screen flow (real screens), source: `model/masterBoard.ts`; PDF: `public/Madfu_Proposed_Simple_Master_Board.pdf`.

- **Know Your Business** — Five questions · eligibility checked internally
- **Identify** — CR or National ID + mobile
- **OTP** — SMS code to verify the mobile
- **Application Submitted** — Not eligible · reason stays internal
- **Resume · CR** — First unfinished CR step
- **Resume · Freelancer** — First unfinished Freelancer step
- **Application Progress** — Submitted application · status only
- **Active Account** — Popup · Log in button
- **Registered Business** — Self-Onboarding
- **CR Verification** — Registration retrieved · nothing to type
- **Business Details** — Website / Google Maps link
- **Commercial Offer** — Standard commission → Continue
- **Review** — Verified details locked
- **Authorization Choice** — Myself, or another signer
- **Nafath** — Owner / manager verifies identity
- **Contract** — Agree & Submit
- **Submitted** — Then: Application Progress
- **Signer** — Another owner / manager signs
- **Waiting for Authorization** — Application frozen · status only
- **Secure Link** — Masked request · no OTP
- **Nafath** — Signer verifies identity
- **Read-only Review** — Full application + frozen offer
- **Contract** — Agree & Sign
- **Submitted** — Signed by the signer
- **Delegated Signer · Phase 2** — MOJ or document review first
- **Freelancer** — Self-Onboarding
- **Certificate** — Choose the Freelancer Certificate
- **Nafath** — Identity verified in the Nafath app
- **Business Details + IBAN** — Website · IBAN linked to the certificate
- **Commercial Offer** — Standard commission → Continue
- **Review** — Verified details locked
- **Contract** — Agree & Submit
- **Submitted** — Then: Application Progress

Arrow labels: Not Eligible · Resume CR · Resume Freelancer · Submitted · Live · New · New Freelancer · Self · Send to signer · SMS link · ✓ Mobile match · Phase 2.

## Detailed Logic Board (one panel per area)

### A · Know Your Business (Page 1): Eligible or Not Eligible — internal only

No identity, mobile, OTP or URL. Two internal outcomes; nothing is shown and everyone continues to Identify. Revenue is collected but never routes (risk input only). The declared category is replaced by the government activity once retrieved.

- **PRODUCT TASK: Eligibility Matrix** _(open)_ — Production catalogue not defined (fixture)
- **Know Your Business** _(screen)_ — Applicant type · Category · Subcategory · Annual revenue · Sales channel
- **Qualification record (KYB-…)** _(backend)_ — Temporary until linked after OTP
- **Eligibility engine** _(decision)_ — 6 ordered rules · internal result

### B · Identifier + mobile, existence check, OTP and routing

Everyone reaches Page 2. An internal lookup decides where the code goes. Existing records open only with their STORED mobile — a different entered mobile is never used. Routing reads the application lifecycle and the authorization state, never completion alone.

- **Rate limit / bot challenge** _(backend)_ — 5 submissions / session
- **Application submitted** _(outcome)_ — Not Eligible is INTERNAL · captured · no paid check · team calls
- **Identifier + mobile** _(screen)_ — CR or National ID · mobile · "IBAN linked?" (eligible Freelancer only)
- **Existence check** _(backend)_ — Internal: new · incomplete · awaiting authorization · submitted · live · paused · not eligible
- **Existing record?** _(decision)_
- **OTP → entered mobile** _(screen)_ — contact_mobile_verified · 3 attempts, 3 resends
- **Create record + route** _(decision)_ — Internal eligibility · IBAN declaration (FL)
- **Entered mobile ≠ stored** _(backend)_ — Never used · no takeover · code to the stored mobile only
- **OTP → STORED mobile** _(screen)_ — "Code sent to the registered mobile ending •••123" · also the Continue link
- **Code not completed** _(outcome)_ — No access · nothing exposed · no new application
- **DRAFT → resume** _(cached)_ — First unfinished CR / Freelancer step · checks reused
- **Lifecycle + authorization** _(decision)_ — Status first, then authorization, then completion
- **Live → "active account" popup** _(screen)_ — Log in only on click · no auto-redirect · no application
- **PAUSED_CR** _(manual)_ — Sales follow-up message
- **Submitted / internal Not Eligible → Application Progress** _(screen)_ — Not Eligible shows "Under review"
- **Awaiting authorization → status page** _(screen)_ — Frozen · status only

### C · Business Verification: registered business (CR verification)

CR data and owners / managers are retrieved in the backend once and reused; nobody is chosen here (authorization comes after Review). CR age and other data feed the risk score; they never reject. No CR IBAN, VAT or branch count.

- **Stored CR data** _(cached)_ — Reused on resume
- **Expired / suspended** _(manual)_ — Your application is saved.
- **Risk score (synthetic)** _(backend)_ — CR age · entity · address · revenue · category — never a block
- **CR data** _(external)_ — Status · age · activities (several) · National Address · entity
- **CR status (hard rule)** _(decision)_
- **Activities → verified category** _(backend)_ — Government wins · prices the offer
- **Owners / managers** _(external)_ — Kept for the Authorization choice
- **Your business registration** _(screen)_ — Retrieved data · Continue
- **Provider unavailable** _(screen)_ — Retry (2/session) · Save & exit · reset on resume
- **Application submitted** _(outcome)_ — Regulated activity → internal Not Eligible
- **Application submitted** _(outcome)_ — No owner / manager on the CR → internal Not Eligible
- **PRODUCT TASK: activity mapping** _(open)_
- **Multi-activity reconciliation** _(open)_
- **Not Eligible inventory** _(open)_
- **Risk weights / thresholds** _(open)_

### D · Business Verification: Freelancer — certificate before Nafath

The certificate list is retrieved by National ID and chosen BEFORE Nafath (one call; no certificate → no Nafath cost). The confirmed certificate activity becomes the verified category; then mobile ↔ National ID and Nafath. Freelancer IBAN stays required and linked to the certificate.

- **Application submitted** _(outcome)_ — No usable certificate → internal Not Eligible · NO Nafath call
- **Application submitted** _(outcome)_ — Certificate activity requires a CR → internal
- **Certificate retrieval** _(external)_ — By National ID · reused on resume
- **Choose certificate** _(screen)_ — Expired / already linked cannot be selected
- **Certificate activity → verified category** _(decision)_
- **Service unavailable** _(screen)_ — Retry later; no Nafath yet
- **Locked after Nafath** _(cached)_ — Certificate cannot change once verified
- **PRIVACY / PROVIDER: certificate details before Nafath** _(open)_

### E · Mobile ↔ National ID, then Nafath (Freelancer, self-authorizing owner, signer)

Send to Nafath first confirms that the mobile belongs to the verifying person. Freelancer: right after the certificate. Registered business: only after Review and the Authorization choice. A preparer / Freelancer mismatch never restarts onboarding; a signer cannot change the mobile in Phase 1.

- **Technical failure** _(backend)_ — No attempt used · 3 / session
- **Nafath verified** _(cached)_ — Preparer: reused on resume · signer: again every session
- **Send to Nafath** _(screen)_ — Freelancer · self-authorizing owner / manager · signer
- **Mobile ↔ National ID** _(external)_ — Signer: the handoff mobile · others: registered mobile · 2 checks
- **Nafath** _(external)_ — 2 attempts / authorization
- **Mismatch (preparer / Freelancer)** _(screen)_ — "The mobile number must belong to …" · Use another mobile number
- **OTP → new mobile** _(screen)_ — Becomes the registered mobile
- **Rejected / timed out** _(screen)_ — Retry while attempts remain
- **Failed twice** _(manual)_ — FL: details collected, no contract · CR self: manual verification · signer: version ends
- **PROVIDER: mobile ownership service** _(open)_
- **Still a mismatch** _(manual)_ — Verification paused · progress saved · no Nafath call
- **COMPLIANCE: after repeated mismatch** _(open)_

### F · Business Details

Store presence for the channel declared on Page 1 (fraud / presence evidence). Google Maps = actual selling branch, not the National Address. Freelancers verify the IBAN linkage. Frozen once a signer handoff starts.

- **Online: store / website URL** _(backend)_ — Scheme optional · no social / WhatsApp / shorteners
- **Business Details** _(screen)_ — Channel shown from Page 1
- **Channel** _(decision)_
- **Both: both links** _(backend)_
- **Applicant type** _(decision)_
- **Offline: Google Maps branch link** _(backend)_ — Any Google Maps domain
- **Freelancer IBAN ↔ certificate** _(external)_ — 2 mismatches / IBAN; technical errors free
- **Not linked twice** _(manual)_ — Enter another IBAN · contract needs a verified IBAN

### G · Commercial Offer (preparer only)

Your Standard Offer → Continue, before any authorization. The rate comes from the VERIFIED category. A better-rate review is optional and low-priority. Once a signer handoff starts the offer is frozen with the application; the signer sees it read-only.

- **Your Standard Offer** _(screen)_ — One commission · short explanation · Continue
- **Pricing matrix** _(backend)_ — Verified (government-mapped) category
- **"Want us to review a better rate?"** _(screen)_ — Collapsed link under the offer
- **Request rate review** _(backend)_ — COMMERCIAL_RATE_REVIEW_REQUESTED · no file needed
- **Optional evidence** _(screen)_ — Shown only after the request
- **Commercial rate review** _(manual)_ — Never blocks; standard rate applies
- **Frozen at handoff** _(cached)_ — Versioned with the application · signer read-only
- **PRODUCT TASK: Pricing matrix** _(open)_
- **COMMERCIAL: evidence for a better rate** _(open)_

### H · Review: locked sections, transactional edit

Preparer: verified sections are locked; only store presence and the rate-review request can be edited (draft until Save; Cancel restores everything). Registered business continues to the Authorization choice. Signer: the same page, entirely read-only.

- **Locked** _(cached)_ — Type · identifier · category · government data · mobile · certificate · FL IBAN
- **Review** _(screen)_ — Applicant · verified identity · store presence · status · banking (FL) · offer
- **Editable section?** _(decision)_ — Store presence · rate review
- **Draft copy** _(backend)_ — Nothing applied yet
- **Save** _(backend)_ — Apply · invalidate dependants only (none here)
- **Cancel** _(backend)_ — Restore the whole application

### I · Authorization choice and signer handoff (registered business, Phase 1)

After Review the preparer authorizes personally or sends the application to another owner / manager on the CR. A handoff creates an authorization VERSION of the same application, freezes data and offer, and sends a secure SMS link valid 7 days (configurable). Max 2 versions in 30 days — no blanket CR lock.

- **PRODUCT: final preparer status list** _(open)_ — Configurable buckets (In progress · Approved · …)
- **PHASE 2: change signer / mobile, resend / revoke** _(open)_
- **Who will authorize and sign?** _(screen)_ — Myself · Send to another signer
- **Choice** _(decision)_
- **Select yourself** _(screen)_ — Owner / manager on the CR
- **Send to another signer** _(screen)_ — Owner / manager on the CR + primary Nafath mobile
- **≤ 2 in 30 days?** _(decision)_ — Versions of THIS application
- **Create authorization V{n}** _(backend)_ — Same application · audit trail · SMS link (7 days)
- **Waiting for authorization** _(screen)_ — Preparer: status only · no edit · no signer change
- **Limit reached** _(manual)_ — Internal / manual unlock · self authorization still possible
- **Application + offer frozen** _(cached)_ — Signer reviews exactly this version
- **Expired / ended** _(manual)_ — Link dead · application kept · no new application

### J · CR signer: secure link → Nafath → read-only Review → Contract

No signer OTP in Phase 1, and the link alone authorizes nothing: the first page shows only masked context. Nafath is the strong identity step and runs again in every signer session; only then is the full application shown. One direction only.

- **PHASE 2 · Delegated signer** _(open)_ — MOJ (automatic) · company / other document (Quality review) · verified BEFORE Nafath
- **Secure SMS link** _(screen)_ — Token → application + version
- **Link valid?** _(decision)_ — Latest version · not expired · not ended
- **Signer confirmation** _(screen)_ — Business · first + last name · masked ID & mobile · Start Nafath Verification
- **Mobile ↔ National ID** _(external)_ — The mobile the preparer entered
- **Nafath** _(external)_ — 2 attempts
- **Read-only Review** _(screen)_ — Full application + frozen offer · no edit
- **Contract** _(screen)_ — Agree & Sign
- **Link no longer works** _(outcome)_ — Expired / ended / older version · nothing shown
- **Version ends** _(manual)_ — Mobile mismatch or Nafath failed twice · application kept
- **Submitted** _(outcome)_ — Authorization COMPLETED · preparer sees Application Progress

### K · Contract, submission and Application Progress

Back to Review, or one action: Agree & Submit (preparer) / Agree & Sign (signer) records acceptance and submits (no Decline). A submitted application opens Application Progress — never Review, Contract or a second submission. No activation is claimed before it happens.

- **Review** _(screen)_
- **Contract gate** _(decision)_ — Signing person: Nafath + mobile ownership · CR: authorization chosen / live signer link · FL: certificate + IBAN
- **Contract** _(screen)_ — Frozen standard commission as Schedule 1 · one action
- **Submitted** _(outcome)_ — Your application has been submitted successfully.
- **Application Progress** _(screen)_ — Return later with the stored-mobile code
- **Live → active-account popup** _(screen)_ — Log in button
- **Submitted for manual verification** _(manual)_ — We have received your application.
- **Statuses** _(backend)_ — Submitted · Under review · Action required · Approved · Unable to proceed
- **OPERATIONS: final status lifecycle / SLA** _(open)_

### L · Resume, reuse, invalidation and freshness

Ordinary resume costs one OTP to the stored mobile and opens the first unfinished CR or Freelancer step. Positive results are reused until a dependency changes; negative and technical results follow a policy per result type.

- **Freshness policy per verification** _(open)_ — Open: reusable until invalidated
- **Stored-mobile OTP** _(screen)_ — Page 2 re-entry or Continue link
- **Valid checks reused** _(cached)_ — CR · owners · mobile match · Nafath · certificate · IBAN
- **Negative results** _(backend)_ — Outage: retry, counters reset per session · expired CR: Sales only · CR age: re-scored
- **Invalidation** _(backend)_ — Mobile → match · certificate → IBAN · IBAN → IBAN only

### M · Two lifecycles: application vs authorization · Phase 1 vs Phase 2

Routing reads BOTH: the application lifecycle (top) and the CR authorization lifecycle (bottom). Completing the authorization submits the application. Not Eligible is an internal application state; the merchant sees Submitted / Under review.

- **QUALIFICATION** _(backend)_ — Page 1 / Page 2
- **OTP_PENDING** _(backend)_
- **DRAFT** _(backend)_ — Editable by the preparer
- **AWAITING_AUTHORIZATION** _(backend)_ — Frozen · handoff version exists
- **SUBMITTED** _(backend)_
- **UNDER_REVIEW → APPROVED** _(backend)_ — or ACTION_REQUIRED / UNABLE_TO_PROCEED
- **LIVE** _(backend)_
- **NOT_ELIGIBLE (internal)** _(manual)_ — Merchant sees Submitted / Under review
- **PAUSED_CR** _(manual)_ — Expired / suspended CR · Sales
- **NOT_STARTED** _(backend)_
- **HANDOFF_CREATED** _(backend)_ — transient
- **AWAITING_SIGNER** _(backend)_
- **NAFATH_PENDING** _(backend)_
- **NAFATH_VERIFIED** _(backend)_
- **CONTRACT_PENDING** _(backend)_
- **COMPLETED** _(backend)_ — Application → SUBMITTED
- **EXPIRED** _(manual)_ — After 7 days (configurable)
- **CANCELLED** _(manual)_ — Signer mobile mismatch / Nafath failed twice

## Resume / Continue Application

1. **Save & exit** (DRAFT only) sends a Continue Application link to the stored mobile. Links stop working on submission, handoff or when the mobile changes.
2. Opening the link — or entering the same identifier on Page 2 (with any mobile) — identifies the application but does **not** authorise access: the code goes to the stored mobile only.
3. After the code, routing reads the lifecycle and authorization status: DRAFT → first unfinished CR / Freelancer stage (every valid check reused); awaiting authorization → status page; submitted or internally Not Eligible → Application Progress; live → active-account popup; paused → Sales follow-up.
4. OTP: 3 attempts per code, 3 resends; a resend never restores the budget. Provider retry counters and Nafath technical failures reset per session.

## Rules and decision tables

### Phase 1 vs Phase 2

| Phase | Scope |
| --- | --- |
| PHASE 1 | Core CR and Freelancer onboarding (shared KYB → Identify → OTP) |
| PHASE 1 | Not Eligible captured internally; merchant sees Application submitted / Under review |
| PHASE 1 | Resume (CR and Freelancer) with the stored mobile only |
| PHASE 1 | Submitted application → Application Progress |
| PHASE 1 | Live merchant popup with a Log in button |
| PHASE 1 | CR Authorization choice: self authorization or signer handoff |
| PHASE 1 | Signer secure SMS link — no signer OTP |
| PHASE 1 | Nafath before the signer sees the full application; read-only signer review |
| PHASE 1 | Application + Commercial Offer freeze at handoff |
| PHASE 1 | 7-day configurable handoff validity |
| PHASE 1 | Maximum 2 handoff versions within 30 days (then internal unlock) |
| PHASE 1 | No preparer signer / mobile change after the handoff starts |
| PHASE 1 | No send-back / request-changes loop |
| PHASE 2 / FUTURE | Change signer or signer mobile after a handoff (revoke the old link, new version, new link) |
| PHASE 2 / FUTURE | Resend / revoke workflow |
| PHASE 2 / FUTURE | Delegated signer production implementation |
| PHASE 2 / FUTURE | Ministry of Justice delegation integration |
| PHASE 2 / FUTURE | Manual delegation Quality-review workflow |
| PHASE 2 / FUTURE | Low-priority "change to another owner / manager / signatory" option |
| PHASE 2 / FUTURE | Any more advanced signer workflow (multiple signers, send-back) |

### Stages

| # | Stage | Screens |
| --- | --- | --- |
| 1 | Know Your Business | kyb |
| 2 | Identify & Verify | identify · otp |
| 3 | Business Verification | cr · certificates · nafath |
| 4 | Business Details | business |
| 5 | Commercial Offer | commercial |
| 6 | Review | review |
| 7 | Authorization & Contract | authorize · handoff · delegation · signer · contract |
| 8 | Submit / Application Status | outcome · status · login |

_Registered business: Nafath is part of stage 7 (after the Authorization choice). Freelancer: Nafath is part of stage 3 (after the certificate). The signer has a short own stepper: Request · Nafath · Review · Sign · Done._

### Page 1 → Page 2 → existence check → OTP → routing

| Situation | OTP sent to | After the code |
| --- | --- | --- |
| New identifier, internally Not Eligible (any reason) | Entered mobile | Application captured with the internal reason → "Application submitted"; no paid check; team contacts the applicant |
| New identifier, eligible Freelancer, IBAN linked = No | Entered mobile | Captured internally (FL_IBAN_NOT_LINKED) → "Application submitted" |
| New identifier, eligible registered business (any revenue band) | Entered mobile | Application created (DRAFT) → CR Verification |
| New identifier, eligible Freelancer with certificate (any revenue band) | Entered mobile | Application created (DRAFT) → Certificate (before Nafath) |
| Incomplete application (DRAFT), any entered mobile | STORED application mobile (•••••••123) — never the entered one | Resume at the first unfinished CR / Freelancer step; valid checks reused |
| Awaiting authorization (handoff exists) | Stored application mobile | Authorization status page (frozen, status only) |
| Submitted, not live | Stored application mobile | Application Progress (status only) |
| Captured as internally Not Eligible | Stored mobile | Application Progress — "Under review"; no reason |
| Paused (CR expired / suspended) | Stored application mobile | Saved; Sales will help you continue |
| Live merchant | Stored account mobile | Popup "You already have an active account under this CR." → Log in (on click only) |
| Code not completed | — | No access; nothing exposed; no new application |

_There is no Sales-lead route and no merchant-facing Not Eligible page. Throttled after 5 Page-2 submissions per session (simulated rate limit / bot challenge)._

### Application lifecycle → where the application opens (preparer)

| Status | Meaning | Opens at |
| --- | --- | --- |
| QUALIFICATION | Qualification (Page 1 / Page 2) — no application yet | Page 1 / Page 2 (nothing persisted) |
| OTP_PENDING | OTP pending — no application yet | OTP screen |
| DRAFT | Draft application (self-onboarding in progress) | First unfinished stage (CR: … review / authorization; FL: certificate / Nafath / …) |
| AWAITING_AUTHORIZATION | Awaiting authorization — application frozen, signer handoff exists | Authorization status page (or the self-authorization Nafath / Contract after a new version) |
| NOT_ELIGIBLE | Not Eligible (INTERNAL) — merchant sees Application submitted / Under review; team contacts them | Application Progress — "Under review" (internal state) |
| PAUSED_CR | Paused — CR expired / suspended; saved and handed to Sales | Sales / manual follow-up message |
| SUBMITTED | Submitted | Application Progress |
| UNDER_REVIEW | Under review | Application Progress |
| ACTION_REQUIRED | Action required | Application Progress |
| APPROVED | Approved (not yet live) | Application Progress |
| UNABLE_TO_PROCEED | Unable to proceed | Application Progress |
| LIVE | Live merchant (account exists) | Active-account popup → Log in |

_Routing reads the lifecycle first, then the authorization status; only a DRAFT is routed by completion. Merchant entity (CR / National ID), Application and User / mobile are separate: knowing the CR never grants access._

### Authorization lifecycle (separate from the application lifecycle)

| Status | Meaning | Preparer sees (configurable) |
| --- | --- | --- |
| NOT_STARTED | Authorization not chosen yet (or a draft choice) | Not started — Not started |
| HANDOFF_CREATED | Version record created, SMS not yet sent (transient) | In progress — Handoff created |
| AWAITING_SIGNER | Secure link sent; signer has not verified | In progress — Awaiting signer |
| NAFATH_PENDING | Signer (or self-authorizing preparer) started Nafath | In progress — Nafath pending |
| NAFATH_VERIFIED | Identity verified with Nafath | In progress — Nafath verified |
| CONTRACT_PENDING | Contract opened, not yet signed | In progress — Contract pending |
| COMPLETED | Signed → application SUBMITTED | Approved — Completed |
| EXPIRED | No signature within 7 days; link dead; application kept | Expired — Expired |
| CANCELLED | Signer mobile mismatch or Nafath failed twice; application kept | Not completed — Cancelled |

_The final preparer status list is not defined yet (OD-17): display buckets live in configuration (copy.ts PREPARER_AUTH_VIEW)._

### Signer handoff rules (Phase 1, configurable in config.ts HANDOFF_RULES)

| Rule | Value / behaviour |
| --- | --- |
| Who can be the signer | One individual owner / manager registered on the CR (delegates: Phase 2) |
| What the preparer enters | The signer (from the CR list) + the signer's primary Nafath mobile |
| Link validity | 7 days (expiryDays, default 7) |
| Versions per application | Max 2 (maxVersions) within 30 days (windowDays); then internal / manual unlock |
| On expiry | Link stops working · application stays saved · no duplicate application · a new version may start (within the limit) |
| Per version, stored | Application ID · version · signer · masked signer mobile · created / expiry · status · initiated by · end reason · completion timestamp · frozen snapshot |
| Freeze | Application data, Commercial Offer, CR / business details, onboarding answers — from the first handoff |
| Preparer after sending | Status only; no edit; no signer / mobile change (Phase 2) |
| Signer entry | Secure link → masked confirmation → mobile ↔ National ID → Nafath → read-only Review → Contract (no OTP) |
| Signer failures | Mobile mismatch or Nafath failed twice → version CANCELLED; application kept |

### Page 1 preliminary eligibility rules (ordered, KYB-RULES-v6-demo (2026-10-28))

| Rule | Condition | Result (internal) | Reason code | Type |
| --- | --- | --- | --- | --- |
| KYB-R01 | Freelancer without a Freelancer Certificate | NOT_ELIGIBLE | FL_CERT_REQUIRED | business |
| KYB-R02 | Category not supported (blacklisted) | NOT_ELIGIBLE | CATEGORY_NOT_SUPPORTED | business |
| KYB-R03 | Regulatory prohibition for this applicant type | NOT_ELIGIBLE | REGULATORY_RESTRICTION | regulatory |
| KYB-R04 | Activity requires a CR and the applicant is a Freelancer | NOT_ELIGIBLE | ACTIVITY_REQUIRES_CR | regulatory |
| KYB-R05 | Freelancer category allowed online only, applicant sells offline | NOT_ELIGIBLE | CHANNEL_NOT_SUPPORTED | business |
| KYB-R06 | Everything else, any revenue band: eligible for self-onboarding | ELIGIBLE | OK | internal |

_First matching rule wins. Internal, before any external call, never shown. Every result continues to Identify + OTP. Revenue (bands at SAR 100,000 / SAR 20,000,000) is collected but no rule reads it — it is a risk input. Production Eligibility Matrix: PRODUCT TASK._

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

_A category is allowed or (internally) not eligible; there is no manual-review category route. Example only (e.g. gold & jewellery)._

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

### Not Eligible rules (internal) and the paused CR route — separate from the risk score

| Reason | Where | Source | Route |
| --- | --- | --- | --- |
| FL_CERT_REQUIRED | Page 1 | Applicant type | Identify → OTP → Internal Not Eligible → merchant sees Application submitted; team contacts them · no paid check |
| CATEGORY_NOT_SUPPORTED | Page 1 (declared) and after retrieval (verified) | Eligibility Matrix | Identify → OTP → Internal Not Eligible → merchant sees Application submitted; team contacts them · no paid check |
| REGULATORY_RESTRICTION | Page 1 | Eligibility Matrix (regulatory) | Identify → OTP → Internal Not Eligible → merchant sees Application submitted; team contacts them · no paid check |
| ACTIVITY_REQUIRES_CR | Page 1 / certificate activity | Eligibility Matrix (regulatory) | Identify → OTP → Internal Not Eligible → merchant sees Application submitted; team contacts them · no paid check |
| CHANNEL_NOT_SUPPORTED | Page 1 | Eligibility Matrix | Identify → OTP → Internal Not Eligible → merchant sees Application submitted; team contacts them · no paid check |
| ACTIVITY_REGULATED | After CR / certificate retrieval | Government activity mapping | Internal Not Eligible → merchant sees Application submitted; team contacts them · no further paid check |
| NO_OWNER_MANAGER_ON_CR | After CR people retrieval | Government associated parties | Internal Not Eligible → merchant sees Application submitted; team contacts them · nobody on the CR can authorize in V1 |
| FL_IBAN_NOT_LINKED | Page 2 declaration (after OTP) | Applicant declaration | Internal Not Eligible → merchant sees Application submitted; team contacts them · no paid check |
| FL_CERT_NOT_FOUND | Certificate retrieval (before Nafath) | Freelance platform | Internal Not Eligible → merchant sees Application submitted; team contacts them · no Nafath call |
| CR_EXPIRED | After CR retrieval | Government CR status | Paused: saved application + Sales recovery |
| CR_SUSPENDED | After CR retrieval | Government CR status | Paused: saved application + Sales recovery |
| CR_RESTRICTED | After CR retrieval | Government CR status (provisional) | Paused: saved application + Sales recovery |

_A regulatory or business Not Eligible rule is never converted into a score to let a merchant continue. Revenue is never a Not Eligible rule. No Not Eligible reason is ever shown to the merchant._

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
| Decision (illustrative) | LOW → PROCEED_FULLY · MEDIUM → PROCEED_CONTROLLED · HIGH → HOLD |

_Backend only; never shown to the merchant; never rejects on its own; no production weights or thresholds invented. Production factors, weights, thresholds and decision effects: RISK DECISION._

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

_Many-to-one. A CR carries several activities. Demo reconciliation: a regulated activity blocks (internally); an activity matching the declaration confirms it; otherwise the primary mapped activity reclassifies; nothing mapped keeps the declaration provisionally (internal flag). Final mapping and multi-activity rules: open._

### External-call order and cost assumptions

| Applicant | Order of paid calls (backend) | What the applicant sees |
| --- | --- | --- |
| Before the first OTP | None (eligibility and existence checks are internal) | Page 1 → Page 2 → code |
| Internally Not Eligible | OTP only | Code → Application submitted |
| Registered business (self) | OTP → CR_DATA → PERSONS → MOBILE_MATCH → NAFATH | Code → CR verification → details → offer → review → authorization → Nafath |
| Registered business (signer) | OTP → CR data → owners / managers → (signer) mobile match → Nafath | Signer: link → confirmation → Nafath |
| Freelancer | OTP → FL_CERTS → MOBILE_MATCH → NAFATH → IBAN | Code → certificate → Nafath → details (IBAN) |
| No certificate found | OTP → certificate retrieval (then stop) | Code → Application submitted (no Nafath cost) |
| Expired / suspended CR | OTP → CR data (then stop) | Code → saved, Sales follow-up |
| Ordinary resume | OTP only (valid checks reused) | Code → first unfinished stage |

_Product cost assumptions (Internal view only): FL_CERTS ≈ SAR 9 · NAFATH ≈ SAR 6 · CR_DATA unknown · PERSONS unknown · MOBILE_MATCH unknown · IBAN unknown · OTP unknown._

### Verification reuse (positive results)

| Verification | Depends on | Freshness policy | On ordinary resume |
| --- | --- | --- | --- |
| CR data (status, age, activities, National Address, entity) | CR identity | Reusable until invalidated (policy open) | Reused — no new provider call |
| Owners / managers on the CR | CR identity | Reusable until invalidated (policy open) | Reused — no new provider call |
| Mobile ↔ National ID ownership | Mobile + National ID of the verifying person | Reusable until invalidated (policy open) | Reused — no new provider call |
| Nafath | Application + verifying person (National ID) | Reusable until invalidated (policy open) | Reused for the preparer; the signer verifies again every session |
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
| Authorizing owner / manager, verified mobile | Locked | Nothing | Chosen at the Authorization step; locked after Nafath or a signer handoff |
| Freelancer Certificate | Locked | Nothing | Chosen before Nafath; locked once Nafath is verified |
| Freelancer IBAN (verified) | Locked | Nothing | Locked once verified; before that it is edited on Business Details (IBAN check only) |
| Store presence (website / Google Maps) | Yes (transactional, preparer, before a handoff) | Nothing | Re-validates the URL format only |
| Commercial rate review request | Yes (transactional, preparer, before a handoff) | Nothing | Standard offer unchanged; internal flag only |

_Transactional edit: values change in a draft; Save applies; Cancel restores the whole application; nothing is invalidated before Save. After a handoff everything is frozen; the signer edits nothing._

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
| Signer handoff limit | Authorization | 2 versions / 30 days per application; link valid 7 days |
| Paid-call bounds | Providers | Mobile check 2 / application · Nafath 2 failures / authorization, 3 technical / session · IBAN 2 mismatches / IBAN · provider retries 2 / session |

### Pricing & Commission Matrix (PRICING-v4-demo (2026-10-27), synthetic)

| Category / subcategory | Standard commission |
| --- | --- |
| retail | 7.0% |
| retail-electronics | 6.5% |
| food | 6.0% |
| services | 7.5% |
| fixture | 7.0% |

_Priced on the VERIFIED (government-mapped) category; never on declared revenue. No plan selection in onboarding. A rate review never blocks: the standard offer applies. Frozen at handoff._

### Contract gate (computed from the prototype rule)

| Applicant | Situation | Contract |
| --- | --- | --- |
| Registered business | Self authorization: mobile matched, Nafath verified | Contract available |
| Registered business | Nafath failed twice | No contract |
| Registered business | Mobile ownership not confirmed | No contract |
| Registered business | Authorization not chosen | No contract |
| Freelancer | Certificate confirmed, Nafath verified, IBAN linkage verified | Contract available |
| Freelancer | IBAN linkage not verified | No contract |

_A signer-handoff contract opens only for the signer, in a session verified with Nafath, on the live version. Without Nafath the application is submitted for manual verification without a contract._

### Outcome pages (merchant-facing)

| Outcome | Applicant sees |
| --- | --- |
| SUBMITTED | Your application has been submitted successfully. |
| SUBMITTED_MANUAL | We have received your application. |
| RECEIVED | Your application has been submitted successfully. |
| PAUSED_CR | Your application is saved. |

_RECEIVED (internally Not Eligible) deliberately shows the same page as SUBMITTED._

### Internal reason codes (never shown to the merchant)

| Code | Meaning |
| --- | --- |
| OK | No restriction |
| CATEGORY_NOT_SUPPORTED | Category not supported (blacklisted) |
| REGULATORY_RESTRICTION | Regulatory prohibition |
| ACTIVITY_REQUIRES_CR | Activity requires a CR |
| CHANNEL_NOT_SUPPORTED | Channel not allowed for this applicant type |
| FL_CERT_REQUIRED | Freelancer without certificate |
| FL_CERT_NOT_FOUND | No usable Freelancer Certificate found |
| NO_OWNER_MANAGER_ON_CR | No individual owner / manager on the CR (nobody can authorize in V1) |
| FL_IBAN_NOT_LINKED | Declared "No" to: Is your IBAN linked to your Freelancer Certificate? |
| ACTIVITY_REGULATED | Verified government activity is not eligible |
| CR_EXPIRED | CR expired |
| CR_SUSPENDED | CR suspended |
| CR_RESTRICTED | CR restricted (provisional route) |

_Only the controlled CR states (expired / suspended / restricted) have merchant copy, because the merchant can fix them._

### Conflicts with the previous prototype (v5) — resolved in favour of the 2026-10-28 decisions

| # | Change |
| --- | --- |
| 1 | v5 showed "Not Eligible" pages (with a personalised reason) and stopped a Freelancer without certificate on Page 1 → now internal only: everyone goes through Identify + OTP and sees Application submitted. |
| 2 | v5 asked registered businesses "Are you an owner or manager registered on this CR?" (No = Not Eligible) → removed: the preparer can be anyone; the owner / manager is chosen at the Authorization step. |
| 3 | v5 put owner / manager selection and Nafath before Business Details for a CR → now after Review (Authorization choice). |
| 4 | v5 showed the Freelancer Certificate after Nafath (a hidden pre-check ran before) → now visible before Nafath; the separate pre-check and its rule flag are gone. |
| 5 | v5 sent a live merchant straight to a login hand-off screen → now a popup; login only on click. |
| 6 | v5 Nafath attempts were counted per application → now per authorization (a new signer version starts fresh attempts). |

## Open decisions

These are **not confirmed rules**. The prototype implements each configurably with synthetic values.

- **OD-1 · PRODUCT TASK — Exact Eligibility Matrix.** Category · subcategory · applicant type · channel · internal result (Eligible / Not Eligible) · CR / certificate required · regulatory restriction · internal reason · rule version. Revenue does not decide eligibility. Prototype: fixture catalogue.
- **OD-2 · PRODUCT TASK — Exact government activity → category mapping.** Every activity code → Madfu subcategory (many-to-one). Prototype: synthetic codes.
- **OD-3 · PRODUCT / COMPLIANCE DECISION — Multi-activity reconciliation behaviour.** Which activity wins (primary, any, most restrictive), and what happens when several map to different categories. Prototype: demo order (regulated blocks → match confirms → primary reclassifies → unmapped keeps the declaration).
- **OD-4 · RISK DECISION — Risk scoring weights / formula.** Factors and weights (CR age, status, company type, capital, activities, revenue, category, fraud, credit, compliance). Prototype: synthetic demo weights.
- **OD-5 · PRODUCT / COMPLIANCE DECISION — Not Eligible inventory.** The complete list of regulatory / business conditions that cannot continue, incl. how a restricted CR is handled (prototype: Sales route, provisional).
- **OD-6 · RISK DECISION — Low / Medium / High thresholds and Proceed fully / controlled / Hold.** Thresholds and what each decision changes (review depth, limits, pricing). Prototype: demo thresholds and an illustrative mapping, no effect on the journey.
- **OD-7 · PROVIDER / COMPLIANCE DECISION — Showing Freelancer Certificate details before Nafath.** The certificate list is now shown before Nafath (product decision). Confirm that the freelance platform / privacy rules permit displaying certificate details by National ID before strong identity verification.
- **OD-8 · PROVIDER / COMPLIANCE DECISION — Mobile ↔ National ID provider / service behaviour.** Which service confirms mobile ownership, its cost, latency, coverage (e.g. prepaid / non-Saudi numbers) and reuse. Prototype: simulated service.
- **OD-9 · COMPLIANCE DECISION — Behaviour after repeated mobile mismatch.** Prototype: 2 checks per application, then the verification step pauses with progress saved; a signer mismatch ends the authorization version. Whether this escalates, blocks or routes to manual is open.
- **OD-10 · PRODUCT TASK — Exact Pricing & Commission Matrix.** Verified category / subcategory → standard commission; tiers; effective dates. Prototype: synthetic.
- **OD-11 · PRODUCT/COMMERCIAL DECISION — Evidence requested for a better rate.** Which documents or data qualify a rate review, and how an improved rate is applied after the contract. Prototype: two placeholder documents.
- **OD-12 · LEGAL DECISION — Final Freelancer IBAN regulatory / legal wording.** The Page-2 question and the linkage requirement wording.
- **OD-13 · PRODUCT/ENGINEERING DECISION — Freshness rules by verification / result.** How long CR data, people, mobile match, Nafath, certificate and IBAN results stay valid. Prototype: reusable until invalidated; negative results per NEGATIVE_POLICY.
- **OD-14 · OPERATIONS DECISION — Sales / manual recovery workflow after an expired / suspended CR.** Who owns it, how the CR is re-checked after correction (prototype: one controlled re-check by Sales), and how the merchant continues.
- **OD-15 · OPERATIONS DECISION — Final application status lifecycle / SLA.** Statuses after submission (prototype: Submitted, Under review, Action required, Approved, Unable to proceed) and any SLA. None invented.
- **OD-16 · LEGAL DECISION — Authorisation of CR owners / managers.** Whether Legal requires a finer distinction (e.g. signatory powers, partner types) than "owner or manager registered on the CR" for signing.
- **OD-17 · PRODUCT TASK — Final preparer authorization status list.** Prototype buckets (configurable): In progress · Approved · Expired · Not completed. The final Phase-1 list (e.g. In Progress / Approved / Rejected) is to be defined.
- **OD-18 · OPERATIONS DECISION — Internal unlock after the handoff limit.** Who may unlock a further handoff after 2 versions in 30 days, with which checks, and how it is audited. Prototype: one Internal-view button.
- **OD-19 · OPERATIONS DECISION — Contacting internally Not Eligible applicants.** Who calls captured Not Eligible applicants, within what time, what they say, and whether a record can later continue online if the rule changes.
- **OD-20 · LEGAL DECISION — Signer link without OTP.** Confirm that a secure SMS link + Nafath (no OTP) is sufficient for the signer in Phase 1, and the masked information allowed on the confirmation page before Nafath.

Other open points:

- Exact revenue band boundaries at SAR 100,000 and SAR 20,000,000 and their risk weights (revenue never routes).
- Whether a signer who cancels / fails can be replaced by the same preparer through a new version immediately, or only after internal review (prototype: a new version is allowed within the limit).
- Providers behind CR data, associated parties, mobile ownership, certificates, IBAN linkage, SMS links and the contract (prototype: neutral simulated adapters).
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

A reviewer-only **Back to previous step** button sits at the top of the controls (not merchant UX): it only changes the screen shown — no verification, lifecycle status or saved value is reset, and locked screens show their existing values. It is unavailable during an edit, on code screens, in a signer session and once the application has left DRAFT.

Three separate areas, none of them merchant UI: **This step** (Page Scenarios: only what can happen on the current screen), **Start demo** (presets grouped by the eight workflows, received Continue and signer links) and **Internal view** (actor, lifecycle, routing, resume stage, internal eligibility and not-eligible reason, verified category, activities, risk + illustrative decision, mobiles, authorization status / version / signer / expiry / attempts / freeze / delegation / signing, checks called / reused / invalidated, cost assumptions, ledger).

- **New Eligible CR Merchant:** New eligible CR merchant · Self authorization · Mobile mismatch before Nafath · Expired CR · Review & edit
- **New Eligible Freelancer:** New eligible Freelancer
- **Not Eligible Application:** Not eligible: registered business · Not eligible: Freelancer without certificate · Not eligible: Freelancer category
- **Existing In-Progress CR Merchant — Resume:** Existing incomplete application · Resume (Continue link)
- **Existing In-Progress Freelancer — Resume:** Existing incomplete Freelancer application · Freelancer Continue link
- **Submitted Application:** Submitted application
- **Existing Live Merchant:** Live merchant
- **CR Merchant Signer Flow:** CR signer handoff · Handoff active · Signer secure-link entry · Signer Nafath failure · Handoff expired · Authorization V1 / V2 · Handoff limit reached · Delegated signer (Phase 2 demo)

### Page Scenarios per screen

Generated from `model/pageScenarios.ts`; options depend on the current state (e.g. applicant type, channel).

- **Know Your Business** (None — internal eligibility rules only): Eligibility (internal): Eligible Registered Business / Eligible Freelancer / Freelancer without Certificate → Identify / OTP → Application submitted / Unsupported Category → Identify / OTP → Application submitted
- **Identifier + mobile** (Madfu application and merchant records (internal), SMS OTP service (next)): Record lookup (internal): New applicant / Application already in progress / Application already submitted / Already a Madfu merchant / Captured earlier (internally Not Eligible) — IBAN linked to the certificate?: Yes → continue / No → Application submitted (internal Not Eligible) — Abuse controls: Too many requests (rate limit)
- **OTP verification** (SMS OTP service): OTP result: Verified / Incorrect code / Invalid code (wrong format) / Expired / timed out — Actions: Resend code (3 left) / Edit mobile number
- **CR verification** (Government CR data (status, age, activities, National Address, entity), Government associated parties): CR result: Active CR / Expired → saved + Sales / Suspended → saved + Sales / Provider unavailable / Several activities (government category differs) / Regulated activity among several — Risk attributes (backend only): CR 2 months old / CR 18 months old / National Address missing / Non-Saudi entity (documents later) — Owners / managers: One owner / manager / Several owners / managers / None (only a delegate / company) → captured internally / People data unavailable
- **Freelancer certificate** (Freelance platform (certificates)): Retrieval result: One certificate / Several certificates / One expired, one active / Already linked to another account / No certificate → Application submitted (internal) / Certificate service unavailable / Certificate activity requires a CR
- **Mobile ownership + Nafath** (Mobile ownership service, Nafath): Mobile ↔ National ID: Mobile matches / Mismatch, then the corrected mobile matches / Mismatch twice → verification paused — Nafath answer: Verified / Rejected / Timeout / Technical failure — Attempts: First failure — retry available / Final failed attempt → manual route
- **Business Details** (Store-presence URL validation (format only), Freelancer IBAN linkage provider): Channel declared on Page 1 (simulator): Online / Offline / Both — Store presence links: Valid website / Maps links / Website: social-media page / Website: invalid / Maps: not a Google Maps link — Freelancer IBAN linkage: Verified / Not linked (first mismatch) / Not linked twice → another IBAN needed / Technical error (no attempt used) / Enter a different IBAN
- **Commercial Offer** (Pricing & Commission Matrix (mock)): Better rate (optional): Standard offer only / Rate review requested (no file) / Evidence uploaded / Optional upload failed
- **Review** (None): Controlled edit: Edit store presence / Edit rate review request
- **Authorization choice** (Government associated parties (stored), SMS (secure signer link)): Choice: I can complete the authorization myself / Send to another signer — Signer handoff: Send Authorization (owner / manager + demo mobile)
- **Authorization status (preparer)** (SMS (secure signer link)): Signer: Signer opens the secure link (new session) / 7 days pass → link expires / 6 days pass → still valid
- **Signer entry (secure link)** (Secure link (token), Mobile ownership service (next), Nafath (next)): Signer checks before Nafath: Start Nafath (mobile matches) / Signer mobile does not match → version ends
- **Delegated signer — PHASE 2 (demo only)** (Ministry of Justice (Phase 2, not integrated), Quality manual review (Phase 2)): Delegation type: Ministry of Justice delegation / Company / commercial delegation document / Other official delegation document
- **Contract** (Contract acceptance (generic, provider not approved)): no simulated outcomes
- **Application Progress** (Madfu application records (internal)): Application status: Submitted / Under review / Action required / Approved / Unable to proceed — Activation (outside onboarding): Merchant goes live

## Scenario catalogue (automated test coverage)

### Know Your Business

- **Eligible registered business** — Five answers, no URL. Check eligibility, then Page 2.
- **Eligible Freelancer** — Freelancer with a certificate: National ID + mobile on Page 2.
- **Eligible registered business — sells online and in store** — Channel captured now; the URLs are asked later in Business Details.
- **Registered business below SAR 100K** — Eligible: revenue never routes. Self-onboarding as normal.
- **Registered business above SAR 20M** — Eligible: self-onboarding as normal (no Sales route).
- **Freelancer without certificate (internally Not Eligible)** — Continues to Identify + OTP; the merchant sees Application submitted. Reason internal.
- **Unsupported category (internally Not Eligible)** — Identify + OTP, then Application submitted. No paid check; the team calls them.
- **Freelancer in an unsupported category** — National ID + mobile + code, then Application submitted (internal Not Eligible).
- **Freelancer in a CR-only category** — Identify + OTP, then Application submitted; reason (activity requires a CR) internal.
- **Freelancer category online only, sells offline** — Identify + OTP, then Application submitted (channel rule internal).

### Identify & routing

- **New registered business** — CR + mobile → existence check → OTP to the entered mobile. No owner / manager question.
- **New Freelancer** — National ID + mobile + IBAN linked = Yes → OTP.
- **Not eligible: registered business** — CR + mobile (neutral page) → OTP → Application submitted. No CR, Nafath or other paid check.
- **Not eligible: Freelancer** — National ID + mobile → OTP → Application submitted. No certificate or Nafath check.
- **Not eligible: Freelancer without certificate** — National ID + mobile → OTP → Application submitted (reason internal).
- **Freelancer IBAN not linked** — IBAN linked = No → OTP → Application submitted (internal Not Eligible).
- **Registered business in progress (resume)** — Different mobile entered: the code goes to the STORED mobile (•••••••123) only; then Business Details.
- **Freelancer in progress (resume)** — Code to the stored mobile; resumes at Nafath (certificate already chosen).
- **Application already submitted** — Registered-mobile code → Application Progress. Never Review or Contract.
- **Captured earlier (internally Not Eligible)** — Registered-mobile code → Application Progress “Under review”. No new record, no reason shown.
- **Already a Madfu merchant** — Account-mobile code → popup “You already have an active account” → Log in only on click.
- **Too many requests** — Rate limit / bot challenge on Page 2 (simulated).
- **OTP errors** — Wrong codes, expiry, bounded resends.
- **Continue link → OTP → resume (registered business)** — Saved at the Commercial Offer: only the code, then the offer; nothing re-verified.
- **Continue link → OTP → resume (Freelancer)** — Saved at Business Details: certificate and Nafath reused.

### Registered business

- **Walk the registered-business journey** — From Page 1 to Submit (code 246810).
- **CR verification (auto)** — CR data and owners / managers are retrieved; the merchant only reviews and continues.
- **CR expired** — Saved + Sales recovery; no further paid calls; no Refresh button.
- **CR suspended** — Same Sales recovery route.
- **CR 2 months old** — Continues: CR age is a risk input (Internal view), not a rejection.
- **Several CR activities, government category differs** — Declared café; registered consultancy + general trade: verified category = consultancy (pricing too).
- **Regulated registered activity** — Captured internally as Not Eligible; the merchant sees Application submitted.
- **CR provider unavailable** — Bounded retries in this session; Save & exit; retries reset on resume.
- **No owner or manager on the CR** — Nobody can authorize in V1 (delegates are Phase 2): captured internally.

### Authorization & signer

- **Authorization choice** — After Review: “I can complete the authorization myself” or “Send to another signer”.
- **Self authorization** — The preparer is an owner / manager: select yourself → Nafath → Contract.
- **Send to another signer** — Select an owner / manager on the CR + their Nafath mobile → Send Authorization.
- **Handoff active (preparer status)** — Application and offer frozen; status only; no signer / mobile change in Phase 1.
- **Signer opens the secure link** — No OTP. Masked request only — no application details before Nafath.
- **Signer Nafath** — Mobile ↔ National ID for the signer mobile, then Nafath.
- **Signer Nafath fails twice** — Authorization not completed; the application stays saved.
- **Signer mobile does not belong to the signer** — No self-service mobile change in Phase 1: this authorization version ends.
- **Signer read-only review** — After Nafath: full application + frozen offer, nothing editable.
- **Signer contract** — Agree & Sign submits the application.
- **Handoff expired (preparer)** — Link no longer works; same application kept; a new authorization version may start.
- **Signer opens an expired link** — Nothing about the application is shown.
- **Authorization V2 (same application)** — V1 expired; V2 sent for the same application ID.
- **Handoff limit reached** — Two versions in 30 days: a third is refused until an internal unlock.
- **Delegated signer (Phase 2 demo)** — MOJ delegation, company document or other document — demo states only.

### Mobile & Nafath

- **Mobile matches the owner** — Self authorization: ownership check passes, Nafath request sent.
- **Mobile does not belong to the selected owner** — Use another mobile → OTP → check again → Nafath. Progress kept.
- **Still a mismatch after the correction** — Verification step paused; progress saved; no Nafath call.
- **Nafath first failure** — Rejected once: one attempt left.
- **Nafath failed twice** — Registered business: submitted for manual verification, no contract.
- **Nafath technical failures** — No attempt used; bounded per session.

### Freelancer

- **Walk the Freelancer journey** — From Page 1 to Submit.
- **Several certificates** — Before Nafath: choose one; its activity becomes the verified category.
- **No certificate found** — Captured internally before any Nafath cost; the merchant sees Application submitted.
- **Certificate service unavailable** — Retry later; no Nafath call yet.
- **Certificate activity requires a CR** — Captured internally after confirmation.
- **Freelancer Nafath** — Certificate chosen; mobile ↔ National ID, then Nafath.
- **Mobile not registered to the National ID** — Same mobile correction as for owners.

### Business Details

- **Registered business: website + Google Maps** — No IBAN, VAT or branch count for a registered business.
- **Freelancer: website + IBAN linkage** — IBAN verified against the National ID and certificate.
- **Freelancer IBAN not linked** — Two mismatches for an IBAN: enter another IBAN. Technical errors do not count.

### Commercial Offer

- **Standard offer** — One rate from the verified category → Continue. No plan selection.
- **Rate review requested** — Interest kept without a file; standard offer continues.
- **Rate review with evidence** — Optional file added; never blocks.

### Review & contract

- **Review with locked verified sections** — Only store presence and the rate review can be edited; then the Authorization choice.
- **Freelancer review** — Certificate, IBAN and verified category locked.
- **Contract (self authorization)** — Agree & Submit: one action. Standard commission only.
- **Contract (Freelancer)** — Agree & Submit.
- **Submitted for manual verification** — Freelancer Nafath failed twice: Review submits without a contract.

### Application status

- **Submitted** — Application Progress after the registered-mobile code.
- **Under review** — Status only; nothing editable.
- **Action required** — The team contacts the merchant; onboarding is not reopened.
- **Approved** — Approved is not live: no activation claim.

## Assumptions in the prototype

- Page 1 has no identity, mobile, OTP or URL; Page 2 has identifier, mobile and (eligible Freelancer only) the IBAN question.
- Merchant entity, Application and User / mobile are separate; access to an existing record = OTP to its stored mobile.
- Application and merchant account are separate: no login or password during onboarding.
- A Continue link identifies a DRAFT; OTP to the stored mobile is always required; links stop working on submission, handoff or mobile change.
- A signer link identifies one authorization version; Nafath (not the link) proves the signer; the signer verifies with Nafath again in every session.
- After an expired or ended handoff the preparer may start a new authorization version of the SAME application (self or signer); data and offer stay frozen.
- Self authorization after a cancelled handoff is not a handoff and does not count towards the handoff limit.
- Nafath attempts are counted per authorization (each signer version starts fresh); technical failures stay bounded per session.
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
- "Blocked" / "Sales lead" outcome terminology.
- Merchant-facing "Not Eligible" pages with a personalised reason, and the Page-1 Not Eligible stop for a Freelancer without certificate (v5) — Not Eligible is now internal; the applicant sees Application submitted.
- The registered-business Page-2 question "Are you an owner or manager registered on this CR?" (No = Not Eligible).
- Owner / manager selection and Nafath before Business Details for a registered business (now after Review, at the Authorization choice).
- Hidden Freelancer Certificate pre-check before Nafath with the certificate shown after Nafath (now the certificate screen comes before Nafath).
- Automatic hand-off of a live merchant to the login screen (now a popup with a Log in button).
