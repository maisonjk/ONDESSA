// Composes App Store / Google Play screenshots: headline banner + real app screen.
// Output sizes: iOS 6.9" 1320x2868, iOS 6.5" 1242x2688, Google Play phone 1080x1920,
// plus the Play feature graphic (1024x500) and a 512px Play icon.
const fs = require('fs');
const path = require('path');
const pw = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright'));

const ROOT = path.join(__dirname, '../..');
const RAW = path.join(ROOT, 'store/.work/raw');
const OUT = path.join(ROOT, 'store');
const font = (p) => 'file://' + path.join(ROOT, 'node_modules', p);
const FONTS = `
@font-face{font-family:'Serif';src:url(${font('@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2')})}
@font-face{font-family:'Serif';font-style:italic;src:url(${font('@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff2')})}
@font-face{font-family:'Sans';font-weight:100 900;src:url(${font('@fontsource-variable/instrument-sans/files/instrument-sans-latin-wght-normal.woff2')})}
@font-face{font-family:'Mono';font-weight:100 900;src:url(${font('@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2')})}
@font-face{font-family:'Num';font-weight:200 800;font-stretch:75% 100%;src:url(${font('@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-standard-normal.woff2')})}`;

// Each slide: what it shows, its headline, and the phase colour it wears.
const SLIDES = [
  { id: '01-today', img: 'today', eyebrow: 'Cycle predictions', title: 'Know your rhythm. <em>Keep it yours.</em>', bg: '#dff1e7', glow: '#9fd6b8', ink: '#1a1020' },
  { id: '02-patterns', img: 'patterns', eyebrow: 'My Cycle, My Patterns', title: 'Patterns from <em>your</em> logs. Never guesses.', bg: '#ece8fa', glow: '#c4b8f0', ink: '#1a1020' },
  { id: '03-calendar', img: 'calendar', eyebrow: 'Honest predictions', title: 'Every estimate shows <em>how sure it is.</em>', bg: '#fbe4ea', glow: '#f1a9bd', ink: '#1a1020' },
  { id: '04-fertility', img: 'fertility', eyebrow: 'Trying to conceive', title: 'Your best days, <em>and the honest range.</em>', bg: '#dcf1e6', glow: '#8fd1b0', ink: '#1a1020' },
  { id: '05-log', img: 'log', eyebrow: 'Daily log', title: 'Log in seconds. <em>Skip anything.</em>', bg: '#fcebdc', glow: '#f3c194', ink: '#1a1020' },
  { id: '06-pregnancy', img: 'pregnancy', eyebrow: 'Pregnancy mode', title: 'Week by week, <em>at your pace.</em>', bg: '#fcebdc', glow: '#f0b98c', ink: '#1a1020' },
  { id: '07-privacy', img: 'privacy', eyebrow: 'Private by design', title: 'No account. No ads. <em>Your cycle stays yours.</em>', bg: '#1a1020', glow: '#4a2244', ink: '#f6f1f8', dark: true },
];

