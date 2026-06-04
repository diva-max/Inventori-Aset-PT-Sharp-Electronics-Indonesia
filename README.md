# 🖥️ Sharp IT Inventory — Backend API

Backend REST API untuk Sistem Inventori Aset IT PT Sharp Electronics Indonesia.

**Stack:** Node.js · Express.js · SQLite (better-sqlite3) · JWT Auth

---

## 🚀 Cara Menjalankan

### 1. Install dependencies
```bash
npm install
```

### 2. Konfigurasi environment
```bash
cp .env.example .env
# Edit .env sesuai kebutuhan (minimal ubah JWT_SECRET di production)
```

### 3. Seed data awal (kategori, lokasi, vendor, aset contoh)
```bash
npm run seed
```

### 4. Jalankan server
```bash
# Production
npm start

# Development (auto-reload)
npm run dev
```

Server berjalan di: `http://localhost:3000`

---

## 🔐 Autentikasi

Semua endpoint (kecuali `/api/auth/login`) memerlukan header:
```
Authorization: Bearer <token>
```

Token diperoleh dari response login.

### Akun default (setelah seed):
| Username   | Password     | Role     |
|------------|--------------|----------|
| admin      | admin123     | admin    |
| teknisi1   | teknisi123   | teknisi  |
| viewer1    | viewer123    | viewer   |

### Role & Akses:
- **admin** — akses penuh (CRUD semua data, manajemen user)
- **teknisi** — baca semua, tambah/edit aset, peminjaman, maintenance
- **viewer** — hanya baca (GET)

---

## 📋 Endpoint API

### Auth
| Method | Endpoint                    | Deskripsi              |
|--------|-----------------------------|------------------------|
| POST   | `/api/auth/login`           | Login, dapat token JWT |
| GET    | `/api/auth/me`              | Info user login        |
| PUT    | `/api/auth/change-password` | Ubah password          |

### Aset
| Method | Endpoint                     | Deskripsi                        |
|--------|------------------------------|----------------------------------|
| GET    | `/api/aset`                  | Daftar aset (filter + paginasi)  |
| GET    | `/api/aset/stats`            | Statistik dashboard              |
| GET    | `/api/aset/generate-kode`    | Auto-generate kode aset          |
| GET    | `/api/aset/:id`              | Detail + riwayat aset            |
| POST   | `/api/aset`                  | Tambah aset baru                 |
| PUT    | `/api/aset/:id`              | Update aset                      |
| PATCH  | `/api/aset/:id/status`       | Ubah status saja                 |
| DELETE | `/api/aset/:id`              | Hapus aset (admin)               |

**Query params GET /api/aset:**
```
?search=laptop&kategori=Laptop&status=Aktif&lokasi=Lantai&page=1&limit=10
&sort=a.kode&order=ASC&garansi_expired=30
```

### Peminjaman
| Method | Endpoint                          | Deskripsi              |
|--------|-----------------------------------|------------------------|
| GET    | `/api/peminjaman`                 | Daftar peminjaman      |
| GET    | `/api/peminjaman/terlambat`       | Cek peminjaman melebihi batas |
| GET    | `/api/peminjaman/:id`             | Detail peminjaman      |
| POST   | `/api/peminjaman`                 | Buat peminjaman baru   |
| PATCH  | `/api/peminjaman/:id/kembali`     | Proses pengembalian    |
| DELETE | `/api/peminjaman/:id`             | Hapus/batal (admin)    |

### Maintenance
| Method | Endpoint                    | Deskripsi               |
|--------|-----------------------------|-------------------------|
| GET    | `/api/maintenance`          | Daftar maintenance      |
| GET    | `/api/maintenance/:id`      | Detail maintenance      |
| POST   | `/api/maintenance`          | Buat tiket maintenance  |
| PUT    | `/api/maintenance/:id`      | Update maintenance      |
| DELETE | `/api/maintenance/:id`      | Hapus (admin)           |

### Master Data
| Method | Endpoint                  | Deskripsi          |
|--------|---------------------------|--------------------|
| GET    | `/api/master/kategori`    | Daftar kategori    |
| POST   | `/api/master/kategori`    | Tambah kategori    |
| PUT    | `/api/master/kategori/:id`| Edit kategori      |
| DELETE | `/api/master/kategori/:id`| Hapus kategori     |
| GET    | `/api/master/lokasi`      | Daftar lokasi      |
| POST   | `/api/master/lokasi`      | Tambah lokasi      |
| PUT    | `/api/master/lokasi/:id`  | Edit lokasi        |
| GET    | `/api/master/vendor`      | Daftar vendor      |
| POST   | `/api/master/vendor`      | Tambah vendor      |
| PUT    | `/api/master/vendor/:id`  | Edit vendor        |
| GET    | `/api/master/users`       | Daftar user (admin)|
| POST   | `/api/master/users`       | Tambah user (admin)|
| PUT    | `/api/master/users/:id`   | Edit user (admin)  |
| DELETE | `/api/master/users/:id`   | Nonaktifkan user   |
| GET    | `/api/master/log`         | Log aktivitas      |

### Utility
| Method | Endpoint       | Deskripsi    |
|--------|----------------|--------------|
| GET    | `/api/health`  | Health check |

---

## 📁 Struktur Folder

```
sharp-backend/
├── db/
│   ├── database.js     # Schema SQLite & inisialisasi
│   ├── seed.js         # Data awal
│   └── inventori.db    # File database (dibuat otomatis)
├── middleware/
│   ├── auth.js         # JWT authenticate & authorize
│   └── logger.js       # Activity log middleware
├── routes/
│   ├── auth.js         # Login, profil, ganti password
│   ├── aset.js         # CRUD aset + upload foto
│   ├── peminjaman.js   # Manajemen peminjaman
│   ├── maintenance.js  # Manajemen maintenance
│   └── master.js       # Kategori, lokasi, vendor, users, log
├── uploads/
│   └── aset/           # Foto aset (dibuat otomatis)
├── server.js           # Entry point
├── package.json
├── .env.example
└── README.md
```

---

## 🔗 Integrasi dengan Frontend

Ubah fungsi `submitAsset()` di frontend HTML untuk memanggil API:

```javascript
// Contoh: login
async function login(username, password) {
  const res = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  if (data.success) {
    localStorage.setItem('token', data.token);
  }
}

// Contoh: ambil data aset
async function getAset(page = 1, search = '') {
  const token = localStorage.getItem('token');
  const res = await fetch(`http://localhost:3000/api/aset?page=${page}&search=${search}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return await res.json();
}
```

---

## 🛡️ Keamanan (Production Checklist)

- [ ] Ubah `JWT_SECRET` menjadi string panjang acak
- [ ] Set `CORS_ORIGIN` ke domain spesifik frontend
- [ ] Set `NODE_ENV=production`
- [ ] Ganti semua password default
- [ ] Letakkan di belakang reverse proxy (Nginx/Apache) dengan HTTPS
- [ ] Backup reguler file `db/inventori.db`
