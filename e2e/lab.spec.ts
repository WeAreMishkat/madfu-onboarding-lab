import { expect, test, type Page } from '@playwright/test';

/** Paths are relative to baseURL (which carries the GitHub Pages base path). */
const ROUTES: Array<[string, RegExp | string]> = [
  ['./', 'Merchant Onboarding Lab'],
  ['./tabby', /Tabby|region|Choose/i],
  ['./tamara', /Tamara|business/i],
  ['./madfu/current', /Get Started/i],
  ['./madfu/proposed', 'Start your Madfu application'],
  ['./compare', 'Compare experiences'],
  ['./madfu/proposed?view=maps', 'Journey maps']
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

test('Madfu Proposed: Freelancer journey end to end in a real browser', async ({ page }) => {
  await page.goto('./madfu/proposed');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('radio', { name: /Freelancer/ }).check();
  await page.getByLabel('National ID Number').fill(['1', '000000', '201'].join(''));
  await page.getByRole('radio', { name: /Above SAR 20,000,000/ }).check();
  await page.getByLabel('Mobile number').fill(['5', '0000', '0012'].join(''));
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel('Verification code').fill('246810');
  await page.getByLabel('Business category').selectOption('services');
  await page.getByLabel('Business subcategory').selectOption('services-design');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Send Nafath request' }).click();
  await expect(page.getByText('Identity verified')).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('FL-400000001')).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel('IBAN').fill(['SA', '00', '80', '000000', '12345678', '4821'].join(''));
  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(page.getByText('Account verified')).toBeVisible();
  await page.getByRole('radio', { name: 'No' }).check();
  await page.getByRole('radio', { name: /^Online/ }).check();
  await page.getByLabel('Website URL').fill('https://studio.example.com');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Everything is ready')).toBeVisible();

  // Refresh keeps progress.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Review your application' })).toBeVisible();

  await page.getByRole('button', { name: 'Continue to agreement' }).click();
  const doc = page.getByLabel('Agreement text');
  await doc.evaluate((el) => { el.scrollTop = el.scrollHeight; el.dispatchEvent(new Event('scroll')); });
  await page.getByRole('checkbox', { name: /I have read the agreement/ }).check();
  await page.getByRole('button', { name: 'Accept agreement' }).click();
  await page.getByRole('button', { name: 'Submit application' }).click();
  await expect(page.getByRole('heading', { name: 'Your application has been submitted successfully.' })).toBeVisible();
});

test('Prototype Controls switch scenarios', async ({ page }) => {
  await page.goto('./madfu/proposed');
  const toggle = page.getByRole('button', { name: 'Prototype Controls', exact: true });
  await expect(toggle).toBeVisible();
  if ((await toggle.getAttribute('aria-pressed')) !== 'true') await toggle.click();
  const controls = page.getByRole('complementary', { name: 'Prototype Controls' });
  await expect(controls).toBeVisible();
  await controls.getByRole('button', { name: /CR expired registration/ }).click();
  await expect(page.getByText('Registration expired').first()).toBeVisible({ timeout: 10_000 });
  await controls.getByRole('button', { name: /Freelancer no certificates/ }).click();
  await expect(page.getByText('No active freelance certificate was found')).toBeVisible({ timeout: 10_000 });
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

test('wireframes PDF downloads', async ({ request, baseURL }) => {
  const res = await request.get(`${baseURL}Madfu_Merchant_Onboarding_Wireframes.pdf`);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('pdf');
  expect((await res.body()).length).toBeGreaterThan(100_000);
});
