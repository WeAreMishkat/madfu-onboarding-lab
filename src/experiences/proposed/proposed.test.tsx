import { describe, expect, it } from 'vitest';
import { act, fireEvent, screen, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { renderAt } from '@/test/render';
import { DEMO, DEMO_SMS_CODE, demoIban } from './model/mock';
import { OUTCOME_COPY } from './model/copy';

async function open(path = '/madfu/proposed') {
  const r = renderAt(path);
  await screen.findByRole('heading', { name: 'Start your Madfu application' });
  return r;
}

async function fillEntry(user: UserEvent, type: 'CR' | 'FL', revenue: RegExp, mobile = DEMO.mobile) {
  await user.click(screen.getByRole('radio', { name: type === 'CR' ? /Registered Business/ : /Freelancer/ }));
  await user.type(screen.getByLabelText(type === 'CR' ? 'Commercial Registration Number' : 'National ID Number'), type === 'CR' ? DEMO.cr : DEMO.nationalId);
  await user.click(screen.getByRole('radio', { name: revenue }));
  await user.type(screen.getByLabelText('Mobile number'), mobile);
  await user.click(screen.getByRole('button', { name: 'Next' }));
}

async function code(user: UserEvent, value = DEMO_SMS_CODE) {
  await screen.findByRole('heading', { name: 'Verify your mobile number' });
  await user.type(screen.getByLabelText('Verification code'), value);
}

async function category(user: UserEvent, group: string, sub: string) {
  await screen.findByRole('heading', { name: 'What does your business sell?' });
  await user.selectOptions(screen.getByLabelText('Business category'), group);
  await user.selectOptions(screen.getByLabelText('Business subcategory'), sub);
  await user.click(screen.getByRole('button', { name: 'Next' }));
}

async function businessDetails(user: UserEvent, iban: string, vat: 'Yes' | 'No') {
  await screen.findByRole('heading', { name: 'Business details' });
  expect(screen.queryByText(/SWIFT|Beneficiary|IBAN certificate|Source of|Proof of sales/i)).toBeNull();
  await user.type(screen.getByLabelText('IBAN'), iban);
  await user.click(screen.getByRole('button', { name: 'Verify' }));
  await screen.findByText('Account verified');
  await user.click(screen.getByRole('radio', { name: vat }));
  await user.click(screen.getByRole('radio', { name: /^Online/ }));
  await user.type(screen.getByLabelText('Website URL'), 'https://shop.example.com');
  await user.click(screen.getByRole('button', { name: 'Next' }));
}

async function agreeAndSubmit(user: UserEvent) {
  await screen.findByRole('heading', { name: 'Merchant agreement' });
  fireEvent.scroll(screen.getByLabelText('Agreement text'));
  await user.click(screen.getByRole('checkbox', { name: /I have read the agreement/ }));
  await user.click(screen.getByRole('button', { name: 'Accept agreement' }));
  await user.click(await screen.findByRole('button', { name: 'Submit application' }));
  await screen.findByRole('heading', { name: OUTCOME_COPY.SUBMITTED.title });
  expect(screen.queryByText(/activated/i)).toBeNull();
}

describe('Madfu Proposed — entry page', () => {
  it('validates required fields, structural IDs and the mobile', async () => {
    const { user } = await open();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Choose an applicant type.')).toBeInTheDocument();
    expect(screen.getByText('Select your annual revenue.')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /Registered Business/ }));
    await user.type(screen.getByLabelText('Commercial Registration Number'), '1234567890');
    await user.type(screen.getByLabelText('Mobile number'), '412345678');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText(/starts with 7\./)).toBeInTheDocument();
    expect(screen.getByText(/9 digits starting with 5/)).toBeInTheDocument();
  });

  it('switching to Freelancer asks for the National ID, never the certificate number', async () => {
    const { user } = await open();
    await user.click(screen.getByRole('radio', { name: /Freelancer/ }));
    expect(screen.getByLabelText('National ID Number')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Certificate/)).toBeNull();
    expect(screen.queryByLabelText('Commercial Registration Number')).toBeNull();
  });
});

