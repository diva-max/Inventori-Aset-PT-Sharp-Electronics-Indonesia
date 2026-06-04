// routes/maintenance.js
// Manajemen maintenance / perbaikan aset IT

const express = require('express');
const { body, validationResult } = require('express-validator');
const { getDb } = require('../db/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

const BASE_QUERY = `
  SELECT
    m.*,
    a.kode     AS kode_aset,
    a.nama     AS nama_aset,
    a.merek    AS merek_aset,
    k.nama     AS kategori_aset,
    l.nama     AS lokasi_aset,
    v.nama     AS nama_vendor,
    u.nama_lengkap AS dibuat_oleh
  FROM maintenance m
  JOIN  aset       a  ON m.aset_id   = a.id
  LEFT JOIN kategori k ON a.kategori_id = k.id
  LEFT JOIN lokasi   l ON a.lokasi_id   = l.id
  LEFT JOIN vendor   v ON m.vendor_id   = v.id
  LEFT JOIN users    u ON m.created_by  = u.id
`;

// ─── GET /api/maintenance ── Daftar maintenance
router.get('/', authenticate, (req, res) => {
  const db = getDb();
  const { status = '', jenis = '', search = '', page = 1, limit = 10 } = req.query;

  const conditions = [];
  const params = [];
  if (status) { conditions.push(`m.status = ?`); params.push(status); }
  if (jenis)  { conditions.push(`m.jenis = ?`);  params.push(jenis); }
  if (search) {
    conditions.push(`(a.kode LIKE ? OR a.nama LIKE ? OR m.masalah LIKE ? OR m.teknisi LIKE ?)`);
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }

  const where  = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));

  const total = db.prepare(`SELECT COUNT(*) AS n FROM maintenance m JOIN aset a ON m.aset_id=a.id ${where}`).get(...params).n;
  const rows  = db.prepare(`${BASE_QUERY} ${where} ORDER BY m.created_at DESC LIMIT ? OFFSET ?`).all(...params, Number(limit), offset);

  res.json({ success: true, data: rows, pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } });
});

// ─── GET /api/maintenance/:id ── Detail maintenance
router.get('/:id', authenticate, (req, res) => {
  const db = getDb();
  const row = db.prepare(`${BASE_QUERY} WHERE m.id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ success: false, message: 'Data maintenance tidak ditemukan.' });
  res.json({ success: true, data: row });
});

// ─── POST /api/maintenance ── Buat tiket maintenance baru
router.post('/', authenticate, authorize('admin', 'teknisi'), [
  body('aset_id').isInt({ min: 1 }).withMessage('Aset wajib dipilih.'),
  body('jenis').isIn(['Preventif','Korektif','Upgrade','Kalibrasi']).withMessage('Jenis maintenance tidak valid.'),
  body('tanggal_masuk').isDate().withMessage('Tanggal masuk tidak valid.'),
  body('masalah').trim().notEmpty().withMessage('Deskripsi masalah wajib diisi.'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const db = getDb();
  const { aset_id, jenis, masalah, teknisi, vendor_id, biaya, tanggal_masuk, tanggal_selesai, catatan } = req.body;

  const aset = db.prepare('SELECT * FROM aset WHERE id=?').get(aset_id);
  if (!aset) return res.status(404).json({ success: false, message: 'Aset tidak ditemukan.' });

  const result = db.prepare(`
    INSERT INTO maintenance (aset_id, jenis, masalah, teknisi, vendor_id, biaya, tanggal_masuk, tanggal_selesai, status, catatan, created_by)
    VALUES (?,?,?,?,?,?,?,?,'Proses',?,?)
  `).run(aset_id, jenis, masalah, teknisi||null, vendor_id||null, parseFloat(biaya)||0, tanggal_masuk, tanggal_selesai||null, catatan||null, req.user.id);

  // Update status aset menjadi Perbaikan
  db.prepare(`UPDATE aset SET status='Perbaikan', updated_by=?, updated_at=datetime('now','localtime') WHERE id=?`)
    .run(req.user.id, aset_id);

  req.logActivity?.({ aksi: 'MAINTENANCE_CREATE', tabel: 'maintenance', recordId: result.lastInsertRowid, keterangan: `Maintenance dibuka untuk aset ${aset.kode}: ${masalah}` });

  const created = db.prepare(`${BASE_QUERY} WHERE m.id=?`).get(result.lastInsertRowid);
  res.status(201).json({ success: true, message: `Tiket maintenance untuk ${aset.kode} berhasil dibuat.`, data: created });
});

// ─── PUT /api/maintenance/:id ── Update maintenance
router.put('/:id', authenticate, authorize('admin', 'teknisi'), (req, res) => {
  const db = getDb();
  const rec = db.prepare('SELECT * FROM maintenance WHERE id=?').get(req.params.id);
  if (!rec) return res.status(404).json({ success: false, message: 'Data maintenance tidak ditemukan.' });

  const { jenis, masalah, penanganan, teknisi, vendor_id, biaya, tanggal_masuk, tanggal_selesai, status, catatan } = req.body;

  db.prepare(`
    UPDATE maintenance SET
      jenis=?, masalah=?, penanganan=?, teknisi=?, vendor_id=?, biaya=?,
      tanggal_masuk=?, tanggal_selesai=?, status=?, catatan=?,
      updated_at=datetime('now','localtime')
    WHERE id=?
  `).run(
    jenis          ?? rec.jenis,
    masalah        ?? rec.masalah,
    penanganan     ?? rec.penanganan,
    teknisi        ?? rec.teknisi,
    vendor_id      ?? rec.vendor_id,
    biaya != null  ? parseFloat(biaya) : rec.biaya,
    tanggal_masuk  ?? rec.tanggal_masuk,
    tanggal_selesai ?? rec.tanggal_selesai,
    status         ?? rec.status,
    catatan        ?? rec.catatan,
    rec.id
  );

  // Jika selesai, kembalikan status aset ke Aktif
  if (status === 'Selesai' && rec.status !== 'Selesai') {
    db.prepare(`UPDATE aset SET status='Aktif', updated_by=?, updated_at=datetime('now','localtime') WHERE id=?`)
      .run(req.user.id, rec.aset_id);

    const aset = db.prepare('SELECT kode FROM aset WHERE id=?').get(rec.aset_id);
    req.logActivity?.({ aksi: 'MAINTENANCE_SELESAI', tabel: 'maintenance', recordId: rec.id, keterangan: `Maintenance selesai untuk aset ${aset?.kode}` });
  }

  const updated = db.prepare(`${BASE_QUERY} WHERE m.id=?`).get(rec.id);
  res.json({ success: true, message: 'Maintenance berhasil diperbarui.', data: updated });
});

// ─── DELETE /api/maintenance/:id ── Hapus record maintenance
router.delete('/:id', authenticate, authorize('admin'), (req, res) => {
  const db = getDb();
  const rec = db.prepare('SELECT * FROM maintenance WHERE id=?').get(req.params.id);
  if (!rec) return res.status(404).json({ success: false, message: 'Data maintenance tidak ditemukan.' });

  db.prepare('DELETE FROM maintenance WHERE id=?').run(rec.id);
  req.logActivity?.({ aksi: 'DELETE', tabel: 'maintenance', recordId: rec.id, keterangan: `Maintenance ID ${rec.id} dihapus` });

  res.json({ success: true, message: 'Data maintenance berhasil dihapus.' });
});

module.exports = router;
