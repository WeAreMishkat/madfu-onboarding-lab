import { expect, test, type Page } from '@playwright/test';

/** Paths are relative to baseURL (which carries the GitHub Pages base path). */
const ROUTES: Array<[string, RegExp | string]> = [
  ['./', 'Merchant Onboarding Lab'],
  ['./tabby', /Tabby|region|Choose/i],
  ['./tamara', /Tamara|business/i],
  ['./madfu/current', /Get Started/i],
  ['./madfu/proposed', 'Tell us about your business'],
  ['./compare', 'Compare experiences'],
  ['./madfu/proposed?view=boards', 'Master boards'],
  ['./madfu/proposed?view=rules', 'Rules & decisions']
];

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return errors;
}

test('home page lists the four experiences and loads its assets', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Merchant Onboarding Lab', level: 1 })).toBeVisible();
  for (const t of ['Tabby', 'Tamara', 'Madfu Current', 'Madfu Proposed']) await expect(page.getByRole('heading', { name: t, exact: true })).toBeVisible();
  const logo = page.locator('img[alt="Madfu"]').first();
  await expect(logo).toBeVisible();
  expect(await logo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

for (const [path, heading] of ROUTES) {
  test(`deep link and refresh: ${path}`, async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto(path);
    await expect(page.getByRole('heading', typeof heading === 'string' ? { name: heading } : { name: heading }).first()).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', typeof heading === 'string' ? { name: heading } : { name: heading }).first()).toBeVisible();
    expect(errors.filter((e) => !/404/.test(e))).toEqual([]);
  });
}

test('navigation from home to every experience and back', async ({ page }) => {
  await page.goto('./');
  for (const name of ['Tabby', 'Tamara', 'Madfu Current', 'Madfu Proposed']) {
    await page.getByRole('link', { name: `View experience: ${name}` }).click();
    await expect(page.getByText(/Experience/).first()).toBeVisible();
    await page.getByRole('link', { name: 'Merchant Onboarding Lab home' }).click();
    await expect(page.getByRole('heading', { name: 'Merchant Onboarding Lab', level: 1 })).toBeVisible();
  }
});

const NID = ['1', '000000', '201'].join('');
const CR = '7000000101';
const MOBILE = ['5', '0000', '0012'].join('');

async function freshProposed(page: Page) {
  await page.goto('./madfu/proposed');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

test('Madfu Proposed: Freelancer journey end to end (Page 1 → Page 2 → OTP → certificate → Nafath → details → offer → submit)', async ({ page }) => {
  await freshProposed(page);
  // Page 1: five questions, no identity, mobile or URL.
  await expect(page.getByLabel('Mobile number')).toHaveCount(0);
  await page.getByLabel('Who is applying?').selectOption('FL_CERT');
  await page.getByLabel('Business category').selectOption('services');
  await page.getByLabel('Business subcategory').selectOption('services-design');
  await page.getByRole('radio', { name: /SAR 100,000–20,000,000/ }).check();
  await page.getByRole('radio', { name: /^Online/ }).check();
  await expect(page.getByLabel('Online store or business website')).toHaveCount(0);
  await page.getByRole('button', { name: 'Check eligibility' }).click();
  // Page 2: identifier + mobile + IBAN-linked declaration.
  await page.getByLabel('National ID Number').fill(NID);
  await page.getByLabel('Mobile number').fill(MOBILE);
  await page.getByRole('radio', { name: 'Yes' }).check();
  await page.getByRole('button', { name: 'Send code' }).click();
  await page.getByLabel('Verification code').fill('246810');
  // Certificate first (before Nafath), then Nafath.
  await expect(page.getByText('FL-400000001')).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Continue to Nafath' }).click();
  await page.getByRole('button', { name: 'Send to Nafath' }).click({ timeout: 10_000 });
  await expect(page.getByText('Identity verified')).toBeVisible({ timeout: 10_000 });
  await page.getByRole('main').getByRole('button', { name: 'Continue', exact: true }).click();
  // Business Details: website + Freelancer IBAN linkage.
  await page.getByLabel('Online store or business website').fill('studio.example.com');
  await page.getByRole('textbox', { name: 'IBAN' }).fill(['SA00', '8000', '0000', '1234', '5678', '4821'].join(''));
  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(page.getByText('Account verified')).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Next' }).click();
  // Commercial Offer: standard offer, no plans.
  await expect(page.getByRole('heading', { name: 'Your Standard Offer' })).toBeVisible();
  await expect(page.getByRole('main').getByRole('checkbox')).toHaveCount(0);
  await page.getByRole('main').getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByText('Everything is ready')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Review your application' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue to contract' }).click();
  await expect(page.getByRole('table', { name: 'Schedule 1' })).toContainText('Standard commission');
  await page.getByRole('button', { name: 'Agree & Submit' }).click();
  await expect(page.getByRole('heading', { name: 'Your application has been submitted successfully.' })).toBeVisible();
  await expect(page.getByRole('main').getByRole('button')).toHaveCount(0);
});

