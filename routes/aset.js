// routes/aset.js
// CRUD lengkap data aset IT + upload foto + auto-generate kode

const express  = require('express');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const { body, query, validationResult } = require('express-validator');
const { getDb } = require('../db/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// ── Upload foto aset ─────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'uploads', 'aset');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random()*1e5)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // max 5MB
  fileFilter: (req, file, cb) => {
    if (/image\/(jpeg|png|webp|gif)/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Hanya file gambar yang diperbolehkan.'));
  },
});

// ── Helper: base query aset dengan JOIN ──────────────────────────
const BASE_QUERY = `
  SELECT
    a.id, a.kode, a.nama, a.merek, a.model,
    a.nomor_seri, a.nomor_inventaris, a.spesifikasi,
    k.nama AS kategori, k.id AS kategori_id,
    l.nama AS lokasi,   l.id AS lokasi_id,
    v.nama AS vendor,   v.id AS vendor_id,
    a.pengguna, a.departemen_pengguna,
    a.status, a.kondisi,
    a.tahun_pengadaan, a.tanggal_beli,
    a.harga_beli, a.garansi_sampai,
    a.catatan, a.foto,
    a.created_at, a.updated_at,
    u1.nama_lengkap AS dibuat_oleh,
    u2.nama_lengkap AS diubah_oleh
  FROM aset a
  LEFT JOIN kategori k  ON a.kategori_id = k.id
  LEFT JOIN lokasi   l  ON a.lokasi_id   = l.id
  LEFT JOIN vendor   v  ON a.vendor_id   = v.id
  LEFT JOIN users    u1 ON a.created_by  = u1.id
  LEFT JOIN users    u2 ON a.updated_by  = u2.id
`;

// ─── GET /api/aset ─── Daftar aset dengan filter, search, paginasi
router.get('/', authenticate, (req, res) => {
  const db = getDb();
  const {
    search = '', kategori = '', status = '', lokasi = '',
    page = 1, limit = 10, sort = 'a.kode', order = 'ASC',
    garansi_expired = ''
  } = req.query;

  const allowedSort  = ['a.kode','a.nama','a.status','a.tahun_pengadaan','a.garansi_sampai','k.nama','l.nama'];
  const allowedOrder = ['ASC','DESC'];
  const safeSort  = allowedSort.includes(sort) ? sort : 'a.kode';
  const safeOrder = allowedOrder.includes(order.toUpperCase()) ? order.toUpperCase() : 'ASC';

  const conditions = [];
  const params     = [];

  if (search) {
    conditions.push(`(a.kode LIKE ? OR a.nama LIKE ? OR a.pengguna LIKE ? OR a.merek LIKE ?)`);
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }
  if (kategori)  { conditions.push(`k.nama = ?`);    params.push(kategori); }
  if (status)    { conditions.push(`a.status = ?`);  params.push(status); }
  if (lokasi)    { conditions.push(`l.nama LIKE ?`); params.push(`%${lokasi}%`); }
  if (garansi_expired === '1') {
    conditions.push(`a.garansi_sampai < date('now')`);
  } else if (garansi_expired === '30') {
    conditions.push(`a.garansi_sampai BETWEEN date('now') AND date('now','+30 days')`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));

  const total = db.prepare(`SELECT COUNT(*) AS n FROM aset a LEFT JOIN kategori k ON a.kategori_id=k.id LEFT JOIN lokasi l ON a.lokasi_id=l.id ${where}`).get(...params).n;
  const rows  = db.prepare(`${BASE_QUERY} ${where} ORDER BY ${safeSort} ${safeOrder} LIMIT ? OFFSET ?`).all(...params, Number(limit), offset);

  res.json({
    success: true,
    data: rows,
    pagination: {
      total,
      page:       Number(page),
      limit:      Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    },
  });
});

