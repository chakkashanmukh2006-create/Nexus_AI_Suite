const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.toString()));
  await page.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle0' });
  await page.click('[data-target="retail-forecast-tab"]');
  await new Promise(r => setTimeout(r, 2000));
  await browser.close();
})();
