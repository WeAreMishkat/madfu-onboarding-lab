# Madfu Proposed — merchant self-onboarding (KYB-first)

> Generated from the Merchant Onboarding Lab model (`src/experiences/proposed/model/`) by `npm run docs`. Do not edit by hand: change the model and regenerate. A test fails when this file is out of date.

**Status:** Proposed / Product Design. Synthetic data; simulated integrations. Not production behaviour.

**Source of truth:** the KYB-first journey update of 2026-10-23. Where it conflicts with older Madfu Proposed requirements (wireframe specification of 2026-10-15), it wins. Madfu Current, Tamara and Tabby are unchanged.

**Principle:** ask cheaply first, verify expensively later, never ask twice, never repeat a paid verification unnecessarily, and do not lose a commercially valid lead because one operational requirement is incomplete.

**Cost rule:** Previously verified CR / Nafath / IBAN data is reused. Resume normally triggers OTP only. Previously successful external checks are reused until their dependent data changes or an explicit freshness policy invalidates them.

## Stages

| # | Stage | Screens |
| --- | --- | --- |
| 1 | Know Your Business | kyb, lead |
| 2 | Identify & Verify | identify, otp |
| 3 | Business Verification | cr-verify, persons, nafath, certificates |
| 4 | Business & Banking Details | business |
| 5 | Commercial Offer | commercial |
| 6 | Review | review |
| 7 | Contract | contract |
| 8 | Submit / Outcome | outcome |

## Detailed journey (one panel per area)

### A · Know Your Business and eligibility

First page. No CR, National ID, mobile or OTP. Eligibility is evaluated internally before any paid verification.

- **Know Your Business** _(screen)_ — Applicant type · Category · Subcategory · Annual revenue · Sales channel
- **URL validation (configurable)** _(backend)_ — Online/Both: website (no social, no WhatsApp) · Offline/Both: Google Maps
- **Qualification record (KYB-…)** _(backend)_ — Temporary until linked after OTP
- **Eligibility engine** _(decision)_ — 10 ordered rules
- **Manual-review category** _(manual)_ — Continue, internal flag
- **Not eligible / temporarily not eligible** _(outcome)_ — Blocked · regulatory · CR required · channel · paused
- **Lead contact** _(screen)_ — Name · mobile
- **SMS OTP (lead)** _(screen)_
- **Sales lead** _(outcome)_ — Thank you for your interest in Madfu. Our team will contact you.
- **Certificate required (lead)** _(outcome)_ — A Freelancer Certificate is required to continue.
- **PRODUCT TASK: Eligibility Matrix** _(open)_ — Production catalogue not defined (fixture)

### B · Identify & Verify, duplicates and resume

Identity after eligibility. The Continue link identifies the application; OTP authorises it. Resume goes to the first incomplete screen.

- **Identification** _(screen)_ — CR: CR / Unified Number + mobile · FL: National ID + mobile
- **Duplicate / existing checks** _(backend)_ — Merchant · application (same / other mobile) · mobile association
- **SMS OTP** _(screen)_ — 3 attempts · resend · edit mobile
- **Identity result** _(decision)_
- **Existing merchant** _(outcome)_ — No new application
- **Duplicate identity** _(outcome)_ — Other mobile · no new application
- **Create application + link KYB** _(backend)_ — Snapshot, eligibility result, reason, ruleset, timestamp
- **Saved application reopened** _(cached)_ — Same identity + same mobile
- **Save & exit** _(screen)_ — Any stage after OTP
- **Continue Application link** _(backend)_ — Sent to the verified mobile
- **Link opened → OTP** _(screen)_ — Application context, masked mobile + ID
- **Reuse verified checks** _(cached)_ — CR · people · Nafath · certificates · IBAN

### C1 · Business Verification: Registered business

Government data is retrieved once and reused. CR 3 months or younger: temporarily not eligible. Declared category is reconciled with the registered activity.