test('Madfu Proposed: an existing application is opened only by the registered mobile and resumes', async ({ page }) => {
  await freshProposed(page);
  const controls = page.getByRole('complementary', { name: 'Prototype Controls' });
  await controls.getByRole('tab', { name: 'Start demo' }).click();
  await controls.getByRole('button', { name: 'Existing incomplete application' }).click();
  await page.getByRole('button', { name: 'Send code' }).click();
  await expect(page.getByRole('heading', { name: 'An application is already in progress for this business.' })).toBeVisible();
  await expect(page.getByText(/registered mobile ending in/)).toContainText('•••••••123');
  await page.getByLabel('Verification code').fill('246810');
  await expect(page.getByRole('heading', { name: 'Business details' })).toBeVisible();
});

test('Madfu Proposed: a submitted application opens Application Progress, not Review', async ({ page }) => {
  await freshProposed(page);
  const controls = page.getByRole('complementary', { name: 'Prototype Controls' });
  await controls.getByRole('tab', { name: 'Start demo' }).click();
  await controls.getByRole('button', { name: 'Submitted application' }).click();
  await page.getByRole('button', { name: 'Send code' }).click();
  await page.getByLabel('Verification code').fill('246810');
  await expect(page.getByRole('main').getByText('Application Progress')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Review your application' })).toHaveCount(0);
});

test('Madfu Proposed: CR mobile mismatch before Nafath is corrected with a new code, without restarting', async ({ page }) => {
  await freshProposed(page);
  const controls = page.getByRole('complementary', { name: 'Prototype Controls' });
  await controls.getByRole('tab', { name: 'Start demo' }).click();
  await controls.getByRole('button', { name: 'Mobile mismatch before Nafath' }).click();
  await page.getByRole('button', { name: 'Send to Nafath' }).click();
  await expect(page.getByText('The mobile number must belong to the selected owner or manager.')).toBeVisible();
  await page.getByRole('button', { name: 'Use another mobile number' }).click();
  await page.getByLabel('Mobile number registered to the National ID').fill(['5', '0000', '0099'].join(''));
  await page.getByRole('button', { name: 'Send code' }).click();
  await page.getByLabel('Verification code').fill('246810');
  await expect(page.getByText('Select this number in Nafath')).toBeVisible();
});

async function proposedKyb(page: Page, kind: string, group: string, sub: string, revenue = /SAR 100,000–20,000,000/) {
  await page.getByLabel('Who is applying?').selectOption(kind);
  await page.getByLabel('Business category').selectOption(group);
  await page.getByLabel('Business subcategory').selectOption(sub);
  await page.getByRole('radio', { name: revenue }).check();
  await page.getByRole('radio', { name: /^Online/ }).check();
  await page.getByRole('button', { name: 'Check eligibility' }).click();
}

test('Madfu Proposed: Freelancer without certificate → Identify → OTP → Application submitted (no rejection reason)', async ({ page }) => {
  await freshProposed(page);
  await proposedKyb(page, 'FL_NO_CERT', 'services', 'services-design');
  await expect(page.getByRole('heading', { name: 'Continue your application' })).toBeVisible();
  await page.getByLabel('National ID Number').fill(NID);
  await page.getByLabel('Mobile number').fill(MOBILE);
  await page.getByRole('button', { name: 'Send code' }).click();
  await page.getByLabel('Verification code').fill('246810');
  await expect(page.getByRole('heading', { name: 'Your application has been submitted successfully.' })).toBeVisible();
  await expect(page.getByRole('main')).not.toContainText(/not eligible|reject|blocked|certificate/i);
});

test('Madfu Proposed: unsupported category (CR) → Identify → OTP → Application submitted (reason internal only)', async ({ page }) => {
  await freshProposed(page);
  await proposedKyb(page, 'CR', 'fixture', 'fixture-blocked');
  await expect(page.getByRole('heading', { name: 'Continue your application' })).toBeVisible();
  await expect(page.getByText('Eligible for online onboarding')).toHaveCount(0);
  await page.getByLabel('Commercial Registration (Unified Number)').fill(CR);
  await page.getByLabel('Mobile number').fill(MOBILE);
  await page.getByRole('button', { name: 'Send code' }).click();
  await page.getByLabel('Verification code').fill('246810');
  await expect(page.getByRole('heading', { name: 'Your application has been submitted successfully.' })).toBeVisible();
  await expect(page.getByRole('main')).not.toContainText(/not eligible|reject|blacklist|blocked/i);
  const controls = page.getByRole('complementary', { name: 'Prototype Controls' });
  await controls.getByRole('tab', { name: 'Internal view' }).click();
  await expect(controls.getByText(/CATEGORY_NOT_SUPPORTED · Category not supported/).first()).toBeVisible();
});

test('Madfu Proposed: a registered business above SAR 20M self-onboards (no Sales route)', async ({ page }) => {
  await freshProposed(page);
  await proposedKyb(page, 'CR', 'retail', 'retail-fashion', /Above SAR 20,000,000/);
  await expect(page.getByRole('heading', { name: 'Good news: you can apply online' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Yes' })).toHaveCount(0); // no owner / manager question
  await page.getByLabel('Commercial Registration (Unified Number)').fill(CR);
  await page.getByLabel('Mobile number').fill(MOBILE);
  await page.getByRole('button', { name: 'Send code' }).click();
  await page.getByLabel('Verification code').fill('246810');
  await expect(page.getByRole('heading', { name: 'Your business registration' })).toBeVisible({ timeout: 10_000 });
});

test('Madfu Proposed: live merchant sees the active-account popup; login only after clicking Log in', async ({ page }) => {
  await freshProposed(page);
  const controls = page.getByRole('complementary', { name: 'Prototype Controls' });
  await controls.getByRole('tab', { name: 'Start demo' }).click();
  await controls.getByRole('button', { name: 'Live merchant' }).click();
  await page.getByRole('button', { name: 'Send code' }).click();
  await page.getByLabel('Verification code').fill('246810');
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'You already have an active account under this CR.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Merchant login' })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('heading', { name: 'Merchant login' })).toBeVisible();
});

test('Madfu Proposed: CR signer handoff — preparer sends, application frozen, signer: secure link → Nafath → read-only review → Agree & Sign', async ({ page }) => {
  await freshProposed(page);
  const controls = page.getByRole('complementary', { name: 'Prototype Controls' });
  await controls.getByRole('tab', { name: 'Start demo' }).click();
  await controls.getByRole('button', { name: 'CR signer handoff' }).click();
  await expect(page.getByRole('heading', { name: 'Who will authorize and sign this application?' })).toBeVisible();
  await page.getByRole('radio', { name: /Nora/ }).check();
  await page.getByLabel('Signer’s mobile number').fill(['5', '0000', '0456'].join(''));
  await page.getByRole('main').getByRole('button', { name: 'Send Authorization', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Waiting for authorization' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Change signer or mobile' })).toBeDisabled();
  // The signer opens the secure SMS link in a new session: no OTP, masked details only.
  await controls.getByRole('tab', { name: 'Start demo' }).click();
  await controls.getByRole('button', { name: 'Open signer link (new session)' }).first().click();
  await expect(page.getByRole('heading', { name: 'You’ve been asked to authorize a Madfu merchant application' })).toBeVisible();
  await expect(page.getByLabel('Verification code')).toHaveCount(0);
  await expect(page.getByRole('main')).not.toContainText(/Standard commission|najdroastery|Google Maps/);
  await page.getByRole('button', { name: 'Start Nafath Verification' }).click();
  await expect(page.getByText('Identity verified')).toBeVisible({ timeout: 10_000 });
  await page.getByRole('main').getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Review the application' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Edit / })).toHaveCount(0);
  await page.getByRole('button', { name: 'Continue to contract' }).click();
  await page.getByRole('button', { name: 'Agree & Sign' }).click();
  await expect(page.getByRole('heading', { name: 'Thank you. The application is signed and submitted.' })).toBeVisible();
});

