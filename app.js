const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const Jimp = require('jimp');
const { createCanvas, GlobalFonts, loadImage } = require('@napi-rs/canvas');

// Register semua font dengan path absolut
try {
  // Font OCR untuk NIK
  const ocrFontPath = path.resolve(__dirname, 'font/Ocr.ttf');
  // Font Sign untuk tanda tangan
  const signFontPath = path.resolve(__dirname, 'font/Sign.ttf');
  // Font Arrial untuk teks lainnya
  const arrialFontPath = path.resolve(__dirname, 'font/Arrial.ttf');
  
  console.log('Font paths:');
  console.log('OCR:', ocrFontPath);
  console.log('Sign:', signFontPath);
  console.log('Arrial:', arrialFontPath);
  
  // Daftarkan font (@napi-rs/canvas: alias di argumen kedua = nama yang dipakai
  // di ctx.font). Engine ini merender OCR-A dengan benar, tidak seperti
  // node-canvas/Pango yang menolak font OCR ini.
  if (fs.existsSync(ocrFontPath)) {
    GlobalFonts.registerFromPath(ocrFontPath, 'OCR A Extended');
    console.log('Font OCR berhasil didaftarkan');
  }

  if (fs.existsSync(signFontPath)) {
    GlobalFonts.registerFromPath(signFontPath, 'Sign');
    console.log('Font Sign berhasil didaftarkan');
  }

  if (fs.existsSync(arrialFontPath)) {
    GlobalFonts.registerFromPath(arrialFontPath, 'Arrial');
    console.log('Font Arrial berhasil didaftarkan');
  }
} catch (error) {
  console.error('Error saat mendaftarkan font:', error);
}

// Inisialisasi Express
const app = express();
const port = process.env.PORT || 3000;

// Set view engine
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Konfigurasi penyimpanan upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('File harus berupa gambar'), false);
    }
  } 
});

// Routes
app.get('/', (req, res) => {
  res.render('index');
});

// Data E-KTP acak (untuk tombol "Isi Acak")
const { generateRandomKTP } = require('./random-data');
app.get('/random', (req, res) => {
  res.json(generateRandomKTP());
});

app.post('/generate', upload.fields([
  { name: 'pas_photo', maxCount: 1 },
  { name: 'tanda_tangan', maxCount: 1 }
]), async (req, res) => {
  try {
    const data = req.body;

    // Validasi NIK: wajib 16 digit angka (validasi klien ada di script.js,
    // ini benteng sisi server bila JS dimatikan atau request langsung)
    if (!data.nik || !/^\d{16}$/.test(data.nik)) {
      return res.status(400).render('error', {
        message: 'NIK harus terdiri dari 16 digit angka'
      });
    }

    // Foto: utamakan hasil cropper (dataURL), fallback ke file upload mentah
    if (data.pas_photo_data && data.pas_photo_data.startsWith('data:image/')) {
      const photoData = data.pas_photo_data.replace(/^data:image\/\w+;base64,/, '');
      const photoPath = path.join(__dirname, 'public/uploads', `photo_${Date.now()}.png`);
      fs.writeFileSync(photoPath, Buffer.from(photoData, 'base64'));
      data.pas_photo = path.relative(__dirname, photoPath);
    } else if (req.files && req.files['pas_photo']) {
      data.pas_photo = req.files['pas_photo'][0].path;
    } else {
      return res.status(400).render('error', {
        message: 'Pas foto wajib diupload'
      });
    }

    // Jika tanda tangan diberikan sebagai data URL
    if (data.tanda_tangan && data.tanda_tangan.startsWith('data:image/png;base64,')) {
      // Simpan tanda tangan sebagai file
      const signatureData = data.tanda_tangan.replace(/^data:image\/png;base64,/, '');
      const signaturePath = path.join(__dirname, 'public/uploads', `signature_${Date.now()}.png`);
      fs.writeFileSync(signaturePath, Buffer.from(signatureData, 'base64'));
      data.tanda_tangan_path = signaturePath;
    }

    // Buat KTP (mengembalikan path web unik)
    const imgPath = await generateEKTP(data);

    res.render('result', {
      imgPath: imgPath,
      data: data
    });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).render('error', { 
      message: 'Terjadi kesalahan saat membuat E-KTP: ' + error.message 
    });
  }
});

