// =============================================================
//  Probe: cek apakah kita bisa dapat calendar_id meeting room
//  (supaya bisa tampilkan JUDUL + pembooking, bukan cuma free/busy)
//
//  Jalankan:  node probe-titles.js
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

async function token() {
  const r = await fetch(BASE + '/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET }),
  });
  const d = await r.json();
  if (d.code !== 0) throw new Error('Token gagal: ' + d.code + ' ' + d.msg);
  return d.tenant_access_token;
}
async function get(t, url) {
  const r = await fetch(BASE + url, { headers: { Authorization: 'Bearer ' + t } });
  return r.json();
}
function line(){ console.log('-'.repeat(60)); }

(async () => {
  if (!APP_ID || !APP_SECRET) { console.error('Isi .env dulu'); process.exit(1); }
  const t = await token();

  // ---- 1) vc/v1/rooms : apakah ada calendar_id? ----
  line(); console.log('1) GET /open-apis/vc/v1/rooms  (cari field calendar_id)'); line();
  let firstCalId = null, firstRoomName = null;
  try {
    const r = await get(t, '/open-apis/vc/v1/rooms?page_size=20');
    if (r.code !== 0) {
      console.log('  [error]', r.code, r.msg, '\n  -> mungkin perlu scope "vc:room:readonly".');
    } else {
      const rooms = (r.data && r.data.rooms) || [];
      console.log('  Ditemukan', rooms.length, 'ruangan. Contoh data mentah 2 ruangan:');
      rooms.slice(0, 2).forEach(rm => console.log('   ', JSON.stringify(rm)));
      // cari field yang mengandung "calendar"
      for (const rm of rooms) {
        const key = Object.keys(rm).find(k => k.toLowerCase().includes('calendar'));
        if (key && rm[key]) { firstCalId = rm[key]; firstRoomName = rm.name; break; }
      }
      console.log(firstCalId ? ('  >> ADA calendar_id! contoh: ' + firstCalId) : '  >> Tidak ada field calendar_id di vc/v1/rooms.');
    }
  } catch (e) { console.log('  [gagal]', e.message); }

  // ---- 2) kalau ada calendar_id, coba List Events (judul + organizer) ----
  if (firstCalId) {
    line(); console.log('2) Tes List Events pakai calendar_id (' + firstRoomName + ')'); line();
    const now = new Date();
    const s = new Date(now); s.setHours(0,0,0,0);
    const e = new Date(now); e.setHours(23,59,59,0);
    const url = '/open-apis/calendar/v4/calendars/' + encodeURIComponent(firstCalId)
      + '/events?start_time=' + Math.floor(s/1000) + '&end_time=' + Math.floor(e/1000) + '&page_size=50';
    const r = await get(t, url);
    if (r.code !== 0) { console.log('  [error events]', r.code, r.msg); }
    else {
      const items = (r.data && r.data.items) || [];
      console.log('  ' + items.length + ' event hari ini. Contoh:');
      items.slice(0,3).forEach(ev => console.log('    summary:', ev.summary, '| start:', JSON.stringify(ev.start_time), '| organizer:', JSON.stringify(ev.event_organizer || ev.organizer || '')));
      console.log(items.length ? '  >> BISA dapat JUDUL! ' : '  >> Kalender kosong hari ini (tapi akses OK).');
    }
  }

  line();
  console.log('Tempel seluruh output ini ke chat ya.');
})();
