// =============================================================
//  Penyimpanan refresh token via Upstash Redis (REST API).
//  (env dibaca saat dipanggil -> aman terhadap urutan load .env)
// =============================================================
const KEY = 'lark_refresh_token';
function cfg() {
  return {
    url: (process.env.UPSTASH_REDIS_REST_URL || '').replace(/\/$/, ''),
    token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
  };
}
export function storeEnabled() { const c = cfg(); return !!(c.url && c.token); }

export async function getRefreshToken() {
  const c = cfg();
  if (!c.url || !c.token) return process.env.LARK_REFRESH_TOKEN || '';
  try {
    const r = await fetch(c.url + '/get/' + KEY, { headers: { Authorization: 'Bearer ' + c.token } });
    const d = await r.json();
    return (d && d.result) ? d.result : (process.env.LARK_REFRESH_TOKEN || '');
  } catch (e) {
    console.error('[store] gagal baca Redis:', e.message);
    return process.env.LARK_REFRESH_TOKEN || '';
  }
}

export async function setRefreshToken(t) {
  const c = cfg();
  if (!c.url || !c.token || !t) return;
  try {
    await fetch(c.url + '/set/' + KEY, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + c.token },
      body: t,
    });
  } catch (e) {
    console.error('[store] gagal tulis Redis:', e.message);
  }
}
