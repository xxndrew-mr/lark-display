// =============================================================
//  Diagnosa: cari kalender / meeting room yang bisa diakses app.
//  Jalankan:  node find-rooms.js
//
//  Tujuan: menemukan calendar_id tiap meeting room untuk diisi ke lib/config.js
// =============================================================
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const BASE = process.env.LARK_BASE_URL || 'https://open.larksuite.com';
const APP_ID = process.env.LARK_APP_ID || '';
const APP_SECRET = process.env.LARK_APP_SECRET || '';

async function getToken() {
  const res = await fetch(BASE + '/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET }),
  });
  const d = await res.json();
  if (d.code !== 0) throw new Error('Token gagal: ' + d.code + ' ' + d.msg);
  return d.tenant_access_token;
}

async function get(token, url) {
  const res = await fetch(BASE + url, { headers: { Authorization: 'Bearer ' + token } });
  return res.json();
}

function line() { console.log('-'.repeat(60)); }

(async () => {
  if (!APP_ID || !APP_SECRET) { console.error('Isi LARK_APP_ID & LARK_APP_SECRET di .env'); process.exit(1); }
  const token = await getToken();

  // ===== METODE A: daftar kalender yang bisa diakses app =====
  line(); console.log('METODE A — Daftar kalender yang bisa diakses app');
  line();
  try {
    let pageToken = '', total = 0;
    do {
      const r = await get(token, '/open-apis/calendar/v4/calendars?page_size=50' + (pageToken ? '&page_token=' + pageToken : ''));
      if (r.code !== 0) { console.log('  [error]', r.code, r.msg); break; }
      const items = (r.data && r.data.calendar_list) || [];
      for (const c of items) {
        total++;
        console.log('  name        :', c.summary || '(tanpa nama)');
        console.log('  calendar_id :', c.calendar_id);
        console.log('  type        :', c.type, '| role:', c.role);
        console.log('  ---');
      }
      pageToken = (r.data && r.data.page_token) || '';
      if (!(r.data && r.data.has_more)) break;
    } while (pageToken);
    if (total === 0) console.log('  (kosong — app belum berlangganan kalender apa pun)');
  } catch (e) { console.log('  [gagal]', e.message); }

  // ===== METODE B: daftar meeting room (resource) =====
  line(); console.log('METODE B — Daftar meeting room (untuk dapat room_id / calendar_id)');
  line();
  try {
    const b = await get(token, '/open-apis/meeting_room/building/list?page_size=100&order_by=name-asc&fields=*');
    if (b.code !== 0) {
      console.log('  [error building/list]', b.code, b.msg,
        '\n  -> Kemungkinan perlu scope "meeting_room:readonly" (View meeting room info).');
    } else {
      const buildings = (b.data && b.data.buildings) || [];
      console.log('  Ditemukan', buildings.length, 'gedung.');
      for (const bd of buildings) {
        console.log('  == Gedung:', bd.name, '(building_id:', bd.building_id + ')');
        const r = await get(token, '/open-apis/meeting_room/room/list?building_id=' + encodeURIComponent(bd.building_id) + '&page_size=100&fields=*');
        if (r.code !== 0) { console.log('    [error room/list]', r.code, r.msg); continue; }
        const rooms = (r.data && r.data.rooms) || [];
        for (const rm of rooms) {
          console.log('     room name   :', rm.name);
          console.log('     room_id     :', rm.room_id);
          if (rm.calendar_id) console.log('     calendar_id :', rm.calendar_id);
          console.log('     (raw):', JSON.stringify(rm));
          console.log('     ---');
        }
      }
    }
  } catch (e) { console.log('  [gagal]', e.message); }

  line();
  console.log('Tempelkan seluruh output ini ke chat ya, biar saya petakan ke lib/config.js.');
})();
