// =============================================================
//  Helper: cari calendar_id ruangan berdasarkan nama
//  Pakai sekali untuk mengisi rooms.json
//
//  Jalankan:
//    node find-calendar.js "Ruang Garuda"
//    node find-calendar.js            (tampilkan semua kalender yang terlihat app)
// =============================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// loader .env sederhana (tanpa paket dotenv)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const APP_ID = process.env.LARK_APP_ID || '';
const APP_SECRET = process.env.LARK_APP_SECRET || '';
const BASE_URL = process.env.LARK_BASE_URL || 'https://open.larksuite.com';

async function getToken() {
  const res = await fetch(`${BASE_URL}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET }),
  });
  const data = await res.json();
  if (data.code !== 0) throw new Error(`Token gagal: ${data.code} ${data.msg}`);
  return data.tenant_access_token;
}

async function searchCalendar(token, query) {
  const res = await fetch(`${BASE_URL}/open-apis/calendar/v4/calendars/search`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  return res.json();
}

async function listCalendars(token) {
  const res = await fetch(`${BASE_URL}/open-apis/calendar/v4/calendars?page_size=50`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

(async () => {
  if (!APP_ID || !APP_SECRET) {
    console.error('Isi dulu LARK_APP_ID & LARK_APP_SECRET di .env');
    process.exit(1);
  }
  const token = await getToken();
  const query = process.argv[2];

  let data;
  if (query) {
    console.log(`\nMencari kalender dengan kata kunci: "${query}"\n`);
    data = await searchCalendar(token, query);
  } else {
    console.log('\nMenampilkan kalender yang terlihat oleh app:\n');
    data = await listCalendars(token);
  }

  if (data.code !== 0) {
    console.error('Error:', data.code, data.msg);
    process.exit(1);
  }

  const items = (data.data && (data.data.items || data.data.calendar_list)) || [];
  if (items.length === 0) {
    console.log('Tidak ada hasil. Pastikan ruangan sudah dibagikan ke app & scope kalender aktif.');
    return;
  }
  for (const c of items) {
    console.log('  name        :', c.summary || c.summary_alias || '(tanpa nama)');
    console.log('  calendar_id :', c.calendar_id);
    console.log('  type        :', c.type || '-');
    console.log('  ---');
  }
  console.log('\nSalin calendar_id yang sesuai ke lib/config.js.\n');
})();
