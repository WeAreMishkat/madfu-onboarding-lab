import { describe, expect, it } from 'vitest';
import { act, screen, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { renderAt } from '@/test/render';
import { STAGES } from './model/config';
import { NOT_ELIGIBLE_SAVED_COPY, OUTCOME_COPY } from './model/copy';
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

  it('Freelancer without a certificate: Not Eligible directly after Page 1 — no Identify, no National ID, no code', async () => {
    const { user } = await open();
    await kyb(user, { kind: 'FL_NO_CERT', group: 'services', sub: 'services-design' });
    expect(await screen.findByRole('heading', { name: OUTCOME_COPY.NOT_ELIGIBLE.title })).toBeInTheDocument();
    expect(screen.getByText(/needs an active Freelancer Certificate/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/National ID|Mobile number|Verification code/)).toBeNull();
  });

  it('a Freelancer in a CR-only category continues to Identify + code, then Not Eligible with a personalised reason', async () => {
    const { user } = await open();
    await kyb(user, { kind: 'FL_CERT', group: 'food', sub: 'food-cafe' });
    await screen.findByRole('heading', { name: 'Leave your details' });
    await user.type(screen.getByLabelText('National ID Number'), DEMO.nationalId);
    await user.type(screen.getByLabelText('Mobile number'), DEMO.mobile);
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    await code(user);
    expect(await screen.findByRole('heading', { name: NOT_ELIGIBLE_SAVED_COPY.title })).toBeInTheDocument();
    expect(screen.getByText(/requires a registered business with a Commercial Registration/)).toBeInTheDocument();
  });
});