- **Non-blocking flags** _(backend)_ — Additional documents later · National Address
- **CR data retrieval** _(external)_ — Status · age · entity · activities · National Address
- **Stored CR data** _(cached)_ — Reused on resume / edit
- **Temporarily not eligible** _(outcome)_ — CR ≤ 3 months
- **Government rules** _(decision)_ — Status, then age
- **Manual verification** _(manual)_ — Expired · government violation
- **Not eligible** _(outcome)_ — Suspended · regulated activity
- **Category ↔ CR activity** _(decision)_ — Mapping outcome → action
- **Activity clarification** _(screen)_ — Change category, or continue: team confirms, no contract
- **Associated people** _(external)_ — Individuals only
- **Select authorised person** _(screen)_ — Masked names and IDs
- **No eligible individual** _(manual)_ — Manual authority check → Business & Banking, no contract
- **Nafath verified** _(cached)_ — Not requested again on resume
- **Nafath** _(external)_ — 2 attempts per application, shared
- **Failed twice** _(manual)_ — Unverified; details collected; no contract
- **PRODUCT TASK: Category ↔ CR activity mapping** _(open)_
- **PRODUCT TASK: Decision & Validation Inventory** _(open)_

### C2 · Business Verification: Freelancer

Nafath on the National ID, then the certificates are retrieved (never uploaded). Zero documents.

- **Nafath (National ID)** _(external)_ — 2 attempts
- **Nafath verified** _(cached)_ — Reused on resume
- **Manual verification** _(manual)_ — Nafath failed twice
- **Certificate retrieval** _(external)_ — By verified National ID
- **Stored certificates** _(cached)_ — Not re-fetched on resume
- **Certificate required** _(outcome)_ — No active certificate: lead, no upload
- **Select certificate** _(screen)_ — Expired / already linked cannot be selected
- **Certificate activity ↔ category** _(decision)_ — CR required → stop · conflict → clarify
- **Not eligible** _(outcome)_ — Activity requires a CR

### D · Business & Banking Details

Stage-1 answers are shown, not asked again. Only remaining details. IBAN ownership checked once; reused until the IBAN or its owner changes.

- **Business & Banking Details** _(screen)_ — VAT · branches (offline) · channel / website / Maps read-only with Edit
- **Applicant type** _(decision)_
- **IBAN ownership (business)** _(external)_ — 2 attempts
- **Bank linked to certificate?** _(screen)_ — Yes / No
- **IBAN ownership (individual + certificate)** _(external)_
- **Banking setup required** _(manual)_ — IBAN skipped; team follows up
- **IBAN verified** _(cached)_ — Same IBAN + same owner: reused
- **Unverified after 2 checks** _(manual)_ — Continue; financial review
- **COMPLIANCE DECISION** _(open)_ — Linked IBAN before contract? Rule flag = false

### E · Commercial Offer

All commercial configuration lives here, not in the Contract. Standard commission comes from the pricing matrix; declared revenue never lowers it automatically.

- **Commercial Offer** _(screen)_ — Standard commission · optional evidence · payment plans · summary
- **Pricing matrix** _(backend)_ — Category / subcategory → standard rate and plan rates
- **Payment plans** _(screen)_ — 3 + 4 months included · 6 / 9 / 12 optional multi-select
- **Optional better-rate evidence** _(screen)_ — Never blocks; skip = standard rate
- **Commercial pricing review** _(manual)_ — Internal; onboarding does not wait
- **Offer summary → Continue** _(screen)_
- **PRODUCT TASK: Pricing & Commission Matrix** _(open)_
- **PRODUCT/COMMERCIAL DECISION: evidence documents** _(open)_

### F · Review, Edit and dependency invalidation

Every section has Edit and returns to Review. An edit invalidates only the verification that depends on the changed field.

- **Review** _(screen)_ — KYB · Identification · Verified data · Banking · Offer · Plans · Verification status
- **Website / Maps / channel** _(backend)_ — Re-validate; nothing invalidated
- **Category** _(cached)_ — Eligibility + reconciliation on stored activity; no provider call
- **IBAN** _(external)_ — Only IBAN verification invalidated
- **CR / National ID** _(external)_ — CR data · people · reconciliation · Nafath · IBAN
- **Mobile** _(screen)_ — New OTP only
- **Which field changed?** _(decision)_

### G · Contract and Submit / Outcome

