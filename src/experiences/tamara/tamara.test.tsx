import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderAt } from '@/test/render';
import {
  CANCELLED_ID_SUFFIX,
  DEMO_APPLICATION_ID,
  DEMO_COMPANY,
  DEMO_EMAIL,
  DEMO_SMS_CODE,
  DEMO_TAKEN_EMAIL,
  MISMATCH_IBAN_SUFFIX,
  REGISTERED_SUFFIX,
  UNFINISHED_SUFFIX,
  demoIban,
  demoMobile,
  demoSwift,
  demoUnifiedNumber
} from './demo';
import { tamaraExperience } from './flow';
import { tamaraComparison } from './comparison';

type User = ReturnType<typeof renderAt>['user'];

const h1 = (name: string | RegExp) => screen.findByRole('heading', { level: 1, name });
const btn = (name: string | RegExp) => screen.getByRole('button', { name });
const labStrip = () => screen.getByLabelText('Lab controls for this experience');

async function signUp(user: User, type: 'Registered Business' | 'Freelancer', phone: string) {
  await h1('Fuel your business growth now with Tamara');
  await user.selectOptions(screen.getByRole('combobox', { name: /select your business type/i }), type);
  expect(btn('Continue')).toBeDisabled();
  await user.type(screen.getByRole('textbox', { name: /phone number/i }), phone);
  expect(btn('Continue')).toBeEnabled();
  await user.click(btn('Continue'));
  const dialog = await screen.findByRole('dialog', { name: 'Before You Proceed' });
  expect(within(dialog).getByText(/not for customers, personal use or financing/i)).toBeInTheDocument();
  await user.click(within(dialog).getByRole('button', { name: 'Proceed as a business' }));
}

async function setPassword(user: User) {
  await h1('Set up your password');
  await user.type(screen.getByLabelText(/^password/i), 'demo-pass-1');
  await user.type(screen.getByLabelText(/confirm password/i), 'demo-pass-1');
  await user.click(btn('Continue'));
}

async function contact(user: User, band: 'Below SAR 20 million' | 'Above SAR 20 million', email = DEMO_EMAIL) {
  await h1('Get your business set up with Tamara');
  await user.type(screen.getByRole('textbox', { name: /business name/i }), DEMO_COMPANY);
  await user.type(screen.getByRole('textbox', { name: /^email/i }), email);
  await user.selectOptions(screen.getByRole('combobox', { name: /estimated total yearly sales/i }), band);
  await user.click(btn('Continue'));
}

async function jump(user: User, item: RegExp) {
  await h1('Fuel your business growth now with Tamara');
  await user.click(btn('Jump to branch'));
  await user.click(screen.getByRole('menuitem', { name: item }));
}

