// routes/master.js
// Master data: kategori, lokasi, vendor, users

const express = require('express');
const bcrypt  = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { getDb } = require('../db/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════
// KATEGORI
// ═══════════════════════════════════════════════════════════════════
router.get('/kategori', authenticate, (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT k.*, COUNT(a.id) AS jumlah_aset
    FROM kategori k LEFT JOIN aset a ON a.kategori_id = k.id
    GROUP BY k.id ORDER BY k.nama
  `).all();
  res.json({ success: true, data: rows });
});

router.post('/kategori', authenticate, authorize('admin'), [
  body('nama').trim().notEmpty(),
  body('prefix').trim().notEmpty().isLength({ max: 3 }),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const db = getDb();
  const { nama, prefix, keterangan } = req.body;
  const result = db.prepare('INSERT INTO kategori (nama, prefix, keterangan) VALUES (?,?,?)').run(nama, prefix.toUpperCase(), keterangan||null);
  res.status(201).json({ success: true, message: 'Kategori ditambahkan.', data: { id: result.lastInsertRowid, nama, prefix } });
});

router.put('/kategori/:id', authenticate, authorize('admin'), (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM kategori WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ success: false, message: 'Kategori tidak ditemukan.' });

  const { nama, prefix, keterangan } = req.body;
  db.prepare('UPDATE kategori SET nama=?, prefix=?, keterangan=? WHERE id=?')
    .run(nama ?? row.nama, prefix ? prefix.toUpperCase() : row.prefix, keterangan ?? row.keterangan, row.id);
  res.json({ success: true, message: 'Kategori diperbarui.' });
});

router.delete('/kategori/:id', authenticate, authorize('admin'), (req, res) => {
  const db = getDb();
  const used = db.prepare('SELECT COUNT(*) AS n FROM aset WHERE kategori_id=?').get(req.params.id).n;
  if (used > 0) return res.status(409).json({ success: false, message: `Kategori digunakan oleh ${used} aset, tidak bisa dihapus.` });
  db.prepare('DELETE FROM kategori WHERE id=?').run(req.params.id);
  res.json({ success: true, message: 'Kategori dihapus.' });
});

// ═══════════════════════════════════════════════════════════════════
// LOKASI
// ═══════════════════════════════════════════════════════════════════
router.get('/lokasi', authenticate, (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT l.*, COUNT(a.id) AS jumlah_aset
    FROM lokasi l LEFT JOIN aset a ON a.lokasi_id = l.id
    GROUP BY l.id ORDER BY l.nama
  `).all();
  res.json({ success: true, data: rows });
});

router.post('/lokasi', authenticate, authorize('admin'), [
  body('nama').trim().notEmpty(),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const db = getDb();
  const { nama, gedung, lantai, keterangan } = req.body;
  const result = db.prepare('INSERT INTO lokasi (nama, gedung, lantai, keterangan) VALUES (?,?,?,?)').run(nama, gedung||null, lantai||null, keterangan||null);
  res.status(201).json({ success: true, message: 'Lokasi ditambahkan.', data: { id: result.lastInsertRowid, nama } });
});

router.put('/lokasi/:id', authenticate, authorize('admin'), (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM lokasi WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ success: false, message: 'Lokasi tidak ditemukan.' });

  const { nama, gedung, lantai, keterangan } = req.body;
  db.prepare('UPDATE lokasi SET nama=?, gedung=?, lantai=?, keterangan=? WHERE id=?')
    .run(nama ?? row.nama, gedung ?? row.gedung, lantai ?? row.lantai, keterangan ?? row.keterangan, row.id);
  res.json({ success: true, message: 'Lokasi diperbarui.' });
});

router.delete('/lokasi/:id', authenticate, authorize('admin'), (req, res) => {
  const db = getDb();
  const used = db.prepare('SELECT COUNT(*) AS n FROM aset WHERE lokasi_id=?').get(req.params.id).n;
  if (used > 0) return res.status(409).json({ success: false, message: `Lokasi digunakan oleh ${used} aset, tidak bisa dihapus.` });
  db.prepare('DELETE FROM lokasi WHERE id=?').run(req.params.id);
  res.json({ success: true, message: 'Lokasi dihapus.' });
});

// ═══════════════════════════════════════════════════════════════════
// VENDOR
// ═══════════════════════════════════════════════════════════════════
router.get('/vendor', authenticate, (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM vendor WHERE aktif=1 ORDER BY nama').all();
  res.json({ success: true, data: rows });
});