// Fungsi untuk membuat E-KTP
async function generateEKTP(data) {
  try {
    // Token unik per request agar file tidak saling menimpa (hindari race condition)
    const uid = `${Date.now()}_${Math.round(Math.random() * 1e6)}`;

    // Baca template dengan Jimp terlebih dahulu
    const template = await Jimp.read(path.join(__dirname, 'public/images/Template.png'));
    
    // Frame foto tetap dengan rasio 3:4
    const PHOTO = { x: 515, y: 130, w: 175, h: 233 };

    // Baca foto pas
    const photoPath = path.join(__dirname, data.pas_photo);
    let pasPhoto = await Jimp.read(photoPath);

    // Center-crop defensif ke rasio 3:4 (hasil cropper sudah 3:4; ini jaga-jaga
    // bila foto dikirim mentah tanpa cropper), lalu resize pasti ke ukuran frame
    const targetRatio = PHOTO.w / PHOTO.h;
    const srcRatio = pasPhoto.getWidth() / pasPhoto.getHeight();
    if (srcRatio > targetRatio) {
      const newW = Math.round(pasPhoto.getHeight() * targetRatio);
      pasPhoto.crop(Math.round((pasPhoto.getWidth() - newW) / 2), 0, newW, pasPhoto.getHeight());
    } else if (srcRatio < targetRatio) {
      const newH = Math.round(pasPhoto.getWidth() / targetRatio);
      pasPhoto.crop(0, Math.round((pasPhoto.getHeight() - newH) / 2), pasPhoto.getWidth(), newH);
    }
    pasPhoto.resize(PHOTO.w, PHOTO.h);

    // Tempel foto ke frame tetap
    template.composite(pasPhoto, PHOTO.x, PHOTO.y);

    // Load template (berisi foto) langsung dari buffer ke canvas — tanpa file temp
    const templateBuffer = await template.getBufferAsync(Jimp.MIME_PNG);
    const templateImg = await loadImage(templateBuffer);
    const canvasWidth = templateImg.width;
    const canvasHeight = templateImg.height;
    
    // Buat canvas dengan ukuran yang sama dengan template
    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');
    
    // Gambar template ke canvas
    ctx.drawImage(templateImg, 0, 0, canvasWidth, canvasHeight);
    
    // Konfigurasi font
    ctx.fillStyle = 'black';
    
    // Prefix wilayah: KOTA atau KABUPATEN (dari form), default KOTA
    const wilayahPrefix = (data.jenis_wilayah || 'KOTA').toUpperCase();

    // Font provinsi dan kota (Arrial) - posisi tengah
    try {
      // Provinsi (di tengah)
      ctx.font = '25px Arrial';
      ctx.textAlign = 'center';
      // Posisi tengah horizontal di 380, vertikal di 65 (ditambah 10px dari sebelumnya)
      ctx.fillText(`PROVINSI ${data.provinsi.toUpperCase()}`, 360, 65);
      // Kota (di tengah)
      ctx.fillText(`${wilayahPrefix} ${data.kota.toUpperCase()}`, 360, 90);
      
      // Reset text align kembali ke default untuk teks lainnya
      ctx.textAlign = 'left';
    } catch (e) {
      console.error('Error menggunakan font Arrial:', e);
      // Fallback ke font standard
      ctx.font = '25px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`PROVINSI ${data.provinsi.toUpperCase()}`, 360, 65);
      ctx.fillText(`${wilayahPrefix} ${data.kota.toUpperCase()}`, 360, 90);
      ctx.textAlign = 'left';
    }
    
    // Font NIK: OCR-A (dirender benar oleh @napi-rs/canvas); Courier New/monospace
    // tetap disertakan sebagai fallback aman bila font gagal dimuat.
    try {
      ctx.font = "32px 'OCR A Extended', 'Courier New', monospace";
      ctx.fillText(data.nik, 180, 125); // x=180 agar tidak menempel titik dua template
    } catch (e) {
      console.error('Error menggunakan font OCR:', e);
      ctx.font = "32px 'Courier New', monospace";
      ctx.fillText(data.nik, 180, 125);
    }
    
    // Font data menggunakan Arrial - posisi y tetap seperti sebelumnya
    // maxWidth agar nilai panjang otomatis mengecil, tidak menabrak area foto.
    // Kolom data mulai x=190 dan foto mulai x=515 → batas ~315px.
    // Baris jenis kelamin dibatasi lebih sempit agar tidak menabrak "Gol. Darah".
    const COL_MAXW = 315;
    const SEX_MAXW = 160;
    try {
      ctx.font = '16px Arrial';
      ctx.fillText(data.nama.toUpperCase(), 190, 155, COL_MAXW);
      ctx.fillText(data.ttl.toUpperCase(), 190, 178, COL_MAXW);
      ctx.fillText(data.jenis_kelamin.toUpperCase(), 190, 201, SEX_MAXW);
      ctx.fillText((data.golongan_darah || '').toUpperCase(), 463, 200);
      ctx.fillText(data.alamat.toUpperCase(), 190, 222, COL_MAXW);
      ctx.fillText(data.rt_rw.toUpperCase(), 190, 244, COL_MAXW);
      ctx.fillText(data.kel_desa.toUpperCase(), 190, 267, COL_MAXW);
      ctx.fillText(data.kecamatan.toUpperCase(), 190, 289, COL_MAXW);
      ctx.fillText(data.agama.toUpperCase(), 190, 310, COL_MAXW);
      ctx.fillText(data.status.toUpperCase(), 190, 333, COL_MAXW);
      ctx.fillText(data.pekerjaan.toUpperCase(), 190, 356, COL_MAXW);
      ctx.fillText(data.kewarganegaraan.toUpperCase(), 190, 379, COL_MAXW);
      ctx.fillText(data.masa_berlaku.toUpperCase(), 190, 400, COL_MAXW);

      // Blok tempat & tanggal dikeluarkan: center di bawah foto agar tidak terpotong
      const issueCenterX = 603;
      ctx.textAlign = 'center';
      ctx.fillText(data.kota.toUpperCase(), issueCenterX, 383, 175);
      ctx.fillText(data.terbuat || new Date().toLocaleDateString('id-ID'), issueCenterX, 403, 175);
      ctx.textAlign = 'left';
    } catch (e) {
      console.error('Error menggunakan font Arrial untuk data:', e);
      // Fallback ke font standard
      ctx.font = '16px sans-serif';
      // Ulangi penulisan teks dengan font fallback dan posisi yang sama
      ctx.fillText(data.nama.toUpperCase(), 190, 155);
      ctx.fillText(data.ttl.toUpperCase(), 190, 178);
      // ... dan seterusnya dengan posisi yang sama seperti di atas
    }
    
    // Tanda tangan: center di bawah blok tanggal (mengikuti issueCenterX = 603)
    const signCenterX = 603;
    try {
      if (data.tanda_tangan_path) {
        // Pangkas area transparan di sekeliling coretan agar tanda tangan mengisi
        // kotak (tidak jadi kecil karena banyak ruang kosong), lalu skalakan
        // proporsional ke dalam kotak dan center.
        const sigJimp = await Jimp.read(data.tanda_tangan_path);
        sigJimp.autocrop({ tolerance: 0.02, cropOnlyFrames: false });

        const boxW = 150, boxH = 52, boxTop = 404;
        const scale = Math.min(boxW / sigJimp.getWidth(), boxH / sigJimp.getHeight());
        const w = Math.round(sigJimp.getWidth() * scale);
        const h = Math.round(sigJimp.getHeight() * scale);

        const sigBuf = await sigJimp.getBufferAsync(Jimp.MIME_PNG);
        const signatureImg = await loadImage(sigBuf);
        // center horizontal di signCenterX, dan vertikal di dalam kotak
        ctx.drawImage(signatureImg, signCenterX - w / 2, boxTop + (boxH - h) / 2, w, h);
      } else {
        // Jika tidak, gunakan nama pertama dengan font Sign
        const nameParts = data.nama.split(' ');
        ctx.font = '40px Sign';
        ctx.textAlign = 'center';
        ctx.fillText(nameParts[0], signCenterX, 442, 170);
        ctx.textAlign = 'left';
        console.log('Menggunakan font Sign untuk tanda tangan');
      }
    } catch (e) {
      console.error('Error menggunakan font Sign untuk tanda tangan:', e);
      // Fallback ke font standard
      const nameParts = data.nama.split(' ');
      ctx.font = '40px serif';
      ctx.textAlign = 'center';
      ctx.fillText(nameParts[0], signCenterX, 442, 170);
      ctx.textAlign = 'left';
    }
    
    // Simpan hasil dengan nama unik agar request bersamaan tidak saling menimpa
    // dan browser tidak menampilkan gambar lama dari cache
    const outputName = `result_${uid}.png`;
    const outputPath = path.join(__dirname, 'public/images', outputName);
    fs.writeFileSync(outputPath, canvas.toBuffer('image/png'));

    // Bersihkan hasil lama (lebih dari 10 menit) agar folder tidak menumpuk
    try {
      const imagesDir = path.join(__dirname, 'public/images');
      const now = Date.now();
      for (const f of fs.readdirSync(imagesDir)) {
        if (/^(result|temp_template)_.*\.png$/.test(f)) {
          const fp = path.join(imagesDir, f);
          if (fp !== outputPath && now - fs.statSync(fp).mtimeMs > 10 * 60 * 1000) {
            fs.unlinkSync(fp);
          }
        }
      }
    } catch (cleanupErr) {
      console.error('Gagal membersihkan file hasil lama:', cleanupErr.message);
    }
    
    // Hapus file tanda tangan jika ada
    if (data.tanda_tangan_path && fs.existsSync(data.tanda_tangan_path)) {
      fs.unlinkSync(data.tanda_tangan_path);
    }

    // Hapus file foto sumber setelah ditempel ke kartu
    const pasPhotoAbs = path.join(__dirname, data.pas_photo);
    if (data.pas_photo && fs.existsSync(pasPhotoAbs)) {
      fs.unlinkSync(pasPhotoAbs);
    }
    
    // Kembalikan path web (bukan path filesystem) untuk dipakai di view
    return `/images/${outputName}`;
  } catch (error) {
    console.error('Error generating E-KTP:', error);
    throw error;
  }
}

// Start server
app.listen(port, () => {
  console.log(`Server berjalan di http://localhost:${port}`);
}); 