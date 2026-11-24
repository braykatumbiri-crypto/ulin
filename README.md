# Mustika Gamers (server online)

Isi proyek:
- `server.js`  server Node.js: login kata sandi, posisi pemain, chat, sinyal WebRTC untuk kamera dan suara
- `public/index.html`  klien game 3D (Three.js dari CDN)

## Menjalankan di komputer
1. Pasang Node.js 18 atau lebih baru.
2. Di folder ini jalankan `npm install` lalu `npm start`.
3. Buka http://localhost:3000. Kamera dan mikrofon boleh dipakai di localhost.
4. Untuk uji online, buka dari dua tab atau dua perangkat, pilih game yang sama.

## Menayangkan untuk siswa
Kamera dan mikrofon hanya berfungsi lewat **HTTPS**. Pilihan termudah: Render, Railway, Fly.io, atau VPS dengan Caddy/Nginx.
- Perintah mulai: `npm start`. Port dibaca dari variabel `PORT`.
- Ganti kata sandi tanpa mengubah kode: variabel lingkungan `GAME_PASSWORD`.
- Siswa di jaringan sekolah yang ketat sering butuh server TURN agar video/suara tersambung. Isi `TURN_URL`, `TURN_USER`, `TURN_PASS` (contoh layanan: Metered, Twilio, atau coturn sendiri).

## Batasan yang perlu diketahui
- Kata sandi dicek di server, tetapi masih satu kata sandi bersama. Akun per siswa belum ada.
- Video dan suara memakai jaringan mesh (setiap pemain terhubung ke semua pemain lain di game yang sama). Nyaman sampai sekitar 6 pemain per game. Untuk kelas penuh, ganti ke SFU seperti LiveKit.
- Chat difilter hanya panjang dan karakter, belum kata kasar.
- Gerakan pemain dipercaya dari klien (belum ada anti-curang). Cukup untuk game santai.
- Kamera dan mikrofon siswa adalah data sensitif. Pastikan ada izin sekolah/orang tua dan guru yang memoderasi.
