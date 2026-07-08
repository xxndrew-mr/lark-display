# CLAUDE.md

Panduan untuk Claude Code saat bekerja di repository ini.

## Ringkasan Project

**lark-room-display** — display status ruang meeting untuk tablet, menarik data dari Lark (Calendar/VC API). Backend berupa fungsi serverless di **Vercel** (region `sin1`), frontend satu halaman HTML statis yang dibuka di tablet dalam mode kiosk (`/?room=<key>`). Tanpa lisensi Lark Rooms per-device — cukup satu Custom App Lark.

Alur data:

```
Lark API ─► fungsi serverless (api/) ─► cache edge Vercel 30 dtk ─► tablet (public/index.html)
```

## Perintah

```bash
node --env-file=.env server.js   # server lokal untuk uji coba (Node 20+), buka http://localhost:3000/?room=<key>
npm start                        # sama dengan di atas (loader .env manual sudah ada di server.js)
node find-rooms.js               # cari room_id semua meeting room yang bisa diakses app (untuk lib/config.js)
vercel --prod                    # deploy production
```

Tidak ada test suite, linter, atau build step. Murni ESM (`"type": "module"`), Node >= 18, tanpa dependency npm (semua pakai `fetch` bawaan).

## Arsitektur

### File inti (jalur produksi)

| File | Peran |
|---|---|
| `lib/config.js` | **Daftar ruangan** (`ROOMS`): key, nama, kapasitas, lokasi, `room_id` (`omm_...`). Satu-satunya tempat edit ruangan. |
| `lib/lark.js` | Semua logika Lark: tenant token (di-cache in-memory), tarik reservasi hari ini. |
| `api/room/[key]/today.js` | `GET /api/room/<key>/today` → JSON jadwal hari ini + header `s-maxage=30`. |
| `api/rooms.js` | `GET /api/rooms` → daftar ruangan. |
| `public/index.html` | Halaman tablet (single file, ~830 baris, HTML+CSS+JS inline). Menghitung status sendiri: DIPAKAI / SEGERA (≤15 mnt) / KOSONG. |
| `server.js` | Server lokal untuk development. **Vercel tidak memakainya** — di Vercel yang jalan folder `api/`. Routing-nya harus meniru perilaku `api/`. |
| `vercel.json` | Region `sin1`, maxDuration 10 dtk per fungsi. |

File legacy (skrip `probe*`, jalur user-token `auth-login.js`/`lib/store.js`, desain lama `find-calendar.js`/`rooms.json`) sudah dihapus Juli 2026; lihat git history bila perlu.

### Alur data di `lib/lark.js` (penting dipahami sebelum mengubah)

1. `getToken()` — tenant_access_token, cache in-memory, refresh 5 menit sebelum expired.
2. `fetchRoomEvents(room)` — jalur utama: `vc/v1/resource_reservation_list` (dapat judul, pemesan, departemen). Butuh `room_level_id` yang dipetakan otomatis dari `vc/v1/rooms` (di-cache di `roomLevelMap`).
3. Fallback otomatis ke `meeting_room/freebusy/batch_get` (hanya status+jam+nama) bila jalur utama gagal.
4. Filter reservasi cancelled via regex `/取消|cancel|失败|reject/i` pada `reservation_status`.
5. `parseLarkDT()` — Lark mengembalikan waktu format string `"2026.06.24 14:00:00 (GMT+08:00)"`, di-parse manual ke ISO UTC. Jangan asumsikan format ISO dari API ini.
6. `todayEpochJakarta()` — rentang "hari ini" **di-hardcode +07:00 (Asia/Jakarta)**, sengaja tahan terhadap timezone server Vercel. Jangan ganti ke `Date` lokal server.

### Kontrak respons API

`GET /api/room/<key>/today` sukses:

```json
{ "room": {"key","name","capacity","location"}, "now": "ISO", "timezone": "+07:00", "events": [{"title","organizer","department","start","end"}], "stale": false }
```

Gagal → **502** `{ "error": "..." }`. Frontend sengaja menahan tampilan terakhir saat 502 (tidak nge-blank) — pertahankan perilaku ini. Room tidak dikenal → 404. Semua respons ber-CORS `*`.

## Konvensi

- Bahasa komentar, pesan error, dan UI: **Bahasa Indonesia**. Ikuti ini untuk kode baru.
- Frontend tetap **satu file** `public/index.html` (HTML+CSS+JS inline), tanpa framework/bundler.
- Tidak menambah dependency npm kecuali sangat perlu — project ini sengaja zero-dependency.
- Perubahan endpoint harus diterapkan di **dua tempat**: `api/` (Vercel) dan `server.js` (lokal).
- Caching bertingkat: token & room-level map di memory fungsi, respons di edge Vercel (`s-maxage=30, stale-while-revalidate=60`), polling tablet 15–30 dtk. Pertimbangkan ketiganya saat debug "data telat update".

## Keamanan

- `LARK_APP_SECRET` hanya di env var Vercel / `.env` lokal. **`.env` berisi kredensial asli dan tidak boleh di-commit** (sudah di `.gitignore`) — jangan pernah menuliskan isi `.env` ke file lain, log, atau contoh kode.
- Tablet hanya menerima JSON hasil olahan; token tidak pernah sampai ke client.

## Env Variables

| Var | Keterangan |
|---|---|
| `LARK_APP_ID` / `LARK_APP_SECRET` | Kredensial Custom App Lark (wajib). |
| `LARK_BASE_URL` | Default `https://open.larksuite.com`; `https://open.feishu.cn` untuk Feishu. |
| `PORT` | Server lokal, default 3000. |
| `TZ_OFFSET` | Label info di JSON, default `+07:00` (bukan pengatur perhitungan waktu). |

## Gotcha

- Judul meeting hanya tersedia lewat `resource_reservation_list` (scope VC); freebusy tidak mengekspos judul.
- Scope minimal app: `calendar:calendar:readonly` + scope VC rooms/reservation agar jalur utama jalan.
- `room_id` format `omm_...` (bukan `calendar_id`); didapat dari `node find-rooms.js`.
- Zona waktu tampilan mengikuti jam lokal tablet — pastikan tablet di Asia/Jakarta.
- Vercel Hobby gratis hanya untuk non-komersial; pemakaian kantor secara resmi butuh paket Pro.
