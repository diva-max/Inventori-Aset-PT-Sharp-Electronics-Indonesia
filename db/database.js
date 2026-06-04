// db/database.js
// Inisialisasi SQLite dan semua tabel sistem inventori aset IT

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'inventori.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    -- ── TABEL USERS ──────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS users (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      username    TEXT    NOT NULL UNIQUE,
      password    TEXT    NOT NULL,
      nama_lengkap TEXT   NOT NULL,
      email       TEXT    UNIQUE,
      role        TEXT    NOT NULL DEFAULT 'viewer'
                  CHECK(role IN ('admin','teknisi','viewer')),
      departemen  TEXT,
      aktif       INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    );

    -- ── TABEL KATEGORI ───────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS kategori (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      nama    TEXT    NOT NULL UNIQUE,
      prefix  TEXT    NOT NULL UNIQUE,   -- NB, PC, PR, SV, SW, dst
      keterangan TEXT
    );

    -- ── TABEL LOKASI ─────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS lokasi (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      nama    TEXT    NOT NULL UNIQUE,
      gedung  TEXT,
      lantai  TEXT,
      keterangan TEXT
    );

    -- ── TABEL VENDOR ─────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS vendor (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      nama      TEXT    NOT NULL,
      kontak    TEXT,
      telepon   TEXT,
      email     TEXT,
      alamat    TEXT,
      keterangan TEXT,
      aktif     INTEGER NOT NULL DEFAULT 1,
      created_at TEXT   NOT NULL DEFAULT (datetime('now','localtime'))
    );

    -- ── TABEL ASET ───────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS aset (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      kode            TEXT    NOT NULL UNIQUE,
      nama            TEXT    NOT NULL,
      merek           TEXT,
      model           TEXT,
      nomor_seri      TEXT,
      nomor_inventaris TEXT,
      spesifikasi     TEXT,
      kategori_id     INTEGER REFERENCES kategori(id),
      lokasi_id       INTEGER REFERENCES lokasi(id),
      vendor_id       INTEGER REFERENCES vendor(id),
      pengguna        TEXT,
      departemen_pengguna TEXT,
      status          TEXT    NOT NULL DEFAULT 'Aktif'
                      CHECK(status IN ('Aktif','Perbaikan','Dipinjam','Scrap','Gudang')),
      kondisi         TEXT    NOT NULL DEFAULT 'Baik'
                      CHECK(kondisi IN ('Baik','Rusak Ringan','Rusak Berat','Scrap')),
      tahun_pengadaan TEXT,
      tanggal_beli    TEXT,
      harga_beli      REAL    DEFAULT 0,
      garansi_sampai  TEXT,
      catatan         TEXT,
      foto            TEXT,   -- path file foto
      created_by      INTEGER REFERENCES users(id),
      updated_by      INTEGER REFERENCES users(id),
      created_at      TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at      TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    );

    -- ── TABEL PEMINJAMAN ─────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS peminjaman (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      aset_id         INTEGER NOT NULL REFERENCES aset(id),
      peminjam        TEXT    NOT NULL,
      departemen      TEXT,
      keperluan       TEXT,
      tanggal_pinjam  TEXT    NOT NULL,
      tanggal_kembali_rencana TEXT NOT NULL,
      tanggal_kembali_aktual  TEXT,
      status          TEXT    NOT NULL DEFAULT 'Dipinjam'
                      CHECK(status IN ('Dipinjam','Dikembalikan','Terlambat')),
      kondisi_kembali TEXT,
      catatan         TEXT,
      approved_by     INTEGER REFERENCES users(id),
      created_by      INTEGER REFERENCES users(id),
      created_at      TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at      TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    );

    -- ── TABEL MAINTENANCE ────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS maintenance (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      aset_id         INTEGER NOT NULL REFERENCES aset(id),
      jenis           TEXT    NOT NULL
                      CHECK(jenis IN ('Preventif','Korektif','Upgrade','Kalibrasi')),
      masalah         TEXT,
      penanganan      TEXT,
      teknisi         TEXT,
      vendor_id       INTEGER REFERENCES vendor(id),
      biaya           REAL    DEFAULT 0,
      tanggal_masuk   TEXT    NOT NULL,
      tanggal_selesai TEXT,
      status          TEXT    NOT NULL DEFAULT 'Proses'
                      CHECK(status IN ('Proses','Selesai','Ditunda','Batal')),
      catatan         TEXT,
      created_by      INTEGER REFERENCES users(id),
      created_at      TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at      TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    );

    -- ── TABEL LOG AKTIVITAS ──────────────────────────────────────
    CREATE TABLE IF NOT EXISTS log_aktivitas (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER REFERENCES users(id),
      aksi        TEXT    NOT NULL,   -- CREATE, UPDATE, DELETE, BORROW, RETURN, MAINTENANCE
      tabel       TEXT    NOT NULL,   -- aset, peminjaman, maintenance, dll
      record_id   INTEGER,
      keterangan  TEXT,
      ip_address  TEXT,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    );

    -- ── INDEXES ──────────────────────────────────────────────────
    CREATE INDEX IF NOT EXISTS idx_aset_kode       ON aset(kode);
    CREATE INDEX IF NOT EXISTS idx_aset_status     ON aset(status);
    CREATE INDEX IF NOT EXISTS idx_aset_kategori   ON aset(kategori_id);
    CREATE INDEX IF NOT EXISTS idx_aset_lokasi     ON aset(lokasi_id);
    CREATE INDEX IF NOT EXISTS idx_peminjaman_aset ON peminjaman(aset_id);
    CREATE INDEX IF NOT EXISTS idx_peminjaman_status ON peminjaman(status);
    CREATE INDEX IF NOT EXISTS idx_maintenance_aset  ON maintenance(aset_id);
    CREATE INDEX IF NOT EXISTS idx_log_user        ON log_aktivitas(user_id);
    CREATE INDEX IF NOT EXISTS idx_log_created     ON log_aktivitas(created_at);
  `);
}

module.exports = { getDb };
