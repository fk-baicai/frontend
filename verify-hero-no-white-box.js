/**
 * 检测首页 hero 左上角是否出现大面积浅色块（本地 8080 白框回归）。
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { PNG } = require('pngjs');

const ROOT = __dirname;
const CLIP = { x: 0, y: 95, width: 360, height: 360 };
const SAMPLE_EVERY_MS = 200;
const DURATION_MS = 12000;
const WHITE_THRESHOLD = 200;
const MAX_WHITE_RATIO = 0.06;

function contentType(filePath) {
    if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
    if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
    if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8';
    if (filePath.endsWith('.mp4')) return 'video/mp4';
    if (filePath.endsWith('.png')) return 'image/png';
    return 'application/octet-stream';
}

function startFallbackServer(port) {
    const server = http.createServer((req, res) => {
        const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
        const safe = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
        const rel = safe === path.sep ? 'index.html' : safe.replace(/^\//, '');
        const filePath = path.join(ROOT, rel);
        if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
            res.writeHead(404);
            res.end('not found');
            return;
        }
        res.writeHead(200, { 'Content-Type': contentType(filePath) });
        fs.createReadStream(filePath).pipe(res);
    });
    return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

async function ensureUrl() {
    const preferred = process.env.USS_TEST_URL || 'http://127.0.0.1:8080/';
    try {
        const u = new URL(preferred);
        const port = Number(u.port) || 80;
        await new Promise((resolve, reject) => {
            const req = http.get(
                { host: u.hostname, port, path: '/', timeout: 1200 },
                (res) => {
                    res.resume();
                    resolve();
                }
            );
            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('timeout'));
            });
        });
        return { url: preferred, server: null, spawned: null };
    } catch (e) {
        const port = 3891;
        const server = await startFallbackServer(port);
        return { url: `http://127.0.0.1:${port}/`, server, spawned: null };
    }
}

function whiteRatio(pngBuffer) {
    const png = PNG.sync.read(pngBuffer);
    let white = 0;
    let total = 0;
    const x1 = Math.min(CLIP.width, png.width);
    const y1 = Math.min(CLIP.height, png.height);
    for (let y = 0; y < y1; y++) {
        for (let x = 0; x < x1; x++) {
            const idx = (png.width * y + x) << 2;
            const r = png.data[idx];
            const g = png.data[idx + 1];
            const b = png.data[idx + 2];
            total++;
            if (r >= WHITE_THRESHOLD && g >= WHITE_THRESHOLD && b >= WHITE_THRESHOLD) {
                white++;
            }
        }
    }
    return total ? white / total : 0;
}

async function sampleWindow(page, failures, samples, label) {
    const buf = await page.screenshot({ type: 'png', clip: CLIP });
    const ratio = whiteRatio(buf);
    const meta = await page.evaluate(() => ({
        htmlClass: document.documentElement.className,
        hasBootCover: !!document.getElementById('heroBootCover'),
        bootOpacity: document.getElementById('heroBootCover')
            ? getComputedStyle(document.getElementById('heroBootCover')).opacity
            : null,
        parkedParent: document.getElementById('myVideo1')?.parentElement?.id || null,
        stageHasVideo: !!document.querySelector('#heroVideoStage video'),
        memberGatedVisible: !!Array.from(document.querySelectorAll('.auth-member-gated')).find((el) => {
            const cs = getComputedStyle(el);
            return cs.display !== 'none' && cs.visibility !== 'hidden';
        }),
        src: document.getElementById('myVideo1')?.currentSrc || '',
        isBlob: String(document.getElementById('myVideo1')?.currentSrc || '').indexOf('blob:') === 0,
    }));
    const row = { label, ratio: Number(ratio.toFixed(4)), meta };
    samples.push(row);
    if (ratio > MAX_WHITE_RATIO) {
        failures.push(row);
        fs.writeFileSync(path.join(__dirname, '_tmp-hero-white-fail.png'), buf);
    }
    if (!String(meta.htmlClass).includes('hero-video-live') && meta.stageHasVideo) {
        failures.push({ label: label + '-video-in-stage-early', ratio, meta });
    }
    if (!String(meta.htmlClass).includes('hero-video-live') && Number(meta.bootOpacity) < 1) {
        failures.push({ label: label + '-boot-cover-missing', ratio, meta });
    }
    if (meta.isBlob) {
        failures.push({ label: label + '-blob-src', ratio, meta });
    }
    if (!String(meta.htmlClass).includes('hero-video-live') && meta.memberGatedVisible) {
        failures.push({ label: label + '-member-gated-early', ratio, meta });
    }
    return ratio;
}

async function runPass(page, failures, samples, prefix) {
    const steps = Math.ceil(DURATION_MS / SAMPLE_EVERY_MS);
    for (let i = 0; i < steps; i++) {
        await page.waitForTimeout(SAMPLE_EVERY_MS);
        await sampleWindow(page, failures, samples, prefix + '-t' + (i + 1) * SAMPLE_EVERY_MS);
    }
}

async function seedLoggedInSession(page) {
    await page.evaluate(() => {
        const sess = {
            token: 'verify-token',
            bindingId: 'VerifyUser',
            loginAt: new Date().toISOString(),
            expiresAt: Date.now() + 86400000,
        };
        sessionStorage.setItem('ussHangzhouAuthSession', JSON.stringify(sess));
        document.documentElement.classList.add('auth-session-cached');
    });
}

async function main() {
    const target = await ensureUrl();
    const browser = await chromium.launch({
        headless: true,
        args: ['--autoplay-policy=no-user-gesture-required'],
    });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

    const failures = [];
    const samples = [];

    await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await runPass(page, failures, samples, 'guest-load');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await runPass(page, failures, samples, 'guest-reload');

    await seedLoggedInSession(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await runPass(page, failures, samples, 'auth-reload');

    await browser.close();
    if (target.server) target.server.close();

    const worst = samples.reduce((a, b) => (a.ratio > b.ratio ? a : b), { ratio: 0 });
    const report = {
        url: target.url,
        pass: failures.length === 0,
        maxWhiteRatio: worst.ratio,
        threshold: MAX_WHITE_RATIO,
        failures: failures.slice(0, 10),
        tail: samples.slice(-5),
    };
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.pass ? 0 : 1);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
