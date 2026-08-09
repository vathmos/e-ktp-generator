// Generator data E-KTP acak yang konsisten (nama <-> gender, NIK <-> TTL <-> gender).
// Nama memakai daftar kurasi nama umum Indonesia + pola majemuk agar kombinasinya
// sangat banyak (jutaan), dilengkapi faker (id_ID) untuk lokasi/alamat.
const { fakerID_ID: faker } = require('@faker-js/faker');

const NAMA_DEPAN_PRIA = [
  'Budi', 'Agus', 'Andi', 'Bambang', 'Dedi', 'Eko', 'Fajar', 'Gunawan', 'Hendra', 'Indra',
  'Joko', 'Krisna', 'Rizki', 'Rudi', 'Slamet', 'Teguh', 'Wahyu', 'Yudi', 'Adi', 'Bayu',
  'Dimas', 'Fikri', 'Galih', 'Hadi', 'Irfan', 'Reza', 'Aditya', 'Arif', 'Bagus', 'Candra',
  'Dani', 'Ferdi', 'Ilham', 'Rangga', 'Satria', 'Surya', 'Yoga', 'Zaki', 'Ahmad', 'Muhammad',
  'Abdul', 'Rahmat', 'Hasan', 'Ridwan', 'Taufik', 'Anwar', 'Fauzan', 'Hendri', 'Nugroho', 'Prasetyo'
];

const NAMA_DEPAN_WANITA = [
  'Siti', 'Ani', 'Dewi', 'Fitri', 'Indah', 'Kartika', 'Lestari', 'Maya', 'Nur', 'Putri',
  'Rina', 'Sari', 'Tika', 'Wulan', 'Yuni', 'Ayu', 'Citra', 'Diah', 'Eka', 'Intan',
  'Nabila', 'Rani', 'Sinta', 'Wati', 'Aisyah', 'Fatimah', 'Khadijah', 'Nurul', 'Salsabila', 'Zahra',
  'Anisa', 'Dinda', 'Melati', 'Ratna', 'Rima', 'Vina', 'Yulia', 'Anggun', 'Cahaya', 'Dwi',
  'Fani', 'Gita', 'Hana', 'Ika', 'Lia', 'Mega', 'Novi', 'Rahma', 'Tari', 'Wida'
];

// Nama tengah/belakang umum (netral gender)
const NAMA_BELAKANG = [
  'Santoso', 'Wijaya', 'Kusuma', 'Pratama', 'Saputra', 'Nugraha', 'Hidayat', 'Setiawan', 'Wibowo', 'Utomo',
  'Halim', 'Gunawan', 'Firmansyah', 'Ramadhan', 'Maulana', 'Putra', 'Permana', 'Susanto', 'Hartono', 'Suryana',
  'Iskandar', 'Purnama', 'Anggara', 'Prakoso', 'Wardana', 'Mahendra', 'Kurniawan', 'Cahyono', 'Widodo', 'Handoko',
  'Sanjaya', 'Wibisono', 'Dharmawan', 'Yulianto', 'Nasution', 'Simanjuntak', 'Lubis', 'Ginting', 'Tarigan', 'Sitorus',
  'Manurung', 'Siregar', 'Harahap', 'Pasaribu', 'Situmorang', 'Panjaitan', 'Hutabarat', 'Sihombing', 'Tanjung', 'Batubara'
];

const AGAMA = ['islam', 'kristen', 'katolik', 'hindu', 'buddha', 'konghucu'];
const STATUS = ['belum menikah', 'menikah', 'cerai hidup', 'cerai mati'];
const GOLONGAN_DARAH = ['A', 'B', 'AB', 'O'];
const PEKERJAAN = [
  'Pegawai Negeri Sipil', 'Wiraswasta', 'Karyawan Swasta', 'Guru', 'Dosen', 'Petani', 'Pedagang',
  'Buruh Harian Lepas', 'Dokter', 'Perawat', 'Polri', 'TNI', 'Nelayan', 'Sopir', 'Montir',
  'Pelajar/Mahasiswa', 'Pensiunan', 'Mengurus Rumah Tangga', 'Wartawan', 'Pengacara', 'Akuntan',
  'Arsitek', 'Programmer', 'Seniman', 'Pramuniaga', 'Satpam', 'Tukang Kayu', 'Bidan', 'Apoteker', 'Chef'
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const pad = (n, len = 2) => String(n).padStart(len, '0');
// Bersihkan embel-embel seperti " (Jawa Barat)" dari nama wilayah faker
const bersih = (s) => s.replace(/\s*\(.*?\)\s*/g, '').trim();

function buatNama(sex) {
  const depan = sex === 'male' ? pick(NAMA_DEPAN_PRIA) : pick(NAMA_DEPAN_WANITA);
  const parts = [depan];
  // ~55% pakai nama tengah agar kombinasi jauh lebih banyak
  if (Math.random() < 0.55) parts.push(pick(NAMA_BELAKANG));
  let belakang = pick(NAMA_BELAKANG);
  while (belakang === parts[parts.length - 1]) belakang = pick(NAMA_BELAKANG);
  parts.push(belakang);
  return parts.join(' ');
}

function generateRandomKTP() {
  const sex = Math.random() < 0.5 ? 'male' : 'female';

  // Tanggal lahir: usia 17–64 tahun
  const now = new Date();
  const umur = 17 + Math.floor(Math.random() * 48);
  const tahun = now.getFullYear() - umur;
  const bulan = 1 + Math.floor(Math.random() * 12);
  const hariMax = new Date(tahun, bulan, 0).getDate();
  const hari = 1 + Math.floor(Math.random() * hariMax);

  // NIK plausibel: [prov 2][kab 2][kec 2][DDMMYY, DD+40 bila wanita][urут 4]
  const kodeWilayah = pad(11 + Math.floor(Math.random() * 82)) + pad(1 + Math.floor(Math.random() * 79)) + pad(1 + Math.floor(Math.random() * 30));
  const hariNik = sex === 'female' ? hari + 40 : hari;
  const tglNik = pad(hariNik) + pad(bulan) + pad(tahun % 100);
  const urut = pad(1 + Math.floor(Math.random() * 9999), 4);
  const nik = kodeWilayah + tglNik + urut;

  const kota = bersih(faker.location.city());
  const provinsi = bersih(faker.location.state());

  return {
    provinsi,
    jenis_wilayah: pick(['KOTA', 'KABUPATEN']),
    kota,
    nik,
    nama: buatNama(sex),
    ttl: `${kota}, ${pad(hari)}-${pad(bulan)}-${tahun}`,
    jenis_kelamin: sex === 'male' ? 'laki-laki' : 'perempuan',
    golongan_darah: pick(GOLONGAN_DARAH),
    alamat: faker.location.streetAddress(),
    rt_rw: `${pad(1 + Math.floor(Math.random() * 20), 3)}/${pad(1 + Math.floor(Math.random() * 20), 3)}`,
    kel_desa: bersih(faker.location.city()),
    kecamatan: bersih(faker.location.city()),
    agama: pick(AGAMA),
    status: pick(STATUS),
    pekerjaan: pick(PEKERJAAN),
    kewarganegaraan: 'wni',
    masa_berlaku: 'SEUMUR HIDUP',
    terbuat: now.toLocaleDateString('id-ID')
  };
}

module.exports = { generateRandomKTP };
