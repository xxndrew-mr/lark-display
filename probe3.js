// =============================================================
//  Probe 3: cari calendar_id ruangan pakai TOKEN AKUN (user).
//  Jalankan:  node --env-file=.env probe3.js   (butuh LARK_REFRESH_TOKEN)
// =============================================================
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
(function(){const f=path.join(__dirname,'.env'); if(!fs.existsSync(f))return;
  for(const l of fs.readFileSync(f,'utf8').split('\n')){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if(m&&!(m[1]in process.env))process.env[m[1]]=m[2].replace(/^["']|["']$/g,'');}})();

const BASE=process.env.LARK_BASE_URL||'https://open.larksuite.com';
const APP_ID=process.env.LARK_APP_ID, APP_SECRET=process.env.LARK_APP_SECRET, RT=process.env.LARK_REFRESH_TOKEN;

async function appToken(){const r=await fetch(BASE+'/open-apis/auth/v3/app_access_token/internal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({app_id:APP_ID,app_secret:APP_SECRET})});const d=await r.json(); if(d.code!==0)throw new Error('app token: '+d.code+' '+d.msg); return d.app_access_token;}
async function userToken(){const at=await appToken(); const r=await fetch(BASE+'/open-apis/authen/v1/oidc/refresh_access_token',{method:'POST',headers:{Authorization:'Bearer '+at,'Content-Type':'application/json'},body:JSON.stringify({grant_type:'refresh_token',refresh_token:RT})}); const d=await r.json(); if(d.code!==0)throw new Error('refresh: '+d.code+' '+d.msg); return (d.data||d).access_token;}

(async()=>{
  if(!RT){console.error('LARK_REFRESH_TOKEN belum ada di .env');process.exit(1);}
  const ut=await userToken();
  console.log('User token OK.\n');

  // A) Daftar kalender milik/langganan akun
  console.log('=== A) GET /calendar/v4/calendars (kalender akun Anda) ===');
  let pt='', n=0;
  do{
    const r=await fetch(BASE+'/open-apis/calendar/v4/calendars?page_size=50'+(pt?'&page_token='+pt:''),{headers:{Authorization:'Bearer '+ut}});
    const d=await r.json();
    if(d.code!==0){console.log('  [error]',d.code,d.msg);break;}
    for(const c of (d.data?.calendar_list||[])){n++; console.log('   -',JSON.stringify({summary:c.summary,calendar_id:c.calendar_id,type:c.type,role:c.role}));}
    pt=d.data?.page_token||''; if(!d.data?.has_more)break;
  }while(pt);
  console.log('  total:',n,'\n');

  // B) Search beberapa query
  for(const q of ['Excellent','Lantai 1-Excellent','Lantai 1','Excelent']){
    console.log('=== B) search query: "'+q+'" ===');
    const r=await fetch(BASE+'/open-apis/calendar/v4/calendars/search',{method:'POST',headers:{Authorization:'Bearer '+ut,'Content-Type':'application/json'},body:JSON.stringify({query:q})});
    const d=await r.json();
    if(d.code!==0){console.log('  [error]',d.code,d.msg);continue;}
    const items=d.data?.items||d.data?.calendar_list||[];
    console.log('  hasil:',items.length);
    items.slice(0,8).forEach(c=>console.log('   -',JSON.stringify({summary:c.summary,calendar_id:c.calendar_id,type:c.type})));
  }
  console.log('\nTempel seluruh output ini ke chat.');
})();
