// routes/peminjaman.js
// Manajemen peminjaman aset: pinjam, kembalikan, daftar, detail

const express = require('express');
const { body, validationResult } = require('express-validator');
const { getDb } = require('../db/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

const BASE_QUERY = `
  SELECT
    p.*,
    a.kode     AS kode_aset,
    a.nama     AS nama_aset,
    a.merek    AS merek_aset,
    k.nama     AS kategori_aset,
    l.nama     AS lokasi_aset,
    u.nama_lengkap AS approved_oleh
  FROM peminjaman p
  JOIN  aset       a ON p.aset_id    = a.id
  LEFT JOIN kategori k ON a.kategori_id = k.id
  LEFT JOIN lokasi   l ON a.lokasi_id   = l.id
  LEFT JOIN users    u ON p.approved_by = u.id
`;

// ─── GET /api/peminjaman ── Daftar semua peminjaman
router.get('/', authenticate, (req, res) => {
  const db = getDb();
  const { status = '', search = '', page = 1, limit = 10 } = req.query;

  const conditions = [];
  const params     = [];

  if (status) { conditions.push(`p.status = ?`); params.push(status); }
  if (search) {
    conditions.push(`(a.kode LIKE ? OR p.peminjam LIKE ? OR p.departemen LIKE ?)`);
    const s = `%${search}%`;
    params.push(s, s, s);
  }

  const where  = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));

  const total = db.prepare(`SELECT COUNT(*) AS n FROM peminjaman p JOIN aset a ON p.aset_id=a.id ${where}`).get(...params).n;
  const rows  = db.prepare(`${BASE_QUERY} ${where} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`).all(...params, Number(limit), offset);

  res.json({
    success: true,
    data: rows,
    pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
  });
});

// ─── GET /api/peminjaman/terlambat ── Cek peminjaman terlambat
router.get('/terlambat', authenticate, (req, res) => {
  const db = getDb();
  const rows = db.prepare(`${BASE_QUERY} WHERE p.status='Dipinjam' AND p.tanggal_kembali_rencana < date('now') ORDER BY p.tanggal_kembali_rencana ASC`).all();

  // Update status jadi Terlambat
  if (rows.length) {
    const ids = rows.map(r => r.id);
    const placeholders = ids.map(() => '?').join(',');
    db.prepare(`UPDATE peminjaman SET status='Terlambat' WHERE id IN (${placeholders})`).run(...ids);
  }

  res.json({ success: true, total: rows.length, data: rows });
});

