// =============================================================
//  Probe 5: pakai TENANT token (token aplikasi) untuk akses kalender.
//  Kalau ini jalan -> tidak perlu OAuth user / Upstash sama sekali.
//  Jalankan: node --env-file=.env probe5.js
// =============================================================
const BASE = process.env.LARK_BASE_URL || 'https://open.larksuite.com';
const APP_ID = process.env.LARK_APP_ID, APP_SECRET = process.env.LARK_APP_SECRET;

async function tenantToken(){
  const r=await fetch(BASE+'/open-apis/auth/v3/tenant_access_token/internal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({app_id:APP_ID,app_secret:APP_SECRET})});
  const d=await r.json(); if(d.code!==0) throw new Error('token: '+d.code+' '+d.msg); return d.tenant_access_token;
}

(async()=>{
  const t = await tenantToken();
  console.log('Tenant token OK.\n');

  // A) daftar kalender yang bisa diakses APP
  const lr = await fetch(BASE+'/open-apis/calendar/v4/calendars?page_size=100',{headers:{Authorization:'Bearer '+t}});
  const ld = await lr.json();
  const list = (ld.data&&ld.data.calendar_list)||[];
  console.log('A) GET /calendars =>', ld.code, ld.msg||'', '| jumlah:', list.length);
  list.forEach(c=>console.log('   [cal]',JSON.stringify({summary:c.summary,type:c.type,calendar_id:c.calendar_id})));

  // B) search nama ruangan
  for(const q of ['Excellent','Lantai 1-Excellent','Lantai','Room']){
    const sr=await fetch(BASE+'/open-apis/calendar/v4/calendars/search',{method:'POST',headers:{Authorization:'Bearer '+t,'Content-Type':'application/json'},body:JSON.stringify({query:q})});
    const sd=await sr.json();
    const items=(sd.data&&(sd.data.items||sd.data.calendar_list))||[];
    console.log('B) search',JSON.stringify(q),'=>',sd.code,sd.msg||'','| hasil:',items.length);
    items.slice(0,8).forEach(c=>console.log('   ',JSON.stringify({summary:c.summary,calendar_id:c.calendar_id})));
  }
  console.log('\nTempel seluruh output ini ke chat.');
})();