// ─── GET /api/aset/stats ── Statistik ringkasan dashboard
router.get('/stats', authenticate, (req, res) => {
  const db = getDb();

  const totalAset    = db.prepare(`SELECT COUNT(*) AS n FROM aset`).get().n;
  const statusStats  = db.prepare(`SELECT status, COUNT(*) AS n FROM aset GROUP BY status`).all();
  const kategoriStats= db.prepare(`SELECT k.nama, COUNT(*) AS n FROM aset a LEFT JOIN kategori k ON a.kategori_id=k.id GROUP BY k.nama ORDER BY n DESC`).all();
  const lokasiStats  = db.prepare(`SELECT l.nama, COUNT(*) AS n FROM aset a LEFT JOIN lokasi l ON a.lokasi_id=l.id GROUP BY l.nama ORDER BY n DESC`).all();
  const garansiAktif = db.prepare(`SELECT COUNT(*) AS n FROM aset WHERE garansi_sampai >= date('now')`).get().n;
  const garansiExpired= db.prepare(`SELECT COUNT(*) AS n FROM aset WHERE garansi_sampai < date('now') AND garansi_sampai IS NOT NULL`).get().n;
  const garansi30Hari= db.prepare(`SELECT COUNT(*) AS n FROM aset WHERE garansi_sampai BETWEEN date('now') AND date('now','+30 days')`).get().n;

  // Peminjaman & maintenance aktif
  const pinjamAktif  = db.prepare(`SELECT COUNT(*) AS n FROM peminjaman WHERE status='Dipinjam'`).get().n;
  const maintenanceAktif = db.prepare(`SELECT COUNT(*) AS n FROM maintenance WHERE status='Proses'`).get().n;

  res.json({
    success: true,
    data: {
      totalAset,
      statusStats,
      kategoriStats,
      lokasiStats,
      garansiAktif,
      garansiExpired,
      garansi30Hari,
      pinjamAktif,
      maintenanceAktif,
    },
  });
});

// ─── GET /api/aset/generate-kode ── Auto-generate kode aset
router.get('/generate-kode', authenticate, (req, res) => {
  const { kategori_id } = req.query;
  if (!kategori_id) return res.status(400).json({ success: false, message: 'kategori_id diperlukan.' });

  const db = getDb();
  const kat = db.prepare('SELECT * FROM kategori WHERE id=?').get(kategori_id);
  if (!kat) return res.status(404).json({ success: false, message: 'Kategori tidak ditemukan.' });

  const existing = db.prepare(`SELECT kode FROM aset WHERE kode LIKE ? ORDER BY kode DESC`).all(`SHARP-${kat.prefix}-%`);
  let maxNum = 0;
  for (const row of existing) {
    const parts = row.kode.split('-');
    const num = parseInt(parts[2], 10);
    if (!isNaN(num) && num > maxNum) maxNum = num;
  }
  const newKode = `SHARP-${kat.prefix}-${String(maxNum + 1).padStart(3, '0')}`;

  res.json({ success: true, kode: newKode });
});

// ─── GET /api/aset/:id ── Detail satu aset
router.get('/:id', authenticate, (req, res) => {
  const db = getDb();
  const aset = db.prepare(`${BASE_QUERY} WHERE a.id = ?`).get(req.params.id);
  if (!aset) return res.status(404).json({ success: false, message: 'Aset tidak ditemukan.' });

  // Ambil riwayat peminjaman
  const peminjaman = db.prepare(`
    SELECT p.*, a.kode AS kode_aset FROM peminjaman p
    JOIN aset a ON p.aset_id = a.id
    WHERE p.aset_id = ? ORDER BY p.created_at DESC LIMIT 10
  `).all(req.params.id);

  // Ambil riwayat maintenance
  const maintenance = db.prepare(`
    SELECT m.*, a.kode AS kode_aset FROM maintenance m
    JOIN aset a ON m.aset_id = a.id
    WHERE m.aset_id = ? ORDER BY m.created_at DESC LIMIT 10
  `).all(req.params.id);

  res.json({ success: true, data: { ...aset, riwayat_peminjaman: peminjaman, riwayat_maintenance: maintenance } });
});

