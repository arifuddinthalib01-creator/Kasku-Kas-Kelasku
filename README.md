# Kasku - Kas Kelasku (React + Supabase)

## Menjalankan
1. `npm install`
2. `npm run dev` (file `.env` sudah berisi URL dan publishable key project Supabase Anda)
3. Buka http://localhost:5173, pilih **Daftar**, pakai email `arifuddin.thalib02@gmail.com` (sudah diundang sebagai Wali Kelas), buat kata sandi, lalu masuk.

## Deploy ke Vercel
1. Upload folder ini ke GitHub, lalu impor di vercel.com (framework: Vite).
2. Tambahkan Environment Variables `VITE_SUPABASE_URL` dan `VITE_SUPABASE_PUBLISHABLE_KEY` (isi dari `.env`).
3. Di Supabase: Authentication > URL Configuration, isi Site URL dengan alamat Vercel Anda.

## Alur pengguna
Wali Kelas membuka Pengaturan > Undang, mengisi email, nama, dan peran. Orang yang diundang memilih **Daftar** di halaman Masuk dengan email yang sama. Tanpa undangan, akun tidak punya akses ke data apa pun.