describe('Registered business end to end', () => {
  it('Page 1 → identifier + mobile + owner → code → owners → mobile check + Nafath → store links → standard offer → review → Agree & Submit', async () => {
    const { user, unmount } = await open();
    await kyb(user, { kind: 'CR', group: 'food', sub: 'food-cafe', channel: /^Both/ });

    await screen.findByRole('heading', { name: 'Good news: you can apply online' });
    await user.type(screen.getByLabelText('Commercial Registration (Unified Number)'), DEMO.cr);
    await user.type(screen.getByLabelText('Mobile number'), DEMO.mobile);
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    expect(screen.getByText('Choose Yes or No.')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Yes' }));
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    await code(user);

    // No CR confirmation page: straight to the owner / manager choice.
    await screen.findByRole('heading', { name: 'Who is applying for this business?' });
    await user.click(await screen.findByRole('radio', { name: /Mohammed/ }));
    expect(screen.queryByRole('radio', { name: /Faisal/ })).toBeNull(); // delegate not offered
    await user.click(screen.getByRole('button', { name: 'Continue to Nafath' }));
    await user.click(await screen.findByRole('button', { name: 'Send to Nafath' }));
    await screen.findByText('Identity verified', undefined, { timeout: 8000 });
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
    await user2.click(screen.getByRole('button', { name: 'Continue to contract' }));

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
  it('certificate pre-check runs silently; Nafath first; certificate; website + IBAN linkage; offer; review', async () => {
    const { user } = await open();
    await kyb(user, { kind: 'FL_CERT', group: 'services', sub: 'services-design' });
    await user.type(await screen.findByLabelText('National ID Number'), DEMO.nationalId);
    await user.type(screen.getByLabelText('Mobile number'), DEMO.mobile);
    await user.click(screen.getByRole('radio', { name: 'Yes' }));
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    await code(user);
    await screen.findByRole('button', { name: 'Send to Nafath' }, { timeout: 5000 });
    expect(screen.queryByText(/FL-4000/)).toBeNull(); // no certificate detail before Nafath
    await user.click(screen.getByRole('button', { name: 'Send to Nafath' }));
    await screen.findByText('Identity verified', undefined, { timeout: 8000 });
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('FL-400000001')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('heading', { name: 'Business details' });
    await user.type(screen.getByLabelText('Online store or business website'), 'studio.example.com');
    await user.type(screen.getByLabelText('IBAN'), demoIban('80', '4821'));
    await user.click(screen.getByRole('button', { name: 'Verify' }));
    await screen.findByText('Account verified', undefined, { timeout: 5000 });
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(await screen.findByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { name: 'Review your application' })).toBeInTheDocument();
  });
});

describe('Existing records and routing after OTP', () => {
  it('application in progress: the code goes to the registered mobile (last 3 digits); then resume', async () => {
    const { user } = start('id-incomplete');
    await user.click(await screen.findByRole('button', { name: 'Send code' }));
    expect(await screen.findByRole('heading', { name: 'An application is already in progress for this business.' })).toBeInTheDocument();
    expect(screen.getByText(/registered mobile ending in/)).toHaveTextContent('•••••••123');
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

  it('live merchant: login, no application', async () => {
    const { user } = start('id-live');
    await user.click(await screen.findByRole('button', { name: 'Send code' }));
    expect(await screen.findByRole('heading', { name: 'This business already has a Madfu account.' })).toBeInTheDocument();
    expect(screen.getByText(/registered mobile ending in/)).toHaveTextContent('•••••••123');
    await code(user);
    expect(await screen.findByRole('button', { name: 'Go to merchant login' })).toBeInTheDocument();
    expect(screen.getByText(/No new application was created/)).toBeInTheDocument();
  });

  it('not an owner or manager: Not Eligible with the personalised reason', async () => {
    const { user } = start('id-cr-not-owner');
    await user.click(await screen.findByRole('button', { name: 'Send code' }));
    await code(user);
    expect(await screen.findByText(/available only to the owners and managers registered on the Commercial Registration/)).toBeInTheDocument();
  });

  it.each([[/Above SAR 20,000,000/], [/Below SAR 100,000/]])('revenue %s: normal self-onboarding (no Sales route)', async (revenue) => {
    const { user } = await open();
    await kyb(user, { kind: 'CR', group: 'retail', sub: 'retail-fashion', revenue });
    await screen.findByRole('heading', { name: 'Good news: you can apply online' });
    await user.type(screen.getByLabelText('Commercial Registration (Unified Number)'), DEMO.cr);
    await user.type(screen.getByLabelText('Mobile number'), DEMO.mobile);
    await user.click(screen.getByRole('radio', { name: 'Yes' }));
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    await code(user);
    expect(await screen.findByRole('heading', { name: 'Who is applying for this business?' })).toBeInTheDocument();
    expect(screen.queryByText(/Sales team/)).toBeNull();
  });

  it('unsupported category: identifier + mobile (no "eligible" claim, no prerequisite), code, then "We’ve received your details"', async () => {
    const { user } = await open();
    await kyb(user, { kind: 'CR', group: 'fixture', sub: 'fixture-blocked' });
    await screen.findByRole('heading', { name: 'Leave your details' });
    expect(screen.queryByText('Eligible for online onboarding')).toBeNull();
    expect(screen.queryByRole('radio', { name: 'Yes' })).toBeNull();
    await user.type(screen.getByLabelText('Commercial Registration (Unified Number)'), DEMO.cr);
    await user.type(screen.getByLabelText('Mobile number'), DEMO.mobile);
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    await code(user);
    expect(await screen.findByRole('heading', { name: NOT_ELIGIBLE_SAVED_COPY.title })).toBeInTheDocument();
    expect(screen.getByText('This business activity is currently not eligible for Madfu onboarding.')).toBeInTheDocument();
    expect(screen.getByText(NOT_ELIGIBLE_SAVED_COPY.body)).toBeInTheDocument();
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
    expect(await screen.findByRole('heading', { name: 'Review your application' })).toBeInTheDocument();
    await user.click(back);
    await user.click(back);
    expect(await screen.findByRole('heading', { name: 'Business details' })).toBeInTheDocument();
    expect(screen.getByLabelText('Online store or business website')).toHaveValue('https://najdroastery.example.com');
    await user.click(back);
    expect(await screen.findByText('Verified with Nafath')).toBeInTheDocument();
    await user.click(back);
    expect(await screen.findByRole('radio', { name: /Mohammed/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Nora/ })).toBeDisabled();
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
    for (const p of ['Existing incomplete application', 'Submitted application', 'Live merchant', 'Mobile mismatch before Nafath', 'Expired CR']) expect(within(controls()).getByRole('button', { name: p })).toBeInTheDocument();
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
    for (const t of ['Know Your Business', 'Not Eligible · Details Received', 'Resume Application', 'Application Progress', 'Owner / Manager', 'Business Details + IBAN']) expect(within(board).getAllByText(t).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('tab', { name: 'Detailed Logic Board' }));
    expect(screen.getByLabelText('Legend')).toHaveTextContent(/Merchant-facing step/);
    expect(screen.getByRole('heading', { name: /E · Mobile ↔ National ID, then Nafath/ })).toBeInTheDocument();
  });

  it('Rules & Decisions lists confirmed decisions apart from open decisions', async () => {
    renderAt('/madfu/proposed?view=rules');
    expect(await screen.findByRole('heading', { name: 'Confirmed product decisions (2026-10-27)' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Open decisions (not confirmed rules)' })).toBeInTheDocument();
    expect(screen.getByText(/Delegated-person onboarding is out of V1/)).toBeInTheDocument();
    expect(screen.getByText('Certificate lookup before Nafath')).toBeInTheDocument();
  });
});
