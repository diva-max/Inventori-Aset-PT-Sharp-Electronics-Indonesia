// middleware/auth.js
// Middleware autentikasi JWT dan kontrol akses berbasis role

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'sharp-inventori-secret-key-2024-ganti-di-production';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '8h';

/**
 * Verifikasi token JWT dari header Authorization: Bearer <token>
 */
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Token autentikasi diperlukan.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Sesi habis, silakan login kembali.' });
    }
    return res.status(403).json({ success: false, message: 'Token tidak valid.' });
  }
}

/**
 * Batasi akses berdasarkan role: 'admin', 'teknisi', 'viewer'
 * Contoh: authorize('admin') atau authorize('admin','teknisi')
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Tidak terautentikasi.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Akses ditolak. Role '${req.user.role}' tidak diizinkan untuk aksi ini.`
      });
    }
    next();
  };
}

/**
 * Generate JWT token
 */
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      nama_lengkap: user.nama_lengkap,
      role: user.role,
      departemen: user.departemen,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

module.exports = { authenticate, authorize, generateToken };
