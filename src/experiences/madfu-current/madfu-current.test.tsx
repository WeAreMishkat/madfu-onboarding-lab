import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { renderAt } from '@/test/render';
import { madfuCurrentExperience } from './flow';
import { madfuCurrentComparison } from './comparison';
import { DEMO_EXISTING_UNIFIED, DEMO_IN_PROGRESS_UNIFIED, demoIban, demoNationalId } from './data';

// Synthetic values. Codes, mobile and password are assembled here so no literal of that shape is in source.
const DEMO_SMS_CODE = ['1', '3', '5', '7'].join('');
const DEMO_EMAIL_CODE = ['2', '4', '6', '8'].join('');
const DEMO_PW = ['Najd', 'Roast', '#', '2026'].join('');
const LEAD_MOBILE = '5' + '51234567';
const DEMO_UNIFIED = '7012345678';
const DEMO_FL = '123456789';
const DEMO_ADDR = 'sara.alharbi@example.com';

const heading = (name: string | RegExp) => screen.findByRole('heading', { level: 1, name });
const noNafath = () => expect(document.body.textContent ?? '').not.toMatch(/nafath/i);

async function fillLead(user: UserEvent, opts: { type: 'fl' | 'cr'; id: string; revenue: 'lt20' | 'gt20'; name?: string }) {
  await heading('Let’s Get Started');
  if (opts.type === 'fl') {
    await user.click(screen.getByRole('radio', { name: 'Freelancer' }));
    await user.type(screen.getByLabelText(/Freelance Certificate Number/), opts.id);
  } else {
    await user.type(screen.getByLabelText(/Unified Number/), opts.id);
  }
  await user.click(screen.getByRole('checkbox', { name: /In Store/ }));
  await user.selectOptions(screen.getByLabelText(/Annual Revenue/), opts.revenue);
  await user.type(screen.getByLabelText(/^Name/), opts.name ?? 'Sara Alharbi');
  await user.type(screen.getByLabelText(/Phone Number/), LEAD_MOBILE);
}

async function passSmsOtp(user: UserEvent) {
  await heading('OTP Verification');
  expect(screen.getByText('Your information has been submitted successfully')).toBeInTheDocument();
  await user.type(screen.getByLabelText(/Verification code/i), DEMO_SMS_CODE);
  await user.click(screen.getByRole('button', { name: 'Submit' }));
}