describe('Madfu Proposed — journeys', () => {
  it('CR self-onboarding, all verified, with Edit and persistence', async () => {
    const { user, unmount } = await open();
    await fillEntry(user, 'CR', /SAR 100,000–20,000,000/);
    await code(user);
    await category(user, 'food', 'food-cafe');

    await screen.findByText('Registration verified');
    await user.click(screen.getByRole('button', { name: 'Next' }));

    await screen.findByRole('heading', { name: 'Who is authorised for this business?' });
    expect(await screen.findByText('Mohammed ••• ••• Al-Qahtani')).toBeInTheDocument();
    expect(screen.queryByText(/Holding/)).toBeNull();
    const cont = screen.getByRole('button', { name: 'Continue to Nafath' });
    expect(cont).toBeDisabled();
    await user.click(screen.getByRole('radio', { name: /Mohammed/ }));
    await user.click(cont);

    await screen.findByText('Select this number in Nafath');
    await screen.findByText('Identity verified');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await businessDetails(user, demoIban('10', '4821'), 'Yes');

    await screen.findByRole('heading', { name: 'Review your application' });
    expect(screen.getByText('Everything is ready')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Edit Sales channel' }));
    const web = await screen.findByLabelText('Website URL');
    await user.clear(web);
    await user.type(web, 'https://new.example.com');
    await user.click(screen.getByRole('button', { name: 'Save and return to review' }));
    expect(await screen.findByText('https://new.example.com')).toBeInTheDocument();

    // Refresh persistence: unmount and render again.
    unmount();
    renderAt('/madfu/proposed');
    expect(await screen.findByRole('heading', { name: 'Review your application' })).toBeInTheDocument();
    const user2 = (await import('@testing-library/user-event')).default.setup({ delay: null });
    await user2.click(screen.getByRole('button', { name: 'Continue to agreement' }));
    await agreeAndSubmit(user2);
  });

  it('Freelancer, several certificates, all verified at any revenue', async () => {
    const { user } = await open();
    await user.click(screen.getByRole('button', { name: /Freelancer, multiple certificates/ }));
    await screen.findByRole('heading', { name: 'Choose your freelance certificate' });
    const next = screen.getByRole('button', { name: 'Next' });
    await screen.findByText('FL-400000002');
    expect(next).toBeDisabled();
    await user.click(screen.getByRole('radio', { name: /FL-400000002/ }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await businessDetails(user, demoIban('80', '4821'), 'No');
    await user.click(await screen.findByRole('button', { name: 'Continue to agreement' }));
    await agreeAndSubmit(user);
  });

  it('Freelancer above SAR 20M is still self-service', async () => {
    const { user } = await open();
    await fillEntry(user, 'FL', /Above SAR 20,000,000/);
    await code(user);
    await screen.findByRole('heading', { name: 'What does your business sell?' });
  });

  it('CR below SAR 100K becomes a Sales lead with neutral copy', async () => {
    const { user } = await open();
    await fillEntry(user, 'CR', /Below SAR 100,000/);
    await code(user);
    expect(await screen.findByRole('heading', { name: OUTCOME_COPY.SALES_LEAD.title })).toBeInTheDocument();
    expect(within(screen.getByRole('main')).queryByText(/Nafath|IBAN|agreement/i)).toBeNull();
  });

  it('incorrect SMS code shows remaining attempts', async () => {
    const { user } = await open();
    await fillEntry(user, 'CR', /SAR 100,000–20,000,000/);
    await code(user, '111111');
    expect(await screen.findByText('Incorrect code. 2 attempts left.')).toBeInTheDocument();
  });

  it('CR Nafath rejected twice: retry, change person, then manual verification without contract', async () => {
    const { user } = await open();
    await user.click(screen.getByRole('button', { name: /CR Nafath rejected twice/ }));
    await user.click(await screen.findByRole('button', { name: 'Send Nafath request' }));
    await screen.findByText('The request was rejected in Nafath');
    expect(screen.getByText(/1 attempt left/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Choose another person' }));
    await user.click(await screen.findByRole('radio', { name: /Nora/ }));
    expect(screen.getByText(/1 Nafath attempt left/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue to Nafath' }));
    await screen.findByText('Nafath verification was not completed');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await businessDetails(user, demoIban('10', '4821'), 'No');
    await user.click(await screen.findByRole('button', { name: 'Submit application' }));
    expect(await screen.findByRole('heading', { name: OUTCOME_COPY.MANUAL_VERIFICATION.title })).toBeInTheDocument();
  });

  it('blocked category: neutral confirmation, no verification calls', async () => {
    const { user } = await open();
    await user.click(screen.getByRole('button', { name: /CR blocked category/ }));
    await user.click(await screen.findByRole('button', { name: 'Next' }));
    expect(await screen.findByRole('heading', { name: OUTCOME_COPY.CATEGORY_REVIEW.title })).toBeInTheDocument();
    expect(screen.getAllByText('CATEGORY_BLOCKED').length).toBeGreaterThan(0);
  });

  it('Freelancer with no certificates goes to the manual certificate number', async () => {
    const { user } = await open();
    await user.click(screen.getByRole('button', { name: /Freelancer no certificates/ }));
    await user.click(await screen.findByRole('button', { name: 'Enter certificate number' }));
    await screen.findByRole('heading', { name: 'Freelance certificate number' });
  });

  it('contract declined', async () => {
    const { user } = await open();
    await user.click(screen.getByRole('button', { name: /Contract declined/ }));
    await screen.findByRole('heading', { name: 'Merchant agreement' });
    await user.click(screen.getByRole('button', { name: 'Decline' }));
    const dialog = screen.getByText('Decline the agreement?').closest('.mb-alert') as HTMLElement;
    await user.click(within(dialog).getByRole('button', { name: 'Decline' }));
    expect(await screen.findByRole('heading', { name: OUTCOME_COPY.CONTRACT_DECLINED.title })).toBeInTheDocument();
  });

  it('resume: the saved application reopens after the code', async () => {
    const { user } = await open();
    await user.click(screen.getByRole('button', { name: /Resume application/ }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await code(user);
    expect(await screen.findByRole('heading', { name: 'Business details' })).toBeInTheDocument();
  });

  it('restart clears the demo', async () => {
    const { user } = await open();
    await fillEntry(user, 'CR', /SAR 100,000–20,000,000/);
    await screen.findByRole('heading', { name: 'Verify your mobile number' });
    await act(async () => { await user.click(screen.getByRole('button', { name: /Restart/ })); });
    expect(await screen.findByRole('heading', { name: 'Start your Madfu application' })).toBeInTheDocument();
  });
});

describe('Madfu Proposed — maps, rules and labels', () => {
  it('journey maps deep link and node types', async () => {
    renderAt('/madfu/proposed?view=maps');
    expect(await screen.findByRole('heading', { name: 'Journey maps' })).toBeInTheDocument();
    for (const tab of ['Overview', 'Registered business', 'Freelancer', 'Manual-review paths']) expect(screen.getByRole('tab', { name: tab })).toBeInTheDocument();
    expect(screen.getByLabelText('Legend')).toHaveTextContent(/External verification/);
  });
  it('decision tables and the Proposed / Product Design label', async () => {
    renderAt('/madfu/proposed?view=rules');
    expect(await screen.findByRole('heading', { name: 'Decision tables' })).toBeInTheDocument();
    expect(screen.getByText('Pending product decisions')).toBeInTheDocument();
    expect(screen.getAllByText('Proposed / Product Design').length).toBeGreaterThan(0);
  });
});
