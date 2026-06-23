// =============================================================
//  Probe 4: refresh token dari Redis -> cetak SCOPE asli token -> tes calendar.
//  Jalankan SENDIRIAN (matikan server dulu):
//      node --env-file=.env probe4.js
// =============================================================
import { getRefreshToken, setRefreshToken, storeEnabled } from './lib/store.js';
const BASE = process.env.LARK_BASE_URL || 'https://open.larksuite.com';
const APP_ID = process.env.LARK_APP_ID, APP_SECRET = process.env.LARK_APP_SECRET;

async function appToken(){
  const r=await fetch(BASE+'/open-apis/auth/v3/app_access_token/internal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({app_id:APP_ID,app_secret:APP_SECRET})});
  const d=await r.json(); if(d.code!==0) throw new Error('app token: '+d.code+' '+d.msg); return d.app_access_token;
}

(async()=>{
  console.log('storeEnabled:', storeEnabled());
  const rt = await getRefreshToken();
  console.log('refresh token dari store:', rt ? (rt.slice(0,12)+'...') : '(KOSONG)');
  if(!rt){ console.log('Tidak ada token. Jalankan auth-login.js dulu.'); return; }

  const at = await appToken();
  const rr = await fetch(BASE+'/open-apis/authen/v1/oidc/refresh_access_token',{
    method:'POST', headers:{Authorization:'Bearer '+at,'Content-Type':'application/json'},
    body:JSON.stringify({grant_type:'refresh_token',refresh_token:rt})});
  const rd = await rr.json();
  console.log('refresh code:', rd.code, rd.msg||'');
  if(rd.code!==0){ console.log('>> Token mati/!valid. Login ulang: node auth-login.js'); return; }
  const t = rd.data||rd;
  console.log('SCOPE token  :', t.scope || '(tidak ada field scope)');
  // simpan token baru biar tidak strand
  if(t.refresh_token && t.refresh_token!==rt) await setRefreshToken(t.refresh_token);
  const ut = t.access_token;

  const lr = await fetch(BASE+'/open-apis/calendar/v4/calendars?page_size=100',{headers:{Authorization:'Bearer '+ut}});
  const ld = await lr.json();
  console.log('\nGET /calendars =>', ld.code, ld.msg||'', '| jumlah:', (ld.data&&ld.data.calendar_list||[]).length);
  (ld.data&&ld.data.calendar_list||[]).forEach(c=>console.log('   [cal]',JSON.stringify({summary:c.summary,type:c.type,calendar_id:c.calendar_id})));

  for(const q of ['Excellent','Lantai 1-Excellent']){
    const sr = await fetch(BASE+'/open-apis/calendar/v4/calendars/search',{method:'POST',headers:{Authorization:'Bearer '+ut,'Content-Type':'application/json'},body:JSON.stringify({query:q})});
    const sd = await sr.json();
    const items=(sd.data&&(sd.data.items||sd.data.calendar_list))||[];
    console.log('search',JSON.stringify(q),'=>',sd.code,sd.msg||'','| hasil:',items.length);
    items.slice(0,8).forEach(c=>console.log('   ',JSON.stringify({summary:c.summary,calendar_id:c.calendar_id})));
  }
  console.log('\nTempel seluruh output ini ke chat.');
})();
