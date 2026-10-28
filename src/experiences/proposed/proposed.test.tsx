import { describe, expect, it } from 'vitest';
import { act, screen, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { renderAt } from '@/test/render';
import { STAGES } from './model/config';
import { OUTCOME_COPY, SIGNER_DONE_COPY } from './model/copy';
import { DEMO, DEMO_SMS_CODE, demoIban } from './model/mock';
import { scenarioById } from './model/scenarios';
import { STORE_KEY } from './store';

const KYB_TITLE = 'Tell us about your business';

async function open(path = '/madfu/proposed') {
  const r = renderAt(path);
  await screen.findByRole('heading', { name: KYB_TITLE });
  return r;
}

/** Open the prototype at a catalogue scenario (seeded the way the app persists its state). */
function start(id: string) {
  window.localStorage.setItem(`mol:${STORE_KEY}`, JSON.stringify(scenarioById(id)!.build()));
  return renderAt('/madfu/proposed');
}
const controls = () => screen.getByRole('complementary', { name: 'Prototype Controls' });
const controlsTab = async (user: UserEvent, name: 'This step' | 'Start demo' | 'Internal view') => user.click(within(controls()).getByRole('tab', { name }));

async function kyb(user: UserEvent, opts: { kind: 'CR' | 'FL_CERT' | 'FL_NO_CERT'; group: string; sub: string; revenue?: RegExp; channel?: RegExp }) {
  await screen.findByRole('heading', { name: KYB_TITLE });
  await user.selectOptions(screen.getByLabelText('Who is applying?'), opts.kind);
  await user.selectOptions(screen.getByLabelText('Business category'), opts.group);
  await user.selectOptions(screen.getByLabelText('Business subcategory'), opts.sub);
  await user.click(screen.getByRole('radio', { name: opts.revenue ?? /SAR 100,000–20,000,000/ }));
  await user.click(screen.getByRole('radio', { name: opts.channel ?? /^Online/ }));
  await user.click(screen.getByRole('button', { name: 'Check eligibility' }));
}

async function code(user: UserEvent, value = DEMO_SMS_CODE) {
  await screen.findByLabelText('Verification code');
  await user.type(screen.getByLabelText('Verification code'), value);
}

describe('Page 1 — five questions only', () => {
  it('asks no identity, mobile, code or URL — for any channel', async () => {
    const { user } = await open();
    expect(screen.queryByLabelText(/Commercial Registration|National ID|Mobile number|Verification code/)).toBeNull();
    expect(screen.getByText(`Stage 1 of ${STAGES.length} · Know Your Business`)).toBeInTheDocument();
    for (const ch of [/^Online/, /^Offline/, /^Both/]) {
      await user.click(screen.getByRole('radio', { name: ch }));
      expect(screen.queryByLabelText('Online store or business website')).toBeNull();
      expect(screen.queryByLabelText('Google Maps link of your store or branch')).toBeNull();
    }
  });

  it('category, subcategory, revenue and channel are required', async () => {
    const { user } = await open();
    await user.click(screen.getByRole('button', { name: 'Check eligibility' }));
    for (const t of ['Choose who is applying.', 'Choose a business category.', 'Choose a subcategory.', 'Select your annual revenue.', 'Choose how you sell.']) expect(screen.getByText(t)).toBeInTheDocument();
  });

  it.each([
    ['Freelancer without a certificate', { kind: 'FL_NO_CERT', group: 'services', sub: 'services-design' }],
    ['Freelancer in a CR-only category', { kind: 'FL_CERT', group: 'food', sub: 'food-cafe' }]
  ] as const)('%s (internally Not Eligible): Identify + code, then the normal "submitted" page — no reason, no rejection', async (_, opts) => {
    const { user } = await open();
    await kyb(user, opts);
    await screen.findByRole('heading', { name: 'Continue your application' });
    expect(screen.queryByText('Eligible for online onboarding')).toBeNull();
    expect(screen.queryByRole('radio', { name: 'Yes' })).toBeNull();
    await user.type(screen.getByLabelText('National ID Number'), DEMO.nationalId);
    await user.type(screen.getByLabelText('Mobile number'), DEMO.mobile);
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    await code(user);
    expect(await screen.findByRole('heading', { name: OUTCOME_COPY.SUBMITTED.title })).toBeInTheDocument();
    expect(screen.getByText(/Application reference/)).toBeInTheDocument();
    expect(screen.getByRole('main')).not.toHaveTextContent(/not eligible|ineligible|reject|blacklist|blocked|requires a registered business|Freelancer Certificate/i);
  });
});

describe('Registered business end to end', () => {
  it('Page 1 → CR + mobile → code → CR verification → store links → standard offer → review → authorization (myself) → Nafath → Agree & Submit', async () => {
    const { user, unmount } = await open();
    await kyb(user, { kind: 'CR', group: 'food', sub: 'food-cafe', channel: /^Both/ });

    await screen.findByRole('heading', { name: 'Good news: you can apply online' });
    expect(screen.queryByRole('radio', { name: 'Yes' })).toBeNull(); // no owner / manager question
    await user.type(screen.getByLabelText('Commercial Registration (Unified Number)'), DEMO.cr);
    await user.type(screen.getByLabelText('Mobile number'), DEMO.mobile);
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    await code(user);

    // CR verification: retrieved data only — nobody is chosen here.
    await screen.findByRole('heading', { name: 'Your business registration' });
    expect(await screen.findByText('Registration retrieved', undefined, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /Mohammed/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    // Business Details: store links by channel; no IBAN, VAT or branches for a registered business.
    await screen.findByRole('heading', { name: 'Business details' });
    expect(screen.queryByLabelText('IBAN')).toBeNull();
    expect(within(screen.getByRole('main')).queryByText(/VAT|branches/i)).toBeNull();
    await user.type(screen.getByLabelText('Online store or business website'), 'najd.example.com');
    await user.type(screen.getByLabelText('Google Maps link of your store or branch'), 'https://maps.app.goo.gl/abc');
    await user.click(screen.getByRole('button', { name: 'Next' }));

    // Commercial Offer: standard offer, no plan selection, rate review collapsed.
    await screen.findByRole('heading', { name: 'Your Standard Offer' });
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.queryByText(/months/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Add file/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await screen.findByRole('heading', { name: 'Review your application' });
    expect(screen.getByText('Everything is ready')).toBeInTheDocument();
    expect(screen.getAllByText('Locked').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByRole('button', { name: 'Edit Business' })).toBeNull();

    // Refresh persistence.
    unmount();
    renderAt('/madfu/proposed');
    expect(await screen.findByRole('heading', { name: 'Review your application' })).toBeInTheDocument();
    const user2 = (await import('@testing-library/user-event')).default.setup({ delay: null });
    await user2.click(screen.getByRole('button', { name: 'Continue to authorization' }));

    // Authorization choice: myself → select yourself → Nafath.
    await screen.findByRole('heading', { name: 'Who will authorize and sign this application?' });
    await user2.click(screen.getByRole('radio', { name: /I can complete the authorization myself/ }));
    await user2.click(await screen.findByRole('radio', { name: /Mohammed/ }));
    expect(screen.queryByRole('radio', { name: /Faisal/ })).toBeNull(); // delegate not offered
    await user2.click(screen.getByRole('button', { name: 'Continue to Nafath' }));
    await user2.click(await screen.findByRole('button', { name: 'Send to Nafath' }));
    await screen.findByText('Identity verified', undefined, { timeout: 8000 });
    await user2.click(screen.getByRole('button', { name: 'Continue' }));

    await screen.findByRole('heading', { name: 'Merchant agreement' });
    const main = screen.getByRole('main');
    expect(within(main).queryAllByRole('checkbox')).toHaveLength(0);
    expect(within(main).getByRole('table', { name: 'Schedule 1' })).toHaveTextContent('Standard commission');
    await user2.click(screen.getByRole('button', { name: 'Agree & Submit' }));
    expect(await screen.findByRole('heading', { name: OUTCOME_COPY.SUBMITTED.title })).toBeInTheDocument();
    expect(within(screen.getByRole('main')).queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryByText(/activated/i)).toBeNull();
  });
});

describe('Freelancer end to end', () => {
  it('Business Details + IBAN; offer; review; then certificate; Nafath; contract', async () => {
    const { user } = await open();
    await kyb(user, { kind: 'FL_CERT', group: 'services', sub: 'services-design' });
    await user.type(await screen.findByLabelText('National ID Number'), DEMO.nationalId);
    await user.type(screen.getByLabelText('Mobile number'), DEMO.mobile);
    await user.click(screen.getByRole('radio', { name: 'Yes' }));
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    await code(user);
    await screen.findByRole('heading', { name: 'Business details' });
    await user.type(screen.getByLabelText('Online store or business website'), 'studio.example.com');
    await user.type(screen.getByLabelText('IBAN'), demoIban('80', '4821'));
    await user.click(screen.getByRole('button', { name: 'Verify' }));
    await screen.findByText('Account verified', undefined, { timeout: 5000 });
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(await screen.findByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { name: 'Review your application' })).toBeInTheDocument();
    expect(screen.getByText('Chosen after this review')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue to certificate' }));
    await screen.findByRole('heading', { name: 'Choose your Freelancer Certificate' });
    expect(await screen.findByText('FL-400000001', undefined, { timeout: 5000 })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue to Nafath' }));
    await user.click(await screen.findByRole('button', { name: 'Send to Nafath' }));
    await screen.findByText('Identity verified', undefined, { timeout: 8000 });
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('button', { name: 'Agree & Submit' })).toBeInTheDocument();
  }, 20000);
});

describe('Existing records and routing after OTP', () => {
  it('application in progress: a different entered mobile is not used — the code goes to the stored mobile (last 3 digits); then resume', async () => {
    const { user } = start('id-incomplete');
    await user.click(await screen.findByRole('button', { name: 'Send code' }));
    expect(await screen.findByRole('heading', { name: 'An application is already in progress for this business.' })).toBeInTheDocument();
    expect(screen.getByText(/registered mobile ending in/)).toHaveTextContent('•••••••123');
    expect(screen.getByText(/can only be continued with the mobile number already registered on it/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Edit mobile number/ })).toBeNull();
    expect(screen.queryByText(/APP-/)).toBeNull();
    await code(user);
    expect(await screen.findByRole('heading', { name: 'Business details' })).toBeInTheDocument();
  });

  it('submitted application: Application Progress, never Review or Contract', async () => {
    const { user } = start('id-submitted');
    await user.click(await screen.findByRole('button', { name: 'Send code' }));
    await code(user);
    expect(await within(screen.getByRole('main')).findByText('Application Progress')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Submitted' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Review your application' })).toBeNull();
    expect(screen.queryByRole('button', { name: /contract/i })).toBeNull();
  });

  it('live merchant: a popup with a Log in button; nothing navigates until it is clicked; no application', async () => {
    const { user } = start('id-live');
    await user.click(await screen.findByRole('button', { name: 'Send code' }));
    expect(await screen.findByRole('heading', { name: 'This business already has a Madfu account.' })).toBeInTheDocument();
    expect(screen.getByText(/registered mobile ending in/)).toHaveTextContent('•••••••123');
    await code(user);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'You already have an active account under this CR.' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Merchant login' })).toBeNull();
    expect(screen.getByText(/No new application was created/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('heading', { name: 'Merchant login' })).toBeInTheDocument();
  });

  it('a record captured as internally Not Eligible re-opens as "Under review" — no reason', async () => {
    const { user } = start('id-not-eligible');
    await user.click(await screen.findByRole('button', { name: 'Send code' }));
    expect(await screen.findByRole('heading', { name: 'An application has already been submitted for this business.' })).toBeInTheDocument();
    await code(user);
    expect(await screen.findByRole('heading', { name: 'Under review' })).toBeInTheDocument();
    expect(screen.getByRole('main')).not.toHaveTextContent(/not eligible|reject|blocked/i);
  });

  it.each([[/Above SAR 20,000,000/], [/Below SAR 100,000/]])('revenue %s: normal self-onboarding (no Sales route)', async (revenue) => {
    const { user } = await open();
    await kyb(user, { kind: 'CR', group: 'retail', sub: 'retail-fashion', revenue });
    await screen.findByRole('heading', { name: 'Good news: you can apply online' });
    await user.type(screen.getByLabelText('Commercial Registration (Unified Number)'), DEMO.cr);
    await user.type(screen.getByLabelText('Mobile number'), DEMO.mobile);
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    await code(user);
    expect(await screen.findByRole('heading', { name: 'Your business registration' })).toBeInTheDocument();
    expect(screen.queryByText(/Sales team/)).toBeNull();
  });

  it('unsupported category (CR): neutral Page 2, code, then the normal "submitted" page — no reason', async () => {
    const { user } = await open();
    await kyb(user, { kind: 'CR', group: 'fixture', sub: 'fixture-blocked' });
    await screen.findByRole('heading', { name: 'Continue your application' });
    expect(screen.queryByText('Eligible for online onboarding')).toBeNull();
    await user.type(screen.getByLabelText('Commercial Registration (Unified Number)'), DEMO.cr);
    await user.type(screen.getByLabelText('Mobile number'), DEMO.mobile);
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    await code(user);
    expect(await screen.findByRole('heading', { name: OUTCOME_COPY.SUBMITTED.title })).toBeInTheDocument();
    expect(screen.getByRole('main')).not.toHaveTextContent(/not eligible|reject|blacklist|blocked|activity/i);
  });
});

describe('Mobile ↔ National ID before Nafath', () => {
  it('mismatch → another mobile → OTP → match → Nafath, without restarting', async () => {
    const { user } = start('mm-mismatch');
    await user.click(await screen.findByRole('button', { name: 'Send to Nafath' }));
    expect(await screen.findByText('The mobile number must belong to the selected owner or manager.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Use another mobile number' }));
    await user.type(screen.getByLabelText('Mobile number registered to the National ID'), DEMO.otherMobile);
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    expect(await screen.findByRole('heading', { name: 'Verify your new mobile number' })).toBeInTheDocument();
    await code(user);
    expect(await screen.findByText('Select this number in Nafath')).toBeInTheDocument();
  });
});

describe('Government outcomes and Commercial Offer', () => {
  it('expired CR: saved, Sales will help; no Refresh button', async () => {
    start('cr-expired');
    expect(await screen.findByRole('heading', { name: 'Your Commercial Registration is currently expired.' })).toBeInTheDocument();
    expect(screen.getByText(/transfer your application to our Sales team/)).toBeInTheDocument();
    expect(within(screen.getByRole('main')).queryByRole('button', { name: /refresh|try again/i })).toBeNull();
  });

  it('better rate: a small collapsed link; uploads only after "Request rate review"; continue never blocked', async () => {
    const { user } = start('com-standard');
    await screen.findByRole('heading', { name: 'Your Standard Offer' });
    expect(screen.queryByRole('button', { name: /Add file/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Want us to review a better commercial rate?' }));
    expect(screen.queryByRole('button', { name: /Add file/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Request rate review' }));
    expect(screen.getAllByRole('button', { name: /Add file/ })).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByRole('heading', { name: 'Review your application' });
    expect(screen.getByText('Requested (standard offer applies meanwhile)')).toBeInTheDocument();
  });
});

describe('Review: locked sections, transactional edit', () => {
  it('Cancel restores the store link; verified sections offer no Edit', async () => {
    const { user } = start('review');
    await screen.findByRole('heading', { name: 'Review your application' });
    expect(screen.queryByRole('button', { name: 'Edit Verified business' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Edit Store presence' }));
    const field = await screen.findByLabelText('Online store or business website');
    await user.clear(field);
    await user.type(field, 'changed.example.com');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await screen.findByRole('heading', { name: 'Review your application' });
    expect(screen.getByText('https://najdroastery.example.com')).toBeInTheDocument();
    expect(screen.queryByText('changed.example.com')).toBeNull();
  });
});

describe('Contract: Back to Review and Agree & Submit only', () => {
  it('has no Decline action', async () => {
    start('contract');
    await screen.findByRole('heading', { name: 'Merchant agreement' });
    const main = within(screen.getByRole('main'));
    expect(main.queryByRole('button', { name: /Decline/ })).toBeNull();
    expect(main.getAllByRole('button').map((b) => b.textContent)).toEqual(['Back to review', 'Agree & Submit']);
  });
});

describe('Reviewer-only Back in Prototype Controls', () => {
  it('moves to the previous step and shows the saved, verified values', async () => {
    const { user } = start('contract');
    await screen.findByRole('heading', { name: 'Merchant agreement' });
    const back = within(controls()).getByRole('button', { name: '← Back to previous step' });
    await user.click(back);
    expect(await screen.findByText('Verified with Nafath')).toBeInTheDocument();
    await user.click(back);
    expect(await screen.findByRole('heading', { name: 'Who will authorize and sign this application?' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Mohammed/ })).toBeChecked();
    await user.click(back);
    expect(await screen.findByRole('heading', { name: 'Review your application' })).toBeInTheDocument();
    await user.click(back);
    await user.click(back);
    expect(await screen.findByRole('heading', { name: 'Business details' })).toBeInTheDocument();
    expect(screen.getByLabelText('Online store or business website')).toHaveValue('https://najdroastery.example.com');
    await user.click(back);
    expect(await screen.findByRole('heading', { name: 'Your business registration' })).toBeInTheDocument();
    expect(within(controls()).getByRole('button', { name: '← Back to previous step' })).toBeDisabled();
  });
});

describe('Prototype Controls', () => {
  it('OTP page shows only OTP cases; Internal view shows lifecycle and mobiles', async () => {
    const { user } = start('otp-errors');
    await screen.findByLabelText('Verification code');
    const panel = within(controls()).getByRole('tabpanel', { name: 'Page Scenarios' });
    expect(within(panel).getAllByRole('button').map((b) => b.textContent)).toEqual(['Verified', 'Incorrect code', 'Invalid code (wrong format)', 'Expired / timed out', 'Resend code (3 left)', 'Edit mobile number']);
    await controlsTab(user, 'Internal view');
    expect(within(controls()).getByText('Lifecycle status')).toBeInTheDocument();
    expect(within(controls()).getByText('contact_mobile_verified')).toBeInTheDocument();
    expect(within(controls()).getByText('authorized_person_mobile_verified')).toBeInTheDocument();
  });

  it('Start demo holds the journey presets', async () => {
    const { user } = await open();
    await controlsTab(user, 'Start demo');
    for (const w of ['1. New Eligible CR Merchant', '3. Not Eligible Application', '5. Existing In-Progress Freelancer — Resume', '8. CR Merchant Signer Flow']) expect(within(controls()).getByRole('heading', { name: w })).toBeInTheDocument();
    for (const p of ['Existing incomplete application', 'Existing incomplete Freelancer application', 'Submitted application', 'Live merchant', 'Mobile mismatch before Nafath', 'Expired CR', 'CR signer handoff', 'Signer secure-link entry', 'Handoff expired', 'Authorization V1 / V2', 'Handoff limit reached', 'Delegated signer (Phase 2 demo)']) expect(within(controls()).getByRole('button', { name: p })).toBeInTheDocument();
    await act(async () => { await user.click(within(controls()).getByRole('button', { name: 'Submitted application' })); });
    expect(await screen.findByRole('heading', { name: 'Good news: you can apply online' })).toBeInTheDocument();
  });

  it('controls and the prototype-mode hint show on first entry; they can be collapsed and reopened', async () => {
    const { user } = await open();
    expect(controls()).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent(/Prototype mode/);
    await user.click(screen.getByRole('button', { name: 'Hide Prototype Controls' }));
    expect(screen.queryByRole('complementary', { name: 'Prototype Controls' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Show controls' }));
    expect(controls()).toBeInTheDocument();
  });
});

describe('Boards and Rules & Decisions', () => {
  it('Master Board and Detailed Logic Board render from the same model', async () => {
    const { user } = renderAt('/madfu/proposed?view=boards');
    expect(await screen.findByRole('heading', { name: 'Master boards' })).toBeInTheDocument();
    const board = screen.getByRole('img', { name: /Master Board — the journey, screen by screen/ });
    for (const t of ['Know Your Business', 'Application Submitted', 'Resume · CR', 'Resume · Freelancer', 'Application Progress', 'Active Account', 'Authorization Choice', 'Secure Link', 'Read-only Review', 'Delegated Signer · Phase 2', 'Business Details + IBAN']) expect(within(board).getAllByText(t).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('tab', { name: 'Detailed Logic Board' }));
    expect(screen.getByLabelText('Legend')).toHaveTextContent(/Merchant-facing step/);
    expect(screen.getByRole('heading', { name: /E · Mobile ↔ National ID, then Nafath/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /I · Authorization choice and signer handoff/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /M · Two lifecycles/ })).toBeInTheDocument();
  });

  it('Rules & Decisions lists confirmed decisions apart from open decisions', async () => {
    renderAt('/madfu/proposed?view=rules');
    expect(await screen.findByRole('heading', { name: 'Confirmed product decisions (2026-10-28)' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Open decisions (not confirmed rules)' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Phase 1 vs Phase 2' })).toBeInTheDocument();
    expect(screen.getByText('Signer secure SMS link — no signer OTP')).toBeInTheDocument();
    expect(screen.getByText('Ministry of Justice delegation integration')).toBeInTheDocument();
    expect(screen.getByText('Showing Freelancer Certificate details before Nafath')).toBeInTheDocument();
  });
});

describe('CR authorization and signer handoff', () => {
  it('Send to another signer: owner / manager + mobile → Send Authorization → frozen status page; signer / mobile change is Phase 2', async () => {
    const { user } = start('auth-signer');
    await screen.findByRole('heading', { name: 'Who will authorize and sign this application?' });
    expect(screen.getByText('Phase 2 · demo')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Send Authorization' }));
    expect(screen.getByText('Choose the owner or manager who will sign.')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /Nora/ }));
    await user.type(screen.getByLabelText('Signer’s mobile number'), DEMO.signerMobile);
    await user.click(screen.getByRole('button', { name: 'Send Authorization' }));
    expect(await screen.findByRole('heading', { name: 'Waiting for authorization' })).toBeInTheDocument();
    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(screen.getByText(/Nora Al-Shammari/)).toBeInTheDocument();
    expect(screen.getByText(/1 of 2 within 30 days/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change signer or mobile' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Save & exit/ })).toBeNull();
  });

  it('signer: secure link shows only masked details (no OTP) → Nafath → read-only review → Agree & Sign → submitted', async () => {
    const { user } = start('signer-link');
    expect(await screen.findByRole('heading', { name: 'You’ve been asked to authorize a Madfu merchant application' })).toBeInTheDocument();
    const main = screen.getByRole('main');
    expect(main).toHaveTextContent('Nora Al-Shammari');
    expect(main).toHaveTextContent('108••••530');
    expect(main).not.toHaveTextContent(/najdroastery|Standard commission|Commercial offer|IBAN|Google Maps|Application APP-/);
    expect(screen.queryByLabelText('Verification code')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Start Nafath Verification' }));
    expect(await screen.findByText('Select this number in Nafath', undefined, { timeout: 5000 })).toBeInTheDocument();
    await screen.findByText('Identity verified', undefined, { timeout: 8000 });
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { name: 'Review the application' })).toBeInTheDocument();
    expect(screen.getByText('Nothing here can be changed')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Edit / })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    expect(screen.getByRole('main')).toHaveTextContent('Standard commission');
    await user.click(screen.getByRole('button', { name: 'Continue to contract' }));
    await screen.findByRole('heading', { name: 'Merchant agreement' });
    await user.click(screen.getByRole('button', { name: 'Agree & Sign' }));
    expect(await screen.findByRole('heading', { name: SIGNER_DONE_COPY.title })).toBeInTheDocument();
  });

  it('an expired signer link shows nothing about the application', async () => {
    start('signer-link-expired');
    expect(await screen.findByRole('heading', { name: 'This authorization link has expired.' })).toBeInTheDocument();
    expect(screen.getByRole('main')).not.toHaveTextContent(/Nora|Najd|commission/);
    expect(screen.queryByRole('button', { name: 'Start Nafath Verification' })).toBeNull();
  });

  it('expired handoff: the preparer can start a new authorization of the same application; at the limit the team is needed', async () => {
    const { user } = start('handoff-expired');
    expect(await screen.findByText('Expired')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start a new authorization' }));
    expect(await screen.findByRole('heading', { name: 'Who will authorize and sign this application?' })).toBeInTheDocument();
    expect(screen.getByText('Your application is saved and locked')).toBeInTheDocument();
  });

  it('handoff limit reached: no further signer request without an internal unlock', async () => {
    const { user } = start('handoff-limit');
    await screen.findByRole('heading', { name: 'Who will authorize and sign this application?' });
    await user.click(screen.getByRole('radio', { name: /Send to another signer/ }));
    expect(screen.getByText('A new authorization can’t be sent right now')).toBeInTheDocument();
    expect(screen.queryByLabelText('Signer’s mobile number')).toBeNull();
  });

  it('delegated signatory is a demo marked Phase 2', async () => {
    const { user } = start('delegation-demo');
    expect(await screen.findByRole('heading', { name: 'Delegated signatory' })).toBeInTheDocument();
    expect(screen.getByText('Phase 2 — demo only')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /Ministry of Justice official delegation/ }));
    await user.click(screen.getByRole('button', { name: 'Verify with the Ministry of Justice (demo)' }));
    expect(within(screen.getByRole('main')).getAllByText(/Delegation verified/).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Back to authorization' }));
    expect(await screen.findByRole('heading', { name: 'Who will authorize and sign this application?' })).toBeInTheDocument();
  });

  it('Internal view shows the authorization facts the merchant never sees', async () => {
    const { user } = start('handoff-active');
    await screen.findByRole('heading', { name: 'Waiting for authorization' });
    await controlsTab(user, 'Internal view');
    const c = within(controls());
    for (const k of ['Authorization status', 'Authorization version', 'Signer mobile (masked)', 'Handoff created / expiry', 'Handoff attempts in window', 'Application frozen', 'Delegated signer (Phase 2 demo)', 'Final signing status', 'Internal not-eligible / paused reason', 'Resume stage (first unfinished)']) expect(c.getByText(k)).toBeInTheDocument();
    expect(c.getByText(/AWAITING_SIGNER · Awaiting signer/)).toBeInTheDocument();
  });
});
