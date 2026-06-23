// =============================================================
//  Probe 2: meeting_room/freebusy/batch_get
//  Endpoint freebusy KHUSUS meeting room -> sering memuat judul + organizer.
//  Jalankan:  node probe2.js
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

// room_id "Excellent" (punya Anda). Ganti bila ingin tes ruangan lain.
const ROOM_ID = 'omm_1b0481181706104c397a80e736f492da';

async function token() {
  const r = await fetch(BASE + '/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET }),
  });
  const d = await r.json();
  if (d.code !== 0) throw new Error('Token gagal: ' + d.code + ' ' + d.msg);
  return d.tenant_access_token;
}

(async () => {
  if (!APP_ID || !APP_SECRET) { console.error('Isi .env dulu'); process.exit(1); }
  const t = await token();

  const now = new Date();
  const s = new Date(now); s.setHours(0,0,0,0);
  const e = new Date(now); e.setHours(23,59,59,0);
  const time_min = s.toISOString();
  const time_max = e.toISOString();

  const url = BASE + '/open-apis/meeting_room/freebusy/batch_get'
    + '?room_ids=' + encodeURIComponent(ROOM_ID)
    + '&time_min=' + encodeURIComponent(time_min)
    + '&time_max=' + encodeURIComponent(time_max);

  console.log('GET', url, '\n');
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + t } });
  const d = await r.json();
  console.log('HTTP', r.status);
  console.log(JSON.stringify(d, null, 2));
  console.log('\nTempel seluruh output ini ke chat.');
})();