test('Prototype Controls: Start demo preset, Page Scenarios per screen, Internal view shows reuse', async ({ page }) => {
  await page.goto('./madfu/proposed');
  const toggle = page.getByRole('button', { name: 'Prototype Controls', exact: true });
  await expect(toggle).toBeVisible();
  if ((await toggle.getAttribute('aria-pressed')) !== 'true') await toggle.click();
  const controls = page.getByRole('complementary', { name: 'Prototype Controls' });
  await controls.getByRole('tab', { name: 'Start demo' }).click();
  await controls.getByRole('button', { name: 'Resume (Continue link)' }).click();
  await expect(page.getByRole('heading', { name: 'Continue your application' })).toBeVisible();
  await controls.getByRole('tab', { name: 'This step' }).click();
  const scenarios = controls.getByRole('tabpanel', { name: 'Page Scenarios' });
  await expect(scenarios.getByRole('button')).toHaveText(['Verified', 'Incorrect code', 'Invalid code (wrong format)', 'Expired / timed out', 'Resend code (3 left)']);
  await scenarios.getByRole('button', { name: 'Verified' }).click();
  await expect(page.getByRole('heading', { name: 'Your Standard Offer' })).toBeVisible();
  await expect(scenarios.getByRole('button', { name: 'Incorrect code' })).toHaveCount(0);
  await controls.getByRole('tab', { name: 'Internal view' }).click();
  await expect(controls.getByText('Verified previously — reused, no new provider call')).toHaveCount(2);
  await expect(controls.getByText('authorized_person_mobile_verified')).toBeVisible();
});