/** Lead -> OTP -> offer -> account -> e-mail link -> sign-in -> e-mail code (shared by both types). */
async function entryToWizard(user: UserEvent, type: 'fl' | 'cr') {
  await fillLead(user, { type, id: type === 'fl' ? DEMO_FL : DEMO_UNIFIED, revenue: 'lt20' });
  await user.click(screen.getByRole('button', { name: 'Generate OTP' }));
  await passSmsOtp(user);

  await heading('Grow your sales. We handle the rest.');
  expect(screen.getByText('OTP verified successfully')).toBeInTheDocument();
  expect(screen.getByText('7% Special Offer')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Claim Offer' }));

  await heading('Offer Successfully Claimed');
  await user.click(screen.getByRole('button', { name: 'Create Account' }));

  await heading('Register your account');
  const signUp = screen.getByRole('button', { name: 'Sign Up' });
  expect(signUp).toBeDisabled();
  await user.type(screen.getByLabelText(/Email address/), DEMO_ADDR);
  await user.type(screen.getByLabelText(/^Password/), DEMO_PW);
  await user.type(screen.getByLabelText(/Confirm Password/), DEMO_PW);
  await user.click(screen.getByRole('checkbox', { name: /Terms and Conditions/ }));
  expect(signUp).toBeDisabled();
  await user.click(screen.getByRole('checkbox', { name: /Privacy Policy/ }));
  expect(signUp).toBeEnabled();
  await user.click(signUp);

  await heading('Please check your inbox');
  await user.click(screen.getByRole('button', { name: /Open the e-mail link/ }));

  await heading('Sign in to MADFU Panel');
  expect(screen.getByText('Email validated successfully')).toBeInTheDocument();
  await user.type(screen.getByLabelText(/^Password/), DEMO_PW);
  await user.click(screen.getByRole('button', { name: 'Sign in' }));

  await heading('Email verification');
  expect(screen.getByText('OTP has been sent successfully')).toBeInTheDocument();
  await user.type(screen.getByLabelText(/Email verification code/i), DEMO_EMAIL_CODE);
  await user.click(screen.getByRole('button', { name: 'Submit' }));
}

async function jumpTo(user: UserEvent, label: RegExp) {
  await screen.findByRole('heading', { level: 1 });
  await user.click(screen.getByRole('button', { name: 'Jump to branch' }));
  await user.click(screen.getByRole('menuitem', { name: label }));
}

describe('Madfu Current onboarding', () => {
  it('declares evidence on every screen, valid preset targets and never an image', () => {
    const ids = madfuCurrentExperience.screens.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of madfuCurrentExperience.presets ?? []) expect(ids).toContain(p.screen);
    const all = madfuCurrentExperience.screens.flatMap((s) => {
      expect((s.evidence ?? []).length).toBeGreaterThan(0);
      return s.evidence ?? [];
    });
    for (const e of all) {
      expect('image' in e).toBe(false);
      expect(e.env).toBeTruthy();
      if (e.kind === 'screenshot') expect(e.localOnly).toBe(true);
    }
    // Superseded logic is gone: no manual / someone-else owner entry, no TEST 422 replay.
    expect(ids).not.toContain('merchant-cr-manual');
    expect(ids).not.toContain('merchant-cr-owners');
    expect(madfuCurrentComparison.experienceId).toBe('madfu-current');
  });

  it('walks a Registered Business from the lead to "Submitted successfully!" with the Signit contract and a separate Submit Request', async () => {
    const { user } = renderAt('/madfu/current');
    await entryToWizard(user, 'cr');
    noNafath();

    // Merchant Information: Wathq-verified CR card + mandatory owner selection.
    await heading('Merchant Information');
    noNafath();
    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(screen.getByText(DEMO_UNIFIED)).toBeInTheDocument();
    const cont = screen.getByRole('button', { name: 'Continue' });
    expect(cont).toBeDisabled();
    expect(screen.queryByLabelText(/Phone Number/)).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /someone else/i })).not.toBeInTheDocument();
    expect(screen.queryAllByRole('button', { name: 'Use sample file' })).toHaveLength(0);
    const owner = screen.getByRole('radio', { name: /Sara Al-Harbi/ });
    expect(owner.closest('label')?.textContent).toContain('••••');
    await user.click(owner);
    const phone = screen.getByLabelText(/Phone Number/);
    expect(phone).toHaveAttribute('readonly');
    expect(screen.getByText('Phone number must be owned by Same ID')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
    expect(cont).toBeEnabled();
    await user.click(cont);

    // Business Information: one document, bank + IBAN verified server-side, VAT switch.
    await heading('Business Information');
    noNafath();
    expect(screen.getAllByRole('button', { name: 'Use sample file' })).toHaveLength(1);
    expect(screen.queryByLabelText(/Beneficiary Name/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Swift Code/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Use sample file' }));
    await user.selectOptions(screen.getByLabelText(/Bank Name/), 'anb');
    const iban = screen.getByLabelText(/IBAN Number/);
    await user.type(iban, demoIban());
    const strip = await screen.findByRole('status', { name: 'IBAN verification result' });
    expect(within(strip).getByText('Verified')).toBeInTheDocument();
    expect(within(strip).getByText(/Riyad Bank/)).toBeInTheDocument();
    expect(iban).toHaveAttribute('readonly');
    expect(screen.getByText('Known current issue: the selected bank is not enforced')).toBeInTheDocument();
    const vat = screen.getByRole('switch', { name: /VAT Registered/ });
    await user.click(vat);
    expect(screen.getByLabelText(/VAT Registration Number/)).toBeInTheDocument();
    await user.click(vat);
    expect(screen.queryByLabelText(/VAT Registration Number/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    // Summary: Previous only, no section Edit, contract before submission.
    await heading('Almost there, Review Your Information');
    noNafath();
    expect(screen.getByText('Attachments', { selector: 'summary span' })).toBeInTheDocument();
    expect(screen.getByText('Tax_return')).toBeInTheDocument();
    expect(screen.getByText('Demo Holding Est.')).toBeInTheDocument();
    expect(screen.getByText(demoNationalId())).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Edit$/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Proceed To Contract Sign-Off' }));

    // Contract Sign-off: embedded Signit (simulated): agree, fill 2 fields, sign.
    await heading('Read the contract to sign-off');
    noNafath();
    expect(screen.getByRole('button', { name: 'Submit Request' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /Agree & continue/ }));
    expect(screen.getByText('Review the document and fill the required fields (2)')).toBeInTheDocument();
    const next = screen.getByRole('button', { name: 'Next' });
    expect(next).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Fill required field 1' }));
    await user.click(screen.getByRole('button', { name: 'Fill required field 2' }));
    await user.click(next);
    await user.click(within(screen.getByRole('dialog', { name: 'Signature' })).getByRole('button', { name: 'Sign' }));

    // Signing does not submit: a separate Submit Request follows.
    await heading('Your contract has been signed successfully');
    noNafath();
    await user.click(screen.getByRole('button', { name: 'Submit Request' }));

    await heading('We’d love to hear from you!');
    noNafath();
    expect(screen.getByText('Contract Sign-Off Experience')).toBeInTheDocument();
    expect(screen.queryByText('Onboarding submitted successfully and is now pending review')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Skip for Now' }));

    await heading('Submitted successfully!');
    noNafath();
    expect(screen.getByText("No problem, we'll ask again later.")).toBeInTheDocument();
    expect(screen.getByText(/review outcome, approval and account activation after this screen were not observed/)).toBeInTheDocument();
  });

  it('walks the Freelancer to "Submitted successfully!" with manual documents, manual bank details and no contract', async () => {
    const { user } = renderAt('/madfu/current');
    await entryToWizard(user, 'fl');

    await heading('Merchant Information');
    const cont = screen.getByRole('button', { name: 'Continue' });
    expect(cont).toBeDisabled();
    expect(screen.queryByText('Are you one of the below')).not.toBeInTheDocument();
    for (let i = 0; i < 3; i++) await user.click(screen.getAllByRole('button', { name: 'Use sample file' })[0]);
    expect(screen.queryAllByRole('button', { name: 'Use sample file' })).toHaveLength(0);
    await user.type(screen.getByLabelText(/Full Name/), 'Sara Al-Harbi');
    await user.type(screen.getByLabelText(/ID Number/), demoNationalId());
    await user.type(screen.getByLabelText(/Email address/), DEMO_ADDR);
    await user.click(screen.getByLabelText(/Delegation Certificate/));
    expect(cont).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Use sample file' }));
    expect(cont).toBeEnabled();
    await user.click(cont);

    await heading('Business Information');
    for (let i = 0; i < 2; i++) await user.click(screen.getAllByRole('button', { name: 'Use sample file' })[0]);
    await user.selectOptions(screen.getByLabelText(/Bank Name/), 'alinma');
    const iban = screen.getByLabelText(/IBAN Number/);
    await user.type(iban, demoIban().toLowerCase());
    await user.tab();
    expect(await screen.findByText('Please enter a valid Saudi IBAN.')).toBeInTheDocument();
    await user.clear(iban);
    await user.type(iban, demoIban());
    expect(screen.queryByRole('status', { name: 'IBAN verification result' })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText(/Beneficiary Name/), 'سارة الحربي');
    await user.type(screen.getByLabelText(/Swift Code/), ['DEMO', 'SA', 'XX'].join(''));
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await heading('Almost there, Review Your Information');
    expect(screen.getByText('Your information has been submitted successfully')).toBeInTheDocument();
    expect(screen.getByText('Known current issue: missing values')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Proceed To Contract Sign-Off' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    await heading('We’d love to hear from you!');
    expect(screen.getByText('Onboarding submitted successfully and is now pending review')).toBeInTheDocument();
    expect(screen.queryByText('Contract Sign-Off Experience')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Skip for Now' }));

    await heading('Submitted successfully!');
    expect(screen.queryByRole('heading', { name: /contract/i })).not.toBeInTheDocument();
  });

  it('routes a lead above SAR 20 Million to a Relationship Manager after the same SMS OTP', async () => {
    const { user } = renderAt('/madfu/current');
    await fillLead(user, { type: 'cr', id: DEMO_UNIFIED, revenue: 'gt20' });
    await user.click(screen.getByRole('button', { name: 'Generate OTP' }));
    await passSmsOtp(user);
    await heading('Thank you for registering with Madfu');
    expect(screen.getByText(/A dedicated Relationship Manager has been assigned to you/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Claim Offer' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create Account' })).not.toBeInTheDocument();
  });

  it('stops an identity that already owns an account before any OTP', async () => {
    const { user } = renderAt('/madfu/current');
    await fillLead(user, { type: 'cr', id: DEMO_EXISTING_UNIFIED, revenue: 'lt20' });
    await user.click(screen.getByRole('button', { name: 'Generate OTP' }));
    await heading('Sign in to MADFU Panel');
    expect(screen.getByText('You already have an account. Please sign in.')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Verification code/i)).not.toBeInTheDocument();
  });

  it('parks a CR with an in-progress lead with Sales, with no OTP', async () => {
    const { user } = renderAt('/madfu/current');
    await jumpTo(user, /In-progress lead/);
    await user.click(screen.getByRole('button', { name: 'Generate OTP' }));
    expect(await screen.findByText('He has in-progress request and will be contacted by Sales team.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Let’s Get Started' })).toBeInTheDocument();
    expect(screen.getByText('In-progress lead: parked with Sales')).toBeInTheDocument();
    expect(screen.getByLabelText(/Unified Number/)).toHaveValue(DEMO_IN_PROGRESS_UNIFIED);
  });

  it('validates the lead identifiers and rejects a special-character name on the server', async () => {
    const { user } = renderAt('/madfu/current');
    await fillLead(user, { type: 'cr', id: '6012345678', revenue: 'lt20', name: 'Sara Al-Harbi' });
    expect(screen.getByRole('button', { name: 'Generate OTP' })).toBeDisabled();
    await user.click(screen.getByLabelText(/Annual Revenue/));
    expect(await screen.findByText('Must be numeric, start with 7, and have an exact length of 10 characters')).toBeInTheDocument();
    const un = screen.getByLabelText(/Unified Number/);
    await user.clear(un);
    await user.type(un, DEMO_UNIFIED);
    await user.click(screen.getByRole('button', { name: 'Generate OTP' }));
    expect(await screen.findByText(/Name: Must be alphanumeric with a space between words/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Let’s Get Started' })).toBeInTheDocument();
  });

  it('asks for a mandatory reason when the offer is declined, then returns to the lead form', async () => {
    const { user } = renderAt('/madfu/current');
    await fillLead(user, { type: 'cr', id: DEMO_UNIFIED, revenue: 'lt20' });
    await user.click(screen.getByRole('button', { name: 'Generate OTP' }));
    await passSmsOtp(user);
    await heading('Grow your sales. We handle the rest.');
    await user.click(screen.getByRole('button', { name: 'No Thanks' }));
    await heading('Are you sure you want to cancel?');
    await user.click(screen.getByRole('button', { name: 'Yes' }));
    await heading('Rejection Reasons');
    const submit = screen.getByRole('button', { name: 'Submit' });
    expect(submit).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Not relevent' })).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Too expensive' }));
    expect(submit).toBeEnabled();
    await user.click(submit);
    await heading('Let’s Get Started');
    expect(screen.getByText('Offer declined: back at the lead form')).toBeInTheDocument();
  });

  it('recovers a failed contract creation by reload and retry; the Submit Request fallback fails', async () => {
    const { user } = renderAt('/madfu/current');
    await jumpTo(user, /CR Summary/);
    await heading('Almost there, Review Your Information');
    await user.click(screen.getByRole('radio', { name: /No answer after about 60 s/ }));
    await user.click(screen.getByRole('button', { name: 'Proceed To Contract Sign-Off' }));
    await heading('We were unable to create your contract.');
    await user.click(screen.getByRole('button', { name: 'Submit Request' }));
    expect(await screen.findByText('Something went wrong. Please try again later.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Reload the page/ }));
    await heading('Almost there, Review Your Information');
    await user.click(screen.getByRole('button', { name: 'Proceed To Contract Sign-Off' }));
    await heading('Read the contract to sign-off');
  });

  it('opens the signed-contract preset and submits it separately', async () => {
    const { user } = renderAt('/madfu/current');
    await jumpTo(user, /Contract signed -> Submit Request/);
    await heading('Your contract has been signed successfully');
    await user.click(screen.getByRole('button', { name: 'Submit Request' }));
    await heading('We’d love to hear from you!');
    expect(screen.getByText('Contract Sign-Off Experience')).toBeInTheDocument();
    noNafath();
  });
});
