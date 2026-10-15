import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderAt } from '@/test/render';
import { tabbyExperience } from './flow';
import { tabbyComparison } from './comparison';
import { demoEmailCode, demoIban, demoNationalId, demoSmsCode } from './data';

type User = ReturnType<typeof renderAt>['user'];

// Synthetic demo values, assembled at runtime.
const DEMO_EMAIL_CODE = demoEmailCode();
const DEMO_SMS_CODE = demoSmsCode();
const demoPhone = () => ['5', '9876', '5432'].join('');

const cont = () => screen.getByRole('button', { name: 'Continue' });
const submit = () => screen.getByRole('button', { name: 'Submit' });
const heading = (name: string | RegExp) => screen.findByRole('heading', { level: 1, name });
const currentScreen = () => document.querySelector('[data-screen]')?.getAttribute('data-screen');

async function signUpToBasics(user: User, email = 'ops@example.com') {
  await heading('Choose your region');
  await user.click(cont());

  await heading('Sign up or log in');
  expect(cont()).toBeDisabled();
  await user.type(screen.getByLabelText(/^email/i), email);
  await screen.findByText('Success!');
  await user.click(cont());

  await heading('Enter the verification code');
  expect(screen.getByText(/6-digit code/)).toBeInTheDocument();
  await user.type(screen.getByLabelText(/^code/i), DEMO_EMAIL_CODE);
  await user.click(cont());

  await heading('Link phone number to your account');
  await user.type(screen.getByLabelText(/phone number/i), demoPhone());
  await user.click(cont());

  await heading('Enter the verification code');
  expect(screen.getByText(/4-digit code/)).toBeInTheDocument();
  await user.type(screen.getByLabelText(/^code/i), DEMO_SMS_CODE);
  await user.click(cont());

  await heading('No business account found in the KSA');
  await user.click(screen.getByRole('button', { name: 'Create a new KSA account' }));
  await heading("Let's start with the basics");
}

async function fillBasics(user: User, revenue: string) {
  await user.type(screen.getByLabelText(/first name/i), 'Noura');
  await user.type(screen.getByLabelText(/last name/i), 'Al-Harbi');
  await user.type(screen.getByLabelText(/business name/i), 'Rimal Home');
  await user.selectOptions(screen.getByLabelText(/annual sales revenue/i), revenue);
  await user.click(cont());
}

async function chooseLicenceAndCategory(user: User, licence: RegExp) {
  await heading('How is your business registered?');
  await user.click(screen.getByRole('radio', { name: licence }));
  await user.click(cont());
  await heading('What do you sell?');
  await user.selectOptions(screen.getByLabelText(/^category/i), 'other');
  await user.selectOptions(screen.getByLabelText(/sub-category/i), 'other:Services');
  await user.click(cont());
  await heading('Where do you sell?');
}

async function jumpTo(user: User, label: RegExp) {
  await screen.findByRole('heading', { level: 1 });
  await user.click(screen.getByRole('button', { name: 'Jump to branch' }));
  await user.click(screen.getByRole('menuitem', { name: label }));
}

