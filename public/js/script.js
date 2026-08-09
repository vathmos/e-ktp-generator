// E-KTP Generator — pure JS (no framework)
document.addEventListener('DOMContentLoaded', function () {

    /* ---------- Toast ---------- */
    function showToast(message, type) {
        type = type || 'info';
        const container = document.querySelector('.toast-container');
        if (!container) return;
        const icons = {
            success: 'bi-check-circle-fill',
            danger: 'bi-exclamation-triangle-fill',
            warning: 'bi-exclamation-circle-fill',
            info: 'bi-info-circle-fill'
        };
        const el = document.createElement('div');
        el.className = 'toast toast--' + type;
        el.innerHTML = '<i class="bi ' + (icons[type] || icons.info) + '"></i><div>' + message + '</div>';
        container.appendChild(el);
        requestAnimationFrame(function () { el.classList.add('is-show'); });
        setTimeout(function () {
            el.classList.remove('is-show');
            setTimeout(function () { el.remove(); }, 220);
        }, 3200);
    }

    /* ---------- Theme toggle ---------- */
    const themeToggle = document.getElementById('themeToggle');
    function currentTheme() {
        return document.documentElement.getAttribute('data-theme') || 'light';
    }
    function applyThemeIcon(t) {
        if (!themeToggle) return;
        const i = themeToggle.querySelector('i');
        if (i) i.className = t === 'dark' ? 'bi bi-sun' : 'bi bi-moon-stars';
    }
    applyThemeIcon(currentTheme());
    if (themeToggle) {
        themeToggle.addEventListener('click', function () {
            const next = currentTheme() === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
            try { localStorage.setItem('theme', next); } catch (e) {}
            applyThemeIcon(next);
        });
    }

    /* ---------- Isi Acak ---------- */
    const randomBtn = document.getElementById('randomFill');
    if (randomBtn) {
        randomBtn.addEventListener('click', async function () {
            try {
                const res = await fetch('/random');
                if (!res.ok) throw new Error('gagal');
                const data = await res.json();
                Object.keys(data).forEach(function (key) {
                    const el = document.querySelector('[name="' + key + '"]');
                    if (el) el.value = data[key];
                });
                showToast('Data acak berhasil diisi', 'success');
            } catch (e) {
                showToast('Gagal mengambil data acak', 'danger');
            }
        });
    }

    /* ---------- Signature pad ---------- */
    const canvas = document.getElementById('signatureCanvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        let isDrawing = false;
        let lastX = 0;
        let lastY = 0;

        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Petakan koordinat pointer (ukuran tampilan) ke koordinat internal
        // canvas (400x150) agar goresan tidak meleset saat canvas ditampilkan
        // dengan lebar berbeda — terutama pada lebih dari satu tarikan.
        function getPos(clientX, clientY) {
            const rect = canvas.getBoundingClientRect();
            return {
                x: (clientX - rect.left) * (canvas.width / rect.width),
                y: (clientY - rect.top) * (canvas.height / rect.height)
            };
        }

        function saveSignature() {
            document.getElementById('signature_data').value = canvas.toDataURL('image/png');
        }

        canvas.addEventListener('mousedown', function (e) {
            isDrawing = true;
            const p = getPos(e.clientX, e.clientY);
            lastX = p.x; lastY = p.y;
        });
        canvas.addEventListener('mousemove', function (e) {
            if (!isDrawing) return;
            const p = getPos(e.clientX, e.clientY);
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
            lastX = p.x; lastY = p.y;
        });
        canvas.addEventListener('mouseup', function () { isDrawing = false; saveSignature(); });
        canvas.addEventListener('mouseout', function () { isDrawing = false; });

        canvas.addEventListener('touchstart', function (e) {
            e.preventDefault();
            const t = e.touches[0];
            const p = getPos(t.clientX, t.clientY);
            lastX = p.x; lastY = p.y;
            isDrawing = true;
        });
        canvas.addEventListener('touchmove', function (e) {
            e.preventDefault();
            if (!isDrawing) return;
            const t = e.touches[0];
            const p = getPos(t.clientX, t.clientY);
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
            lastX = p.x; lastY = p.y;
        });
        canvas.addEventListener('touchend', function () { isDrawing = false; saveSignature(); });

        const clearBtn = document.getElementById('clearSignature');
        if (clearBtn) {
            clearBtn.addEventListener('click', function () {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                document.getElementById('signature_data').value = '';
                showToast('Tanda tangan berhasil dihapus', 'info');
            });
        }
    }

    /* ---------- Form validation & loading ---------- */
    const form = document.getElementById('ektp-form');
    if (form) {
        const loadingIndicator = document.getElementById('loadingIndicator');
        form.addEventListener('submit', function (event) {
            const nikInput = document.getElementById('nik');
            if (nikInput && nikInput.value) {
                const nikValue = nikInput.value.replace(/\D/g, '');
                if (nikValue.length !== 16) {
                    event.preventDefault();
                    showToast('NIK harus terdiri dari 16 digit angka', 'danger');
                    nikInput.focus();
                    return false;
                }
                nikInput.value = nikValue;
            }

            const rtRwInput = document.getElementById('rt_rw');
            if (rtRwInput && rtRwInput.value) {
                if (!/^\d{3}\/\d{3}$/.test(rtRwInput.value)) {
                    event.preventDefault();
                    showToast('Format RT/RW harus 000/000', 'danger');
                    rtRwInput.focus();
                    return false;
                }
            }

            const photoInput = document.getElementById('pas_photo');
            if (photoInput && photoInput.files && photoInput.files.length > 0) {
                const fileSize = photoInput.files[0].size / 1024 / 1024;
                if (fileSize > 5) {
                    event.preventDefault();
                    showToast('Ukuran file foto tidak boleh lebih dari 5MB', 'danger');
                    return false;
                }
            }

            const signatureInput = document.getElementById('signature_data');
            if (signatureInput && !signatureInput.value) {
                event.preventDefault();
                showToast('Silakan buat tanda tangan terlebih dahulu', 'danger');
                const sc = document.getElementById('signatureCanvas');
                if (sc) sc.scrollIntoView({ behavior: 'smooth' });
                return false;
            }

            if (loadingIndicator) loadingIndicator.classList.add('is-visible');
            const submitBtn = document.getElementById('submitBtn');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span class="spinner spinner-sm"></span> Memproses...';
            }
            return true;
        });
    }

    /* ---------- Photo cropper (3:4) + custom modal ---------- */
    const photoInput = document.getElementById('pas_photo');
    const cropperImage = document.getElementById('cropperImage');
    const cropperModalEl = document.getElementById('cropperModal');
    let cropper = null;

    function renderPhotoPreview(dataUrl) {
        const container = document.getElementById('photo-preview-container');
        if (!container) return;
        const prompt = document.getElementById('dropzonePrompt');
        if (prompt) prompt.style.display = 'none';
        container.innerHTML = '';
        const img = document.createElement('img');
        img.src = dataUrl;
        const caption = document.createElement('p');
        caption.textContent = 'Foto yang akan digunakan — klik untuk mengganti';
        container.appendChild(img);
        container.appendChild(caption);
    }

    function closeModal() {
        if (!cropperModalEl) return;
        cropperModalEl.classList.remove('is-open');
        cropperModalEl.setAttribute('aria-hidden', 'true');
        if (cropper) { cropper.destroy(); cropper = null; }
    }

    function openModal() {
        if (!cropperModalEl) return;
        cropperModalEl.classList.add('is-open');
        cropperModalEl.setAttribute('aria-hidden', 'false');
    }

    function handlePhotoFile(file) {
        if (!file) return;
        if (!file.type || file.type.indexOf('image/') !== 0) {
            showToast('File harus berupa gambar', 'danger');
            return;
        }
        const reader = new FileReader();
        reader.onload = function (e) {
            cropperImage.src = e.target.result;
            openModal();
        };
        reader.readAsDataURL(file);
    }

    if (photoInput && cropperImage && cropperModalEl && window.Cropper) {
        photoInput.addEventListener('change', function () {
            if (this.files && this.files[0]) handlePhotoFile(this.files[0]);
        });

        // Dropzone: klik untuk memilih + drag & drop
        const dropzone = document.getElementById('dropzone');
        if (dropzone) {
            dropzone.addEventListener('click', function () { photoInput.click(); });

            ['dragenter', 'dragover'].forEach(function (ev) {
                dropzone.addEventListener(ev, function (e) {
                    e.preventDefault();
                    dropzone.classList.add('is-drag');
                });
            });
            ['dragleave', 'dragend', 'drop'].forEach(function (ev) {
                dropzone.addEventListener(ev, function (e) {
                    e.preventDefault();
                    dropzone.classList.remove('is-drag');
                });
            });
            dropzone.addEventListener('drop', function (e) {
                const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
                if (!file) return;
                // Salin file ke input agar tetap terkirim & memenuhi required
                try {
                    const dt = new DataTransfer();
                    dt.items.add(file);
                    photoInput.files = dt.files;
                } catch (_) {}
                handlePhotoFile(file);
            });
        }

        // Inisialisasi cropper setelah gambar dimuat & modal tampil
        cropperImage.addEventListener('load', function () {
            if (!cropperModalEl.classList.contains('is-open')) return;
            if (cropper) cropper.destroy();
            cropper = new Cropper(cropperImage, {
                aspectRatio: 3 / 4,
                viewMode: 1,
                dragMode: 'move',
                autoCropArea: 1,
                background: false,
                movable: true,
                zoomable: true
            });
        });

        // Tutup: tombol [data-close], klik backdrop, tombol Escape
        cropperModalEl.querySelectorAll('[data-close]').forEach(function (btn) {
            btn.addEventListener('click', closeModal);
        });
        cropperModalEl.addEventListener('click', function (e) {
            if (e.target === cropperModalEl) closeModal();
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && cropperModalEl.classList.contains('is-open')) closeModal();
        });

        const cropSave = document.getElementById('cropSave');
        if (cropSave) {
            cropSave.addEventListener('click', function () {
                if (!cropper) return;
                const c = cropper.getCroppedCanvas({ width: 350, height: 466 });
                const dataUrl = c.toDataURL('image/jpeg', 0.92);
                document.getElementById('pas_photo_data').value = dataUrl;
                // Hasil crop sudah tersimpan; lepas required agar submit tetap jalan
                // walau file mentah tidak tersalin (mis. DataTransfer tak didukung)
                photoInput.removeAttribute('required');
                renderPhotoPreview(dataUrl);
                closeModal();
                showToast('Foto berhasil disesuaikan', 'success');
            });
        }
    }
});
