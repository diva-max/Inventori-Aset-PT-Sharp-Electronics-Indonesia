// server.js
// Entry point — PT Sharp Electronics Indonesia IT Asset Inventory Backend

require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const morgan   = require('morgan');
const path     = require('path');

const { getDb }         = require('./db/database');
const { authenticate }  = require('./middleware/auth');
const { activityLogger }= require('./middleware/logger');

// Route handlers
const authRoutes        = require('./routes/auth');
const asetRoutes        = require('./routes/aset');
const peminjamanRoutes  = require('./routes/peminjaman');
const maintenanceRoutes = require('./routes/maintenance');
const masterRoutes      = require('./routes/master');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Init database on startup ─────────────────────────────────────
getDb();

// ── Middlewares ──────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));

app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static file serving untuk foto aset
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Activity logger: pasang req.logActivity ke semua route
app.use(authenticate.unless ? authenticate : (req, res, next) => {
  // Pasang logActivity (tidak wajib login di middleware ini)
  req.logActivity = () => {};
  next();
});
app.use(activityLogger);

// ── API Routes ────────────────────────────────────────────────────
app.use('/api/auth',        authRoutes);
app.use('/api/aset',        asetRoutes);
app.use('/api/peminjaman',  peminjamanRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/master',      masterRoutes);

// ── Health check ──────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  const db = getDb();
  const asetCount = db.prepare('SELECT COUNT(*) AS n FROM aset').get().n;
  res.json({
    success: true,
    service: 'Sharp IT Inventory API',
    version: '1.0.0',
    status:  'OK',
    database: 'Connected',
    totalAset: asetCount,
    timestamp: new Date().toISOString(),
  });
});

// ── 404 Handler ───────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Endpoint ${req.method} ${req.path} tidak ditemukan.` });
});

// ── Global Error Handler ──────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Error]', err);

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, message: 'Ukuran file terlalu besar. Maksimal 5MB.' });
  }
  if (err.message?.includes('gambar')) {
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return res.status(409).json({ success: false, message: 'Data sudah ada (duplikat).' });
  }

  res.status(500).json({ success: false, message: 'Terjadi kesalahan server.', detail: process.env.NODE_ENV === 'development' ? err.message : undefined });
});

// ── Start ──────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Sharp IT Inventory API berjalan di http://localhost:${PORT}`);
  console.log(`   Mode: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
  console.log(`\n📋 Endpoint tersedia:`);
  console.log(`   POST   /api/auth/login`);
  console.log(`   GET    /api/aset`);
  console.log(`   GET    /api/aset/stats`);
  console.log(`   POST   /api/aset`);
  console.log(`   GET    /api/peminjaman`);
  console.log(`   POST   /api/peminjaman`);
  console.log(`   GET    /api/maintenance`);
  console.log(`   POST   /api/maintenance`);
  console.log(`   GET    /api/master/kategori`);
  console.log(`   GET    /api/master/lokasi`);
  console.log(`   GET    /api/master/vendor`);
  console.log(`   GET    /api/master/users`);
  console.log(`   GET    /api/master/log\n`);
});

module.exports = app;
