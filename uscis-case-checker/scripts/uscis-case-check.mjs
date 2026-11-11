import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOOKUP_URL = 'https://egov.uscis.gov/casestatus/landing.do';
const DEFAULT_RECEIPT = process.env.CASE_RECEIPT || 'IOE8434753880';
const DEFAULT_WORKER = 'https://yookoo-daily-bot.phamminhtrikg.workers.dev';

function parseArgs(argv) {
  const out = { receipt: DEFAULT_RECEIPT, workerUrl: '', nonce: '', timeout: 180, keepOpen: false, profile: path.join(ROOT, '.uscis-browser-profile') };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') { console.log('npm run case -- --receipt IOE8434753880 [--nonce NONCE] [--worker-url URL]'); process.exit(0); }
    if (arg === '--keep-open') { out.keepOpen = true; continue; }
    const value = argv[++i];
    if (!value) throw new Error('Thiếu giá trị sau ' + arg);
    if (arg === '--receipt') out.receipt = value;
    else if (arg === '--worker-url') out.workerUrl = value.replace(/\/$/, '');
    else if (arg === '--nonce') out.nonce = value;
    else if (arg === '--profile') out.profile = path.resolve(value);
    else if (arg === '--timeout') out.timeout = Number(value);
    else throw new Error('Tùy chọn không hợp lệ: ' + arg);
  }
  out.receipt = String(out.receipt).trim().toUpperCase();
  if (!/^[A-Z]{3}\d{10}$/.test(out.receipt)) throw new Error('Receipt phải có dạng ABC1234567890.');
  if (!Number.isFinite(out.timeout) || out.timeout < 20 || out.timeout > 900) throw new Error('--timeout phải từ 20 đến 900 giây.');
  if (out.nonce && !out.workerUrl) out.workerUrl = DEFAULT_WORKER;
  if (out.nonce && !/^[a-z0-9]{24,80}$/.test(out.nonce)) throw new Error('Nonce không đúng định dạng.');
  return out;
}

async function visible(page, selectors) {
  for (const selector of selectors) {
    const item = page.locator(selector).first();
    if (await item.count() && await item.isVisible().catch(() => false)) return item;
  }
  return null;
}

async function submitReceipt(page, receipt) {
  const input = await visible(page, ['input[name="appReceiptNum"]', 'input[id*="receipt" i]', 'input[name*="receipt" i]', 'input[placeholder*="receipt" i]']);
  if (!input) throw new Error('Không tìm thấy ô Receipt Number.');
  await input.fill(receipt);
  const button = await visible(page, ['button:has-text("Check Case Status")', 'button:has-text("Check Status")', 'input[type="submit"]', 'button[type="submit"]']);
  if (!button) throw new Error('Không tìm thấy nút tra cứu.');
  await button.click();
}

function lines(text) { return String(text || '').split(/\r?\n/).map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean); }

async function readResult(page, receipt) {
  const body = await page.locator('body').innerText().catch(() => '');
  if (!new RegExp('\\b' + receipt + '\\b', 'i').test(body.replace(/\s+/g, ' '))) return null;
  const headings = lines(await page.locator('h1,h2,h3').allTextContents());
  const title = headings.find(x => x.length >= 5 && x.length <= 180 && !/Case Status Online|Check Case Status/i.test(x));
  if (!title) return null;
  const ps = lines(await page.locator('p').allTextContents()).filter(x => x.length > 20);
  const text = (ps.length ? ps.join('\n') : lines(body).join('\n')).slice(0, 2500);
  if (text.length < 25) return null;
  const match = /\bOn\s+([A-Z][a-z]+\s+\d{1,2},\s+20\d{2})\b/.exec(text);
  const date = match ? new Date(match[1] + ' 00:00:00 GMT') : null;
  return { version: 1, receipt, title: title.slice(0, 180), text, eventDate: date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : null, newReceipt: null, origin: 'local-playwright', sourceUrl: page.url(), readAt: new Date().toISOString() };
}

async function waitResult(page, receipt, seconds) {
  const end = Date.now() + seconds * 1000;
  let warned = false;
  while (Date.now() < end) {
    const body = await page.locator('body').innerText().catch(() => '');
    if (!warned && /verify you are human|checking your browser|cf-chl-|captcha|attention required/i.test(body)) { warned = true; console.log('USCIS yêu cầu CAPTCHA/Cloudflare. Hãy xử lý thủ công trong cửa sổ trình duyệt.'); }
    const result = await readResult(page, receipt);
    if (result) return result;
    await page.waitForTimeout(1000);
  }
  throw new Error('Hết thời gian chờ kết quả.');
}

async function sendWorker(result, workerUrl, nonce) {
  const response = await fetch(workerUrl + '/browser/submit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nonce, receipt: result.receipt, title: result.title, text: result.text, sourceUrl: result.sourceUrl, readAt: result.readAt }) });
  const body = await response.text();
  if (!response.ok) throw new Error('Worker từ chối (' + response.status + '): ' + body);
  return JSON.parse(body);
}

const options = parseArgs(process.argv.slice(2));
await fs.mkdir(options.profile, { recursive: true });
console.log('Mở USCIS để tra ' + options.receipt + '...');
const context = await chromium.launchPersistentContext(options.profile, { headless: false, channel: 'msedge', viewport: null });
const page = context.pages()[0] || await context.newPage();
try {
  await page.goto(LOOKUP_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await submitReceipt(page, options.receipt);
  const result = await waitResult(page, options.receipt, options.timeout);
  const dir = path.join(ROOT, '.case-results');
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, result.receipt + '-' + Date.now() + '.json');
  await fs.writeFile(file, JSON.stringify(result, null, 2) + '\n', 'utf8');
  console.log('\n' + result.title + '\n' + result.text + '\nĐã lưu: ' + file);
  if (options.nonce) console.log('Worker: ' + JSON.stringify(await sendWorker(result, options.workerUrl, options.nonce)));
  else console.log('Chưa gửi Worker vì chưa truyền --nonce.');
} finally { if (!options.keepOpen) await context.close(); }
