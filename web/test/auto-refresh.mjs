// Isolated browser fixtures: no requests or messages are sent to the running backend.
import assert from 'node:assert/strict';
import { build } from '../../tools/webprover/node_modules/esbuild/lib/main.js';
import puppeteer from '../../tools/webprover/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
import { fileURLToPath } from 'node:url';

const fixture = await build({ entryPoints: [fileURLToPath(new URL('../src/services/mockData.ts', import.meta.url))], bundle: true, write: false, format: 'esm' });
const { INITIAL_COMPLAINTS } = await import('data:text/javascript;base64,' + Buffer.from(fixture.outputFiles[0].text).toString('base64'));
const report = { ...INITIAL_COMPLAINTS[0], id: 'INC-AUTO-TEST', title: 'Fictional browser test', status: 'committee_assigned', revokedMemberIds: [], activeChallengeId: null };
let cases = [], messages = [], denied = false, sendFails = false, caseRequests = 0;
const message = (id, sender, text) => ({ id, sender, text, timestamp: '2026-10-11T10:00:00Z', isEncrypted: false });
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.name));
  page.on('dialog', dialog => dialog.dismiss());
  await page.setRequestInterception(true);
  page.on('request', async request => {
    const path = new URL(request.url()).pathname;
    if (!path.startsWith('/hr/')) { await request.continue(); return; }
    let data = [], status = 200;
    if (path === '/hr/cases') { caseRequests++; data = cases; }
    else if (path.endsWith('/messages')) {
      if (denied) { status = 403; data = { detail: { reason: 'forbidden' } }; }
      else if (request.method() === 'POST') {
        if (sendFails) { status = 500; data = { detail: { reason: 'server_error' } }; }
        else { const sent = message('staff-new', 'Investigation team (Elena Rostova)', JSON.parse(request.postData()).text); messages.push(sent); status = 201; data = sent; }
      } else data = messages;
    } else if (path === '/hr/insights') data = null;
    else if (path === '/hr/patterns') data = { repeatSubjects: [], correlatedPairs: [], limitation: 'Review guidance only.' };
    else if (path === '/hr/cases/' + report.id) data = report;
    await request.respond({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' }, body: JSON.stringify(data) });
  });
  const clickNav = async id => {
    await page.click(`[data-nav="${id}"]`);
  };
  await page.goto(process.env.DASHBOARD_URL ?? 'http://127.0.0.1:5173', { waitUntil: 'networkidle0' });
  await clickNav('reports');
  cases = [report];
  await page.waitForFunction(id => document.body.innerText.includes(id), { timeout: 10000 }, report.id);
  assert.ok(caseRequests > 2, 'New report arrived without a manual refresh');

  messages = [message('reporter-1', 'Anonymous Reporter', 'Fictional reporter message.'), message('staff-1', 'Investigation team (Elena Rostova)', 'Fictional reviewer reply.')];
  await clickNav('inbox');
  await page.waitForSelector('[data-message-side="reporter"]');
  await page.waitForSelector('[data-message-side="reviewer"]');
  assert.equal(await page.$eval('[data-message-side="reporter"]', el => el.classList.contains('items-start')), true);
  assert.equal(await page.$eval('[data-message-side="reviewer"]', el => el.classList.contains('items-end')), true);
  await page.type('form textarea', 'Unsent fictional draft');
  messages.push(message('reporter-2', 'Anonymous Reporter', 'New incoming fictional message.'));
  await page.waitForFunction(() => document.body.innerText.includes('New incoming fictional message.'), { timeout: 10000 });
  assert.equal(await page.$eval('form textarea', el => el.value), 'Unsent fictional draft');
  sendFails = true;
  await page.click('form button[type="submit"]');
  await page.waitForFunction(() => !document.querySelector('form button[type="submit"]').disabled);
  assert.equal(await page.$eval('form textarea', el => el.value), 'Unsent fictional draft');
  sendFails = false;
  await page.click('form button[type="submit"]');
  await page.waitForFunction(() => document.body.innerText.includes('Unsent fictional draft'), { timeout: 10000 });
  assert.equal(await page.$eval('form textarea', el => el.value), '');
  denied = true;
  await page.waitForFunction(() => document.body.innerText.includes('Conversation access restricted'), { timeout: 10000 });
  assert.equal(await page.$('[data-message-side]'), null, 'Revoked conversation content was removed');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ newReportsUpdateAutomatically: true, incomingMessagesUpdateAutomatically: true, oppositeMessageSides: true, draftPreservedOnRefreshAndFailure: true, replyAppearsImmediately: true, deniedMessagesCleared: true }));
} finally { await browser.close(); }
