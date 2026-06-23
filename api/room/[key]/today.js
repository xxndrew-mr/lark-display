// =============================================================
//  Fungsi serverless Vercel:  GET /api/room/<key>/today
//  Tarik jadwal hari ini satu ruangan dari Lark, lalu cache di edge.
// =============================================================
import { ROOMS, TZ } from '../../../lib/config.js';
import { fetchRoomEvents } from '../../../lib/lark.js';

export default async function handler(req, res) {
  const key = req.query.key;
  const room = ROOMS.find(r => r.key === key);

  res.setHeader('Access-Control-Allow-Origin', '*');

  if (!room) {
    return res.status(404).json({ error: "Ruangan '" + key + "' tidak ditemukan. Cek lib/config.js." });
  }

  try {
    const events = await fetchRoomEvents(room);
    // Cache di CDN Vercel 30 detik -> banyak tablet berbagi 1 panggilan ke Lark
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    return res.status(200).json({
      room: { key: room.key, name: room.name, capacity: room.capacity, location: room.location },
      now: new Date().toISOString(),
      timezone: TZ,
      events,
      stale: false,
    });
  } catch (e) {
    // 502 -> halaman display menahan tampilan terakhir (tidak nge-blank)
    return res.status(502).json({ error: e.message });
  }
}
