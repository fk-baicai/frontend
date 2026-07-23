/**
 * 本地前端静态服务（正确 video/mp4 MIME，避免 Chrome 首帧闪白）。
 * 用法：node dev-static-server.js
 * 访问：http://127.0.0.1:8080/
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.env.USS_FRONTEND_PORT) || 8080;
const HOST = process.env.USS_FRONTEND_HOST || '127.0.0.1';

function contentType(filePath) {
    if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
    if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
    if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8';
    if (filePath.endsWith('.mp4')) return 'video/mp4';
    if (filePath.endsWith('.webm')) return 'video/webm';
    if (filePath.endsWith('.png')) return 'image/png';
    if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) return 'image/jpeg';
    if (filePath.endsWith('.ico')) return 'image/x-icon';
    if (filePath.endsWith('.json')) return 'application/json';
    if (filePath.endsWith('.svg')) return 'image/svg+xml';
    if (filePath.endsWith('.woff2')) return 'font/woff2';
    return 'application/octet-stream';
}

const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    const safe = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
    const rel = safe === path.sep ? 'index.html' : safe.replace(/^\//, '');
    const filePath = path.join(ROOT, rel);

    if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
        return;
    }

    const stat = fs.statSync(filePath);
    const headers = {
        'Content-Type': contentType(filePath),
        'Cache-Control': /\.(mp4|webm)$/i.test(filePath)
            ? 'public, max-age=31536000, immutable'
            : 'no-cache',
    };
    res.writeHead(200, headers);
    fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, HOST, () => {
    console.log(`[uss-frontend] http://${HOST}:${PORT}/`);
    console.log('[uss-frontend] mp4 Content-Type: video/mp4');
});
