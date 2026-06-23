// =============================================================
//  Server LOKAL untuk uji coba di laptop (opsional).
//  Vercel TIDAK memakai file ini — di Vercel dipakai folder api/.
//  Jalankan:  node --env-file=.env server.js   (Node 20+)
//         atau:  node server.js  (env loader manual di bawah)
// =============================================================
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// loader .env sederhana (kalau belum dimuat via --env-file)
(function loadEnv() {
  const f = path.join(__dirname, '.env');
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
})();

const { ROOMS, TZ } = await import('./lib/config.js');
const { fetchRoomEvents } = await import('./lib/lark.js');

const PORT = parseInt(process.env.PORT || '3000', 10);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

function sendJSON(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(obj));
}
function serveStatic(res, urlPath) {
  const rel = (urlPath === '/' ? '/index.html' : urlPath).split('?')[0];
  const base = path.join(__dirname, 'public');
  const file = path.join(base, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(base)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://' + req.headers.host);
  const p = url.pathname;
  const m = p.match(/^\/api\/room\/([^/]+)\/today$/);
  if (m) {
    const key = decodeURIComponent(m[1]);
    const room = ROOMS.find(r => r.key === key);
    if (!room) return sendJSON(res, 404, { error: "Ruangan '" + key + "' tidak ditemukan. Cek lib/config.js." });
    try {
      const events = await fetchRoomEvents(room);
      return sendJSON(res, 200, {
        room: { key: room.key, name: room.name, capacity: room.capacity, location: room.location },
        now: new Date().toISOString(), timezone: TZ, events, stale: false,
      });
    } catch (e) { return sendJSON(res, 502, { error: e.message }); }
  }
  if (p === '/api/rooms') return sendJSON(res, 200, ROOMS.map(r => ({ key: r.key, name: r.name })));
  if (p === '/healthz') return sendJSON(res, 200, { ok: true, rooms: ROOMS.length });
  serveStatic(res, p);
}).listen(PORT, () => {
  console.log('\n  [LOKAL] jalan di http://localhost:' + PORT);
  console.log('  Display:  http://localhost:' + PORT + '/?room=' + (ROOMS[0] && ROOMS[0].key));
  console.log('  Memuat ' + ROOMS.length + ' ruangan: ' + ROOMS.map(r => r.key).join(', ') + '\n');
});
