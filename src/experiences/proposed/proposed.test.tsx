import { describe, expect, it } from 'vitest';
import { act, screen, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { renderAt } from '@/test/render';
import { STAGES } from './model/config';
import { OUTCOME_COPY } from './model/copy';
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

async function kyb(user: UserEvent, opts: { kind: 'CR' | 'FL_CERT' | 'FL_NO_CERT'; group: string; sub: string; revenue?: RegExp; channel?: RegExp; web?: string; maps?: string }) {
  await screen.findByRole('heading', { name: KYB_TITLE });
  await user.selectOptions(screen.getByLabelText('Who is applying?'), opts.kind);
  await user.selectOptions(screen.getByLabelText('Business category'), opts.group);
  await user.selectOptions(screen.getByLabelText('Business subcategory'), opts.sub);
  await user.click(screen.getByRole('radio', { name: opts.revenue ?? /SAR 100,000–20,000,000/ }));
  await user.click(screen.getByRole('radio', { name: opts.channel ?? /^Online/ }));
  if (opts.web !== undefined) await user.type(screen.getByLabelText('Business website URL'), opts.web);
  if (opts.maps !== undefined) await user.type(screen.getByLabelText('Google Maps URL'), opts.maps);
  await user.click(screen.getByRole('button', { name: 'Check eligibility' }));
}

async function code(user: UserEvent, value = DEMO_SMS_CODE) {
  await screen.findByLabelText('Verification code');
  await user.type(screen.getByLabelText('Verification code'), value);
}

describe('Stage 1 — Know Your Business comes first', () => {
  it('first page asks no CR, National ID, mobile or code', async () => {
    await open();
    expect(screen.queryByLabelText(/Commercial Registration|National ID|Mobile number|Verification code/)).toBeNull();
    expect(screen.getByText(`Stage 1 of ${STAGES.length} · Know Your Business`)).toBeInTheDocument();
  });

  it('subcategory depends on category; channel fields are conditional', async () => {
    const { user } = await open();
    expect(screen.getByLabelText('Business subcategory')).toBeDisabled();
    await user.selectOptions(screen.getByLabelText('Business category'), 'food');
    expect(screen.getByLabelText('Business subcategory')).toBeEnabled();
    expect(screen.queryByLabelText('Business website URL')).toBeNull();
    await user.click(screen.getByRole('radio', { name: /^Online/ }));
    expect(screen.getByLabelText('Business website URL')).toBeInTheDocument();
    expect(screen.queryByLabelText('Google Maps URL')).toBeNull();
    await user.click(screen.getByRole('radio', { name: /^Both/ }));
    expect(screen.getByLabelText('Google Maps URL')).toBeInTheDocument();
  });

  it('rejects an invalid website, a social-media page and a non-Google Maps link', async () => {
    const { user } = await open();
    await kyb(user, { kind: 'CR', group: 'food', sub: 'food-cafe', channel: /^Both/, web: 'https://instagram.com/najd', maps: 'https://example.com/where' });
    expect(await screen.findByText('Enter your own website, not a social-media page.')).toBeInTheDocument();
    expect(screen.getByText('Enter a Google Maps link to your location.')).toBeInTheDocument();
    const web = screen.getByLabelText('Business website URL');
    await user.clear(web);
    await user.type(web, 'my-store');
    await user.click(screen.getByRole('button', { name: 'Check eligibility' }));
    expect(await screen.findByText(/Enter a full link/)).toBeInTheDocument();
  });

  it('Freelancer without certificate becomes a lead: contact + code, no verification screens', async () => {
    const { user } = await open();
    await kyb(user, { kind: 'FL_NO_CERT', group: 'services', sub: 'services-design', web: 'https://studio.example.com' });
    await screen.findByRole('heading', { name: 'A Freelancer Certificate is needed to apply online' });
    await user.type(screen.getByLabelText('Your name'), 'Sara');
    await user.type(screen.getByLabelText('Mobile number'), DEMO.mobile);
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    await code(user);
    expect(await screen.findByRole('heading', { name: OUTCOME_COPY.FL_CERT_REQUIRED.title })).toBeInTheDocument();
    await controlsTab(user, 'Internal view');
    expect(within(controls()).getByText('LEAD_FL_CERT_REQUIRED')).toBeInTheDocument();
  });

  it('a Freelancer in a CR-only category is stopped before any external call', async () => {
    const { user } = await open();
    await kyb(user, { kind: 'FL_CERT', group: 'food', sub: 'food-cafe', web: 'https://kitchen.example.com' });
    expect(await screen.findByRole('heading', { name: OUTCOME_COPY.NOT_ELIGIBLE.title })).toBeInTheDocument();
    expect(screen.getByText(/requires a registered business/)).toBeInTheDocument();
  });
});

describe('Full registered-business journey in the UI', () => {
  it('KYB → identify → OTP → verification → banking → offer → review → contract → submitted, with persistence', async () => {
    const { user, unmount } = await open();
    await kyb(user, { kind: 'CR', group: 'food', sub: 'food-cafe', web: 'https://najd.example.com' });

    await screen.findByRole('heading', { name: 'Good news: you can apply online' });
    await user.type(screen.getByLabelText('Commercial Registration (Unified Number)'), DEMO.cr);
    await user.type(screen.getByLabelText('Mobile number'), DEMO.mobile);
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    await code(user);

    await screen.findByText('Registration verified');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(await screen.findByRole('radio', { name: /Mohammed/ }));
    await user.click(screen.getByRole('button', { name: 'Continue to Nafath' }));
    await screen.findByText('Identity verified');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    // Stage 4: Stage-1 answers are shown, not asked again.
    await screen.findByRole('heading', { name: 'Business & banking details' });
    expect(screen.getByText('https://najd.example.com')).toBeInTheDocument();
    expect(screen.queryByLabelText('Business website URL')).toBeNull();
    expect(screen.queryByText(/SWIFT|Beneficiary|IBAN certificate|Source of Revenue|Source of Income/i)).toBeNull();
    await user.type(screen.getByLabelText('IBAN'), demoIban('10', '4821'));
    await user.click(screen.getByRole('button', { name: 'Verify' }));
    await screen.findByText('Account verified');
    await user.click(screen.getByRole('radio', { name: 'No' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));

    // Stage 5: plans and commission here.
    await screen.findByRole('heading', { name: 'Your commercial offer' });
    expect(screen.getAllByText('Included').length).toBe(2);
    expect(screen.queryByRole('checkbox', { name: /^3 months/ })).toBeNull();
    await user.click(screen.getByRole('checkbox', { name: /^6 months/ }));
    await user.click(screen.getByRole('checkbox', { name: /^9 months/ }));
    await user.click(screen.getByRole('checkbox', { name: /^9 months/ }));
    expect(screen.getByText(/6 months \(/)).toBeInTheDocument();
    // The optional better-offer section stays collapsed: no upload is needed to continue.
    expect(screen.queryByRole('button', { name: /Add file/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Continue with this offer' }));

    await screen.findByRole('heading', { name: 'Review your application' });
    expect(screen.getByText('Everything is ready')).toBeInTheDocument();

    // Refresh persistence.
    unmount();
    renderAt('/madfu/proposed');
    expect(await screen.findByRole('heading', { name: 'Review your application' })).toBeInTheDocument();
    const user2 = (await import('@testing-library/user-event')).default.setup({ delay: null });
    await user2.click(screen.getByRole('button', { name: 'Continue to contract' }));

    // Stage 7: contract only — no checkbox, no plan selection, one action.
    await screen.findByRole('heading', { name: 'Merchant agreement' });
    const main = screen.getByRole('main');
    expect(within(main).queryAllByRole('checkbox')).toHaveLength(0);
    expect(within(main).getByRole('table', { name: 'Schedule 1' })).toHaveTextContent('6 months');
    expect(within(main).getByText(/By clicking/)).toHaveTextContent(/Privacy Policy/);
    expect(within(main).queryByRole('button', { name: 'Submit application' })).toBeNull();
    await user2.click(screen.getByRole('button', { name: 'Agree & Submit' }));
    // Directly to success: no second Submit, no confirmation form.
    expect(await screen.findByRole('heading', { name: OUTCOME_COPY.SUBMITTED.title })).toBeInTheDocument();
    expect(screen.getByText('Our team will review your application and contact you if anything else is required.')).toBeInTheDocument();
    expect(within(screen.getByRole('main')).queryAllByRole('button')).toHaveLength(0);
    expect(within(screen.getByRole('main')).queryAllByRole('textbox')).toHaveLength(0);
    expect(screen.queryByText(/activated/i)).toBeNull();
  });
});

describe('Resume and verification reuse', () => {
  it('Continue link opens the code screen with context; after the code the stored checks are reused', async () => {
    const { user } = start('resume-nafath');
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Business category')).toBeNull();
    await code(user);
    expect(await screen.findByRole('heading', { name: 'Business & banking details' })).toBeInTheDocument();
    await controlsTab(user, 'Internal view');
    expect(screen.getAllByText('Verified previously — reused, no new provider call').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText('IBAN ownership check')).toBeInTheDocument();
  });

  it('Save & exit sends a Continue link; opening it asks only for the code', async () => {
    const { user } = start('com-6');
    await user.click(await screen.findByRole('button', { name: /Save & exit/ }));
    expect(await screen.findByText(/We sent a Continue Application link/)).toBeInTheDocument();
    await controlsTab(user, 'Start demo');
    await user.click(within(controls()).getByRole('button', { name: 'Open Continue link (new session)' }));
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    await code(user);
    expect(await screen.findByRole('heading', { name: 'Your commercial offer' })).toBeInTheDocument();
  });
});

describe('Freelancer banking and edits', () => {
  it('bank not linked to the certificate: IBAN skipped, the journey continues', async () => {
    const { user } = start('fl-bank-no');
    await user.click(await screen.findByRole('radio', { name: 'No / not yet' }));
    expect(screen.queryByLabelText('IBAN')).toBeNull();
    expect(screen.getByText(/No IBAN is needed now/)).toBeInTheDocument();
    await user.click(screen.getAllByRole('radio', { name: 'No' })[0]);
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByRole('heading', { name: 'Your commercial offer' })).toBeInTheDocument();
  });

  it('edit IBAN from Review invalidates only the IBAN check', async () => {
    const { user } = start('edit-iban');
    await user.click(await screen.findByRole('button', { name: 'Edit Business & banking' }));
    const iban = await screen.findByLabelText('IBAN');
    await user.clear(iban);
    await user.type(iban, demoIban('20', '7777'));
    await controlsTab(user, 'Internal view');
    expect(within(controls()).getByText('Invalidated: IBAN changed')).toBeInTheDocument();
    expect(within(controls()).queryAllByText(/^Invalidated:/)).toHaveLength(1);
  });

  it('contract declined can be reopened', async () => {
    const { user } = start('contract-decline');
    await screen.findByRole('heading', { name: 'Merchant agreement' });
    await user.click(screen.getByRole('button', { name: 'Decline' }));
    const dialog = screen.getByText('Decline the agreement?').closest('.mb-alert') as HTMLElement;
    await user.click(within(dialog).getByRole('button', { name: 'Decline' }));
    expect(await screen.findByRole('heading', { name: OUTCOME_COPY.CONTRACT_DECLINED.title })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Review the agreement again' }));
    expect(await screen.findByRole('heading', { name: 'Merchant agreement' })).toBeInTheDocument();
  });

  it('restart clears the demo', async () => {
    const { user } = start('id-new-cr');
    await screen.findByRole('heading', { name: 'Good news: you can apply online' });
    await act(async () => { await user.click(screen.getByRole('button', { name: /Restart/ })); });
    expect(await screen.findByRole('heading', { name: KYB_TITLE })).toBeInTheDocument();
  });
});

describe('Prototype Controls: Page Scenarios per screen, Internal view separate', () => {
  const pageOptions = () => within(screen.getByRole('tabpanel', { name: 'Page Scenarios' })).getAllByRole('button').map((b) => b.textContent ?? '');

  it('OTP page shows only OTP cases; they change after navigation; Internal view is a separate tab', async () => {
    const { user } = start('id-new-cr');
    await screen.findByRole('heading', { name: 'Good news: you can apply online' });
    expect(pageOptions()).toEqual(['New applicant', 'Saved application, same mobile → resume', 'Application exists under another mobile', 'Already a Madfu merchant']);
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    await screen.findByLabelText('Verification code');
    expect(pageOptions()).toEqual(['Verified', 'Incorrect code', 'Invalid code (wrong format)', 'Expired / timed out', 'All attempts failed', 'Resend code', 'Edit mobile number']);
    expect(within(controls()).queryByText(/Nafath|IBAN|Category|commission|certificate/)).toBeNull();
    await user.click(within(controls()).getByRole('button', { name: 'Incorrect code' }));
    expect(await screen.findByText('Incorrect code. 2 attempts left.')).toBeInTheDocument();
    await user.click(within(controls()).getByRole('button', { name: 'Verified' }));
    await screen.findByRole('heading', { name: 'Business verification' });
    expect(pageOptions()).toContain('CR 3 months old or less');
    expect(pageOptions()).not.toContain('Incorrect code');
    await controlsTab(user, 'Internal view');
    expect(within(controls()).getByText('External checks (cost view)')).toBeInTheDocument();
    expect(within(controls()).queryByRole('tabpanel', { name: 'Page Scenarios' })).toBeNull();
  });

  it('contract page offers only accept / decline; the global scenario list is gone from inside the journey', async () => {
    start('contract-accept');
    await screen.findByRole('heading', { name: 'Merchant agreement' });
    expect(pageOptions()).toEqual(['Normal contract', 'Contract declined']);
    expect(within(controls()).queryByText(/Add 6-month|Resume after Nafath verified/)).toBeNull();
  });

  it('Start demo holds the journey presets', async () => {
    const { user } = start('edit-website');
    await screen.findByRole('heading', { name: 'Review your application' });
    await controlsTab(user, 'Start demo');
    await user.click(within(controls()).getByRole('button', { name: 'Happy path — registered business' }));
    expect(await screen.findByRole('heading', { name: KYB_TITLE })).toBeInTheDocument();
  });
});

describe('Commercial Offer: optional better offer, collapsed by default', () => {
  it('collapsed by default and marked optional; Yes expands the optional uploads; Not now keeps it collapsed', async () => {
    const { user } = start('com-standard');
    await screen.findByRole('heading', { name: 'Your commercial offer' });
    const better = screen.getByRole('region', { name: 'Better commercial offer' });
    expect(within(better).getByText('Optional')).toBeInTheDocument();
    expect(within(better).getByText('Interested in a better commercial offer?')).toBeInTheDocument();
    expect(within(better).queryByRole('button', { name: /Add file/ })).toBeNull();
    await user.click(within(better).getByRole('button', { name: 'Not now' }));
    expect(within(better).queryByRole('button', { name: /Add file/ })).toBeNull();
    await user.click(within(better).getByRole('button', { name: 'Yes, tell me more' }));
    expect(within(better).getAllByRole('button', { name: /Add file/ })).toHaveLength(2);
    expect(within(better).getByText(/your onboarding continues with the standard offer without these documents/)).toBeInTheDocument();
    expect(within(better).getByText('Supporting document')).toBeInTheDocument();
  });

  it('uploading optional evidence requests a Commercial review; the standard offer stays and Continue works', async () => {
    const { user } = start('com-standard');
    await screen.findByRole('heading', { name: 'Your commercial offer' });
    const standard = screen.getByText('Your standard offer').closest('div')!.textContent;
    await user.click(screen.getByRole('button', { name: 'Yes, tell me more' }));
    await user.click(screen.getAllByRole('button', { name: /Add file/ })[0]);
    expect(await screen.findByText(/Review requested · standard offer applies/)).toBeInTheDocument();
    expect(screen.getByText('Your standard offer').closest('div')!.textContent).toBe(standard);
    await user.click(screen.getByRole('checkbox', { name: /^12 months/ }));
    await user.click(screen.getByRole('button', { name: 'Continue with this offer' }));
    await screen.findByRole('heading', { name: 'Review your application' });
    await controlsTab(user, 'Internal view');
    expect(within(controls()).getByText('COMMERCIAL_PRICING_REVIEW')).toBeInTheDocument();
    expect(within(controls()).getByText('Commercial pricing review requested')).toBeInTheDocument();
  });

  it('skipping the optional section does not block and shows no warning', async () => {
    const { user } = start('com-standard');
    await screen.findByRole('heading', { name: 'Your commercial offer' });
    await user.click(screen.getByRole('button', { name: 'Continue with this offer' }));
    expect(await screen.findByRole('heading', { name: 'Review your application' })).toBeInTheDocument();
    expect(screen.getByText('Everything is ready')).toBeInTheDocument();
  });
});

describe('Prototype Controls visible by default, collapsible, reviewer hint', () => {
  it('controls and the prototype-mode hint show on first entry; they can be collapsed and reopened', async () => {
    const { user } = await open();
    expect(controls()).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent(/Prototype mode/);
    expect(within(controls()).getByText(/Prototype tip:/)).toBeInTheDocument();
    expect(within(controls()).getByText('Prototype only')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Hide Prototype Controls' }));
    expect(screen.queryByRole('complementary', { name: 'Prototype Controls' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Show controls' }));
    expect(controls()).toBeInTheDocument();
  });
});

describe('Master boards and rules', () => {
  it('Simple and Detailed Master Boards render from the same stage list', async () => {
    const { user } = renderAt('/madfu/proposed?view=boards');
    expect(await screen.findByRole('heading', { name: 'Master boards' })).toBeInTheDocument();
    expect(screen.getByLabelText('Legend')).toHaveTextContent(/Cached \/ reused verification/);
    for (const s of STAGES) expect(screen.getAllByText(new RegExp(s.label)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Resume normally triggers OTP only/).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('tab', { name: 'Detailed Master Board' }));
    expect(screen.getByRole('heading', { name: /C1 · Business Verification: Registered business/ })).toBeInTheDocument();
    expect(screen.getAllByText(/PRODUCT TASK/).length).toBeGreaterThan(0);
  });

  it('rules view lists the open decisions without presenting them as rules', async () => {
    renderAt('/madfu/proposed?view=rules');
    expect(await screen.findByRole('heading', { name: 'Rules & decisions' })).toBeInTheDocument();
    expect(screen.getByText(/Freelancer linked IBAN before contract\?/)).toBeInTheDocument();
    expect(screen.getAllByText('COMPLIANCE DECISION').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Proposed / Product Design').length).toBeGreaterThan(0);
  });
});
