const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
(async () => {
  const out = path.join(__dirname, 'frames'); fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1080, height: 960 } });
  p.on('console', m => console.log('page:', m.text())); p.on('pageerror', e => console.log('err:', e.message));
  await p.goto('file://' + path.join(__dirname, 'out/index.html'));
  await p.waitForFunction(() => window.ready === true);
  const c = await p.$('canvas');
  for (let f = 0; f < 180; f++) {
    await p.evaluate(f => window.renderFrame(f), f);
    await c.screenshot({ path: path.join(out, String(f).padStart(4, '0') + '.png') });
  }
  await b.close();
})();
