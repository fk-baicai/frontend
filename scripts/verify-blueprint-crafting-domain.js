/**
 * 蓝图系统前端域名可用性检测（API 同源 + 页面 OUT 产出属性）。
 */
'use strict';
const { chromium } = require('playwright');
const BASE = String(process.argv[2] || 'http://127.0.0.1:8080').replace(/\/$/, '');
const AELSEN_ID = '4725bf9e-2981-4a20-a7ae-9b0427638be6';
async function fetchJson(url, opts) {
    const r = await fetch(url, Object.assign({ signal: AbortSignal.timeout(60000) }, opts || {}));
    const body = await r.json().catch(() => ({}));
    return { status: r.status, body };
}
async function verifyApi() {
    const meta = await fetchJson(BASE + '/api/sc/blueprints/meta');
    if (meta.status !== 200 || !meta.body.ok || !meta.body.ready) throw new Error('meta unavailable');
    const list = await fetchJson(BASE + '/api/sc/blueprints?group=component&type=cooling&limit=1');
    const id = list.body.items && list.body.items[0] && list.body.items[0].uuid;
    if (!id) throw new Error('empty list');
    const detail = await fetchJson(BASE + '/api/sc/blueprints/' + encodeURIComponent(id));
    const bp = detail.body.blueprint;
    const statKeys = Object.keys((bp && bp.base_stats) || {});
    if (detail.status !== 200 || !statKeys.length) throw new Error('missing base_stats');
    return { meta: meta.body, statKeys, mods: (bp.ingredients || []).filter(i => (i.stat_modifiers || []).length).length };
}
async function verifyPage() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const url = BASE + '/blueprint-crafting.html?sector=ship&group=component&type=cooling&blueprint=' + encodeURIComponent(AELSEN_ID);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('#bpSimStats .bp-sim-stat', { timeout: 90000 });
    const apiBase = await page.evaluate(() => window.USS_AUTH_API_BASE || '');
    const before = await page.locator('#bpSimStats .bp-sim-stat').allTextContents();
    await page.locator('[data-preset=max]').first().click();
    await page.waitForTimeout(400);
    const after = await page.locator('#bpSimStats .bp-sim-stat').allTextContents();
    const summary = await page.locator('#bpSimSummary').innerText();
    await browser.close();
    if (!before.length) throw new Error('empty OUT stats');
    return { apiBase, statCount: before.length, statsChanged: before.join('|') !== after.join('|'), summary: summary.replace(/\s+/g, ' ').trim() };
}
(async function main() {
    console.log('[verify-blueprint] base', BASE);
    const api = await verifyApi();
    console.log('[verify-blueprint] api ok total=' + api.meta.total + ' mods=' + api.mods);
    const ui = await verifyPage();
    console.log('[verify-blueprint] page ok apiBase=' + ui.apiBase + ' changed=' + ui.statsChanged + ' summary=' + ui.summary);
    const pass = ui.statCount > 0 && ui.summary.includes('Q');
    console.log(pass ? '[verify-blueprint] PASS' : '[verify-blueprint] FAIL');
    process.exit(pass ? 0 : 1);
})().catch(e => { console.error('[verify-blueprint] FAIL', e.message || e); process.exit(1); });