function slideHtml(s, W, H, img) {
  const u = W / 100; // 1u = 1% of width
  const tall = H / W > 2; // phone-shaped canvases get more room for the headline
  return `<!doctype html><html><head><meta charset="utf-8"><style>${FONTS}
  *{box-sizing:border-box;margin:0}
  html,body{width:${W}px;height:${H}px;overflow:hidden}
  body{background:${s.bg};color:${s.ink};font-family:'Sans',sans-serif;position:relative}
  .glow{position:absolute;width:${120 * u}px;height:${120 * u}px;right:${-45 * u}px;top:${-55 * u}px;border-radius:50%;background:radial-gradient(circle,${s.glow} 0%,transparent 65%);opacity:.9}
  .head{position:absolute;left:${8 * u}px;right:${8 * u}px;top:${(tall ? 14 : 8) * u}px}
  .brand{display:flex;align-items:center;gap:${2 * u}px;font-family:'Serif';font-size:${5.2 * u}px;letter-spacing:-.02em}
  .brand svg{width:${5.6 * u}px;height:${5.6 * u}px}
  .eyebrow{font-family:'Mono';text-transform:uppercase;letter-spacing:.1em;font-size:${2.9 * u}px;opacity:.7;margin-top:0}
  h1{font-family:'Serif';font-weight:400;font-size:${(tall ? 10.4 : 9) * u}px;line-height:.98;letter-spacing:-.025em;margin-top:${2.4 * u}px;text-wrap:balance}
  h1 em{font-style:italic}
  .phone{position:absolute;left:${11 * u}px;right:${11 * u}px;top:${(tall ? 53 : 43) * u}px;border-radius:${7.5 * u}px;overflow:hidden;
    box-shadow:0 ${4 * u}px ${10 * u}px rgba(26,16,32,${s.dark ? '.6' : '.22'}),0 0 0 ${0.9 * u}px ${s.dark ? '#3a2f40' : 'rgba(255,255,255,.9)'}}
  .phone img{display:block;width:100%}
  </style></head><body>
  <div class="glow"></div>
  <div class="head">
    <div class="eyebrow">${s.eyebrow}</div>
    <h1>${s.title}</h1>
  </div>
  <div class="phone"><img src="file://${img}"></div>
  </body></html>`;
}

const featureHtml = (img) => `<!doctype html><html><head><meta charset="utf-8"><style>${FONTS}
*{box-sizing:border-box;margin:0}html,body{width:1024px;height:500px;overflow:hidden}
body{background:#1a1020;color:#f6f1f8;font-family:'Sans';position:relative}
.glow{position:absolute;width:700px;height:700px;right:-200px;top:-300px;border-radius:50%;background:radial-gradient(circle,#4a2244 0%,transparent 65%)}
.t{position:absolute;left:64px;top:110px;width:520px}
.brand{display:flex;align-items:center;gap:12px;font-family:'Serif';font-size:34px}
.brand svg{width:38px;height:38px}
h1{font-family:'Serif';font-weight:400;font-size:62px;line-height:.98;margin-top:28px;letter-spacing:-.02em}h1 em{font-style:italic;color:#f598b0}
p{font-family:'Mono';font-size:15px;letter-spacing:.08em;text-transform:uppercase;opacity:.7;margin-top:22px}
.phone{position:absolute;right:70px;top:46px;width:300px;border-radius:30px;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,.5),0 0 0 3px #3a2f40}
.phone img{width:100%;display:block}
</style></head><body><div class="glow"></div>
<div class="t"><div class="brand"><svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="15" fill="#c83c61"/><path d="M7 17.5c3-5 6-5 9 0s6 5 9 0" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/></svg>Ondessa</div>
<h1>Know your rhythm. <em>Keep it yours.</em></h1><p>Private cycle, fertility &amp; pregnancy tracking</p></div>
<div class="phone"><img src="file://${img}"></div></body></html>`;

(async () => {
  const b = await pw.chromium.launch();
  const page = await b.newPage();
  const render = async (html, W, H, out) => {
    const tmp = path.join(ROOT, 'store/.work/slide.html');
    fs.writeFileSync(tmp, html);
    await page.setViewportSize({ width: W, height: H });
    await page.goto('file://' + tmp);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(150);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await page.screenshot({ path: out, type: 'png' });
  };
  const sizes = [
    ['ios/screenshots/iphone-6.9', 1320, 2868],
    ['ios/screenshots/iphone-6.5', 1242, 2688],
    ['android/screenshots/phone', 1080, 1920],
  ];
  for (const [dir, W, H] of sizes) {
    for (const s of SLIDES) await render(slideHtml(s, W, H, path.join(RAW, s.img + '.png')), W, H, path.join(OUT, dir, `${s.id}.png`));
    console.log('rendered', dir);
  }
  await render(featureHtml(path.join(RAW, 'today.png')), 1024, 500, path.join(OUT, 'android/feature-graphic.png'));
  await render(`<html><body style="margin:0"><img src="file://${ROOT}/assets/icon-only.png" style="width:512px;height:512px;display:block"></body></html>`, 512, 512, path.join(OUT, 'android/icon-512.png'));
  console.log('rendered feature graphic and icon');
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
