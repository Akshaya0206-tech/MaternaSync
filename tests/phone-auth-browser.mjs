/** Run only against backend/tests/phone_auth_browser_server.py and a Vite proxy to port 8003. No real SMS. */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const base = 'http://127.0.0.1:5175';
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await mkdir('.test-output', { recursive: true });
try {
  await page.goto(base + '/signin');
  await page.getByRole('button', { name: 'Phone sign-in', exact: true }).waitFor();
  await page.getByRole('button', { name: /Demo Patient/ }).click();
  await page.waitForURL('**/patient/dashboard');
  await page.goto(base + '/patient/profile');
  const section = page.getByRole('heading', { name: 'Phone sign-in', exact: true }).locator('..');
  await section.getByLabel('Mobile number (+91)', { exact: true }).fill('9800000001');
  await section.getByLabel('Current password', { exact: true }).fill('SarahDemo123!');
  await section.getByRole('button', { name: 'Send verification code', exact: true }).click();
  await section.getByLabel('Six-digit code', { exact: true }).fill('000000');
  await section.getByRole('button', { name: 'Verify code', exact: true }).click();
  await section.getByRole('alert').filter({ hasText: 'incorrect or expired' }).waitFor();
  await section.getByLabel('Six-digit code', { exact: true }).fill('246810');
  await section.getByRole('button', { name: 'Verify code', exact: true }).click();
  await section.getByText('Linked sign-in number: +91 ******0001', { exact: true }).waitFor();
  await section.screenshot({ path: '.test-output/phone-linked.png' });
  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  await page.goto(base + '/signin');
  await page.getByRole('button', { name: 'Phone sign-in', exact: true }).click();
  await page.getByLabel('Mobile number (+91)', { exact: true }).fill('9800000001');
  // A server refusal must show its wait time and block both clicks and Enter submissions.
  let sendRequests = 0;
  await page.route('**/api/auth/otp/start', async route => {
    sendRequests++;
    if (sendRequests === 1) await route.fulfill({status:429,contentType:'application/json',headers:{'Retry-After':'3'},body:JSON.stringify({detail:'Too many requests. Please wait before trying again.'})});
    else await route.continue();
  });
  await page.getByRole('button', { name: 'Send sign-in code', exact: true }).click();
  const retry = page.getByRole('button', { name: /^Try again in / });
  await retry.waitFor();
  assert.equal(await retry.isDisabled(), true);
  await page.getByLabel('Mobile number (+91)', { exact: true }).press('Enter');
  assert.equal(sendRequests, 1);
  await page.screenshot({ path: '.test-output/phone-cooldown.png' });
  await page.getByRole('button', { name: 'Send sign-in code', exact: true }).click();
  await page.getByLabel('Six-digit code', { exact: true }).waitFor();
  assert.equal(sendRequests, 2);
  await page.screenshot({ path: '.test-output/phone-code.png' });
  await page.getByLabel('Six-digit code', { exact: true }).fill('246810');
  await page.getByRole('button', { name: 'Verify code', exact: true }).click();
  await page.waitForURL('**/patient/dashboard');
  await page.goto(base + '/patient/profile');
  await section.getByLabel('Current password', { exact: true }).fill('SarahDemo123!');
  await section.getByRole('button', { name: 'Remove sign-in number', exact: true }).click();
  await section.getByRole('button', { name: 'Send verification code', exact: true }).waitFor();
  for (const [role, route] of [['Doctor', '/doctor/profile'], ['Caregiver', '/caregiver/profile']]) {
    await page.getByRole('button', { name: 'Logout', exact: true }).click();
    await page.goto(base + '/signin');
    await page.getByRole('button', { name: new RegExp(`Demo ${role}`) }).click();
    await page.waitForURL(role === 'Doctor' ? '**/doctor/dashboard' : '**/caregiver/home');
    await page.goto(base + route);
    await page.getByRole('heading', { name: 'Phone sign-in', exact: true }).waitFor();
  }
  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  await page.goto(base + '/signin');
  await page.getByLabel('Language', { exact: true }).selectOption('hi');
  await page.getByRole('button', { name: 'फ़ोन से साइन इन', exact: true }).click();
  await page.getByLabel('मोबाइल नंबर (+91)', { exact: true }).waitFor();
  await page.screenshot({ path: '.test-output/phone-signin-hi.png' });
  assert.deepEqual(errors, []);
  console.log('PASS: enrollment, wrong code, rate-limit countdown/retry, phone sign-in, patient routing, unlink, doctor/caregiver settings, Hindi UI; no browser errors.');
} finally { await browser.close(); }
