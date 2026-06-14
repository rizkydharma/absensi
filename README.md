# Aplikasi Absensi PWA

Aplikasi absensi berbasis web menggunakan HTML, CSS, dan Vanilla JavaScript. Backend menggunakan Google Apps Script Web App, dan data disimpan di Google Spreadsheet.

## File Utama
- `index.html` - tampilan utama aplikasi.
- `style.css` - gaya tampilan responsif dan mobile-friendly.
- `app.js` - logika login, validasi lokasi, dan kirim data ke backend.
- `manifest.webmanifest` - konfigurasi PWA.
- `sw.js` - service worker untuk caching.
- `code.gs` - backend Google Apps Script.

## Cara Pakai
1. Buat Google Spreadsheet baru.
2. Tambahkan sheet `DAFTAR_KARYAWAN` dengan kolom:
   - ID
   - NAMA
   - JABATAN
   - DEFAULT STORE
   - NAME STORE
   - GAJI
   - PIN
3. Tambahkan sheet `ABSENSI` dengan kolom:
   - TANGGAL
   - NAMA
   - ID
   - STORE
   - STATUS
   - GAJI
   - KETERANGAN
   - STATUS GAJI
   - JAM DATANG
   - JAM PULANG
   - LOCATE
   - RADIUS
   - DEVICE
4. Buka Google Apps Script, buat project baru, lalu salin kode dari `code.gs`.
5. Ganti `SPREADSHEET_ID` di `code.gs` dengan ID spreadsheet Anda.
6. Deploy sebagai *Web App* dengan akses `Anyone, even anonymous`.
7. Salin URL Web App, lalu ganti `GAS_ENDPOINT` di `app.js`.

## Deploy ke GitHub Pages
1. Buat repository GitHub.
2. Tambahkan file `index.html`, `style.css`, `app.js`, `manifest.webmanifest`, dan `sw.js` ke repository.
3. Push repo ke GitHub.
4. Aktifkan GitHub Pages pada branch `main` atau `gh-pages`.
5. Akses aplikasi melalui URL GitHub Pages.

## Catatan Penting
- Sebelum absen, karyawan harus login terlebih dahulu.
- Karyawan harus memilih lokasi kerja hari ini dari daftar outlet.
- Validasi lokasi dilakukan di frontend menggunakan koordinat outlet yang di-hardcode.
- Jika jarak melebihi radius outlet, data tidak dikirim ke backend dan akan muncul pesan.

## Update yang bisa dilakukan
- Tambahkan ikon PWA di folder `icons/`.
- Perbaiki styling sesuai kebutuhan brand.
- Tambahkan validasi tambahan di backend untuk keamanan.
