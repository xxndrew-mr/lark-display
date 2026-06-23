// =============================================================
//  Helper Lark: ambil token + tarik FREE/BUSY satu meeting room.
//  (env dibaca saat dipanggil -> aman urutannya)
//
//  Meeting room/resource hanya mengekspos free/busy (status + jam),
//  bukan judul meeting. Maka tiap blok sibuk ditandai "Terpakai".
// =============================================================
function baseUrl() { return process.env.LARK_BASE_URL || 'https://open.larksuite.com'; }

let tokenCache = { value: '', expireAt: 0 };

export async function getToken() {
  const now = Date.now();
  if (tokenCache.value && now < tokenCache.expireAt - 5 * 60 * 1000) return tokenCache.value;

  const appId = process.env.LARK_APP_ID || '';
  const appSecret = process.env.LARK_APP_SECRET || '';
  if (!appId || !appSecret) throw new Error('LARK_APP_ID / LARK_APP_SECRET belum diset');

  const res = await fetch(baseUrl() + '/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });
  const data = await res.json();
  if (data.code !== 0) throw new Error('Gagal ambil token: ' + data.code + ' ' + data.msg);
  tokenCache = { value: data.tenant_access_token, expireAt: now + (data.expire || 7200) * 1000 };
  return tokenCache.value;
}

// Rentang "hari ini" RFC3339 (ikut zona waktu server; jalankan TZ=Asia/Jakarta)
function todayRangeRFC3339() {
  const now = new Date();
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const end = new Date(now); end.setHours(23, 59, 59, 0);
  return { time_min: start.toISOString(), time_max: end.toISOString() };
}

// Ambil blok sibuk meeting room hari ini -> array event ringkas
export async function fetchRoomEvents(room) {
  const token = await getToken();
  const { time_min, time_max } = todayRangeRFC3339();

  const res = await fetch(baseUrl() + '/open-apis/calendar/v4/freebusy/list', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ time_min, time_max, room_id: room.room_id }),
  });
  const data = await res.json();
  if (data.code !== 0) throw new Error('Freebusy gagal (' + room.key + '): ' + data.code + ' ' + data.msg);

  const list = (data.data && data.data.freebusy_list) || [];
  return list
    .map(b => ({
      title: 'Terpakai',
      organizer: '',
      start: new Date(b.start_time).toISOString(),
      end: new Date(b.end_time).toISOString(),
    }))
    .sort((a, b) => new Date(a.start) - new Date(b.start));
}
