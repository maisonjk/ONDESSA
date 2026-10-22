// Captures clean app screens (no tour banner) at iPhone 6.9" resolution: 430x932 CSS @3x = 1290x2796.
process.env.ONDESSA_URL = process.env.ONDESSA_URL || 'http://localhost:4600';
const L = require('../../e2e/lib.cjs');
const { base, preg, understand } = require('../../store/.work/data.json');
const OUT = require('path').join(__dirname, '../../store/.work/raw');
require('fs').mkdirSync(OUT, { recursive: true });

(async () => {
  const pw = require(require('path').join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright'));
  const browser = await pw.chromium.launch();
  const shoot = async (name, data, route, prep, scheme = 'light') => {
    const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, colorScheme: scheme });
    const page = await ctx.newPage();
    await page.goto(`${process.env.ONDESSA_URL}/#/legal`);
    await L.seed(page, data, { route });
    await page.waitForTimeout(600);
    if (prep) await prep(page);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/${name}.png` });
    await ctx.close();
    console.log('captured', name);
  };
  const scrollTo = (text, offset = 90) => async (page) => {
    await page.getByText(text, { exact: false }).first().scrollIntoViewIfNeeded();
    await page.evaluate((o) => window.scrollBy(0, -o), offset);
  };
  await shoot('today', base, '/app');
  await shoot('today-dark', base, '/app', null, 'dark');
  await shoot('patterns', understand, '/app/insights', async (page) => {
    await page.evaluate(() => {
      const h = [...document.querySelectorAll('h3')].find((x) => x.textContent.includes('before your period'));
      window.scrollTo(0, h.getBoundingClientRect().top + window.scrollY - 140);
    });
  });
  await shoot('calendar', base, '/app/calendar');
  await shoot('fertility', base, '/app/fertility');
  await shoot('log', base, '/app/log', async (page) => {
    for (const n of ['headache', 'calm']) await page.getByRole('button', { name: n, exact: true }).click();
  });
  await shoot('pregnancy', preg, '/app/pregnancy');
  await shoot('privacy', base, '/app/privacy', async (page) => {
    await page.getByLabel('Passcode', { exact: true }).fill('2468');
    await page.getByRole('button', { name: 'Turn on' }).click();
    await page.getByText('Encrypted with your passcode.').waitFor({ timeout: 15000 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(3200); // let the confirmation toast fade
  });
  await browser.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