describe('Tabby experience', () => {
  it('has unique screen ids, valid targets and evidence on every screen, with no published images', () => {
    const ids = tabbyExperience.screens.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of tabbyExperience.presets ?? []) expect(ids).toContain(p.screen);
    for (const s of tabbyExperience.screens) {
      expect((s.evidence ?? []).length).toBeGreaterThan(0);
      expect(s.statusNote ?? '').not.toBe('');
    }
    const all = tabbyExperience.screens.flatMap((s) => s.evidence ?? []);
    // Screenshots are never published: no evidence object carries an image key.
    expect(all.every((e) => !Object.prototype.hasOwnProperty.call(e, 'image'))).toBe(true);
    const shots = all.filter((e) => e.kind === 'screenshot');
    expect(shots.length).toBeGreaterThan(0);
    expect(shots.every((e) => e.localOnly === true && !!e.date && !!e.env)).toBe(true);
    // Every record ID is a real Tabby repository ID.
    expect(all.every((e) => /^TAB-(STATE|RULE|EVID|PAGE|JOURNEY|NET)-\d{6}$/.test(e.id))).toBe(true);
    // The superseded code-only sales-led rule is no longer cited.
    expect(all.some((e) => e.id === 'TAB-RULE-000042')).toBe(false);
    expect(tabbyComparison.experienceId).toBe('tabby');
  });

  it('labels the Commercial licence success screen INFERRED and points at the Freelancer capture', () => {
    const cr = tabbyExperience.screens.find((s) => s.id === 'submitted-cr')!;
    const fl = tabbyExperience.screens.find((s) => s.id === 'submitted')!;
    const highOutcome = tabbyExperience.screens.find((s) => s.id === 'reach-out')!;
    expect(cr.status).toBe('INFERRED');
    expect(cr.statusNote).toMatch(/Freelancer path/);
    expect(cr.evidence?.find((e) => e.id === 'TAB-STATE-000051')?.description).toMatch(/Freelancer path/);
    expect(fl.status).toBe('OBSERVED');
    expect(highOutcome.status).toBe('OBSERVED');
  });

  it('walks the Commercial licence route below SAR 20m to the shared "We\'re reviewing" outcome', async () => {
    const { user } = renderAt('/tabby');
    await signUpToBasics(user);

    // Business email: four revenue bands.
    const revenue = screen.getByLabelText(/annual sales revenue/i);
    expect(within(revenue).getAllByRole('option')).toHaveLength(5);
    await fillBasics(user, 'less_than_1m');

    await chooseLicenceAndCategory(user, /commercial licence/i);
    expect(screen.queryByRole('button', { name: 'Submit' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /online/i }));
    await user.type(screen.getByLabelText(/website or social media/i), 'rimal.example.com');
    await user.click(cont());
    expect(await screen.findByText("Please enter a valid website link starting with 'https://'")).toBeInTheDocument();
    await user.clear(screen.getByLabelText(/website or social media/i));
    await user.type(screen.getByLabelText(/website or social media/i), 'https://rimal.example.com');
    await user.click(cont());

    await heading('Legal details');
    await user.type(screen.getByLabelText(/^unified number/i), '7001000001');
    await user.tab();
    const legalName = await screen.findByLabelText(/legal name of business/i);
    expect(legalName).toHaveValue('Rimal Home Supplies Co.');
    expect(legalName).toHaveAttribute('readonly');
    expect(screen.getByLabelText(/legal address/i)).toHaveAttribute('readonly');
    await user.click(cont());

    await heading('Bank details');
    expect(screen.getByText(/must be your business bank account/i)).toBeInTheDocument();
    expect(screen.queryByText(/english iban certificate/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/payout report email/i)).toHaveValue('ops@example.com');
    expect(screen.getByText('SAR')).toBeInTheDocument();
    await user.type(screen.getByLabelText(/^iban/i), demoIban());
    expect(await screen.findByLabelText(/bank name/i)).toHaveAttribute('readonly');
    await user.type(screen.getByLabelText(/beneficiary name/i), 'Rimal Home Supplies Co.');
    await user.click(cont());

    await heading('Review application');
    await user.click(submit());
    expect(await screen.findByText('This field is required')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /authority to submit/i }));
    await user.click(submit());
    await heading("We're reviewing your application");
    expect(screen.getByText('This usually takes around two business days')).toBeInTheDocument();
    expect(currentScreen()).toBe('submitted-cr');
    expect(screen.getByText('Commercial licence success not observed')).toBeInTheDocument();
  });

  it('shows the generic error for an invalid or expired unified number and the client error for a non-7 value', async () => {
    const { user } = renderAt('/tabby');
    await jumpTo(user, /< SAR 5m, at legal details/i);
    await heading('Legal details');

    const un = screen.getByLabelText(/^unified number/i);
    await user.type(un, '4012345678');
    await user.tab();
    expect(await screen.findByText('Enter a unified number instead of a commercial registration number')).toBeInTheDocument();

    await user.clear(un);
    await user.type(un, '7009999991');
    await user.tab();
    expect(await screen.findByText('Please enter valid unified number')).toBeInTheDocument();
    expect(screen.queryByLabelText(/legal name of business/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/legal address/i)).not.toBeInTheDocument();

    await user.clear(un);
    await user.type(un, '7123');
    await user.tab();
    expect(await screen.findByText('Please enter valid unified number')).toBeInTheDocument();

    // Valid but no address returned: address becomes editable.
    await user.clear(un);
    await user.type(un, '7001000002');
    await user.tab();
    expect(await screen.findByLabelText(/legal name of business/i)).toHaveValue('Najd Craft Coffee Co.');
    expect(screen.getByLabelText(/legal address/i)).not.toHaveAttribute('readonly');
  });

  it.each([
    ['SAR 20m to SAR 100m', 'from_5m_to_15m'],
    ['Above SAR 100m', 'above_15m']
  ])('ends a Commercial licence application at %s at store type with Submit (sales-led)', async (_label, band) => {
    const { user } = renderAt('/tabby');
    await signUpToBasics(user, 'ops@big-retail.example.com');
    await fillBasics(user, band);
    await chooseLicenceAndCategory(user, /commercial licence/i);

    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
    expect(screen.getByText(/this is the last step/i)).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /online/i }));
    await user.type(screen.getByLabelText(/website or social media/i), 'https://big-retail.example.com');
    await user.click(submit());

    await heading("We'll reach out to continue");
    expect(screen.getByText(/contact you by phone or email in the next 2 business days/i)).toBeInTheDocument();
    expect(currentScreen()).toBe('reach-out');
    expect(screen.queryByRole('heading', { level: 1, name: 'Legal details' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: 'Bank details' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/unified number/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^iban/i)).not.toBeInTheDocument();
  });

  it('offers both SAR 20m-and-above presets at store type with Submit', async () => {
    const { user } = renderAt('/tabby');
    await jumpTo(user, /SAR 20m-100m, sales-led/i);
    await heading('Where do you sell?');
    expect(submit()).toBeInTheDocument();
    await jumpTo(user, /Above SAR 100m, sales-led/i);
    await heading('Where do you sell?');
    await user.click(submit());
    await heading("We'll reach out to continue");
  });

  it('keeps a SAR 5m-20m Commercial licence on the full form (Continue to legal details)', async () => {
    const { user } = renderAt('/tabby');
    await jumpTo(user, /SAR 5m-20m, at store type/i);
    await heading('Where do you sell?');
    expect(screen.queryByRole('button', { name: 'Submit' })).not.toBeInTheDocument();
    await user.click(cont());
    await heading('Legal details');
    expect(screen.getByLabelText(/^unified number/i)).toBeInTheDocument();
  });

  it('walks a Freelancer from sign-up to "We\'re reviewing your application"', async () => {
    const { user } = renderAt('/tabby');
    await signUpToBasics(user, 'studio@example.com');
    await fillBasics(user, 'less_than_1m');
    await chooseLicenceAndCategory(user, /freelance or productive family certificate/i);
    expect(screen.queryByRole('checkbox', { name: /in-store/i })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText(/website or social media/i), 'https://studio.example.com');
    await user.click(cont());

    await heading('Legal details');
    expect(screen.queryByRole('switch', { name: /reclaim your vat/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/unified number/i)).not.toBeInTheDocument();
    expect(screen.getByText(/proof of national address certificate/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/freelance certificate number/i), '400100200');
    await user.click(screen.getAllByRole('button', { name: 'Use sample file' })[0]);
    await user.click(screen.getAllByRole('button', { name: 'Use sample file' })[0]);
    await user.type(screen.getByLabelText(/national id number/i), demoNationalId());
    await user.type(screen.getByLabelText(/^national address/i), 'Unit 4, Demo Street, Jeddah');
    await user.click(cont());

    await heading('Bank details');
    expect(screen.getByText(/or if you don't have one, your personal bank account/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/payout report email/i)).not.toBeInTheDocument();
    await user.type(screen.getByLabelText(/^iban/i), demoIban());
    await screen.findByLabelText(/bank name/i);
    await user.type(screen.getByLabelText(/beneficiary name/i), 'Faisal Demo');
    await user.click(cont());
    expect(await screen.findByText('This field is required')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Use sample file' }));
    await user.click(cont());

    await heading('Review application');
    expect(screen.queryByText(/Lab control/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /authority to submit/i }));
    await user.click(submit());
    await heading("We're reviewing your application");
    expect(currentScreen()).toBe('submitted');
    expect(screen.getByText('Created at submission')).toBeInTheDocument();
  });

  it('offers only two revenue bands to a free e-mail account (inferred)', async () => {
    const { user } = renderAt('/tabby');
    await signUpToBasics(user, ['layla', 'gmail.com'].join('@'));
    const revenue = screen.getByLabelText(/annual sales revenue/i);
    const labels = within(revenue).getAllByRole('option').map((o) => o.textContent);
    expect(labels).toEqual(['Select', 'Less than SAR 5m (inferred)', 'Above SAR 5m (inferred)']);
  });

  it('refuses a duplicate Commercial licence application at Submit with 409', async () => {
    const { user } = renderAt('/tabby');
    await jumpTo(user, /duplicate 409/i);
    await heading('Review application');
    await user.click(screen.getByRole('checkbox', { name: /authority to submit/i }));
    await user.click(submit());
    expect(await screen.findByText('Legal and bank details already in use')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Review application' })).toBeInTheDocument();
    expect(currentScreen()).toBe('result');
  });

  it('puts a reviewed application back on the short path when the revenue is edited to SAR 20m or more', async () => {
    const { user } = renderAt('/tabby');
    await jumpTo(user, /duplicate 409/i);
    await heading('Review application');
    const basics = screen.getByText('Basic details').closest('section, div')!;
    await user.click(within(basics as HTMLElement).getByRole('button', { name: 'Edit' }));
    await heading("Let's start with the basics");
    await user.selectOptions(screen.getByLabelText(/annual sales revenue/i), 'from_5m_to_15m');
    await user.click(cont());
    await heading('How is your business registered?');
    await user.click(cont());
    await heading('What do you sell?');
    await user.click(cont());
    await heading('Where do you sell?');
    expect(submit()).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
  });
});
