// Tes ambil JUDUL dari kalender penyelenggara. node --env-file=.env probe6.js
import { getRefreshToken } from './lib/store.js';
const BASE = process.env.LARK_BASE_URL || 'https://open.larksuite.com';
const APP_ID=process.env.LARK_APP_ID, APP_SECRET=process.env.LARK_APP_SECRET;

// dari debug event Excellent:
const ORG_CAL = 'feishu.cn_TW2eOaQ7yZwrW2BKGQHVde@group.calendar.feishu.cn';
const EVENT_ID = 'cf1b71c4-759f-416f-a786-89de686fc980_0';

async function appToken(){const r=await fetch(BASE+'/open-apis/auth/v3/app_access_token/internal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({app_id:APP_ID,app_secret:APP_SECRET})});const d=await r.json();if(d.code!==0)throw new Error(d.code+' '+d.msg);return d.app_access_token;}
async function userToken(){const at=await appToken();const rt=await getRefreshToken();const r=await fetch(BASE+'/open-apis/authen/v1/oidc/refresh_access_token',{method:'POST',headers:{Authorization:'Bearer '+at,'Content-Type':'application/json'},body:JSON.stringify({grant_type:'refresh_token',refresh_token:rt})});const d=await r.json();if(d.code!==0)throw new Error('refresh: '+d.code+' '+d.msg);return (d.data||d).access_token;}

(async()=>{
  const ut=await userToken();
  // coba 1: GET event di kalender penyelenggara
  const u1 = BASE+'/open-apis/calendar/v4/calendars/'+encodeURIComponent(ORG_CAL)+'/events/'+encodeURIComponent(EVENT_ID);
  const r1=await fetch(u1,{headers:{Authorization:'Bearer '+ut}});
  const d1=await r1.json();
  console.log('GET event (organizer cal) =>', d1.code, d1.msg||'');
  if(d1.code===0) console.log('   summary:', JSON.stringify(d1.data&&d1.data.event&&d1.data.event.summary));
  else console.log('   (gagal akses kalender penyelenggara)');
  console.log('\nTempel output ini ke chat.');
})();
