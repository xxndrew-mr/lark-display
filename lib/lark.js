// =============================================================
//  Helper Lark (token aplikasi) — REAL-TIME + JUDUL.
//  Sumber: vc/v1/resource_reservation_list -> judul, pemesan, departemen, jam.
//  room_level_id diambil otomatis dari vc/v1/rooms. Fallback: meeting_room freebusy.
// =============================================================
function baseUrl() { return process.env.LARK_BASE_URL || 'https://open.larksuite.com'; }

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

// Rentang "hari ini" (epoch detik) menurut zona Asia/Jakarta (+07:00), tahan tz server
function todayEpochJakarta() {
  const off = 7 * 3600;
  const local = Math.floor(Date.now() / 1000) + off;
  const start = Math.floor(local / 86400) * 86400 - off;
  return { start, end: start + 86399 };
}

// "2026.06.24 14:00:00 (GMT+08:00)" -> ISO UTC
function parseLarkDT(s) {
  const m = (s || '').match(/(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2}):(\d{2})\s*\(GMT([+-]\d{2}):(\d{2})\)/);
  if (!m) return null;
  const [, y, mo, d, H, M, S, oh, om] = m;
  const sign = parseInt(oh, 10) >= 0 ? 1 : -1;
  const off = sign * (Math.abs(parseInt(oh, 10)) * 3600 + parseInt(om, 10) * 60);
  return new Date(Date.UTC(+y, +mo - 1, +d, +H, +M, +S) - off * 1000).toISOString();
}

// Peta room_id -> room_level_id (dari vc/v1/rooms), di-cache
let roomLevelMap = null;
async function loadRoomLevels(token) {
  if (roomLevelMap) return roomLevelMap;
  const map = {};
  let pt = '';
  do {
    const r = await fetch(baseUrl() + '/open-apis/vc/v1/rooms?page_size=100' + (pt ? '&page_token=' + pt : ''), { headers: { Authorization: 'Bearer ' + token } });
    const d = await r.json();
    if (d.code !== 0) throw new Error('vc rooms gagal: ' + d.code + ' ' + d.msg);
    for (const rm of (d.data && d.data.rooms) || []) map[rm.room_id] = rm.room_level_id;
    pt = (d.data && d.data.page_token) || '';
    if (!(d.data && d.data.has_more)) break;
  } while (pt);
  roomLevelMap = map;
  return map;
}

// Reservasi hari ini (dengan judul) untuk satu ruangan
async function fetchReservations(room, token) {
  const levels = await loadRoomLevels(token);
  const level = levels[room.room_id];
  if (!level) throw new Error('room_level_id tidak ketemu untuk ' + room.key);
  const { start, end } = todayEpochJakarta();
  let items = [], pt = '';
  do {
    const url = baseUrl() + '/open-apis/vc/v1/resource_reservation_list'
      + '?room_level_id=' + encodeURIComponent(level)
      + '&room_ids=' + encodeURIComponent(room.room_id)
      + '&need_topic=true&start_time=' + start + '&end_time=' + end + '&page_size=100'
      + (pt ? '&page_token=' + pt : '');
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
    const d = await r.json();
    if (d.code !== 0) throw new Error('reservation_list gagal (' + room.key + '): ' + d.code + ' ' + d.msg);
    items = items.concat((d.data && d.data.room_reservation_list) || []);
    pt = (d.data && d.data.page_token) || '';
    if (!(d.data && d.data.has_more)) break;
  } while (pt);

  return items
    .filter(it => !/取消|cancel|失败|reject/i.test(it.reservation_status || ''))
    .map(it => ({
      title: (it.event_title || '').trim() || it.reserver || 'Terpakai',
      organizer: it.reserver || '',
      department: it.department_of_reserver && it.department_of_reserver !== '-' ? it.department_of_reserver : '',
      start: parseLarkDT(it.event_start_time),
      end: parseLarkDT(it.event_end_time),
    }))
    .filter(e => e.start && e.end)
    .sort((a, b) => new Date(a.start) - new Date(b.start));
}

// Fallback: meeting_room freebusy (status+jam+nama saja)
async function fetchFreebusy(room, token) {
  const { start, end } = todayEpochJakarta();
  const url = baseUrl() + '/open-apis/meeting_room/freebusy/batch_get'
    + '?room_ids=' + encodeURIComponent(room.room_id)
    + '&time_min=' + encodeURIComponent(new Date(start * 1000).toISOString())
    + '&time_max=' + encodeURIComponent(new Date(end * 1000).toISOString());
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  const d = await r.json();
  if (d.code !== 0) throw new Error('Freebusy gagal (' + room.key + '): ' + d.code + ' ' + d.msg);
  const blocks = (d.data && d.data.free_busy && d.data.free_busy[room.room_id]) || [];
  return blocks.map(b => {
    const name = (b.organizer_info && b.organizer_info.name) || '';
    return { title: name || 'Terpakai', organizer: name, department: '', start: new Date(b.start_time).toISOString(), end: new Date(b.end_time).toISOString() };
  }).sort((a, b) => new Date(a.start) - new Date(b.start));
}

export async function fetchRoomEvents(room) {
  const token = await getToken();
  try {
    return await fetchReservations(room, token);
  } catch (e) {
    console.error('[reservation] gagal, fallback freebusy:', e.message);
    return fetchFreebusy(room, token);
  }
}
