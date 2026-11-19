import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = 'http://localhost:5173';
const OUT = '/private/tmp/claude-501/-Users-maxim-WebstormProjects-geoguessr/4f67952e-350a-436a-8d16-70b882e2a401/scratchpad/shots';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const errors = [];

async function freshContext(viewport) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`[console] ${page.url()} :: ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`[pageerror] ${page.url()} :: ${err.message}`));
  page.on('requestfailed', (req) => {
    if (!req.url().includes('tile.openstreetmap.org')) errors.push(`[requestfailed] ${req.url()} :: ${req.failure()?.errorText}`);
  });
  return { ctx, page };
}

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
}

const desktop = { width: 1440, height: 900 };
const mobile = { width: 390, height: 844 };

// 1. Logged-out landing page (desktop)
{
  const { ctx, page } = await freshContext(desktop);
  await page.goto(BASE + '/');
  await page.waitForTimeout(800);
  await shot(page, '01-landing-desktop');
  await ctx.close();
}

// 2. Logged-out landing page (mobile)
{
  const { ctx, page } = await freshContext(mobile);
  await page.goto(BASE + '/');
  await page.waitForTimeout(800);
  await shot(page, '02-landing-mobile');
  await ctx.close();
}

// 3. Register flow
const email = `smoketest+${Date.now()}@example.com`;
const password = 'correct-horse-battery-staple';
{
  const { ctx, page } = await freshContext(desktop);
  await page.goto(BASE + '/auth');
  await page.waitForTimeout(500);
  await shot(page, '03-auth-desktop');
  await page.getByRole('button', { name: 'Sign up' }).first().click();
  await page.waitForTimeout(300);
  await shot(page, '04-auth-dialog-providers');
  await page.getByRole('button', { name: 'Continue with Email' }).click();
  await page.waitForTimeout(300);
  await shot(page, '05-auth-dialog-email');
  await page.getByLabel('Display name').fill('Smoke Tester');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForTimeout(1200);
  await shot(page, '06-after-register');
  await ctx.close();
}

// 4. Login with same account + home dashboard
let storageState;
{
  const { ctx, page } = await freshContext(desktop);
  await page.goto(BASE + '/auth');
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Log in' }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Continue with Email' }).click();
  await page.waitForTimeout(300);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('dialog').getByRole('button', { name: 'Log in' }).click();
  await page.waitForTimeout(1200);
  await shot(page, '07-home-desktop-loggedin');
  storageState = await ctx.storageState();
  await ctx.close();
}

// 5. Home mobile logged in
{
  const ctx = await browser.newContext({ viewport: mobile, storageState });
  const page = await ctx.newPage();
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`[console] ${page.url()} :: ${msg.text()}`); });
  await page.goto(BASE + '/');
  await page.waitForTimeout(800);
  await shot(page, '08-home-mobile-loggedin');
  await ctx.close();
}

// 6. Duels page logged in (desktop)
{
  const ctx = await browser.newContext({ viewport: desktop, storageState });
  const page = await ctx.newPage();
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`[console] ${page.url()} :: ${msg.text()}`); });
  await page.goto(BASE + '/duels');
  await page.waitForTimeout(800);
  await shot(page, '09-duels-desktop');
  await ctx.close();
}

// 7. Settings page logged in
{
  const ctx = await browser.newContext({ viewport: desktop, storageState });
  const page = await ctx.newPage();
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`[console] ${page.url()} :: ${msg.text()}`); });
  await page.goto(BASE + '/settings');
  await page.waitForTimeout(800);
  await shot(page, '10-settings-desktop');
  await ctx.close();
}

// 8. Play flow (solo) - setup -> round -> submit guess -> result
{
  const ctx = await browser.newContext({ viewport: desktop, storageState });
  const page = await ctx.newPage();
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`[console] ${page.url()} :: ${msg.text()}`); });
  await page.goto(BASE + '/play');
  await page.waitForTimeout(500);
  await shot(page, '11-play-setup');
  await page.getByRole('button', { name: 'Start playing' }).click();
  await page.waitForTimeout(1500);
  await shot(page, '12-play-round');
  // Click middle of the map to drop a guess
  const map = page.locator('.tg-map-picker');
  await map.click({ position: { x: 150, y: 150 } });
  await page.waitForTimeout(300);
  await shot(page, '13-play-round-guessed');
  await page.getByRole('button', { name: 'Submit guess' }).click();
  await page.waitForTimeout(1200);
  await shot(page, '14-play-result');
  await ctx.close();
}

// 9. Daily page logged in
{
  const ctx = await browser.newContext({ viewport: desktop, storageState });
  const page = await ctx.newPage();
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`[console] ${page.url()} :: ${msg.text()}`); });
  await page.goto(BASE + '/daily');
  await page.waitForTimeout(1000);
  await shot(page, '15-daily-desktop');
  await ctx.close();
}

// 10. Mobile duels + tablet home
{
  const ctx = await browser.newContext({ viewport: { width: 820, height: 1180 }, storageState });
  const page = await ctx.newPage();
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`[console] ${page.url()} :: ${msg.text()}`); });
  await page.goto(BASE + '/');
  await page.waitForTimeout(800);
  await shot(page, '16-home-tablet');
  await ctx.close();
}

await browser.close();

console.log('ERRORS:', errors.length);
for (const e of errors) console.log(e);
console.log('DONE');
