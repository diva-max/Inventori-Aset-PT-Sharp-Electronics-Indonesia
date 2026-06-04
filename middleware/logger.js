// middleware/logger.js
// Catat setiap aksi penting ke tabel log_aktivitas

const { getDb } = require('../db/database');

/**
 * Helper: catat log aktivitas ke database
 * @param {object} opts - { userId, aksi, tabel, recordId, keterangan, ip }
 */
function logActivity({ userId, aksi, tabel, recordId, keterangan, ip }) {
  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO log_aktivitas (user_id, aksi, tabel, record_id, keterangan, ip_address)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId || null, aksi, tabel, recordId || null, keterangan || null, ip || null);
  } catch (err) {
    console.error('[Logger] Gagal menyimpan log:', err.message);
  }
}

/**
 * Middleware: attach logActivity ke req agar bisa dipakai di route
 */
function activityLogger(req, res, next) {
  req.logActivity = ({ aksi, tabel, recordId, keterangan }) => {
    logActivity({
      userId: req.user?.id,
      aksi,
      tabel,
      recordId,
      keterangan,
      ip: req.ip || req.connection?.remoteAddress,
    });
  };
  next();
}

module.exports = { activityLogger, logActivity };
