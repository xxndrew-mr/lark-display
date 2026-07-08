<div align="center">

<img src="assets/lark-logo.png" alt="Logo Lark" width="96">

# Lark Room Display

**Display status ruang meeting untuk tablet — data langsung dari Lark, tanpa lisensi Lark Rooms per-device.**

[![Deploy](https://img.shields.io/badge/deploy-Vercel-black?logo=vercel)](https://vercel.com)
[![Node](https://img.shields.io/badge/node-%E2%89%A518-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)]()
[![Module](https://img.shields.io/badge/module-ESM-blue)]()

<br>

🟩 **KOSONG** &nbsp;·&nbsp; 🟨 **SEGERA** (≤30 mnt lagi) &nbsp;·&nbsp; 🟦 **DIPAKAI** &nbsp;·&nbsp; 🟥 **HAMPIR SELESAI** (sisa ≤15 mnt)

</div>

---

Satu **Custom App Lark** + deploy ke **Vercel** = semua tablet di kantor bisa menampilkan status ruang meeting secara real-time. Tablet cukup membuka satu URL dalam mode kiosk — tidak ada aplikasi yang perlu di-install, tidak ada server yang perlu dirawat.

```
Lark API (Calendar/VC)  ─►  Fungsi serverless Vercel (api/)  ─►  Cache edge 30 dtk  ─►  Tablet (public/index.html)
```

## Fitur

- **Zero dependency** — murni Node.js `fetch` bawaan, tanpa satu pun package npm.
- **Hemat kuota API** — respons di-cache di edge Vercel 30 detik, sehingga banyak tablet berbagi satu panggilan ke Lark; token & peta ruangan di-cache in-memory.
- **Tahan gangguan** — kalau Lark/backend error, tablet menahan tampilan terakhir (tidak nge-blank).
- **Judul & pemesan meeting** tampil (via VC `resource_reservation_list`), dengan fallback otomatis ke freebusy bila jalur utama gagal.
- **Mode demo** bawaan untuk preview tanpa kredensial: `/?demo=free|soon|busy|ending|cycle`.
- **Siap kiosk** — fullscreen, anti-zoom, jam & countdown besar, agenda hari ini di samping.

## Struktur proyek

| File | Fungsi |
|---|---|
| [`lib/config.js`](lib/config.js) | **Daftar ruangan** (nama, kapasitas, lokasi, `room_id`). Satu-satunya tempat edit ruangan. |
| [`lib/lark.js`](lib/lark.js) | Logika Lark: tenant token (cache in-memory), tarik reservasi hari ini, fallback freebusy. |
| [`api/room/[key]/today.js`](api/room/%5Bkey%5D/today.js) | Fungsi Vercel: `GET /api/room/<key>/today` → jadwal hari ini. |
| [`api/rooms.js`](api/rooms.js) | Fungsi Vercel: `GET /api/rooms` → daftar ruangan. |
| [`public/index.html`](public/index.html) | Halaman tablet — satu file HTML+CSS+JS, tanpa framework. |
| [`find-rooms.js`](find-rooms.js) | Skrip **lokal** sekali jalan untuk mencari `room_id` semua ruangan. |
| [`server.js`](server.js) | Server **lokal** untuk development (Vercel tidak memakainya). |
| [`vercel.json`](vercel.json) | Setting Vercel (region Singapura `sin1`). |

## Mulai cepat

### 1. Buat Custom App di Lark (sekali saja)

1. Buka [Lark Developer Console](https://open.larksuite.com) → **Create Custom App**, catat **App ID** (`cli_...`) dan **App Secret**.
2. **Permissions & Scopes** → tambahkan:
   - `calendar:calendar:readonly`
   - scope **VC rooms & reservation** (agar judul meeting & pemesan terbaca)
3. **Publish/Release** app untuk organisasi Anda (perlu approval admin).

> Pakai **Feishu** (Tiongkok)? Set env `LARK_BASE_URL=https://open.feishu.cn`. Untuk Lark internasional, biarkan default.

### 2. Cari `room_id` tiap ruangan

Butuh Node.js 18+. Di folder proyek:

```bash
cp .env.example .env      # isi LARK_APP_ID & LARK_APP_SECRET
node find-rooms.js
```

Salin daftar `room_id` (format `omm_...`) yang muncul ke [`lib/config.js`](lib/config.js):

```js
export const ROOMS = [
  { key: 'garuda',   name: 'Ruang Garuda',   capacity: 10, location: 'Lantai 3', room_id: 'omm_xxxx...' },
  { key: 'rajawali', name: 'Ruang Rajawali', capacity: 6,  location: 'Lantai 2', room_id: 'omm_yyyy...' },
];
```

`key` = nama pendek bebas tanpa spasi, dipakai di URL tablet: `?room=garuda`.

Uji lokal sebelum deploy (opsional):

```bash
node --env-file=.env server.js
# buka http://localhost:3000/?room=garuda
```

### 3. Deploy ke Vercel

```bash
npm install -g vercel
vercel                             # login, pilih scope & nama project
vercel env add LARK_APP_ID         # tempel cli_xxxx, pilih semua environment
vercel env add LARK_APP_SECRET     # tempel secret
vercel --prod
```

> Alternatif tanpa CLI: push repo ini ke GitHub → di vercel.com **Add New → Project** → import repo → isi Environment Variables → Deploy.

Cek hasil:

- `https://nama-project.vercel.app/api/rooms`
- `https://nama-project.vercel.app/api/room/garuda/today`
- `https://nama-project.vercel.app/?room=garuda`

### 4. Pasang di tablet

Buka satu URL per ruangan dalam mode kiosk:

```
https://nama-project.vercel.app/?room=garuda
```

| Perangkat | Cara |
|---|---|
| Android | App **Fully Kiosk Browser** → set URL → auto-start & keep screen on |
| iPad | Safari → **Add to Home Screen** → buka via ikon + Guided Access |
| Mini-PC/Chrome | `chrome --kiosk "https://.../?room=garuda"` |

Karena di-host di Vercel, tablet mengakses lewat HTTPS dari mana saja — tidak harus satu jaringan dengan kantor.

## Cara kerja

1. Tablet memanggil `/api/room/<key>/today` tiap 15–30 detik.
2. Fungsi Vercel mengambil token Lark (di-cache), menarik reservasi **hari ini** (zona +07:00), membuang yang cancelled, lalu mengirim JSON ringkas.
3. Respons di-cache di edge Vercel (`s-maxage=30, stale-while-revalidate=60`) → banyak tablet berbagi satu panggilan ke Lark.
4. Halaman menghitung status sendiri dari jam lokal tablet: sedang ada event → **DIPAKAI** (biru), sisa ≤15 menit → **merah**, event mulai ≤30 menit lagi → **SEGERA** (kuning), selain itu **KOSONG** (hijau).
5. Kalau Lark error, fungsi membalas 502 → tablet menahan tampilan terakhir.

### Kontrak API

`GET /api/room/<key>/today` sukses:

```json
{
  "room": { "key": "garuda", "name": "Ruang Garuda", "capacity": 10, "location": "Lantai 3" },
  "now": "2026-07-08T03:00:00.000Z",
  "timezone": "+07:00",
  "events": [{ "title": "Weekly Sync", "organizer": "Andre", "department": "IT", "start": "...", "end": "..." }],
  "stale": false
}
```

Gagal → `502 { "error": "..." }` · Room tidak dikenal → `404` · Semua respons ber-CORS `*`.

## Environment variables

| Var | Keterangan |
|---|---|
| `LARK_APP_ID` / `LARK_APP_SECRET` | Kredensial Custom App Lark (**wajib**). |
| `LARK_BASE_URL` | Default `https://open.larksuite.com`; `https://open.feishu.cn` untuk Feishu. |
| `PORT` | Server lokal, default `3000`. |
| `TZ_OFFSET` | Label info di JSON, default `+07:00` (bukan pengatur perhitungan waktu). |

## Catatan & batasan

- **Lisensi Vercel** — paket Hobby gratis hanya untuk non-komersial; pemakaian kantor resmi butuh paket **Pro**, atau self-host `server.js` di server lokal/VPS.
- **Judul meeting** hanya tersedia lewat jalur VC (`resource_reservation_list`); fallback freebusy hanya memberi status + jam.
- **Zona waktu** — rentang "hari ini" dihitung di +07:00 (Asia/Jakarta); tampilan jam mengikuti jam lokal tablet, jadi pastikan tablet di zona yang benar.

## Keamanan

- `LARK_APP_SECRET` hanya hidup di Environment Variables Vercel / `.env` lokal — tidak pernah dikirim ke tablet, tablet hanya menerima JSON hasil olahan.
- `.env` berisi kredensial asli dan sudah masuk `.gitignore` — jangan pernah di-commit.

---

<div align="center">
<sub>Logo Lark © Lark Technologies — dipakai secara nominatif; proyek ini tidak berafiliasi dengan Lark.</sub>
</div>