describe('Tamara experience', () => {
  it('new CR (below SAR 20M): set password with no code, contact, Lean verify, signatory, SMS, Nafath approved (simulated) and onward', async () => {
    const { user } = renderAt('/tamara');
    await signUp(user, 'Registered Business', demoMobile('345'));

    // No SMS code at entry for a new mobile (TAM-RULE-000071).
    await h1('Set up your password');
    expect(screen.queryByLabelText(/verification code/i)).not.toBeInTheDocument();
    await setPassword(user);

    await contact(user, 'Below SAR 20 million');
    await h1('Business verification');
    expect(screen.getByRole('radio', { name: 'Registered Business' })).toBeChecked();
    expect(screen.queryByRole('combobox', { name: /annual gmv/i })).not.toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: /unified national number/i }), demoUnifiedNumber('345'));
    await user.selectOptions(screen.getByRole('combobox', { name: /business category/i }), 'personal-professional');
    await user.selectOptions(screen.getByRole('combobox', { name: /business subcategory/i }), 'Legal Services');
    await user.click(btn('Verify'));

    await h1(`Who is the legal signatory of ${DEMO_COMPANY}?`);
    await user.click(screen.getByRole('radio', { name: /Faisal/ }));
    await user.click(btn('Verify'));

    const sms = await screen.findByRole('dialog', { name: 'Mobile verification' });
    await user.type(within(sms).getByLabelText(/verification code/i), '12');
    await user.click(within(sms).getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('OTP must be 6 digits')).toBeInTheDocument();
    expect(within(sms).getByRole('button', { name: 'Change number' })).toBeDisabled();
    await user.clear(within(sms).getByLabelText(/verification code/i));
    await user.type(within(sms).getByLabelText(/verification code/i), DEMO_SMS_CODE);
    await user.click(within(sms).getByRole('button', { name: 'Continue' }));

    await h1('Verify with Nafath');
    expect(screen.getByLabelText('Nafath number 47')).toBeInTheDocument();
    await user.click(btn('Simulate: approved (not captured)'));

    await h1('Bank details');
    expect(screen.getByLabelText('Lab note: Not captured on a new application')).toBeInTheDocument();
    expect(btn('Continue')).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: /^iban/i }), demoIban('1234'));
    await user.type(screen.getByRole('textbox', { name: /swift code/i }), demoSwift());
    await user.click(btn('Verify account'));
    await screen.findByText(/account verified/i);
    expect(screen.getByRole('textbox', { name: /beneficiary name/i })).toHaveAttribute('readonly');
    await user.click(btn('Use sample file'));
    await user.click(btn('Continue'));

    await h1('Business channel');
    expect(within(labStrip()).getByText('Inferred')).toBeInTheDocument();
    expect(screen.getByLabelText('Lab note: Not captured: reconstructed from the application payload')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Online' }));
    await user.click(btn('Continue'));

    await h1('Additional information');
    expect(within(labStrip()).getByText('Inferred')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Yes' }));
    await user.type(screen.getByRole('textbox', { name: /vat number/i }), '3'.repeat(15));
    await user.click(btn('Continue'));

    await h1('KYC documents');
    expect(within(labStrip()).getByText('Documented')).toBeInTheDocument();
    for (let i = 0; i < 4; i++) await user.click(screen.getAllByRole('button', { name: 'Use sample file' })[0]);
    await user.click(btn('Continue'));

    await h1('Review and submit');
    expect(within(labStrip()).getByText('Unknown')).toBeInTheDocument();
    await user.click(btn('Submit application'));
    await h1('Verifying KYC');
    expect(screen.getByText(DEMO_APPLICATION_ID)).toBeInTheDocument();
  });

  it('locks the contact step after Continue and refuses a reused email', async () => {
    const { user } = renderAt('/tamara');
    await signUp(user, 'Registered Business', demoMobile('345'));
    await setPassword(user);
    await contact(user, 'Below SAR 20 million', DEMO_TAKEN_EMAIL);
    expect(await screen.findByText('This email is already registered. Try signing in instead.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Get your business set up with Tamara' })).toBeInTheDocument();

    const email = screen.getByRole('textbox', { name: /^email/i });
    await user.clear(email);
    await user.type(email, DEMO_EMAIL);
    await user.click(btn('Continue'));
    await h1('Business verification');
    await user.click(btn('Back'));
    await h1('Get your business set up with Tamara');
    expect(screen.getByRole('textbox', { name: /business name/i })).toHaveAttribute('readonly');
    expect(screen.getByRole('combobox', { name: /estimated total yearly sales/i })).toBeDisabled();
    expect(screen.getByText(DEMO_APPLICATION_ID)).toBeInTheDocument();
  });

  it('refuses a cancelled CR and counts the attempt (Verify 2 / 3)', async () => {
    const { user } = renderAt('/tamara');
    await jump(user, /new cr at business verification/i);
    await h1('Business verification');
    expect(btn('Continue')).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: /unified national number/i }), demoUnifiedNumber(CANCELLED_ID_SUFFIX));
    await user.selectOptions(screen.getByRole('combobox', { name: /business category/i }), 'Insurance');
    await user.click(btn('Verify'));
    expect(await screen.findByText('Your commercial registration has been cancelled.')).toBeInTheDocument();
    expect(btn('Verify 2 / 3')).toBeEnabled();
    expect(screen.getByRole('heading', { level: 1, name: 'Business verification' })).toBeInTheDocument();
  });

  it('Nafath not approved: "Nafath verification has rejected" with Try again, and no way on to bank details', async () => {
    const { user } = renderAt('/tamara');
    await jump(user, /signatory \+ nafath/i);
    await h1(`Who is the legal signatory of ${DEMO_COMPANY}?`);
    await user.click(screen.getByRole('radio', { name: /Noura/ }));
    await user.click(btn('Verify'));
    const sms = await screen.findByRole('dialog', { name: 'Mobile verification' });
    await user.type(within(sms).getByLabelText(/verification code/i), DEMO_SMS_CODE);
    await user.click(within(sms).getByRole('button', { name: 'Continue' }));
    await h1('Verify with Nafath');
    await user.click(btn('Simulate: not approved (observed)'));

    const rejected = await screen.findByRole('dialog', { name: 'Nafath verification has rejected' });
    expect(within(rejected).getByText('We were unable to verify your info with Nafath')).toBeInTheDocument();
    expect(within(labStrip()).getByText('Observed')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: 'Bank details' })).not.toBeInTheDocument();
    await user.click(within(rejected).getByRole('button', { name: 'Try again' }));
    await h1('Verify with Nafath');
    await user.click(btn('Simulate: not approved (observed)'));
    const again = await screen.findByRole('dialog', { name: 'Nafath verification has rejected' });
    await user.click(within(again).getByRole('button', { name: 'Try again' }));
    await h1('Verify with Nafath');
    await user.click(btn('Simulate: not approved (observed)'));
    const last = await screen.findByRole('dialog', { name: 'Nafath verification has rejected' });
    expect(within(last).getByRole('button', { name: 'Try again' })).toBeDisabled();
    expect(screen.getByLabelText('Lab note: No attempts left (simulated)')).toBeInTheDocument();
  });

  it('above SAR 20M: schedule a call, then "Application Submitted Successfully", with no verification, signatory, Nafath or bank step', async () => {
    const { user } = renderAt('/tamara');
    await signUp(user, 'Registered Business', demoMobile('678'));
    await setPassword(user);
    await contact(user, 'Above SAR 20 million');

    await h1('Schedule a call to complete your setup');
    expect(screen.getByRole('textbox', { name: /business name/i })).toHaveValue(DEMO_COMPANY);
    expect(screen.getByRole('textbox', { name: /business name/i })).toHaveAttribute('readonly');
    expect(screen.getByRole('radio', { name: /Morning/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Afternoon/ })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /unified national number/i })).not.toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: /website url/i }), 'https://shop.example.com');
    await user.click(screen.getByRole('radio', { name: /Evening/ }));
    await user.click(btn('Continue'));

    await h1('Application Submitted Successfully');
    expect(screen.getByText('Our team will review your application and get back to you in 24 hours.')).toBeInTheDocument();
    expect(within(labStrip()).getByText('Observed')).toBeInTheDocument();
    for (const name of ['Business verification', /legal signatory/i, 'Verify with Nafath', 'Bank details']) {
      expect(screen.queryByRole('heading', { level: 1, name })).not.toBeInTheDocument();
    }
  });

  it('blocks a mobile that already owns a merchant account, before any code', async () => {
    const { user } = renderAt('/tamara');
    await signUp(user, 'Freelancer', demoMobile(REGISTERED_SUFFIX));
    expect(await screen.findByText('This phone number is already registered. Try signing in instead.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /sign in/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/verification code/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: 'Set up your password' })).not.toBeInTheDocument();
  });

  it('resumes an unfinished application by password recovery (two rejected codes) and lands on the saved, reopened step', async () => {
    const { user } = renderAt('/tamara');
    await signUp(user, 'Registered Business', demoMobile(UNFINISHED_SUFFIX));
    await h1('Enter your password');
    await user.click(btn('Forgot password'));
    await h1('Mobile verification');
    expect(screen.getByText(/if the account information you entered matches/i)).toBeInTheDocument();

    for (let i = 0; i < 2; i++) {
      await user.type(screen.getByLabelText(/verification code/i), DEMO_SMS_CODE);
      await user.click(btn('Continue'));
      expect(await screen.findByText('Verification code not found. Please request a new one.')).toBeInTheDocument();
    }
    await user.type(screen.getByLabelText(/verification code/i), DEMO_SMS_CODE);
    await user.click(btn('Continue'));
    await setPassword(user);
    await h1('Business verification');
    expect(screen.getByText('Reopened by review')).toBeInTheDocument();
  });

  it('resumes straight to the saved step with a password (no code)', async () => {
    const { user } = renderAt('/tamara');
    await signUp(user, 'Registered Business', demoMobile(UNFINISHED_SUFFIX));
    await h1('Enter your password');
    await user.type(screen.getByLabelText(/^password/i), 'demo-pass-1');
    await user.click(btn('Continue'));
    await h1('Business verification');
    expect(screen.getAllByText('G-maps link has no images').length).toBeGreaterThan(0);
  });

  it('reopen: only the flagged field is editable and Continue waits for an edit; signatory passed by reuse; bank step deadlocks', async () => {
    const { user } = renderAt('/tamara');
    await jump(user, /reopened application/i);
    await h1('Business verification');
    expect(screen.getAllByText('G-maps link has no images').length).toBeGreaterThan(0);
    expect(screen.getByRole('textbox', { name: 'Category' })).toHaveAttribute('readonly');
    expect(screen.getByRole('textbox', { name: 'Business type' })).toHaveAttribute('readonly');
    expect(btn('Continue')).toBeDisabled();
    const unn = screen.getByRole('textbox', { name: 'Unified National Number' });
    const value = (unn as HTMLInputElement).value;
    await user.clear(unn);
    await user.type(unn, value);
    expect(btn('Continue')).toBeEnabled();
    await user.click(btn('Continue'));

    await h1('Bank details');
    expect(screen.getByLabelText('Lab note: Legal signatory passed in between')).toBeInTheDocument();
    expect(btn('Continue')).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: 'IBAN' }), '1');
    await user.click(btn('Verify account'));
    expect(await screen.findByText('The IBAN flag is back')).toBeInTheDocument();
    expect(btn('Continue')).toBeDisabled();
  });

  it('Freelancer: Step 1 observed, everything after it labelled as not walked', async () => {
    const { user } = renderAt('/tamara');
    await jump(user, /freelancer at step 1/i);
    await h1('Fuel your business growth now with Tamara');
    expect(screen.getByRole('combobox', { name: /select your business type/i })).toHaveValue('freelancer');
    expect(within(labStrip()).getByText('Observed')).toBeInTheDocument();
    await user.click(btn('Continue'));
    const dialog = await screen.findByRole('dialog', { name: 'Before You Proceed' });
    await user.click(within(dialog).getByRole('button', { name: 'Proceed as a business' }));

    await h1('Set up your password');
    expect(screen.getByLabelText('Lab note: Freelancer: not walked past Step 1')).toBeInTheDocument();
    await setPassword(user);
    await contact(user, 'Below SAR 20 million');
    await h1('Business verification');
    expect(screen.getByLabelText('Lab note: Freelancer: not walked past Step 1')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Freelancer' })).toBeChecked();
    expect(screen.getByRole('textbox', { name: /national id/i })).toHaveAttribute('readonly');
    expect(screen.getAllByText('Inferred').length).toBeGreaterThan(0);

    await user.type(screen.getByRole('textbox', { name: /freelancer certificate number/i }), '987654321');
    await user.click(btn('Verify 1 / 3'));
    await screen.findByText(/freelancer certificate verified \(simulated\)/i);
    await user.click(btn('Continue'));
    await h1('Freelancer: next section');
    expect(within(labStrip()).getByText('Unknown')).toBeInTheDocument();
  });

  it('shows the bank mismatch message (preset)', async () => {
    const { user } = renderAt('/tamara');
    await jump(user, /bank verification mismatch/i);
    await h1('Bank details');
    expect(screen.getByRole('textbox', { name: /^iban/i })).toHaveValue(demoIban(MISMATCH_IBAN_SUFFIX));
    await user.click(btn('Verify account'));
    expect(await screen.findByText('The bank details provided do not match the business number.')).toBeInTheDocument();
    expect(btn('Continue')).toBeDisabled();
  });

  it('structure: evidence on every screen, real record IDs, no image field, valid presets', () => {
    const ids = new Set(tamaraExperience.screens.map((s) => s.id));
    for (const s of tamaraExperience.screens) {
      expect(s.evidence?.length, s.id).toBeGreaterThan(0);
      expect(s.statusNote, s.id).toBeTruthy();
      for (const e of s.evidence ?? []) {
        expect(e.id).toMatch(/^TAM-(RULE|STATE|EVID|NET|JOURNEY|PAGE)-\d{6}$/);
        expect(Object.keys(e)).not.toContain('image');
        if (e.kind === 'screenshot') expect(e.localOnly, e.id).toBe(true);
        expect(e.date, e.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(e.env, e.id).toBeTruthy();
      }
    }
    // The audit: the TAM-STATE-000027 / TAM-EVID-000098 capture shows the Registered form and must not back any screen.
    const all = tamaraExperience.screens.flatMap((s) => (s.evidence ?? []).map((e) => e.id));
    expect(all).not.toContain('TAM-STATE-000027');
    expect(all).not.toContain('TAM-EVID-000098');
    expect(JSON.stringify(tamaraExperience.screens.map((s) => s.evidence))).not.toMatch(/"image"/);

    for (const p of tamaraExperience.presets ?? []) expect(ids.has(p.screen), p.id).toBe(true);
    expect(tamaraExperience.presets?.length).toBeGreaterThanOrEqual(9);
    expect(ids.has('otp')).toBe(false);
    expect(tamaraComparison.experienceId).toBe('tamara');
  });
});
