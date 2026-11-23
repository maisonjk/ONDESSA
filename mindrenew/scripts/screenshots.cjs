// End-to-end walk through the core loop in a real browser, capturing screenshots and console errors.
// Usage: npm run build && npx vite preview --port 4173 & npm run shots
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = process.env.BASE_URL || 'http://localhost:4173';
const OUT = process.env.OUT || 'shots';
const SCALE = Number(process.env.SCALE || 1);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const errors = [];
  const run = async (scheme) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: SCALE, colorScheme: scheme });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`${scheme}: ${e.message}`));
    page.on('console', (m) => m.type() === 'error' && !m.text().includes('favicon') && errors.push(`${scheme}: ${m.text()}`));
    const shot = (n) => page.screenshot({ path: `${OUT}/${scheme}-${n}.png`, fullPage: false });
    const click = (name) => page.getByRole('button', { name }).first().click();

    await page.goto(BASE);
    await page.waitForTimeout(400);
    await shot('01-welcome');
    await click('Begin');
    await click('Peace instead of anxiety');
    await click('Knowing who I am in Christ');
    await shot('02-onboard-grow');
    await click('Continue');
    await click('Identity'); await click('Anxiety');
    await click('Continue');
    await click('Continue');
    await page.getByLabel('What should we call you?').fill('Sam');
    await shot('03-onboard-reminder');
    await click('Start my first renewal');
    await page.waitForTimeout(300);
    await shot('04-recognize');
    await page.getByRole('button', { name: /^Identity/ }).click();
    await click('Continue');
    await page.waitForTimeout(300);
    await page.getByRole('radio', { name: /not good enough/ }).click();
    await shot('05-identify');
    await click('See what God says');
    await page.waitForTimeout(1000);
    await shot('06-truth');
    await page.screenshot({ path: `${OUT}/${scheme}-06b-truth-full.png`, fullPage: true });
    await click('Make it personal');
    await page.getByRole('textbox').fill('I would stop over-preparing for my meeting and trust that I am enough because of grace.');
    await shot('07-personal');
    await click('Continue');
    await page.waitForTimeout(400);
    await shot('08-live');
    await click('I’ll do this today');
    await page.waitForTimeout(900);
    await shot('09-complete');
    await click('Done');
    await page.waitForTimeout(500);
    await shot('10-home');
    await page.screenshot({ path: `${OUT}/${scheme}-10b-home-full.png`, fullPage: true });
    if (scheme === 'dark') { await ctx.close(); return; }
    // Second renewal is gated for free users.
    await click('Renew again');
    await page.waitForTimeout(500);
    await shot('11-paywall');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Library' }).click();
    await page.waitForTimeout(300);
    await shot('12-library');
    await page.locator('.card.pressable').first().click();
    await page.waitForTimeout(400);
    await shot('13-truth-detail');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Companion' }).click();
    await page.getByLabel('Your thought').fill('I keep thinking everyone at church is judging me');
    await click('Find the truth');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/${scheme}-14-companion.png`, fullPage: true });
    await page.getByRole('button', { name: 'New thought' }).click();
    await page.getByLabel('Your thought').fill('honestly i want to die');
    await click('Find the truth');
    await page.waitForTimeout(300);
    await shot('15-crisis');
    await page.getByRole('button', { name: 'Journey' }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/${scheme}-16-progress.png`, fullPage: true });
    await page.getByRole('button', { name: 'Today' }).click();
    await page.getByRole('button', { name: 'Profile and settings' }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/${scheme}-17-settings.png`, fullPage: true });
    // Reload persists state.
    await page.goto(BASE + '/#/');
    await page.waitForTimeout(400);
    const persisted = await page.getByText('You’ve met with God’s truth today.').count();
    if (!persisted) errors.push('state did not persist across reload');
    // Desktop layout
    await page.setViewportSize({ width: 1280, height: 860 });
    await page.waitForTimeout(300);
    await shot('18-desktop');
    await ctx.close();
  };
  await run('light');
  await run('dark');
  await browser.close();
  console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'NO ERRORS');
})().catch((e) => { console.error(e); process.exit(1); });
