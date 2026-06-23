// =============================================================
//  auth-login.js — login OAuth Lark SEKALI (di laptop)
//  Hasil: REFRESH TOKEN untuk disimpan di env (LARK_REFRESH_TOKEN).
//
//  Prasyarat di Lark Developer Console:
//   - Tambah scope (kolom user_access_token): calendar:calendar:readonly
//   - Security settings > Redirect URL: tambahkan  http://localhost:5390/callback
//   - Publish versi baru.
//
//  Jalankan:  node auth-login.js   lalu buka URL yang tampil di browser.
// =============================================================
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { setRefreshToken, storeEnabled } from './lib/store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
(function loadEnv(){
  const f = path.join(__dirname, '.env');
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f,'utf8').split('\n')){
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g,'');
  }
})();

const BASE = process.env.LARK_BASE_URL || 'https://open.larksuite.com';
const APP_ID = process.env.LARK_APP_ID || '';
const APP_SECRET = process.env.LARK_APP_SECRET || '';
const PORT = 5390;
const REDIRECT = 'http://localhost:' + PORT + '/callback';
const SCOPE = 'calendar:calendar:readonly';

if (!APP_ID || !APP_SECRET){ console.error('Isi LARK_APP_ID & LARK_APP_SECRET di .env dulu.'); process.exit(1); }

async function appToken(){
  const r = await fetch(BASE + '/open-apis/auth/v3/app_access_token/internal', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET })
  });
  const d = await r.json();
  if (d.code !== 0) throw new Error('app_access_token gagal: ' + d.code + ' ' + d.msg);
  return d.app_access_token;
}

async function exchange(code){
  const at = await appToken();
  const r = await fetch(BASE + '/open-apis/authen/v1/oidc/access_token', {
    method:'POST',
    headers:{ Authorization:'Bearer '+at, 'Content-Type':'application/json' },
    body: JSON.stringify({ grant_type:'authorization_code', code })
  });
  return r.json();
}

const authorizeUrl = BASE + '/open-apis/authen/v1/index'
  + '?app_id=' + encodeURIComponent(APP_ID)
  + '&redirect_uri=' + encodeURIComponent(REDIRECT)
  + '&scope=' + encodeURIComponent(SCOPE)
  + '&state=display';

const server = http.createServer(async (req,res)=>{
  const u = new URL(req.url, 'http://localhost:'+PORT);
  if (u.pathname !== '/callback'){ res.writeHead(404); return res.end('not found'); }
  const code = u.searchParams.get('code');
  if (!code){ res.writeHead(400); return res.end('Tidak ada code. Coba ulang.'); }
  try{
    const d = await exchange(code);
    if (d.code !== 0) throw new Error(d.code + ' ' + d.msg);
    const t = d.data || d; // OIDC: data{...}
    const rt = t.refresh_token;
    console.log('\n==================  BERHASIL  ==================');
    console.log('refresh_token :', rt);
    if (storeEnabled()) {
      await setRefreshToken(rt);
      console.log('>> refresh_token tersimpan ke Upstash Redis (siap dipakai backend).');
    }
    console.log('SCOPE didapat  :', t.scope || '(tidak ada field scope di respons)');
    console.log('access_token  :', (t.access_token||'').slice(0,18) + '...');
    console.log('berlaku       : access ~', t.expires_in, 'dtk | refresh ~', (t.refresh_expires_in||t.refresh_token_expires_in), 'dtk');
    console.log('================================================');
    console.log('\nLangkah berikut:');
    console.log('  1) Lokal  : tambahkan ke .env  ->  LARK_REFRESH_TOKEN=' + rt);
    console.log('  2) Vercel : vercel env add LARK_REFRESH_TOKEN  (tempel nilai di atas)\n');
    res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
    res.end('<h2 style="font-family:sans-serif">Berhasil login. Cek terminal untuk refresh_token. Tab ini boleh ditutup.</h2>');
  }catch(e){
    console.error('Gagal tukar code:', e.message);
    res.writeHead(500); res.end('Gagal: ' + e.message + ' (cek terminal)');
  }
  setTimeout(()=>server.close(), 1500);
});

server.listen(PORT, ()=>{
  console.log('\nBuka URL ini di browser (login sebagai akun Anda):\n');
  console.log('  ' + authorizeUrl + '\n');
  console.log('Menunggu callback di ' + REDIRECT + ' ...');
});
