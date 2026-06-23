// GET /api/rooms  -> daftar ruangan tersedia
import { ROOMS } from '../lib/config.js';
export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json(ROOMS.map(r => ({ key: r.key, name: r.name })));
}