router.post('/vendor', authenticate, authorize('admin'), [
  body('nama').trim().notEmpty(),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const db = getDb();
  const { nama, kontak, telepon, email, alamat, keterangan } = req.body;
  const result = db.prepare('INSERT INTO vendor (nama, kontak, telepon, email, alamat, keterangan) VALUES (?,?,?,?,?,?)').run(nama, kontak||null, telepon||null, email||null, alamat||null, keterangan||null);
  res.status(201).json({ success: true, message: 'Vendor ditambahkan.', data: { id: result.lastInsertRowid, nama } });
});

router.put('/vendor/:id', authenticate, authorize('admin'), (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM vendor WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ success: false, message: 'Vendor tidak ditemukan.' });

  const { nama, kontak, telepon, email, alamat, keterangan, aktif } = req.body;
  db.prepare('UPDATE vendor SET nama=?, kontak=?, telepon=?, email=?, alamat=?, keterangan=?, aktif=? WHERE id=?')
    .run(nama??row.nama, kontak??row.kontak, telepon??row.telepon, email??row.email, alamat??row.alamat, keterangan??row.keterangan, aktif!=null?aktif:row.aktif, row.id);
  res.json({ success: true, message: 'Vendor diperbarui.' });
});

// ═══════════════════════════════════════════════════════════════════
// USERS (admin only)
// ═══════════════════════════════════════════════════════════════════
router.get('/users', authenticate, authorize('admin'), (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT id, username, nama_lengkap, email, role, departemen, aktif, created_at FROM users ORDER BY nama_lengkap').all();
  res.json({ success: true, data: rows });
});

router.post('/users', authenticate, authorize('admin'), [
  body('username').trim().notEmpty(),
  body('password').isLength({ min: 6 }),
  body('nama_lengkap').trim().notEmpty(),
  body('role').isIn(['admin','teknisi','viewer']),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const db = getDb();
  const { username, password, nama_lengkap, email, role, departemen } = req.body;

  const exist = db.prepare('SELECT id FROM users WHERE username=?').get(username);
  if (exist) return res.status(409).json({ success: false, message: `Username '${username}' sudah digunakan.` });

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (username, password, nama_lengkap, email, role, departemen) VALUES (?,?,?,?,?,?)')
    .run(username, hash, nama_lengkap, email||null, role, departemen||null);

  res.status(201).json({ success: true, message: 'User ditambahkan.', data: { id: result.lastInsertRowid, username, nama_lengkap, role } });
});

router.put('/users/:id', authenticate, authorize('admin'), (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
  if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });

  const { nama_lengkap, email, role, departemen, aktif, password } = req.body;

  let passwordHash = user.password;
  if (password) passwordHash = bcrypt.hashSync(password, 10);

  db.prepare(`UPDATE users SET nama_lengkap=?, email=?, role=?, departemen=?, aktif=?, password=?, updated_at=datetime('now','localtime') WHERE id=?`)
    .run(nama_lengkap??user.nama_lengkap, email??user.email, role??user.role, departemen??user.departemen, aktif!=null?aktif:user.aktif, passwordHash, user.id);

  res.json({ success: true, message: 'User diperbarui.' });
});

router.delete('/users/:id', authenticate, authorize('admin'), (req, res) => {
  const db = getDb();
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ success: false, message: 'Tidak bisa menghapus akun sendiri.' });
  }
  db.prepare('UPDATE users SET aktif=0 WHERE id=?').run(req.params.id);
  res.json({ success: true, message: 'User dinonaktifkan.' });
});

// ═══════════════════════════════════════════════════════════════════
// LOG AKTIVITAS
// ═══════════════════════════════════════════════════════════════════
router.get('/log', authenticate, authorize('admin', 'teknisi'), (req, res) => {
  const db = getDb();
  const { page = 1, limit = 20, aksi = '' } = req.query;

  const conditions = aksi ? ['l.aksi = ?'] : [];
  const params = aksi ? [aksi] : [];
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (Math.max(1, Number(page)) - 1) * Number(limit);

  const total = db.prepare(`SELECT COUNT(*) AS n FROM log_aktivitas l ${where}`).get(...params).n;
  const rows = db.prepare(`
    SELECT l.*, u.nama_lengkap, u.username
    FROM log_aktivitas l LEFT JOIN users u ON l.user_id = u.id
    ${where} ORDER BY l.created_at DESC LIMIT ? OFFSET ?
  `).all(...params, Number(limit), offset);

  res.json({ success: true, data: rows, pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } });
});

module.exports = router;
