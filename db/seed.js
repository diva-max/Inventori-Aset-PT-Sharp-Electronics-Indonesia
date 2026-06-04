// db/seed.js
// Mengisi data awal: admin, kategori, lokasi, vendor, dan data aset contoh

const { getDb } = require('./database');
const bcrypt = require('bcryptjs');

async function seed() {
  const db = getDb();

  console.log('🌱 Seeding database...');

  // ── USERS ──────────────────────────────────────────────────────
  const adminHash = bcrypt.hashSync('admin123', 10);
  const teknisiHash = bcrypt.hashSync('teknisi123', 10);

  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (username, password, nama_lengkap, email, role, departemen)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertUser.run('admin', adminHash, 'Administrator', 'admin@sharp.co.id', 'admin', 'IT MIS');
  insertUser.run('teknisi1', teknisiHash, 'Budi Santoso', 'budi@sharp.co.id', 'teknisi', 'IT MIS');
  insertUser.run('viewer1', bcrypt.hashSync('viewer123', 10), 'Sari Dewi', 'sari@sharp.co.id', 'viewer', 'HR');
  console.log('  ✓ Users');

  // ── KATEGORI ───────────────────────────────────────────────────
  const insertKat = db.prepare(`
    INSERT OR IGNORE INTO kategori (nama, prefix, keterangan) VALUES (?, ?, ?)
  `);
  [
    ['Laptop', 'NB', 'Notebook / Laptop portabel'],
    ['Desktop PC', 'PC', 'Komputer desktop stasioner'],
    ['Printer', 'PR', 'Printer inkjet maupun laser'],
    ['Server', 'SV', 'Server fisik dan virtual'],
    ['Switch', 'SW', 'Network switch manageable/unmanageable'],
    ['Router', 'RT', 'Router jaringan'],
    ['Proyektor', 'PJ', 'Proyektor presentasi'],
    ['UPS', 'UP', 'Uninterruptible Power Supply'],
    ['Monitor', 'MN', 'Monitor / display'],
    ['Lainnya', 'XX', 'Perangkat IT lainnya'],
  ].forEach(r => insertKat.run(...r));
  console.log('  ✓ Kategori');

  // ── LOKASI ─────────────────────────────────────────────────────
  const insertLok = db.prepare(`
    INSERT OR IGNORE INTO lokasi (nama, gedung, lantai, keterangan) VALUES (?, ?, ?, ?)
  `);
  [
    ['Lantai 1', 'Gedung Utama', 'Lantai 1', 'Area umum lantai 1'],
    ['Lantai 2', 'Gedung Utama', 'Lantai 2', 'Area umum lantai 2'],
    ['Lantai 3', 'Gedung Utama', 'Lantai 3', 'Area umum lantai 3'],
    ['Server Room', 'Gedung Utama', 'Lantai 1', 'Ruang server utama'],
    ['Workshop', 'Gedung Produksi', 'Lantai 1', 'Area workshop & produksi'],
    ['Gudang IT', 'Gedung Utama', 'Basement', 'Gudang penyimpanan aset'],
  ].forEach(r => insertLok.run(...r));
  console.log('  ✓ Lokasi');

  // ── VENDOR ─────────────────────────────────────────────────────
  const insertVen = db.prepare(`
    INSERT OR IGNORE INTO vendor (nama, kontak, telepon, email, alamat) VALUES (?, ?, ?, ?, ?)
  `);
  [
    ['PT Datascrip', 'Agus Priyanto', '021-7255555', 'sales@datascrip.co.id', 'Jakarta Selatan'],
    ['PT Synnex Metrodata', 'Dewi Rahayu', '021-6288888', 'info@synnex-metrodata.co.id', 'Jakarta Utara'],
    ['Dell Indonesia', 'Michael Tan', '021-5095555', 'dell.id@dell.com', 'Jakarta Pusat'],
    ['Lenovo Indonesia', 'Sarah Kim', '021-5151234', 'lenovo.id@lenovo.com', 'Jakarta Pusat'],
    ['PT Epson Indonesia', 'Hadi Wijaya', '021-5451234', 'service@epson.co.id', 'Karawang'],
  ].forEach(r => insertVen.run(...r));
  console.log('  ✓ Vendor');

  // ── ASET DATA ──────────────────────────────────────────────────
  const katRow  = k => db.prepare('SELECT id FROM kategori WHERE nama=?').get(k);
  const lokRow  = l => db.prepare('SELECT id FROM lokasi   WHERE nama=?').get(l);

  const insertAset = db.prepare(`
    INSERT OR IGNORE INTO aset
      (kode, nama, merek, model, kategori_id, lokasi_id, pengguna, status, tahun_pengadaan, garansi_sampai)
    VALUES (@kode, @nama, @merek, @model, @kat, @lok, @pengguna, @status, @tahun, @garansi)
  `);

  const assets = [
    {kode:'SHARP-NB-001',nama:'ThinkPad X1 Carbon',merek:'Lenovo',model:'X1 Carbon Gen 10',kat:'Laptop',lok:'Lantai 2',pengguna:'Ahmad Fauzi',status:'Aktif',tahun:'2023',garansi:'2026-05'},
    {kode:'SHARP-NB-002',nama:'HP EliteBook 840',merek:'HP',model:'EliteBook 840 G9',kat:'Laptop',lok:'Lantai 1',pengguna:'Budi Santoso',status:'Aktif',tahun:'2022',garansi:'2025-11'},
    {kode:'SHARP-NB-003',nama:'Dell Latitude 5430',merek:'Dell',model:'Latitude 5430',kat:'Laptop',lok:'Lantai 1',pengguna:'Rini Wulandari',status:'Aktif',tahun:'2023',garansi:'2026-07'},
    {kode:'SHARP-NB-044',nama:'Lenovo ThinkPad E14',merek:'Lenovo',model:'ThinkPad E14 Gen 4',kat:'Laptop',lok:'Lantai 2',pengguna:'Siti Rahayu',status:'Perbaikan',tahun:'2021',garansi:'2024-01'},
    {kode:'SHARP-NB-055',nama:'ASUS VivoBook 15',merek:'ASUS',model:'VivoBook 15 X1502',kat:'Laptop',lok:'Lantai 1',pengguna:'Dewi Anggraini',status:'Dipinjam',tahun:'2022',garansi:'2025-06'},
    {kode:'SHARP-NB-072',nama:'Lenovo IdeaPad 3',merek:'Lenovo',model:'IdeaPad 3 Gen 7',kat:'Laptop',lok:'Lantai 2',pengguna:'Hendra Gunawan',status:'Dipinjam',tahun:'2022',garansi:'2025-09'},
    {kode:'SHARP-PC-001',nama:'Dell OptiPlex 7090',merek:'Dell',model:'OptiPlex 7090',kat:'Desktop PC',lok:'Lantai 2',pengguna:'Finance Dept.',status:'Aktif',tahun:'2022',garansi:'2025-12'},
    {kode:'SHARP-PC-002',nama:'HP ProDesk 600 G6',merek:'HP',model:'ProDesk 600 G6',kat:'Desktop PC',lok:'Lantai 1',pengguna:'HRD Dept.',status:'Aktif',tahun:'2023',garansi:'2026-05'},
    {kode:'SHARP-PC-041',nama:'Dell OptiPlex 3080',merek:'Dell',model:'OptiPlex 3080',kat:'Desktop PC',lok:'Workshop',pengguna:'Workshop',status:'Perbaikan',tahun:'2020',garansi:'2023-08'},
    {kode:'SHARP-PR-001',nama:'HP LaserJet M1005',merek:'HP',model:'LaserJet M1005',kat:'Printer',lok:'Lantai 1',pengguna:'Sekretariat',status:'Aktif',tahun:'2021',garansi:'2024-03'},
    {kode:'SHARP-PR-015',nama:'Epson L3210',merek:'Epson',model:'L3210',kat:'Printer',lok:'Lantai 3',pengguna:'MIS Dept.',status:'Aktif',tahun:'2023',garansi:'2026-01'},
    {kode:'SHARP-PR-031',nama:'Epson L3210',merek:'Epson',model:'L3210',kat:'Printer',lok:'Lantai 1',pengguna:'HR Dept.',status:'Aktif',tahun:'2025',garansi:'2028-05'},
    {kode:'SHARP-SV-001',nama:'Dell PowerEdge R440',merek:'Dell',model:'PowerEdge R440',kat:'Server',lok:'Server Room',pengguna:'IT MIS',status:'Aktif',tahun:'2021',garansi:'2026-03'},
    {kode:'SHARP-SV-002',nama:'Dell PowerEdge R440',merek:'Dell',model:'PowerEdge R440',kat:'Server',lok:'Server Room',pengguna:'IT MIS',status:'Aktif',tahun:'2021',garansi:'2026-03'},
    {kode:'SHARP-SV-003',nama:'HPE ProLiant ML350',merek:'HPE',model:'ProLiant ML350 Gen10',kat:'Server',lok:'Server Room',pengguna:'IT MIS',status:'Aktif',tahun:'2022',garansi:'2027-01'},
    {kode:'SHARP-SW-001',nama:'Cisco SG110-24',merek:'Cisco',model:'SG110-24',kat:'Switch',lok:'Server Room',pengguna:'IT Infrastruktur',status:'Aktif',tahun:'2020',garansi:'2025-07'},
    {kode:'SHARP-SW-009',nama:'Cisco SG110-24',merek:'Cisco',model:'SG110-24',kat:'Switch',lok:'Lantai 2',pengguna:'Lantai 2',status:'Perbaikan',tahun:'2020',garansi:'2023-07'},
    {kode:'SHARP-PJ-004',nama:'Epson EB-X500',merek:'Epson',model:'EB-X500',kat:'Proyektor',lok:'Lantai 3',pengguna:'Marketing',status:'Dipinjam',tahun:'2022',garansi:'2025-08'},
    {kode:'SHARP-PJ-007',nama:'Viewsonic PA503W',merek:'Viewsonic',model:'PA503W',kat:'Proyektor',lok:'Lantai 1',pengguna:'Training Room',status:'Dipinjam',tahun:'2021',garansi:'2024-11'},
    {kode:'SHARP-UP-001',nama:'APC Smart-UPS 1500',merek:'APC',model:'Smart-UPS 1500',kat:'UPS',lok:'Server Room',pengguna:'Server Room',status:'Aktif',tahun:'2021',garansi:'2024-06'},
  ];

  for (const a of assets) {
    const katId = katRow(a.kat)?.id;
    const lokId = lokRow(a.lok)?.id;
    insertAset.run({ kode:a.kode, nama:a.nama, merek:a.merek, model:a.model,
      kat:katId, lok:lokId, pengguna:a.pengguna, status:a.status,
      tahun:a.tahun, garansi:a.garansi });
  }
  console.log(`  ✓ ${assets.length} Aset`);

  // ── LOG AKTIVITAS AWAL ─────────────────────────────────────────
  const insertLog = db.prepare(`
    INSERT INTO log_aktivitas (user_id, aksi, tabel, record_id, keterangan)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertLog.run(1, 'CREATE', 'sistem', null, 'Database diinisialisasi dan data awal di-seed');
  console.log('  ✓ Log awal');

  console.log('\n✅ Seeding selesai!');
  console.log('   Login: admin / admin123');
  console.log('   Login: teknisi1 / teknisi123');
  console.log('   Login: viewer1 / viewer123');
}

seed().catch(console.error);
