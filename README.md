# Lark Room Display (versi Vercel)

Display status ruang meeting di tablet, menarik data dari **Lark Calendar (rooms)**.
Tanpa lisensi Lark Rooms per-device — cukup **satu Custom App** Lark + deploy gratis ke **Vercel**.

```
Lark Calendar (rooms)  ─►  Fungsi serverless di Vercel  ─►  Banyak tablet (web)
```

Di Vercel tidak ada server yang nyala terus. Jadi tiap tablet meminta data → fungsi menarik
langsung dari Lark → hasilnya **di-cache di edge Vercel selama 30 detik**, sehingga banyak
tablet/refresh berbagi satu panggilan ke Lark (hemat & cepat).

---

## Struktur file

| File | Fungsi |
|---|---|
| `lib/config.js` | **Daftar ruangan** (nama, kapasitas, lokasi, `calendar_id`). Satu-satunya tempat edit ruangan. |
| `lib/lark.js` | Logika Lark: ambil token + tarik event. |
| `api/room/[key]/today.js` | Fungsi Vercel: `GET /api/room/<key>/today`. |
| `api/rooms.js` | Fungsi Vercel: daftar ruangan. |
| `public/index.html` | Halaman yang tampil di tablet. |
| `find-calendar.js` | Skrip **lokal** untuk cari `calendar_id` (dijalankan di laptop, sekali). |
| `server.js` | Server **lokal** untuk uji coba di laptop (Vercel tidak memakainya). |
| `.env.example` | Template kredensial untuk uji lokal. |
| `vercel.json` | Setting Vercel (region Singapura). |

> Catatan: file `rooms.json` versi lama sudah tidak dipakai — boleh dihapus. Konfigurasi ruangan sekarang ada di `lib/config.js`.

---

## Langkah 1 — Buat Custom App di Lark (sekali saja)

1. Buka **Lark Developer Console**: https://open.larksuite.com → **Create Custom App**.
2. Catat **App ID** (`cli_...`) dan **App Secret**.
3. Menu **Permissions & Scopes** → tambahkan scope:
   - `calendar:calendar:readonly`
4. **Publish / Release** app untuk organisasi Anda (perlu approval admin).
5. Pastikan kalender tiap ruang meeting bisa diakses app. Kalau nanti ruangan tak muncul
   saat dicari, minta admin membagikan kalender ruangan ke app, atau ambil `calendar_id`
   dari **Admin Console → Meeting Room**.

> Pakai Feishu (Tiongkok)? Set env `LARK_BASE_URL=https://open.feishu.cn`. Untuk Lark
> internasional (umumnya Indonesia), biarkan default.

---

## Langkah 2 — Cari calendar_id tiap ruangan (di laptop Anda)

Butuh Node.js 18+ di laptop. Di folder proyek:

```bash
cp .env.example .env      # isi LARK_APP_ID & LARK_APP_SECRET
node find-calendar.js "Ruang Garuda"
```

Akan muncul `calendar_id`. Lakukan untuk tiap ruangan, lalu isi ke **`lib/config.js`**:

```js
export const ROOMS = [
  { key: 'garuda',   name: 'Ruang Garuda',   capacity: 10, location: 'Lantai 3', calendar_id: 'feishu.cn_xxxx@group...' },
  { key: 'rajawali', name: 'Ruang Rajawali', capacity: 6,  location: 'Lantai 2', calendar_id: 'feishu.cn_yyyy@group...' },
];
```

`key` = nama pendek bebas (tanpa spasi); dipakai di URL tablet: `?room=garuda`.

(Opsional uji lokal sebelum deploy: `node --env-file=.env server.js` lalu buka
`http://localhost:3000/?room=garuda`.)

---

## Langkah 3 — Deploy ke Vercel

Cara paling cepat pakai **Vercel CLI** (tanpa perlu GitHub):

```bash
npm install -g vercel
cd lark-room-display
vercel            # ikuti prompt: login, pilih scope, nama project
```

Lalu **set kredensial** sebagai Environment Variables (JANGAN taruh app_secret di file yang diupload):

```bash
vercel env add LARK_APP_ID         # tempel cli_xxxx, pilih semua environment
vercel env add LARK_APP_SECRET     # tempel secret
# (opsional, hanya jika Feishu) vercel env add LARK_BASE_URL  -> https://open.feishu.cn
```

Deploy ke production:

```bash
vercel --prod
```

Selesai. Anda akan dapat URL seperti `https://nama-project.vercel.app`.

> Alternatif tanpa CLI: push folder ini ke GitHub → di vercel.com klik **Add New → Project**
> → import repo → isi Environment Variables di Settings → Deploy.

Cek hasil:
- `https://nama-project.vercel.app/api/rooms`
- `https://nama-project.vercel.app/api/room/garuda/today`
- `https://nama-project.vercel.app/?room=garuda`

---

## Langkah 4 — Pasang di tablet

Buka URL ini di browser tablet (fullscreen / kiosk), satu URL per ruangan:

```
https://nama-project.vercel.app/?room=garuda
https://nama-project.vercel.app/?room=rajawali
```

**Mode kiosk:**
- **Android**: app "Fully Kiosk Browser" → set URL → enable auto-start & keep screen on.
- **iPad**: Safari → Add to Home Screen → buka via ikon + Guided Access.
- **Mini-PC/Chrome**: `chrome --kiosk "https://nama-project.vercel.app/?room=garuda"`

Karena di Vercel, tablet akses lewat HTTPS dari mana saja (tidak harus satu jaringan dengan kantor).

---

## Cara kerja singkat

1. Tablet memanggil `/api/room/{key}/today` tiap 15–30 detik (default halaman).
2. Fungsi Vercel ambil token Lark (di-cache), tarik event **hari ini** ruangan itu,
   buang yang `cancelled`, kirim JSON ringkas.
3. Respons di-cache di edge Vercel 30 detik (`s-maxage=30`) → hemat panggilan ke Lark.
4. Halaman menghitung sendiri statusnya: jam sekarang di dalam event → **DIPAKAI** (merah);
   event ≤15 menit lagi → **SEGERA** (kuning); selain itu **KOSONG** (hijau).
5. Kalau Lark error, fungsi balas 502 → tablet menahan tampilan terakhir (tidak nge-blank).

---

## Catatan & batasan

- **Lisensi Vercel**: paket **Hobby gratis** untuk penggunaan non-komersial. Untuk
  pemakaian kantor/komersial, Vercel mensyaratkan paket **Pro** (berbayar). Pertimbangkan ini,
  atau pakai opsi self-host (server lokal/VPS) jika ingin sepenuhnya gratis.
- **Nama penyelenggara** dikosongkan (Calendar API tidak mengembalikannya langsung); judul,
  waktu, dan status lengkap. Bisa ditambah nanti via API kontak.
- **Zona waktu**: hasil event sudah ISO/UTC; halaman menampilkan dalam waktu lokal tablet.
  Pastikan zona waktu tablet benar (Asia/Jakarta).
- **Keamanan**: `app_secret` hanya disimpan di Environment Variables Vercel — tidak pernah
  dikirim ke tablet, tidak ada di file yang diupload. Jangan commit `.env` (sudah di-`.gitignore`).