test('Prototype Controls open by default in a light reviewer theme, with the prototype hint', async ({ page, context }) => {
  await context.clearCookies();
  await page.goto('./madfu/proposed');
  await page.evaluate(() => { sessionStorage.clear(); localStorage.clear(); });
  await page.reload();
  const controls = page.getByRole('complementary', { name: 'Prototype Controls' });
  await expect(controls).toBeVisible();
  await expect(page.getByRole('note')).toContainText('Prototype mode');
  await expect(controls.getByText(/Prototype tip:/)).toBeVisible();
  const bg = (sel: string) => page.locator(sel).first().evaluate((el) => getComputedStyle(el).backgroundColor);
  const light = (rgb: string) => { const [r, g, b] = rgb.match(/\d+/g)!.map(Number); return (r + g + b) / 3 > 220; };
  expect(light(await bg('.ip'))).toBe(true);
  expect(light(await bg('.lab-bar'))).toBe(true);
});

test('Compare: Current vs Proposed and all four', async ({ page }) => {
  await page.goto('./compare');
  await expect(page.getByRole('button', { name: /Madfu Current ↔ Proposed/ })).toBeVisible();
  await page.getByRole('button', { name: 'All four experiences' }).click();
  await expect(page.getByText('Benchmark').first()).toBeVisible();
});

test('Evidence drawer shows references, never screenshots', async ({ page }) => {
  await page.goto('./madfu/current');
  await page.getByRole('button', { name: 'Evidence' }).click();
  const drawer = page.getByRole('complementary', { name: 'Evidence for this screen' });
  await expect(drawer).toBeVisible();
  await expect(drawer.locator('img')).toHaveCount(0);
  await expect(drawer.getByText(/MDF-/).first()).toBeVisible();
});

for (const pdf of ['Madfu_Merchant_Onboarding_Wireframes.pdf', 'Madfu_Proposed_Simple_Master_Board.pdf', 'Madfu_Proposed_Detailed_Master_Board.pdf']) {
  test(`PDF downloads: ${pdf}`, async ({ request, baseURL }) => {
    const res = await request.get(`${baseURL}${pdf}`);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('pdf');
    expect((await res.body()).length).toBeGreaterThan(50_000);
  });
}
