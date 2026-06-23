// =============================================================
//  Helper Lark — judul via user token (List Events) + organizer via freebusy.
//  Kalau event tanpa subjek (summary kosong), pakai nama pemesan sebagai label.
// =============================================================
import { getRefreshToken, setRefreshToken, storeEnabled } from './store.js';
function baseUrl() { return process.env.LARK_BASE_URL || 'https://open.larksuite.com'; }

let appTok = { value: '', exp: 0 };
async function getAppToken() {
  const now = Date.now();
  if (appTok.value && now < appTok.exp - 5 * 60 * 1000) return appTok.value;
  const id = process.env.LARK_APP_ID || '', sec = process.env.LARK_APP_SECRET || '';
  if (!id || !sec) throw new Error('LARK_APP_ID / LARK_APP_SECRET belum diset');
  const r = await fetch(baseUrl() + '/open-apis/auth/v3/app_access_token/internal', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: id, app_secret: sec }),
  });
  const d = await r.json();
  if (d.code !== 0) throw new Error('app_access_token gagal: ' + d.code + ' ' + d.msg);
  appTok = { value: d.app_access_token, exp: now + (d.expire || 7200) * 1000 };
  return appTok.value;
}

let tenantTok = { value: '', exp: 0 };
export async function getToken() {
  const now = Date.now();
  if (tenantTok.value && now < tenantTok.exp - 5 * 60 * 1000) return tenantTok.value;
  const id = process.env.LARK_APP_ID || '', sec = process.env.LARK_APP_SECRET || '';
  if (!id || !sec) throw new Error('LARK_APP_ID / LARK_APP_SECRET belum diset');
  const r = await fetch(baseUrl() + '/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: id, app_secret: sec }),
  });
  const d = await r.json();
  if (d.code !== 0) throw new Error('Gagal ambil token: ' + d.code + ' ' + d.msg);
  tenantTok = { value: d.tenant_access_token, exp: now + (d.expire || 7200) * 1000 };
  return tenantTok.value;
}

let userTok = { value: '', exp: 0 };
let curRefresh = '';
async function getUserToken() {
  const now = Date.now();
  if (userTok.value && now < userTok.exp - 5 * 60 * 1000) return userTok.value;
  const rt = curRefresh || await getRefreshToken();
  if (!rt) throw new Error('refresh token kosong — jalankan auth-login.js');
  const at = await getAppToken();
  const r = await fetch(baseUrl() + '/open-apis/authen/v1/oidc/refresh_access_token', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + at, 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'refresh_token', refresh_token: rt }),
  });
  const d = await r.json();
  if (d.code !== 0) throw new Error('refresh user token gagal: ' + d.code + ' ' + d.msg);
  const t = d.data || d;
  userTok = { value: t.access_token, exp: now + (t.expires_in || 7200) * 1000 };
  if (t.refresh_token && t.refresh_token !== rt) { curRefresh = t.refresh_token; await setRefreshToken(t.refresh_token); }
  else curRefresh = rt;
  return userTok.value;
}

function todayEpoch() {
  const n = new Date(); const s = new Date(n); s.setHours(0,0,0,0); const e = new Date(n); e.setHours(23,59,59,0);
  return { start: Math.floor(s/1000), end: Math.floor(e/1000) };
}
function todayRFC() {
  const n = new Date(); const s = new Date(n); s.setHours(0,0,0,0); const e = new Date(n); e.setHours(23,59,59,0);
  return { time_min: s.toISOString(), time_max: e.toISOString() };
}

const calIdCache = new Map();
async function resolveCalendarId(room, token) {
  if (calIdCache.has(room.key)) return calIdCache.get(room.key);
  const queries = [room.name, (room.location ? room.location + '-' + room.name : null)].filter(Boolean);
  for (const q of queries) {
    const r = await fetch(baseUrl() + '/open-apis/calendar/v4/calendars/search', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q }),
    });
    const d = await r.json();
    if (d.code !== 0) continue;
    const items = (d.data && (d.data.items || d.data.calendar_list)) || [];
    const hit = items.find(c => (c.summary || '').toLowerCase().includes(room.name.toLowerCase())) || items[0];
    if (hit && hit.calendar_id) { calIdCache.set(room.key, hit.calendar_id); return hit.calendar_id; }
  }
  throw new Error('calendar_id tidak ketemu untuk ' + room.name);
}

async function fetchTitled(room) {
  const token = await getUserToken();
  const calId = await resolveCalendarId(room, token);
  const { start, end } = todayEpoch();
  const url = baseUrl() + '/open-apis/calendar/v4/calendars/' + encodeURIComponent(calId)
    + '/events?start_time=' + start + '&end_time=' + end + '&page_size=100';
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  const d = await r.json();
  if (d.code !== 0) throw new Error('List events gagal (' + room.key + '): ' + d.code + ' ' + d.msg);
  const items = (d.data && d.data.items) || [];
  return items
    .filter(ev => ev.status !== 'cancelled')
    .map(ev => ({
      title: (ev.summary || '').trim(),
      organizer: (ev.event_organizer && ev.event_organizer.display_name) || '',
      start: ev.start_time && ev.start_time.timestamp ? new Date(parseInt(ev.start_time.timestamp,10)*1000).toISOString() : null,
      end: ev.end_time && ev.end_time.timestamp ? new Date(parseInt(ev.end_time.timestamp,10)*1000).toISOString() : null,
    }))
    .filter(e => e.start && e.end)
    .sort((a,b) => new Date(a.start) - new Date(b.start));
}

async function fetchFreebusy(room) {
  const token = await getToken();
  const { time_min, time_max } = todayRFC();
  const url = baseUrl() + '/open-apis/meeting_room/freebusy/batch_get'
    + '?room_ids=' + encodeURIComponent(room.room_id)
    + '&time_min=' + encodeURIComponent(time_min)
    + '&time_max=' + encodeURIComponent(time_max);
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  const d = await r.json();
  if (d.code !== 0) throw new Error('Freebusy gagal (' + room.key + '): ' + d.code + ' ' + d.msg);
  const blocks = (d.data && d.data.free_busy && d.data.free_busy[room.room_id]) || [];
  return blocks.map(b => ({
    organizer: (b.organizer_info && b.organizer_info.name) || '',
    start: new Date(b.start_time).toISOString(),
    end: new Date(b.end_time).toISOString(),
  })).sort((a,b) => new Date(a.start) - new Date(b.start));
}

// Gabung: organizer dari freebusy (paling andal) -> final title = subjek || nama pemesan
function finalize(titled, busy) {
  return titled.map(ev => {
    const s = new Date(ev.start), e = new Date(ev.end);
    const m = busy.find(b => new Date(b.start) < e && new Date(b.end) > s);
    const organizer = ev.organizer || (m && m.organizer) || '';
    const title = ev.title || organizer || 'Terpakai';
    return { title, organizer, start: ev.start, end: ev.end };
  });
}

export async function fetchRoomEvents(room) {
  if (storeEnabled() || process.env.LARK_REFRESH_TOKEN) {
    try {
      const titled = await fetchTitled(room);
      let busy = [];
      try { busy = await fetchFreebusy(room); } catch (_) {}
      return finalize(titled, busy);
    } catch (e) {
      console.error('[user-token] gagal, fallback ke freebusy:', e.message);
    }
  }
  // fallback: freebusy saja (nama pemesan sebagai judul)
  const busy = await fetchFreebusy(room);
  return busy.map(b => ({ title: b.organizer || 'Terpakai', organizer: b.organizer, start: b.start, end: b.end }));
}