// ─── POST /api/aset ── Tambah aset baru
router.post('/', authenticate, authorize('admin', 'teknisi'), upload.single('foto'), [
  body('kode').trim().notEmpty().withMessage('Kode aset wajib diisi.'),
  body('nama').trim().notEmpty().withMessage('Nama aset wajib diisi.'),
  body('kategori_id').isInt({ min: 1 }).withMessage('Kategori wajib dipilih.'),
  body('status').isIn(['Aktif','Perbaikan','Dipinjam','Scrap','Gudang']).withMessage('Status tidak valid.'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const db = getDb();
  const {
    kode, nama, merek, model, nomor_seri, nomor_inventaris,
    spesifikasi, kategori_id, lokasi_id, vendor_id,
    pengguna, departemen_pengguna, status = 'Aktif', kondisi = 'Baik',
    tahun_pengadaan, tanggal_beli, harga_beli, garansi_sampai, catatan,
  } = req.body;

  // Cek duplikat kode
  const exist = db.prepare('SELECT id FROM aset WHERE kode = ?').get(kode);
  if (exist) return res.status(409).json({ success: false, message: `Kode aset '${kode}' sudah terdaftar.` });

  const foto = req.file ? `/uploads/aset/${req.file.filename}` : null;

  const result = db.prepare(`
    INSERT INTO aset
      (kode, nama, merek, model, nomor_seri, nomor_inventaris, spesifikasi,
       kategori_id, lokasi_id, vendor_id, pengguna, departemen_pengguna,
       status, kondisi, tahun_pengadaan, tanggal_beli, harga_beli,
       garansi_sampai, catatan, foto, created_by, updated_by)
    VALUES
      (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    kode, nama, merek||null, model||null, nomor_seri||null, nomor_inventaris||null, spesifikasi||null,
    kategori_id||null, lokasi_id||null, vendor_id||null, pengguna||null, departemen_pengguna||null,
    status, kondisi, tahun_pengadaan||null, tanggal_beli||null, parseFloat(harga_beli)||0,
    garansi_sampai||null, catatan||null, foto, req.user.id, req.user.id
  );

  req.logActivity?.({ aksi: 'CREATE', tabel: 'aset', recordId: result.lastInsertRowid, keterangan: `Aset baru ditambahkan: ${kode}` });

  const newAset = db.prepare(`${BASE_QUERY} WHERE a.id = ?`).get(result.lastInsertRowid);
  res.status(201).json({ success: true, message: `Aset ${kode} berhasil ditambahkan.`, data: newAset });
});

// ─── PUT /api/aset/:id ── Update aset
router.put('/:id', authenticate, authorize('admin', 'teknisi'), upload.single('foto'), (req, res) => {
  const db = getDb();
  const aset = db.prepare('SELECT * FROM aset WHERE id=?').get(req.params.id);
  if (!aset) return res.status(404).json({ success: false, message: 'Aset tidak ditemukan.' });

  const {
    kode, nama, merek, model, nomor_seri, nomor_inventaris, spesifikasi,
    kategori_id, lokasi_id, vendor_id, pengguna, departemen_pengguna,
    status, kondisi, tahun_pengadaan, tanggal_beli, harga_beli,
    garansi_sampai, catatan,
  } = req.body;

  // Cek duplikat kode (selain diri sendiri)
  if (kode && kode !== aset.kode) {
    const exist = db.prepare('SELECT id FROM aset WHERE kode=? AND id!=?').get(kode, aset.id);
    if (exist) return res.status(409).json({ success: false, message: `Kode '${kode}' sudah digunakan aset lain.` });
  }

  // Handle foto baru (hapus foto lama jika ada)
  let foto = aset.foto;
  if (req.file) {
    if (aset.foto) {
      const oldPath = path.join(__dirname, '..', aset.foto);
      fs.unlink(oldPath, () => {});
    }
    foto = `/uploads/aset/${req.file.filename}`;
  }

  db.prepare(`
    UPDATE aset SET
      kode=?, nama=?, merek=?, model=?, nomor_seri=?, nomor_inventaris=?,
      spesifikasi=?, kategori_id=?, lokasi_id=?, vendor_id=?,
      pengguna=?, departemen_pengguna=?, status=?, kondisi=?,
      tahun_pengadaan=?, tanggal_beli=?, harga_beli=?,
      garansi_sampai=?, catatan=?, foto=?, updated_by=?,
      updated_at=datetime('now','localtime')
    WHERE id=?
  `).run(
    kode    ?? aset.kode,
    nama    ?? aset.nama,
    merek   ?? aset.merek,
    model   ?? aset.model,
    nomor_seri ?? aset.nomor_seri,
    nomor_inventaris ?? aset.nomor_inventaris,
    spesifikasi ?? aset.spesifikasi,
    kategori_id ?? aset.kategori_id,
    lokasi_id   ?? aset.lokasi_id,
    vendor_id   ?? aset.vendor_id,
    pengguna    ?? aset.pengguna,
    departemen_pengguna ?? aset.departemen_pengguna,
    status   ?? aset.status,
    kondisi  ?? aset.kondisi,
    tahun_pengadaan ?? aset.tahun_pengadaan,
    tanggal_beli    ?? aset.tanggal_beli,
    harga_beli != null ? parseFloat(harga_beli) : aset.harga_beli,
    garansi_sampai ?? aset.garansi_sampai,
    catatan ?? aset.catatan,
    foto,
    req.user.id,
    aset.id
  );

  req.logActivity?.({ aksi: 'UPDATE', tabel: 'aset', recordId: aset.id, keterangan: `Aset diperbarui: ${aset.kode}` });

  const updated = db.prepare(`${BASE_QUERY} WHERE a.id = ?`).get(aset.id);
  res.json({ success: true, message: 'Aset berhasil diperbarui.', data: updated });
});

// ─── PATCH /api/aset/:id/status ── Ubah status saja
router.patch('/:id/status', authenticate, authorize('admin', 'teknisi'), [
  body('status').isIn(['Aktif','Perbaikan','Dipinjam','Scrap','Gudang']).withMessage('Status tidak valid.'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const db = getDb();
  const aset = db.prepare('SELECT * FROM aset WHERE id=?').get(req.params.id);
  if (!aset) return res.status(404).json({ success: false, message: 'Aset tidak ditemukan.' });

  db.prepare(`UPDATE aset SET status=?, updated_by=?, updated_at=datetime('now','localtime') WHERE id=?`)
    .run(req.body.status, req.user.id, aset.id);

  req.logActivity?.({ aksi: 'UPDATE_STATUS', tabel: 'aset', recordId: aset.id, keterangan: `Status ${aset.kode} diubah: ${aset.status} → ${req.body.status}` });

  res.json({ success: true, message: `Status aset diubah menjadi ${req.body.status}.` });
});

// ─── DELETE /api/aset/:id ── Hapus aset (admin only)
router.delete('/:id', authenticate, authorize('admin'), (req, res) => {
  const db = getDb();
  const aset = db.prepare('SELECT * FROM aset WHERE id=?').get(req.params.id);
  if (!aset) return res.status(404).json({ success: false, message: 'Aset tidak ditemukan.' });

  // Hapus foto dari disk jika ada
  if (aset.foto) {
    const filePath = path.join(__dirname, '..', aset.foto);
    fs.unlink(filePath, () => {});
  }

  db.prepare('DELETE FROM aset WHERE id=?').run(aset.id);
  req.logActivity?.({ aksi: 'DELETE', tabel: 'aset', recordId: aset.id, keterangan: `Aset dihapus: ${aset.kode}` });

  res.json({ success: true, message: `Aset ${aset.kode} berhasil dihapus.` });
});

module.exports = router;
