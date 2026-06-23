// =============================================================
//  Daftar ruangan (satu-satunya tempat edit ruangan)
//
//  Memakai FREE/BUSY meeting room -> field "room_id" (bukan calendar_id).
//  room_id didapat dari: node find-rooms.js
//  Display menampilkan status KOSONG/DIPAKAI + jam (tanpa judul meeting,
//  karena Lark tidak mengekspos judul untuk meeting room/resource).
// =============================================================
export const ROOMS = [
  // ---------- Lantai 1 ----------
  { key: 'excellent', name: 'Excellent',             capacity: 4,  location: 'Lantai 1', room_id: 'omm_1b0481181706104c397a80e736f492da' },
  { key: 'gg',        name: 'GG',                    capacity: 20, location: 'Lantai 1', room_id: 'omm_3f5d1c7281d8b0ad7115d0add5a6347a' },

  // ---------- Lantai 2 ----------
  { key: 'beyond',    name: 'Beyond',                capacity: 6,  location: 'Lantai 2', room_id: 'omm_e00fc17da61a7d713158053e203d30eb' },
  { key: 'berdiri',   name: 'Ruang Meeting Berdiri', capacity: 8,  location: 'Lantai 2', room_id: 'omm_5f2d868f0aaa92ab2353733c79280e34' },
  { key: 'synergy',   name: 'Synergy',               capacity: 6,  location: 'Lantai 2', room_id: 'omm_4d52b2096d3cb39bb00e8cab50c48328' },

  // ---------- Lantai 3 ----------
  { key: 'collab',    name: 'Collab',                capacity: 4,  location: 'Lantai 3', room_id: 'omm_9fb13015a6a0d92e5f7b82c7e6576867' },
  { key: 'dm',        name: 'DM',                    capacity: 11, location: 'Lantai 3', room_id: 'omm_e7a86579eb8304e5d8c4862e380a034d' },
  { key: 'grit',      name: 'Grit',                  capacity: 4,  location: 'Lantai 3', room_id: 'omm_129b040d5f278934874071fffc08372c' },
  { key: 'passion',   name: 'Passion',               capacity: 3,  location: 'Lantai 3', room_id: 'omm_3264ad69d1bd772f90120944ff8fae2b' },
  { key: 'trust',     name: 'Trust',                 capacity: 9,  location: 'Lantai 3', room_id: 'omm_ac8d956394023271b56f2aea2f1991a9' },
  { key: 'vision',    name: 'Vision',                capacity: 7,  location: 'Lantai 3', room_id: 'omm_ef61c1faa8d9b8945239c28be396fe6a' },
];

export const TZ = process.env.TZ_OFFSET || '+07:00';
