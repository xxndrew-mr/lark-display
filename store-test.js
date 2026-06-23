// Tes koneksi Upstash: tulis lalu baca. Jalankan: node --env-file=.env store-test.js
import { storeEnabled, setRefreshToken, getRefreshToken } from './lib/store.js';
console.log('UPSTASH_REDIS_REST_URL  :', process.env.UPSTASH_REDIS_REST_URL ? 'ADA' : 'KOSONG');
console.log('UPSTASH_REDIS_REST_TOKEN:', process.env.UPSTASH_REDIS_REST_TOKEN ? 'ADA' : 'KOSONG');
console.log('storeEnabled():', storeEnabled());
const sample = 'TEST_' + Date.now();
await setRefreshToken(sample);
const back = await getRefreshToken();
console.log('ditulis :', sample);
console.log('dibaca  :', back);
console.log(back === sample ? '>> UPSTASH OK (tulis & baca berhasil)' : '>> GAGAL: yang dibaca tidak sama / kosong');