// ─── GET /api/peminjaman/:id ── Detail peminjaman
router.get('/:id', authenticate, (req, res) => {
  const db = getDb();
  const row = db.prepare(`${BASE_QUERY} WHERE p.id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ success: false, message: 'Data peminjaman tidak ditemukan.' });
  res.json({ success: true, data: row });
});

// ─── POST /api/peminjaman ── Buat peminjaman baru
router.post('/', authenticate, authorize('admin', 'teknisi'), [
  body('aset_id').isInt({ min: 1 }).withMessage('Aset wajib dipilih.'),
  body('peminjam').trim().notEmpty().withMessage('Nama peminjam wajib diisi.'),
  body('tanggal_pinjam').isDate().withMessage('Tanggal pinjam tidak valid.'),
  body('tanggal_kembali_rencana').isDate().withMessage('Tanggal kembali rencana tidak valid.'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const db = getDb();
  const { aset_id, peminjam, departemen, keperluan, tanggal_pinjam, tanggal_kembali_rencana, catatan } = req.body;

  // Cek aset tersedia
  const aset = db.prepare('SELECT * FROM aset WHERE id=?').get(aset_id);
  if (!aset) return res.status(404).json({ success: false, message: 'Aset tidak ditemukan.' });
  if (aset.status !== 'Aktif' && aset.status !== 'Gudang') {
    return res.status(409).json({ success: false, message: `Aset tidak dapat dipinjam, status saat ini: ${aset.status}` });
  }

  const result = db.prepare(`
    INSERT INTO peminjaman (aset_id, peminjam, departemen, keperluan, tanggal_pinjam, tanggal_kembali_rencana, status, catatan, approved_by, created_by)
    VALUES (?,?,?,?,?,?,'Dipinjam',?,?,?)
  `).run(aset_id, peminjam, departemen||null, keperluan||null, tanggal_pinjam, tanggal_kembali_rencana, catatan||null, req.user.id, req.user.id);

  // Update status aset
  db.prepare(`UPDATE aset SET status='Dipinjam', updated_by=?, updated_at=datetime('now','localtime') WHERE id=?`)
    .run(req.user.id, aset_id);

  req.logActivity?.({ aksi: 'BORROW', tabel: 'peminjaman', recordId: result.lastInsertRowid, keterangan: `Aset ${aset.kode} dipinjam oleh ${peminjam}` });

  const created = db.prepare(`${BASE_QUERY} WHERE p.id=?`).get(result.lastInsertRowid);
  res.status(201).json({ success: true, message: `Aset ${aset.kode} berhasil dipinjamkan ke ${peminjam}.`, data: created });
});

// ─── PATCH /api/peminjaman/:id/kembali ── Kembalikan aset
router.patch('/:id/kembali', authenticate, authorize('admin', 'teknisi'), [
  body('tanggal_kembali_aktual').isDate().withMessage('Tanggal kembali tidak valid.'),
  body('kondisi_kembali').notEmpty().withMessage('Kondisi saat dikembalikan wajib diisi.'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const db = getDb();
  const pinjam = db.prepare('SELECT * FROM peminjaman WHERE id=?').get(req.params.id);
  if (!pinjam) return res.status(404).json({ success: false, message: 'Data peminjaman tidak ditemukan.' });
  if (pinjam.status === 'Dikembalikan') {
    return res.status(409).json({ success: false, message: 'Aset sudah dikembalikan sebelumnya.' });
  }

  const { tanggal_kembali_aktual, kondisi_kembali, catatan } = req.body;

  db.prepare(`
    UPDATE peminjaman SET
      tanggal_kembali_aktual=?, kondisi_kembali=?, catatan=COALESCE(?, catatan),
      status='Dikembalikan', updated_at=datetime('now','localtime')
    WHERE id=?
  `).run(tanggal_kembali_aktual, kondisi_kembali, catatan||null, pinjam.id);

  // Kembalikan status aset ke Aktif
  db.prepare(`UPDATE aset SET status='Aktif', updated_by=?, updated_at=datetime('now','localtime') WHERE id=?`)
    .run(req.user.id, pinjam.aset_id);

  const aset = db.prepare('SELECT kode FROM aset WHERE id=?').get(pinjam.aset_id);
  req.logActivity?.({ aksi: 'RETURN', tabel: 'peminjaman', recordId: pinjam.id, keterangan: `Aset ${aset?.kode} dikembalikan oleh ${pinjam.peminjam}` });

  res.json({ success: true, message: 'Aset berhasil dikembalikan.' });
});

// ─── DELETE /api/peminjaman/:id ── Batal peminjaman (admin only)
router.delete('/:id', authenticate, authorize('admin'), (req, res) => {
  const db = getDb();
  const pinjam = db.prepare('SELECT * FROM peminjaman WHERE id=?').get(req.params.id);
  if (!pinjam) return res.status(404).json({ success: false, message: 'Data peminjaman tidak ditemukan.' });

  if (pinjam.status === 'Dipinjam') {
    db.prepare(`UPDATE aset SET status='Aktif', updated_by=?, updated_at=datetime('now','localtime') WHERE id=?`)
      .run(req.user.id, pinjam.aset_id);
  }

  db.prepare('DELETE FROM peminjaman WHERE id=?').run(pinjam.id);
  req.logActivity?.({ aksi: 'DELETE', tabel: 'peminjaman', recordId: pinjam.id, keterangan: `Peminjaman ID ${pinjam.id} dihapus` });

  res.json({ success: true, message: 'Data peminjaman berhasil dihapus.' });
});

module.exports = router;
