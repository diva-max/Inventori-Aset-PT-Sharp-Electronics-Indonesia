// routes/auth.js
// Endpoint autentikasi: login, info profil, ubah password

const express = require('express');
const bcrypt  = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { getDb } = require('../db/database');
const { generateToken, authenticate } = require('../middleware/auth');
const { logActivity } = require('../middleware/logger');

const router = express.Router();

// ─── POST /api/auth/login ─────────────────────────────────────────────────
router.post('/login', [
  body('username').trim().notEmpty().withMessage('Username wajib diisi.'),
  body('password').notEmpty().withMessage('Password wajib diisi.'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { username, password } = req.body;
  const db = getDb();

  const user = db.prepare('SELECT * FROM users WHERE username = ? AND aktif = 1').get(username);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Username atau password salah.' });
  }

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) {
    logActivity({ userId: null, aksi: 'LOGIN_GAGAL', tabel: 'users', keterangan: `Login gagal untuk username: ${username}`, ip: req.ip });
    return res.status(401).json({ success: false, message: 'Username atau password salah.' });
  }

  const token = generateToken(user);

  logActivity({ userId: user.id, aksi: 'LOGIN', tabel: 'users', recordId: user.id, keterangan: `Login berhasil: ${username}`, ip: req.ip });

  res.json({
    success: true,
    message: 'Login berhasil.',
    token,
    user: {
      id: user.id,
      username: user.username,
      nama_lengkap: user.nama_lengkap,
      email: user.email,
      role: user.role,
      departemen: user.departemen,
    },
  });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────
router.get('/me', authenticate, (req, res) => {
  const db = getDb();
  const user = db.prepare(
    'SELECT id, username, nama_lengkap, email, role, departemen, created_at FROM users WHERE id = ?'
  ).get(req.user.id);

  if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });

  res.json({ success: true, data: user });
});

// ─── PUT /api/auth/change-password ───────────────────────────────────────
router.put('/change-password', authenticate, [
  body('password_lama').notEmpty().withMessage('Password lama wajib diisi.'),
  body('password_baru').isLength({ min: 6 }).withMessage('Password baru minimal 6 karakter.'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { password_lama, password_baru } = req.body;
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

  if (!bcrypt.compareSync(password_lama, user.password)) {
    return res.status(400).json({ success: false, message: 'Password lama tidak sesuai.' });
  }

  const hash = bcrypt.hashSync(password_baru, 10);
  db.prepare("UPDATE users SET password=?, updated_at=datetime('now','localtime') WHERE id=?")
    .run(hash, req.user.id);

  req.logActivity?.({ aksi: 'CHANGE_PASSWORD', tabel: 'users', recordId: req.user.id, keterangan: 'Password diubah' });

  res.json({ success: true, message: 'Password berhasil diubah.' });
});

module.exports = router;