The contract page contains the contract only: agreed commission and plans are shown as contract content, never selected here. Nafath is not the contract provider.

- **Review** _(screen)_
- **Contract gate** _(decision)_ — Nafath · person / certificate
- **Contract** _(screen)_ — Read · accept / decline · back
- **Submitted** _(outcome)_ — Your application has been submitted successfully.
- **Submitted · banking pending** _(outcome)_ — Freelancer bank not linked
- **Contract declined** _(outcome)_ — Not submitted; resumable
- **Manual verification** _(manual)_ — We have received your application.
- **Contract provider** _(open)_ — Generic acceptance until a provider is approved

## Resume / Continue Application

1. After the application exists (identity + mobile + OTP), **Save & exit** sends a secure Continue Application link to the verified mobile.
2. Opening the link identifies the application but does **not** authorise access: the OTP screen opens directly, with the application, masked CR / National ID and masked mobile shown.
3. After the code, the applicant lands on the first incomplete valid screen. Completed stages are not repeated; every stored successful verification is reused (ledger entry "reused — no new provider call").
4. The same applies when the applicant re-enters through Know Your Business with the same identity and mobile (the saved application is reopened; today's draft answers are discarded). OTP: 3 attempts per code.

## Rules and decision tables

### Stages

| # | Stage | Screens |
| --- | --- | --- |
| 1 | Know Your Business | kyb · lead |
| 2 | Identify & Verify | identify · otp |
| 3 | Business Verification | cr-verify · persons · nafath · certificates |
| 4 | Business & Banking Details | business |
| 5 | Commercial Offer | commercial |
| 6 | Review | review |
| 7 | Contract | contract |
| 8 | Submit / Outcome | outcome |

### Stage 1 eligibility rules (ordered, KYB-RULES-v3-demo (2026-10-23))

| Rule | Condition | Result | Reason code | Type |
| --- | --- | --- | --- | --- |
| KYB-R01 | Category blocked / restricted for this applicant type | NOT_ELIGIBLE | CATEGORY_NOT_SUPPORTED | business |
| KYB-R02 | Regulatory prohibition for this applicant type | NOT_ELIGIBLE | REGULATORY_RESTRICTION | regulatory |
| KYB-R03 | Activity requires a CR and the applicant is a Freelancer | NOT_ELIGIBLE | ACTIVITY_REQUIRES_CR | regulatory |
| KYB-R04 | Freelancer category allowed online only, applicant sells offline | NOT_ELIGIBLE | CHANNEL_NOT_SUPPORTED | business |
| KYB-R05 | Category temporarily paused | TEMPORARILY_NOT_ELIGIBLE | CATEGORY_PAUSED | business |
| KYB-R06 | Freelancer without a Freelancer Certificate: keep as lead | SALES_LEAD | FL_CERT_REQUIRED | business |
| KYB-R07 | Registered business below SAR 100,000: lead (Business Team rejects under the proposed policy) | SALES_LEAD | REVENUE_BELOW_BAND | business |
| KYB-R08 | Registered business above SAR 20,000,000: Sales lead | SALES_LEAD | REVENUE_ABOVE_BAND | business |
| KYB-R09 | Category needs manual business review: continue, flagged | MANUAL_REVIEW | CATEGORY_MANUAL_REVIEW | internal |
| KYB-R10 | Everything else: eligible for self-onboarding | ELIGIBLE | OK | internal |

_First matching rule wins. Evaluated internally before any external call. Production Eligibility Matrix: PRODUCT TASK._

### Category rules (synthetic fixture catalogue)

| Madfu subcategory | Registered business | Freelancer |
| --- | --- | --- |
| Retail & e-commerce › Fashion & accessories | Allowed | Allowed |
| Retail & e-commerce › Electronics | Allowed | Freelancer online only |
| Retail & e-commerce › Gold & jewellery (example) | Regulatory prohibition | Requires a CR |
| Food & beverage › Cafés & coffee | Allowed | Requires a CR |
| Food & beverage › Home-made food | Allowed | Freelancer online only |
| Services › Design & creative services | Allowed | Allowed |
| Services › Photography | Allowed | Allowed |
| Services › Business consulting | Allowed | Allowed |
| Fixture examples (demo rules) › Example: restricted category | Blocked / restricted | Blocked / restricted |
| Fixture examples (demo rules) › Example: manual business review | Manual business review | Manual business review |
| Fixture examples (demo rules) › Example: temporarily paused | Temporarily paused | Temporarily paused |

_Example only (e.g. gold & jewellery). Not the production policy catalogue._

### Website and Google Maps validation (configurable)

| Field | Accepted | Rejected |
| --- | --- | --- |
| Website (Online / Both) | https:// link with a real domain | Social media (instagram.com, facebook.com, fb.com, tiktok.com, x.com…) · WhatsApp (wa.me, whatsapp.com…) · invalid format |
| Google Maps URL (Offline / Both) | maps.google.com, maps.app.goo.gl, goo.gl, g.page · google.com/maps | Any other host, social links, invalid format |

_A format check does not prove the applicant owns the website or location._

### Government CR validation (GOV-CR-v3-demo (2026-10-23))

| Check | Condition | Action |
| --- | --- | --- |
| CR status | ACTIVE | continue |
| CR status | EXPIRED | manual_review (CR_EXPIRED) |
| CR status | SUSPENDED | not_eligible (CR_SUSPENDED) |
| CR status | VIOLATION | manual_review (CR_GOVERNMENT_VIOLATION) |
| CR age | 3 months or less | temporarily_not_eligible (CR_TOO_RECENT) |
| National Address | Missing / expired | continue + flag |
| Legal entity | NON_SAUDI | continue + "additional documents required" (collected later) |

_Only these rules are known. The full Decision & Validation Inventory is a PRODUCT TASK._

### Category ↔ government activity mapping (ACT-MAP-v3-demo (2026-10-23))

| Declared subcategory | Government activity | Outcome | Action |
| --- | --- | --- | --- |
| Retail & e-commerce › Fashion & accessories | Retail sale of clothing (demo) | MATCH | continue |
| Retail & e-commerce › Fashion & accessories | General retail trade (demo) | AMBIGUOUS | manual_review |
| Retail & e-commerce › Fashion & accessories | Retail sale of gold and jewellery (demo) | CONFLICT | clarify |
| Retail & e-commerce › Electronics | Retail sale of electronic equipment (demo) | MATCH | continue |
| Retail & e-commerce › Electronics | General retail trade (demo) | COMPATIBLE | continue |
| Retail & e-commerce › Gold & jewellery (example) | Retail sale of gold and jewellery (demo) | MATCH | continue |
| Food & beverage › Cafés & coffee | Coffee shops (demo) | MATCH | continue |
| Food & beverage › Cafés & coffee | Management consultancy (demo) | CONFLICT | clarify |
| Food & beverage › Home-made food | Home food production (demo) | MATCH | continue |
| Food & beverage › Home-made food | Coffee shops (demo) | COMPATIBLE | continue |
| Services › Design & creative services | Specialised design activities (demo) | MATCH | continue |
| Services › Design & creative services | Photographic activities (demo) | COMPATIBLE | continue |
| Services › Photography | Photographic activities (demo) | MATCH | continue |
| Services › Photography | Specialised design activities (demo) | COMPATIBLE | continue |
| Services › Business consulting | Management consultancy (demo) | MATCH | continue |
| Fixture examples (demo rules) › Example: manual business review | Management consultancy (demo) | MATCH | continue |
| Any pair not listed | — | UNMAPPED | manual_review |
| Registered activity not eligible for the applicant | e.g. gold & jewellery | any | stop |

_Synthetic fixture. Production mapping: PRODUCT TASK for the Product/Business team._

### Verification reuse (cost rule)

| Verification | Depends on | Freshness policy | On ordinary resume |
| --- | --- | --- | --- |
| CR data (registry, activities, National Address) | CR identity | Reusable until invalidated | Reused — no new provider call |
| Associated people | CR identity | Reusable until invalidated | Reused — no new provider call |
| Nafath | Application + selected verified person / National ID | Reusable until invalidated | Reused — no new provider call |
| Freelancer Certificate retrieval | Verified National ID | Reusable until invalidated | Reused — no new provider call |
| IBAN ownership | IBAN + ownership target (business CR, or National ID + certificate) | Reusable until invalidated | Reused — no new provider call |

_Previously successful external checks are reused until their dependent data changes or an explicit freshness policy invalidates them. Resume normally costs one SMS OTP._

### Edit → what is invalidated

| Change | External verifications invalidated | Internal re-evaluation |
| --- | --- | --- |
| Website or Google Maps URL | None | Re-validate the URL format only |
| Sales channel | None | Re-run eligibility (channel rules) |
| Category / subcategory | None | Re-run eligibility and category ↔ activity reconciliation on the stored activity; re-derive pricing. No external call: the stored CR / certificate activity is reused |
| Annual revenue | None | Re-run eligibility (revenue routing) |
| IBAN | IBAN ownership | IBAN verification only |
| Bank linked to certificate (Freelancer) | IBAN ownership | IBAN verification only |
| Selected authorised person (before Nafath success) | None | New Nafath context for the new person; attempt counter not reset |
| Selected authorised person (after Nafath success) | Nafath | Nafath must be repeated for the new person |
| Selected freelance certificate | IBAN ownership | Re-run reconciliation on the certificate activity. IBAN ownership target includes the certificate |
| CR number | CR data (registry, activities, National Address), Associated people, Nafath, IBAN ownership | Duplicate check, CR retrieval, people, activity reconciliation, authority (Nafath), IBAN ownership target |
| National ID (Freelancer) | Nafath, Freelancer Certificate retrieval, IBAN ownership | Duplicate check, Nafath, certificate retrieval, IBAN ownership target |
| Mobile number | None | New SMS OTP for the new mobile |

### Pricing & Commission Matrix (PRICING-v3-demo (2026-10-23), synthetic)

| Category / subcategory | Standard (3 + 4 months, included) | 6 months (optional) | 9 months (optional) | 12 months (optional) |
| --- | --- | --- | --- | --- |
| retail | 7.0% | 8.5% | 10.0% | 11.5% |
| retail-electronics | 6.5% | 8.0% | 9.5% | 11.0% |
| food | 6.0% | 7.5% | 9.0% | 10.5% |
| services | 7.5% | 9.0% | 10.5% | 12.0% |
| fixture | 7.0% | 8.5% | 10.0% | 11.5% |

_Standard commission never drops because of self-declared revenue. Optional evidence triggers an internal Commercial review; onboarding continues with the standard rate._

### Contract gate (computed from the prototype rule)

| Applicant | Situation | Contract |
| --- | --- | --- |
| Registered business with a Commercial Registration (CR) | Nafath verified, IBAN verified | Contract available |
| Registered business with a Commercial Registration (CR) | Nafath verified, IBAN unverified after 2 checks | Contract available |
| Registered business with a Commercial Registration (CR) | Activity conflict, team to confirm | No contract: manual verification |
| Registered business with a Commercial Registration (CR) | Nafath failed twice | No contract: manual verification |
| Freelancer with a Freelancer Certificate | Nafath verified, certificate selected, bank linked | Contract available |
| Freelancer with a Freelancer Certificate | Nafath verified, bank NOT linked to certificate | Contract available |

_Freelancer bank-link gate is a rule flag (currently OFF), pending a Compliance decision._

### Outcomes: applicant sees vs internal status

| Applicant sees | Internal status |
| --- | --- |
| Your application has been submitted successfully. | Submitted · under review |
| Your application has been submitted. | Submitted · banking setup required |
| We have received your application. | Manual verification |
| Thank you for your interest in Madfu. Our team will contact you. | Sales lead · CR above SAR 20M |
| Thank you for your interest in Madfu. Our team will contact you. | Lead · CR below SAR 100K (Business Team rejects under the proposed policy) |
| A Freelancer Certificate is required to continue. | Lead · Freelancer certificate required |
| A Freelancer Certificate is required to continue. | Lead · no active Freelancer certificate found |
| We can’t onboard this business online at the moment. | Not eligible |
| We can’t onboard this business yet. | Temporarily not eligible |
| This business already has a Madfu account. | Existing merchant · no new application |
| An application already exists for these details. | Duplicate identity · no new application |
| You declined the contract. | Contract declined · not submitted |

### Internal reason codes (never shown as such)

| Code | Meaning |
| --- | --- |
| OK | No restriction |
| CATEGORY_NOT_SUPPORTED | Category blocked / restricted |
| REGULATORY_RESTRICTION | Regulatory prohibition |
| ACTIVITY_REQUIRES_CR | Activity requires a CR |
| CHANNEL_NOT_SUPPORTED | Channel not allowed for this applicant type |
| CATEGORY_PAUSED | Category temporarily paused |
| CATEGORY_MANUAL_REVIEW | Category needs manual business review |
| FL_CERT_REQUIRED | Freelancer certificate required |
| REVENUE_BELOW_BAND | CR revenue below the self-service band |
| REVENUE_ABOVE_BAND | CR revenue above the self-service band |
| CR_TOO_RECENT | CR age 3 months or less |
| CR_EXPIRED | CR expired |
| CR_SUSPENDED | CR suspended |
| CR_GOVERNMENT_VIOLATION | Government violation / restriction |
| ACTIVITY_REGULATED | Registered activity is not eligible (regulated) |

## Open decisions and product tasks

These are **not confirmed rules**. The prototype implements each configurably with synthetic values.

- **PRODUCT TASK — Define the full Eligibility Matrix.** Category · subcategory · applicant type · sales channel · revenue band · result · CR / certificate required · manual review · regulatory restriction · reason code · rule version.
- **PRODUCT TASK — Define the Pricing & Commission Matrix.** Category · subcategory · merchant / revenue tier · tenure · standard commission · improved / negotiated logic · proof requirement · effective date / version.
- **PRODUCT TASK — Define Category/Subcategory ↔ CR Activity mapping.** MATCH / COMPATIBLE / AMBIGUOUS / CONFLICT / UNMAPPED per pair, and the action for each (continue, manual review, stop, clarification).
- **PRODUCT TASK — Complete the Onboarding Decision & Validation Inventory.** Every rule from merchant input, government CR data, National Address, freelancer data, regulation, Madfu policy, categories, CR activities / age / status, legal entity, nationality, violations, banking, sales channel. Per rule: source, field, condition, type, regulatory / business / internal, stage, blocking, user message, internal status, manual follow-up, external-call cost, version.
- **COMPLIANCE DECISION — Freelancer linked IBAN before contract?.** Can a Freelancer sign the Madfu contract before the required IBAN is linked to the Freelancer Certificate? Prototype rule flag: false (least disruptive: contract allowed, banking follow-up).
- **PRODUCT/COMMERCIAL DECISION — Optional better-pricing documents.** Which documents qualify a merchant for improved pricing. Prototype: "Revenue supporting document A / B" placeholders. Contract amendment / repricing after review also open.
- **PRODUCT/ENGINEERING DECISION — Freshness / expiry policy for stored verifications.** CR data, people, Nafath, certificates, IBAN. Prototype: "Reusable until invalidated" (no expiry) for all.

Other open points:

- Exact treatment of SAR 100,000 and SAR 20,000,000 (policy boundary to confirm; prototype: inside the self-service band).
- Government status → action mapping (prototype: expired and violation → manual verification, suspended → not eligible).
- Providers behind CR data, associated people, certificates, IBAN ownership and the contract (prototype: neutral simulated adapters).
- Whether a Nafath technical failure uses one of the 2 attempts (rule flag: false).
- Which additional documents non-Saudi entities need, and when operations collect them.

## Backlog templates (columns to fill)

### Onboarding Decision & Validation Inventory — PRODUCT TASK

| Source | Field | Condition | Rule type | Regulatory / business / internal | Evaluation stage | Blocking / non-blocking | User-visible action / message | Internal status | Manual follow-up | External-call / cost impact | Rule version |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| … | … | … | … | … | … | … | … | … | … | … | … |

### Eligibility Matrix — PRODUCT TASK

| Category | Subcategory | Applicant type | Sales channel | Revenue band (if relevant) | Eligibility result | Required CR / certificate | Manual review flag | Regulatory restriction | Internal reason code | Rule version |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| … | … | … | … | … | … | … | … | … | … | … |

### Pricing & Commission Matrix — PRODUCT TASK

| Category | Subcategory | Merchant / revenue tier | Payment tenure | Standard / default commission | Improved / negotiated commission logic | Proof requirement | Effective date / version |
| --- | --- | --- | --- | --- | --- | --- | --- |
| … | … | … | … | … | … | … | … |

## Prototype scenarios

### Know Your Business

- **1. Eligible CR — Online** — Next: eligible. Identity is asked only now. Walk on with code 246810.
- **2. Eligible CR — Offline** — Offline needs a Google Maps link instead of a website.
- **3. Eligible CR — Both** — Both channels: website and Google Maps link are required.
- **4. Blocked category** — Not eligible, stopped before any external call. Reason code stays internal.
- **5. Category requires CR, applicant is Freelancer** — Freelancer + an activity that needs a CR: cannot continue as Freelancer.
- **6. Freelancer category not allowed Offline** — Electronics is online-only for Freelancers in the fixture.
- **7. Freelancer without certificate → Lead** — Not discarded: contact details + OTP, saved as a lead. No verification screens.
- **8. Invalid website** — Press Next: the website is rejected (no https:// and no real domain).
- **9. Social-media URL rejected as website** — Press Next: an Instagram page is not the merchant’s own website.
- **10. Invalid / non-Google Maps offline URL** — Press Next: only Google Maps location links are accepted.
- **+. CR below SAR 100K → lead** — Lead capture; the Business Team rejects under the proposed policy.
- **+. Category temporarily paused** — Temporarily not eligible at Stage 1.

### Identify & resume

- **11. New CR application** — CR + mobile, then OTP. The Stage-1 record is linked to the new application.
- **12. New Freelancer application** — National ID + mobile, then OTP.
- **13. Duplicate CR** — An application exists for this CR under another mobile: no new application.
- **14. Duplicate National ID** — Same for a Freelancer National ID.
- **15. Existing incomplete application** — Same CR + same mobile: after OTP the saved application opens at its first incomplete screen.
- **16. Continue link → OTP → resume Stage 3+** — Opened from the SMS link: only the code is asked, then Stage 3 opens.
- **17. Resume after CR verified** — After the code: the CR data is reused (no registry call). See Internal state.
- **18. Resume after Nafath verified** — After the code: Nafath is not requested again.
- **19. Resume after IBAN verified** — After the code: the IBAN check is reused; the Commercial Offer opens.
- **+. OTP errors** — Wrong codes (3 attempts), expiry from the controls, resend.

### Government & activity

- **20. CR 3 months old or less** — Temporarily not eligible: the applicant can apply later.
- **21. CR expired** — No automatic onboarding: manual verification.
- **22. CR suspended** — Not eligible; reason stays internal.
- **23. CR government violation** — No automatic onboarding: manual verification.
- **24. CR needs extra documents later** — Non-Saudi entity: the clean journey continues; "additional documents" is an internal flag.
- **25. National Address missing / expired** — Continues; flagged for operations.
- **26. Declared category matches CR activity** — MATCH: continue.
- **27. Compatible category / activity** — COMPATIBLE: continue.
- **28. Category / activity ambiguous** — AMBIGUOUS: continue, flagged for manual review.
- **29. Category / activity conflict** — CONFLICT: change the category, or continue and let the team confirm (no automatic contract).
- **+. Fashion declared, gold & jewellery registered** — The CR activity is regulated: stops; the declared category cannot hide it.
- **+. CR provider unavailable** — Bounded retries; progress kept; come back with the Continue link.

### Nafath

- **30. Nafath success** — Send the request; it is approved.
- **31. Nafath first failure** — Rejected once: retry or choose another person (counter shared).
- **32. Nafath max failures → manual** — Two failures: unverified, business details still collected, no contract.
- **33. Resume after successful Nafath → reuse** — Freelancer saved after Nafath: after the code, certificates load; Nafath is reused.
- **+. No eligible individual on the CR** — Only a company: manual authority check, no Nafath, no contract.
- **+. Nafath technical failure** — Does not use an attempt (provisional rule flag).

### Freelancer

- **34. Freelancer certificate retrieved** — One certificate found and preselected.
- **35. Multiple certificates** — Choose one. A certificate with another activity is reconciled against your category.
- **36. No certificate found** — No document upload fallback: "certificate required" lead.
- **37. Bank linked to certificate = Yes** — Answer Yes, enter the IBAN, verify against the individual + certificate.
- **38. Bank linked = No → banking setup required** — Answer No: IBAN skipped, the journey continues; internal "banking setup required".
- **+. Walk the Freelancer journey** — From Know Your Business to Submit, as a Freelancer with a certificate.
- **+. Certificate activity requires a CR** — The only certificate is for an activity a Freelancer cannot onboard: stops.

### Banking

- **39. CR IBAN verified** — Verify: ownership matches the business.
- **40. IBAN failure** — Mismatch twice: continue unverified (financial review).
- **41. IBAN changed → only IBAN re-verified** — Review › Edit banking › change the IBAN: only the IBAN check is invalidated.
- **42. Resume with the same verified IBAN → reuse** — Saved at Review: after the code nothing is re-checked.

### Commercial Offer

- **43. Standard commission accepted** — Continue with the standard commission.
- **44. Optional pricing evidence skipped** — Nothing uploaded: onboarding is not blocked.
- **45. Optional pricing evidence uploaded** — Continue with the standard commission; internal Commercial pricing review.
- **46. Base 3 / 4-month plans only** — 3 and 4 months are included and cannot be removed.
- **47. Add 6-month** — 6 months selected.
- **48. Add 6 + 9** — 6 and 9 months selected.
- **49. Add 6 + 9 + 12** — All optional plans selected.
- **50. Remove an optional tenure** — Untick one before Continue: the summary updates.

### Review & edit

- **51. Edit website** — Edit Know Your Business, change the website: no CR / Nafath / IBAN re-check.
- **52. Edit IBAN** — Only the IBAN verification is invalidated.
- **53. Edit category** — Eligibility and reconciliation re-run on the stored CR activity; no provider call.
- **54. Edit identity / CR** — A new CR invalidates CR data, people, Nafath and IBAN; the journey resumes at Business Verification.
- **+. Edit mobile** — Review › Edit identification › new mobile: a new code is required, nothing else.

### Contract & submit

- **55. Contract accepted** — Contract only: read, accept, submit. Plans are shown, not selectable.
- **56. Contract declined** — Decline: not submitted; return to the contract later.
- **57. Full self-service submitted** — Walk the whole CR journey from Know Your Business to Submit (code 246810).
- **58. Manual verification outcome** — Nafath failed twice: Review submits for manual verification, no contract.
- **59. Banking pending outcome** — Freelancer without a linked bank account: contract allowed (provisional rule flag), submitted with banking follow-up.
- **60. Sales lead outcome** — CR above SAR 20M: contact details + OTP, then the Sales thank-you.

## Assumptions in the prototype

- Know Your Business is the first page: no CR, National ID, mobile or OTP before eligibility.
- Application and merchant account are separate: no login or password during onboarding.
- A Continue link identifies an application; OTP is always required to reopen it.
- Stage-1 answers are never asked again; they are shown with Edit.
- Nafath verifies identity and authority; it is not the contract signature.
- IBAN is the only bank input; bank name is derived. No standard-path document uploads; Freelancers upload nothing.
- Payment plans and commission live in the Commercial Offer; the Contract shows them as contract content only.
- Source of Revenue / Source of Income are not asked.

## Superseded in Madfu Proposed (still valid in Madfu Current where observed)

- CR / National ID as the first page; OTP before KYB eligibility.
- Category screening after identity (now part of Know Your Business).
- Plan selection in the Contract (now in the Commercial Offer).
- Automatic better commission from declared revenue alone.
- Repeated CR fetch, Nafath, IBAN verification or certificate retrieval on resume.
- Re-entry of Stage-1 answers (shown with Edit instead).
- Source of Revenue / Source of Income; standard-path document uploads; manual certificate-number fallback.
