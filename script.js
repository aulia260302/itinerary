// ============================================================
// KONFIGURASI SUPABASE — GANTI DENGAN NILAI DARI PROJECT KAMU
// Cara ambil: Supabase Dashboard → Settings → API
// ============================================================
const SUPABASE_URL = "https://vdcywgzwbgwoxbmqklbv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkY3l3Z3p3Ymd3b3hibXFrbGJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NjAxNTcsImV4cCI6MjA5ODAzNjE1N30.XMA8yOsemn7hdW5m3jwdgB1rfGFlbe_3J2gKWv9wCV0";

// Helper: headers untuk semua request ke Supabase REST API
function sbHeaders() {
    return {
        "Content-Type":  "application/json",
        "apikey":        SUPABASE_KEY,
        "Authorization": "Bearer " + SUPABASE_KEY,
        "Prefer":        "return=representation"
    };
}

// ============================================================
// LOAD DATA DARI SUPABASE SAAT HALAMAN PERTAMA DIBUKA
// ============================================================
async function loadDataDariSupabase() {
    try {
        // 1. Load settings (budget & pax)
        const resSetting = await fetch(`${SUPABASE_URL}/rest/v1/settings?id=eq.1`, {
            headers: sbHeaders()
        });
        const settingData = await resSetting.json();
        if (settingData && settingData.length > 0) {
            const s = settingData[0];
            totalBudget  = parseFloat(s.total_budget)  || 0;
            personCount  = parseInt(s.person_count)     || 0;

            const elBudget = document.getElementById('total-budget');
            if (elBudget) elBudget.innerText = totalBudget.toLocaleString('id-ID');
            const elPax = document.getElementById('table-pax-count');
            if (elPax) elPax.innerText = "Set Person: " + personCount;
            const elPaxLabel = document.getElementById('pax-count-label');
            if (elPaxLabel) elPaxLabel.innerText = personCount;
        }

        // 2. Load semua baris expense
        const resExp = await fetch(`${SUPABASE_URL}/rest/v1/expenses?order=id.asc`, {
            headers: sbHeaders()
        });
        const expenses = await resExp.json();

        const tableBody = document.getElementById('expense-table-body');
        if (!tableBody) return;
        tableBody.innerHTML = "";

        // Reset global state sebelum isi ulang dari DB
        totalExpenses = 0;
        for (let k in kategoriAmts) kategoriAmts[k] = 0;

        expenses.forEach(exp => {
            const numericQty    = parseInt(exp.quantity)    || 0;
            const numericCost   = parseFloat(exp.unit_cost) || 0;
            const hitungAmount  = parseFloat(exp.amount)    || 0;
            const currentPax    = personCount > 0 ? personCount : 1;
            const hitungPaxCost = hitungAmount / currentPax;

            const newRow = document.createElement('tr');
            newRow.dataset.id          = exp.id;
            newRow.dataset.tglMulaiRaw = exp.tanggal_mulai   || '';
            newRow.dataset.tglSelesaiRaw = exp.tanggal_selesai || '';
            rowDatasetSimpan(newRow,
                exp.tanggal_range || '',
                exp.deskripsi,
                exp.kategori,
                numericQty,
                numericCost,
                hitungAmount
            );

            newRow.innerHTML = `
                <td>
                    <div class="action-cell-buttons">
                        <button class="btn-action-edit"   onclick="editBarisTransaksi(this)">✏️</button>
                        <button class="btn-action-delete" onclick="hapusBarisTransaksi(this)">🗑️</button>
                    </div>
                </td>
                <td>${exp.tanggal_range || ''}</td>
                <td>${exp.deskripsi}</td>
                <td>${exp.kategori}</td>
                <td>${numericQty}</td>
                <td>${numericCost.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                <td style="color: #2F699E; font-weight: 600;">${hitungPaxCost.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                <td>${hitungAmount.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
            `;
            tableBody.appendChild(newRow);

            // Akumulasi global
            totalExpenses += hitungAmount;
            if (kategoriAmts.hasOwnProperty(exp.kategori)) {
                kategoriAmts[exp.kategori] += hitungAmount;
            }
        });

        // Update semua visual dashboard
        if (typeof kalkulasiUlangRingkasan === 'function')  kalkulasiUlangRingkasan();
        if (typeof updateProgressBarVisual === 'function')  updateProgressBarVisual();

        // Tampilkan setup trip jika belum ada expense DAN belum ada trip aktif
        const tripAktif = getTripAktif();
        if (expenses.length === 0 && !tripAktif) {
            tampilkanTripSetup();
        } else if (tripAktif) {
            renderTripContextBar(tripAktif);
        }

    } catch (err) {
        console.error("Gagal memuat data dari Supabase:", err);
    }
}

// ============================================================
// TRIP SETUP SCREEN — muncul sebelum dashboard jika trip belum diset
// ============================================================
function tampilkanTripSetup() {
    // Sembunyikan main dashboard sementara
    const mainDash = document.querySelector('.main-dashboard');
    if (mainDash) mainDash.style.display = 'none';

    const existing = document.getElementById('trip-setup-screen');
    if (existing) { existing.style.display = 'flex'; return; }

    const setupEl = document.createElement('div');
    setupEl.id = 'trip-setup-screen';
    setupEl.style.cssText = 'display:flex; justify-content:center; align-items:flex-start; padding: 20px 16px 40px; font-family: Plus Jakarta Sans, sans-serif;';

    setupEl.innerHTML = `
    <div style="background:white; border-radius:12px; box-shadow:0 8px 32px rgba(0,0,0,0.10); width:100%; max-width:480px; overflow:hidden;">

        <!-- Header -->
        <div style="background:linear-gradient(135deg,#1E4E79 0%,#2F699E 100%); padding:28px 28px 24px;">
            <div style="color:rgba(255,255,255,0.65); font-size:11px; letter-spacing:2px; font-weight:600; margin-bottom:8px; text-transform:uppercase;">✈️ VERVE Itineraries</div>
            <div style="color:white; font-size:1.45rem; font-weight:700; line-height:1.3;">Mau liburan kemana? 🗺️</div>
            <div style="color:rgba(255,255,255,0.7); font-size:13px; margin-top:6px;">Isi dulu detail tripmu, baru kita atur budgetnya!</div>
        </div>

        <!-- Form -->
        <div style="padding:24px 28px 28px;">

            <div style="margin-bottom:18px;">
                <label style="font-size:13px; font-weight:600; color:#374151; display:block; margin-bottom:7px;">📍 Tujuan Liburan</label>
                <input type="text" id="setup-tujuan" placeholder="Contoh: Bandung, Bali, Lombok, Tokyo..."
                    style="width:100%; padding:11px 14px; border:1.5px solid #E2E8F0; border-radius:7px; font-size:14px; font-family:inherit; outline:none; box-sizing:border-box; transition:border-color 0.2s;"
                    onfocus="this.style.borderColor='#2F699E'" onblur="this.style.borderColor='#E2E8F0'">
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:18px;">
                <div>
                    <label style="font-size:13px; font-weight:600; color:#374151; display:block; margin-bottom:7px;">📅 Tanggal Mulai</label>
                    <input type="date" id="setup-tgl-mulai"
                        style="width:100%; padding:11px 14px; border:1.5px solid #E2E8F0; border-radius:7px; font-size:14px; font-family:inherit; outline:none; box-sizing:border-box; transition:border-color 0.2s;"
                        onfocus="this.style.borderColor='#2F699E'" onblur="this.style.borderColor='#E2E8F0'">
                </div>
                <div>
                    <label style="font-size:13px; font-weight:600; color:#374151; display:block; margin-bottom:7px;">📅 Tanggal Selesai</label>
                    <input type="date" id="setup-tgl-selesai"
                        style="width:100%; padding:11px 14px; border:1.5px solid #E2E8F0; border-radius:7px; font-size:14px; font-family:inherit; outline:none; box-sizing:border-box; transition:border-color 0.2s;"
                        onfocus="this.style.borderColor='#2F699E'" onblur="this.style.borderColor='#E2E8F0'">
                </div>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:24px;">
                <div>
                    <label style="font-size:13px; font-weight:600; color:#374151; display:block; margin-bottom:7px;">👥 Jumlah Orang (Pax)</label>
                    <input type="number" id="setup-pax" placeholder="Contoh: 4" min="1"
                        style="width:100%; padding:11px 14px; border:1.5px solid #E2E8F0; border-radius:7px; font-size:14px; font-family:inherit; outline:none; box-sizing:border-box; transition:border-color 0.2s;"
                        onfocus="this.style.borderColor='#2F699E'" onblur="this.style.borderColor='#E2E8F0'">
                </div>
                <div>
                    <label style="font-size:13px; font-weight:600; color:#374151; display:block; margin-bottom:7px;">💰 Total Budget (Rp)</label>
                    <input type="number" id="setup-budget" placeholder="Contoh: 5000000" min="0"
                        style="width:100%; padding:11px 14px; border:1.5px solid #E2E8F0; border-radius:7px; font-size:14px; font-family:inherit; outline:none; box-sizing:border-box; transition:border-color 0.2s;"
                        onfocus="this.style.borderColor='#2F699E'" onblur="this.style.borderColor='#E2E8F0'">
                </div>
            </div>

            <button onclick="konfirmasiTripSetup()"
                style="width:100%; background:linear-gradient(135deg,#2F699E,#4A82B8); color:white; border:none; padding:14px; border-radius:8px; font-size:15px; font-weight:700; cursor:pointer; letter-spacing:0.3px; transition:opacity 0.2s;"
                onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">
                🚀 Mulai Perencanaan Trip!
            </button>

            <div style="text-align:center; margin-top:14px;">
                <button onclick="lewatiTripSetup()" style="background:none; border:none; color:#94A3B8; font-size:13px; cursor:pointer; text-decoration:underline;">
                    Lewati, langsung ke dashboard →
                </button>
            </div>
        </div>
    </div>`;

    // Sisipkan setelah header
    const header = document.querySelector('header');
    if (header && header.nextSibling) {
        header.parentNode.insertBefore(setupEl, header.nextSibling);
    } else {
        document.body.insertBefore(setupEl, document.body.firstChild);
    }
}

function konfirmasiTripSetup() {
    const tujuan    = document.getElementById('setup-tujuan')?.value.trim();
    const tglMulai  = document.getElementById('setup-tgl-mulai')?.value;
    const tglSelesai= document.getElementById('setup-tgl-selesai')?.value;
    const pax       = parseInt(document.getElementById('setup-pax')?.value) || 0;
    const budget    = parseFloat(document.getElementById('setup-budget')?.value) || 0;

    if (!tujuan) {
        document.getElementById('setup-tujuan').style.borderColor = '#EF4444';
        document.getElementById('setup-tujuan').focus();
        return;
    }

    // Hitung durasi hari
    let hariCount = '';
    if (tglMulai && tglSelesai) {
        const d1 = new Date(tglMulai), d2 = new Date(tglSelesai);
        const selisih = Math.max(1, Math.round((d2-d1)/(1000*60*60*24))+1);
        hariCount = selisih + ' hari';
    }

    // Format tanggal display
    const formatTgl = (raw) => {
        if (!raw) return '';
        const [y,m,d] = raw.split('-');
        return `${d}/${m}/${y}`;
    };

    const tripData = {
        tujuan,
        tglMulai,
        tglSelesai,
        tglDisplay: tglMulai && tglSelesai ? `${formatTgl(tglMulai)} – ${formatTgl(tglSelesai)}` : '',
        pax,
        budget,
        hariCount
    };

    // Simpan ke localStorage
    simpanTripAktif(tripData);

    // Set budget & pax ke dashboard
    if (budget > 0) {
        totalBudget = budget;
        const elBudget = document.getElementById('total-budget');
        if (elBudget) elBudget.innerText = totalBudget.toLocaleString('id-ID');
    }
    if (pax > 0) {
        personCount = pax;
        const elPax = document.getElementById('table-pax-count');
        if (elPax) elPax.innerText = 'Set Person: ' + pax;
        const elPaxLabel = document.getElementById('pax-count-label');
        if (elPaxLabel) elPaxLabel.innerText = pax;
    }

    // Simpan ke Supabase settings
    simpanSettingsSupabase(budget, pax);
    if (typeof kalkulasiUlangRingkasan === 'function') kalkulasiUlangRingkasan();

    // Sembunyikan setup, tampilkan dashboard
    const setupEl = document.getElementById('trip-setup-screen');
    if (setupEl) setupEl.style.display = 'none';
    const mainDash = document.querySelector('.main-dashboard');
    if (mainDash) mainDash.style.display = '';

    // Render context bar
    renderTripContextBar(tripData);
}

function lewatiTripSetup() {
    const setupEl = document.getElementById('trip-setup-screen');
    if (setupEl) setupEl.style.display = 'none';
    const mainDash = document.querySelector('.main-dashboard');
    if (mainDash) mainDash.style.display = '';
}

function renderTripContextBar(tripData) {
    if (!tripData || !tripData.tujuan) return;
    const existing = document.getElementById('trip-context-bar');
    if (existing) existing.remove();

    const bar = document.createElement('div');
    bar.id = 'trip-context-bar';
    bar.style.cssText = 'background:#1E4E79; padding:8px 20px; border-radius:8px; margin-bottom:16px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; font-family:Plus Jakarta Sans,sans-serif;';

    const info = [
        tripData.tujuan   ? `📍 <strong style="color:white;">${tripData.tujuan}</strong>` : '',
        tripData.tglDisplay ? `📅 <span style="color:rgba(255,255,255,0.8); font-size:13px;">${tripData.tglDisplay}</span>` : '',
        tripData.pax      ? `👥 <span style="color:rgba(255,255,255,0.8); font-size:13px;">${tripData.pax} orang</span>` : '',
        tripData.hariCount? `⏱️ <span style="color:rgba(255,255,255,0.8); font-size:13px;">${tripData.hariCount}</span>` : ''
    ].filter(Boolean).join('<span style="color:rgba(255,255,255,0.3); margin:0 10px;">|</span>');

    bar.innerHTML = `
        <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">${info}</div>
        <button onclick="mulaiTripBaruDariBar()" style="background:rgba(239,68,68,0.85); color:white; border:none; padding:5px 12px; border-radius:5px; font-size:12px; font-weight:600; cursor:pointer; white-space:nowrap;">
            ✚ Trip Baru
        </button>
    `;

    const mainDash = document.querySelector('.main-dashboard');
    if (mainDash) mainDash.insertBefore(bar, mainDash.firstChild);
}

function mulaiTripBaruDariBar() {
    if (!confirm('Mulai trip baru?\nData expense saat ini akan dihapus dari Supabase.')) return;
    localStorage.removeItem('verve_trip_aktif');
    mulaiTripBaru();
}

// ============================================================
// SIMPAN EXPENSE BARU KE SUPABASE (menggantikan save_expense.php)
// ============================================================
async function simpanExpenseKeSupabase(payload) {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/expenses`, {
            method:  "POST",
            headers: sbHeaders(),
            body: JSON.stringify(payload)
        });
        const result = await res.json();
        if (!res.ok) {
            console.error("Supabase error:", result);
            return null;
        }
        return result[0]; // Mengembalikan row yang baru dibuat (termasuk id)
    } catch (err) {
        console.error("Gagal simpan ke Supabase:", err);
        return null;
    }
}

// ============================================================
// UPDATE EXPENSE YANG ADA DI SUPABASE (untuk fungsi edit baris)
// ============================================================
async function updateExpenseSupabase(id, payload) {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/expenses?id=eq.${id}`, {
            method:  "PATCH",
            headers: sbHeaders(),
            body: JSON.stringify(payload)
        });
        if (!res.ok) {
            const err = await res.json();
            console.error("Gagal update Supabase:", err);
        }
    } catch (err) {
        console.error("Error update Supabase:", err);
    }
}

// ============================================================
// HAPUS EXPENSE DARI SUPABASE (untuk fungsi hapus baris)
// ============================================================
async function hapusExpenseSupabase(id) {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/expenses?id=eq.${id}`, {
            method:  "DELETE",
            headers: sbHeaders()
        });
        if (!res.ok) {
            const err = await res.json();
            console.error("Gagal hapus dari Supabase:", err);
        }
    } catch (err) {
        console.error("Error hapus Supabase:", err);
    }
}

// ============================================================
// SIMPAN SETTINGS (BUDGET & PAX) KE SUPABASE
// ============================================================
async function simpanSettingsSupabase(budget, pax, extraData = {}) {
    try {
        await fetch(`${SUPABASE_URL}/rest/v1/settings?id=eq.1`, {
            method:  "PATCH",
            headers: sbHeaders(),
            body: JSON.stringify({ total_budget: budget, person_count: pax, updated_at: new Date().toISOString(), ...extraData })
        });
    } catch (err) {
        console.error("Gagal simpan settings:", err);
    }
}

// Simpan & ambil konteks trip aktif di localStorage (ringan, tidak perlu Supabase)
function simpanTripAktif(data) {
    localStorage.setItem("verve_trip_aktif", JSON.stringify(data));
}
function getTripAktif() {
    try { return JSON.parse(localStorage.getItem("verve_trip_aktif")) || null; }
    catch(e) { return null; }
}


// ============================================================
// SCRIPT ASLI VERVE ITINERARIES (TIDAK DIUBAH KECUALI BAGIAN DB)
// ============================================================
// State data manajemen anggaran awal
let totalBudget = 0;
let totalExpenses = 0;
let personCount = 0;

// Menyimpan data sub-total per kategori
let kategoriAmts = {
    "Sarana dan Prasarana": 0,
    "Penginapan": 0,
    "Kendaraan": 0,
    "Kuliner": 0,
    "Dokumentasi dan Kesehatan": 0,
    "Wisata dan penunjangnya": 0
};

// --- MENIMPA FUNGSI SET TOTAL BUDGET DENGAN MODAL TENGAH ---
function setTotalBudget() {
    const overlay = document.getElementById('modalOverlay');
    const title = document.getElementById('modalTitle');
    const content = document.getElementById('modalFormContent');
    const btnSimpan = document.getElementById('btnSimpanModal');

    title.innerText = "Set Total Budget";
    
    // Trik: Jika totalBudget masih 0, kosongkan string-nya agar input benar-benar bersih tanpa angka 0 bawaan
    const nilaiTampil = totalBudget === 0 ? "" : totalBudget;

    content.innerHTML = `
        <div class="form-group">
            <label>Masukkan Nilai Total Anggaran Dasar:</label>
            <input type="number" id="inputBudgetVal" value="${nilaiTampil}" placeholder="Contoh: 350000000">
        </div>
    `;
    
    overlay.style.display = 'flex'; // Munculkan modal di tengah layar
    
    const inputBudget = document.getElementById('inputBudgetVal');
    inputBudget.focus();
    inputBudget.select(); // Otomatis memblok teks di dalam input, jika ada angka langsung tertimpa saat diketik

    btnSimpan.onclick = function() {
        const val = inputBudget.value;
        if(val && !isNaN(val)) {
            totalBudget = parseFloat(val);
            
            // Perbarui visual teks angka budget di dashboard utama kamu
            const elBudget = document.getElementById('total-budget');
            if (elBudget) {
                elBudget.innerText = totalBudget.toLocaleString('id-ID');
            }
            
            // Sinkronisasi ulang mesin kalkulator dashboard
            if (typeof kalkulasiUlangRingkasan === 'function') {
                kalkulasiUlangRingkasan();
            }
            // Simpan budget ke Supabase
            simpanSettingsSupabase(totalBudget, personCount);
        }
        tutupModal();
    };
}

// 2. Fungsi untuk mengatur jumlah peserta (Pax)
function setPersonCount() {
    const paxInput = prompt("Masukkan Jumlah Peserta / Pax (Contoh: 150):");
    if (!paxInput || isNaN(paxInput)) return;

    personCount = parseInt(paxInput);
    document.getElementById('table-pax-count').innerText = "Set Person: " + personCount;
    document.getElementById('pax-count-label').innerText = personCount;
    kalkulasiUlangRingkasan();
}

// 3. Fungsi utama menambahkan baris tabel pengeluaran secara manual
// (tambahTransaksi v1 dihapus - digantikan versi final di bawah)

// 4. Penghitung matematika untuk selisih anggaran dan biaya per kepala (Pax) serta Total Tabel
function kalkulasiUlangRingkasan() {
    document.getElementById('total-expenses').innerText = totalExpenses.toLocaleString('id-ID');
    
    // Hitung sisa saldo (Difference)
    let difference = totalBudget - totalExpenses;
    document.getElementById('total-difference').innerText = difference.toLocaleString('id-ID');

    // Hitung Biaya Per Pax Global
    let globalCostPerPax = 0;
    if (personCount > 0) {
        globalCostPerPax = Math.round(totalExpenses / personCount);
        document.getElementById('cost-per-pax').innerText = globalCostPerPax.toLocaleString('id-ID');
    } else {
        document.getElementById('cost-per-pax').innerText = "0";
    }

    if (document.getElementById('donut-total-text')) {
        document.getElementById('donut-total-text').innerText = "Rp" + totalExpenses.toLocaleString('id-ID');
    }

    // ================= SINKRONISASI ULANG BARIS INDIVIDUAL (BODY) INDEKS /PAX COST =================
    const currentPax = (typeof personCount !== 'undefined' && personCount > 0) ? personCount : 1;
    const semuaBarisTransaksi = document.querySelectorAll("#expense-table-body tr");
    
    semuaBarisTransaksi.forEach(row => {
        // Ambil nilai unit cost asli dari dataset baris
        const numericAmount = parseFloat(row.dataset.amount) || 0;
        // Hitung ulang nilai pax cost baru berdasarkan personCount yang baru diubah
        const hitungPaxCostBaru = numericAmount / currentPax;
        
        // Karena kolom Action di paling kiri (index 0), kolom /Pax Cost berada di sel indeks ke-6
        if (row.cells[6]) {
            row.cells[6].innerText = hitungPaxCostBaru.toLocaleString('en-US', {minimumFractionDigits: 2});
        }
    });

    // ================= SINKRONISASI BARIS TOTAL DI PALING BAWAH TABEL =================
    const table = document.querySelector(".table-responsive table");
    if (table) {
        // Cari atau buat elemen tfoot agar posisinya selalu di paling bawah tabel
        let tfoot = table.querySelector("tfoot");
        if (!tfoot) {
            tfoot = document.createElement("tfoot");
            table.appendChild(tfoot);
        }

        // Jika tabel kosong (tidak ada baris di tbody), sembunyikan baris total bawah
        if (semuaBarisTransaksi.length === 0) {
            tfoot.innerHTML = "";
            return;
        }

        // Hitung akumulasi total khusus kolom /Pax Cost berdasarkan totalExpenses saat ini
        const totalPaxCostAcc = totalExpenses / currentPax;

        // Cetak struktur baris total (Menyesuaikan jumlah kolom: Action, Date, Description, Category, Qty, Unit Cost, /Pax Cost, Amount)
        tfoot.innerHTML = `
            <tr style="background-color: #f8fafc; font-weight: bold; border-top: 2px solid #cbd5e1;">
                <td colspan="4" style="text-align: center; color: #1e293b; padding: 12px;">TOTAL</td>
                <td></td>
                <td></td>
                <td style="color: #2F699E;">${totalPaxCostAcc.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                <td style="color: #1e293b;">${totalExpenses.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
            </tr>
        `;
    }
}

// 5. Memperbarui grafik presentase batang berdasarkan akumulasi pengeluaran Anda
// Injeksi HTML bar Kendaraan ke breakdown section (dijalankan saat DOM siap)
function injectKendaraanBar() {
    if (document.getElementById('pct-kendaraan')) return; // sudah ada, skip
    const progressList = document.querySelector('.progress-list');
    if (!progressList) return;

    // Sisipkan setelah baris Penginapan (index 1)
    const items = progressList.querySelectorAll('.progress-item');
    const afterPenginapan = items[1] || null;
    const kendaraanHTML = `
    <div class="progress-item">
        <span class="category-name">Kendaraan</span>
        <div class="progress-bar-wrapper">
            <span class="percentage-badge" id="pct-kendaraan" style="background-color:#9B59B6;">0%</span>
            <div class="bar-bg">
                <div class="bar-fill" id="bar-kendaraan" style="width:0%;background-color:#9B59B6;"></div>
            </div>
            <span class="category-amount" id="amt-kendaraan">0</span>
        </div>
    </div>`;

    if (afterPenginapan) {
        afterPenginapan.insertAdjacentHTML('afterend', kendaraanHTML);
    } else {
        progressList.insertAdjacentHTML('beforeend', kendaraanHTML);
    }
}

function updateProgressBarVisual() {
    if (totalExpenses === 0) return;

    // Pastikan bar Kendaraan sudah ada di DOM
    injectKendaraanBar();

    // Hitung persentase semua kategori termasuk Kendaraan
    let pctSarana     = Math.round((kategoriAmts["Sarana dan Prasarana"]     / totalExpenses) * 100);
    let pctPenginapan = Math.round((kategoriAmts["Penginapan"]               / totalExpenses) * 100);
    let pctKendaraan  = Math.round((kategoriAmts["Kendaraan"]                / totalExpenses) * 100);
    let pctKuliner    = Math.round((kategoriAmts["Kuliner"]                  / totalExpenses) * 100);
    let pctDokkes     = Math.round((kategoriAmts["Dokumentasi dan Kesehatan"]/ totalExpenses) * 100);
    let pctWisata     = Math.round((kategoriAmts["Wisata dan penunjangnya"]  / totalExpenses) * 100);

    // Suntik nominal uang ke layar
    document.getElementById('amt-sarana').innerText     = kategoriAmts["Sarana dan Prasarana"].toLocaleString('id-ID');
    document.getElementById('amt-penginapan').innerText = kategoriAmts["Penginapan"].toLocaleString('id-ID');
    document.getElementById('amt-kuliner').innerText    = kategoriAmts["Kuliner"].toLocaleString('id-ID');
    document.getElementById('amt-dokkes').innerText     = kategoriAmts["Dokumentasi dan Kesehatan"].toLocaleString('id-ID');
    document.getElementById('amt-wisata').innerText     = kategoriAmts["Wisata dan penunjangnya"].toLocaleString('id-ID');
    const elAmtKend = document.getElementById('amt-kendaraan');
    if (elAmtKend) elAmtKend.innerText = kategoriAmts["Kendaraan"].toLocaleString('id-ID');

    // Suntik persentase
    document.getElementById('pct-sarana').innerText     = pctSarana + "%";
    document.getElementById('pct-penginapan').innerText = pctPenginapan + "%";
    document.getElementById('pct-kuliner').innerText    = pctKuliner + "%";
    document.getElementById('pct-dokkes').innerText     = pctDokkes + "%";
    document.getElementById('pct-wisata').innerText     = pctWisata + "%";
    const elPctKend = document.getElementById('pct-kendaraan');
    if (elPctKend) elPctKend.innerText = pctKendaraan + "%";

    // Lebar progress bar
    document.getElementById('bar-sarana').style.width     = pctSarana + "%";
    document.getElementById('bar-penginapan').style.width = pctPenginapan + "%";
    document.getElementById('bar-kuliner').style.width    = pctKuliner + "%";
    document.getElementById('bar-dokkes').style.width     = pctDokkes + "%";
    document.getElementById('bar-wisata').style.width     = pctWisata + "%";
    const elBarKend = document.getElementById('bar-kendaraan');
    if (elBarKend) elBarKend.style.width = pctKendaraan + "%";

    // Donut chart — 6 warna termasuk Kendaraan (ungu)
    const s1 = pctSarana;
    const s2 = s1 + pctPenginapan;
    const s3 = s2 + pctKendaraan;
    const s4 = s3 + pctKuliner;
    const s5 = s4 + pctDokkes;
    document.getElementById('donut-visual').style.background = `conic-gradient(
        #4F81BD 0% ${s1}%,
        #70AD47 ${s1}% ${s2}%,
        #9B59B6 ${s2}% ${s3}%,
        #C00000 ${s3}% ${s4}%,
        #ED7D31 ${s4}% ${s5}%,
        #7F7F7F ${s5}% 100%
    )`;
}

// --- AUTO-INJECT STRUKTUR MODAL KE HTML ---
// Baris ini otomatis membuat elemen overlay modal di HTML tanpa Anda perlu edit file index.html
const htmlModalStruktur = `
<div class="modal-overlay" id="modalOverlay">
    <div class="modal-box">
        <h3 id="modalTitle">Input Data</h3>
        <hr style="border: 0; border-top: 1px solid #E2E8F0; margin: 10px 0;">
        <div id="modalFormContent"></div>
        <div class="modal-actions">
            <button class="btn-secondary" id="btnBatalModal">Batal</button>
            <button class="btn-primary" id="btnSimpanModal">Simpan</button>
        </div>
    </div>
</div>
`;
document.body.insertAdjacentHTML('beforeend', htmlModalStruktur);

// Fungsi menutup modal
function tutupModal() {
    document.getElementById('modalOverlay').style.display = 'none';
}
document.getElementById('btnBatalModal').onclick = tutupModal;


// --- MENIMPA FUNGSI INPUT PERSON DENGAN MODAL TENGAH ---
function setPersonCount() {
    const overlay = document.getElementById('modalOverlay');
    const title = document.getElementById('modalTitle');
    const content = document.getElementById('modalFormContent');
    const btnSimpan = document.getElementById('btnSimpanModal');

    title.innerText = "Set Person / Pax";
    content.innerHTML = `
        <div class="form-group">
            <label>Masukkan Jumlah Peserta / Pax:</label>
            <input type="number" id="inputPaxVal" value="${typeof personCount !== 'undefined' ? personCount : 0}" placeholder="Contoh: 150">
        </div>
    `;
    
    overlay.style.display = 'flex'; // Munculkan modal di tengah layar
    
    btnSimpan.onclick = function() {
        const val = document.getElementById('inputPaxVal').value;
        if(val && !isNaN(val)) {
            personCount = parseInt(val);
            if(document.getElementById('table-pax-count')) document.getElementById('table-pax-count').innerText = "Set Person: " + personCount;
            if(document.getElementById('pax-count-label')) document.getElementById('pax-count-label').innerText = personCount;
            if(typeof kalkulasiUlangRingkasan === 'function') kalkulasiUlangRingkasan();
            // Simpan pax ke Supabase
            simpanSettingsSupabase(totalBudget, personCount);
        }
        tutupModal();
    };
}


// --- MENIMPA FUNGSI TAMBAH TRANSAKSI DENGAN MODAL TENGAH ---
// (tambahTransaksi v2 dihapus - digantikan versi final di bawah)

// ================= AUTOMATIC COLUMN & SUMMARY BUTTON INJECTION =================
// 1. Menambahkan header kolom baru "/Pax Cost" di samping Unit Cost secara otomatis
const tabelHeadRow = document.querySelector(".table-responsive table thead tr");
if (tabelHeadRow && !document.getElementById("col-pax-cost-head")) {
    const unitCostTh = tabelHeadRow.cells[4]; // Posisi Unit Cost
    const newTh = document.createElement("th");
    newTh.id = "col-pax-cost-head";
    newTh.innerText = "/Pax Cost";
    tabelHeadRow.insertBefore(newTh, unitCostTh.nextSibling);
}

// 2. DIUBAH: Menambahkan header kolom "Action" di PALING POJOK KIRI (Sebelum Date)
if (tabelHeadRow && !document.getElementById("col-action-head")) {
    const actionTh = document.createElement("th");
    actionTh.id = "col-action-head";
    actionTh.innerText = "Action";
    actionTh.style.width = "100px";
    tabelHeadRow.insertBefore(actionTh, tabelHeadRow.firstChild); // Menyisipkan di paling pertama
}

// 3. Menaruh tombol di LUAR kotak tabel (setelah container tabel) dan rata KIRI
const tableContainer = document.querySelector(".table-section-container");
if (tableContainer && !document.getElementById("btn-save-summary-trigger")) {
    const actionWrapper = document.createElement("div");
    actionWrapper.className = "summary-action-wrapper-outside";
    actionWrapper.innerHTML = `
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
            <button class="btn-save-summary" id="btn-save-summary-trigger" onclick="simpanKeItineraryTree()">
                💾 Simpan Ringkasan ke Itinerary Tree
            </button>
            <button onclick="mulaiTripBaru()" style="background:#EF4444;color:white;border:none;padding:12px 20px;border-radius:6px;font-weight:700;font-size:0.9rem;cursor:pointer;box-shadow:0 4px 12px rgba(239,68,68,0.2);transition:all 0.2s ease;" onmouseover="this.style.background='#DC2626'" onmouseout="this.style.background='#EF4444'">
                🗑️ Mulai Trip Baru
            </button>
        </div>
    `;
    tableContainer.parentNode.insertBefore(actionWrapper, tableContainer.nextSibling);
}


// Fungsi pembantu menghitung detail jumlah hari dan malam antara dua tanggal kalender
function hitungDetailDurasi(tglMulai, tglSelesai) {
    if (!tglMulai || !tglSelesai) return { hari: 1, malam: 1 };
    const mulai = new Date(tglMulai);
    const selesai = new Date(tglSelesai);
    const selisihWaktu = selesai.getTime() - mulai.getTime();
    const selisihHari = Math.ceil(selisihWaktu / (1000 * 3600 * 24));
    
    if (selisihHari <= 0) {
        return { hari: 1, malam: 1 };
    }
    return {
        hari: selisihHari + 1,
        malam: selisihHari
    };
}

// ================= FUNGSI TAMBAH TRANSAKSI (ACTION DI POJOK KIRI) =================
function tambahTransaksi() {
    const overlay = document.getElementById('modalOverlay');
    const title = document.getElementById('modalTitle');
    const content = document.getElementById('modalFormContent');
    const btnSimpan = document.getElementById('btnSimpanModal');

    title.innerText = "Tambah Baris Pengeluaran Baru";
    content.innerHTML = `
        <div class="form-group">
            <label>Tanggal Mulai Travel:</label>
            <input type="date" id="txTanggalMulai">
        </div>
        <div class="form-group">
            <label>Tanggal Selesai Travel:</label>
            <input type="date" id="txTanggalSelesai">
        </div>
        <div class="form-group">
            <label>Kategori Komponen:</label>
            <select id="txKategori">
                <option value="Sarana dan Prasarana">Sarana dan Prasarana</option>
                <option value="Penginapan" selected>Penginapan</option>
                <option value="Kendaraan">Kendaraan</option>
                <option value="Kuliner">Kuliner</option>
                <option value="Dokumentasi dan Kesehatan">Dokumentasi dan Kesehatan</option>
                <option value="Wisata dan penunjangnya">Wisata dan penunjangnya</option>
            </select>
        </div>
        <div class="form-group">
            <label>Deskripsi Pengeluaran:</label>
            <input type="text" id="txDeskripsi" placeholder="Contoh: Apartment Bandung">
        </div>
        <div id="dynamicFormFields"></div>
        <div id="txLivePreviewTotal" style="margin-top: 10px; font-size: 13px; color: #2F699E; font-weight: 600;"></div>
    `;

    const katSelect = document.getElementById('txKategori');
    const dynamicFields = document.getElementById('dynamicFormFields');
    const livePreview = document.getElementById('txLivePreviewTotal');
    const tglMulaiInput = document.getElementById('txTanggalMulai');
    const tglSelesaiInput = document.getElementById('txTanggalSelesai');

    function renderDynamicFields() {
        const kat = katSelect.value;
        if (kat === "Kendaraan") {
            dynamicFields.innerHTML = `
                <div class="form-group">
                    <label>Berapa Kendaraan:</label>
                    <input type="number" id="txQty" value="1">
                </div>
                <div class="form-group">
                    <label>Harga per Malam / Hari:</label>
                    <input type="number" id="txCost" placeholder="Contoh: 500000">
                </div>
            `;
        } else if (kat === "Penginapan") {
            dynamicFields.innerHTML = `
                <div class="form-group">
                    <label>Jumlah Kamar (Quantity):</label>
                    <input type="number" id="txQty" value="1">
                </div>
                <div class="form-group">
                    <label>Harga per Malam:</label>
                    <input type="number" id="txCost" placeholder="Contoh: 550000">
                </div>
            `;
        } else {
            dynamicFields.innerHTML = `
                <div class="form-group">
                    <label>Quantity / Jumlah:</label>
                    <input type="number" id="txQty" value="1">
                </div>
                <div class="form-group">
                    <label>Harga Satuan (Unit Cost):</label>
                    <input type="number" id="txCost" placeholder="Contoh: 50000">
                </div>
            `;
        }
        pasangLiveKalkulasi();
    }

    function pasangLiveKalkulasi() {
        const qtyEl = document.getElementById('txQty');
        const costEl = document.getElementById('txCost');
        
        const hitungLive = () => {
            const tglMulai = tglMulaiInput.value;
            const tglSelesai = tglSelesaiInput.value;
            const kat = katSelect.value;
            const qty = parseInt(qtyEl?.value) || 0;
            const cost = parseFloat(costEl?.value) || 0;

            if (tglMulai && tglSelesai && (kat === "Penginapan" || kat === "Kendaraan")) {
                const durasi = hitungDetailDurasi(tglMulai, tglSelesai);
                const totalHargaRange = qty * cost * durasi.malam;
                livePreview.innerText = `* Estimasi Durasi: ${durasi.hari} Hari ${durasi.malam} Malam (Total: Rp ${totalHargaRange.toLocaleString('en-US', {minimumFractionDigits: 0})})`;
            } else if (qty && cost) {
                livePreview.innerText = `* Total: Rp ${(qty * cost).toLocaleString('en-US', {minimumFractionDigits: 0})}`;
            } else {
                livePreview.innerText = "";
            }
        };

        if (qtyEl) qtyEl.oninput = hitungLive;
        if (costEl) costEl.oninput = hitungLive;
        tglMulaiInput.onchange = hitungLive;
        tglSelesaiInput.onchange = hitungLive;
        hitungLive();
    }

    katSelect.onchange = renderDynamicFields;
    renderDynamicFields();

    overlay.style.display = 'flex';

    btnSimpan.onclick = function() {
        const tglMulaiRaw = tglMulaiInput.value;
        const tglSelesaiRaw = tglSelesaiInput.value;
        const deskripsi = document.getElementById('txDeskripsi').value;
        const kategori = katSelect.value;
        const qty = document.getElementById('txQty').value;
        const cost = document.getElementById('txCost').value;

        if (!tglMulaiRaw || !tglSelesaiRaw || !deskripsi || !qty || !cost || isNaN(qty) || isNaN(cost)) {
            alert("Mohon isi data dengan benar.");
            return;
        }

        const partsMulai = tglMulaiRaw.split("-");
        const tglMulaiClean = `${partsMulai[2]}/${partsMulai[1]}/${partsMulai[0]}`;
        
        const partsSelesai = tglSelesaiRaw.split("-");
        const tglSelesaiClean = `${partsSelesai[2]}/${partsSelesai[1]}/${partsSelesai[0]}`;

        const tanggalRange = `${tglMulaiClean} - ${tglSelesaiClean}`;
        const numericQty = parseInt(qty);
        const numericCost = parseFloat(cost);
        
        let hitungAmount = 0;
        if (kategori === "Penginapan" || kategori === "Kendaraan") {
            const durasi = hitungDetailDurasi(tglMulaiRaw, tglSelesaiRaw);
            hitungAmount = numericQty * numericCost * durasi.malam;
        } else {
            hitungAmount = numericQty * numericCost;
        }
        
        const currentPax = (typeof personCount !== 'undefined' && personCount > 0) ? personCount : 1;
        const hitungPaxCost = hitungAmount / currentPax;

        const tableBody = document.getElementById('expense-table-body');
        if (tableBody) {
            const newRow = document.createElement('tr');
            rowDatasetSimpan(newRow, tanggalRange, deskripsi, kategori, numericQty, numericCost, hitungAmount);
            newRow.dataset.tglMulaiRaw = tglMulaiRaw;
            newRow.dataset.tglSelesaiRaw = tglSelesaiRaw;

            newRow.innerHTML = `
                <td>
                    <div class="action-cell-buttons">
                        <button class="btn-action-edit" onclick="editBarisTransaksi(this)">✏️</button>
                        <button class="btn-action-delete" onclick="hapusBarisTransaksi(this)">🗑️</button>
                    </div>
                </td>
                <td>${tanggalRange}</td>
                <td>${deskripsi}</td>
                <td>${kategori}</td>
                <td>${numericQty}</td>
                <td>${numericCost.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                <td style="color: #2F699E; font-weight: 600;">${hitungPaxCost.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                <td>${hitungAmount.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
            `;
            tableBody.appendChild(newRow);
        }

        updateAngkaGlobal(hitungAmount, kategori, "tambah");

        // SIMPAN KE SUPABASE (menggantikan save_expense.php)
        simpanExpenseKeSupabase({
            tanggal_mulai:   tglMulaiRaw,
            tanggal_selesai: tglSelesaiRaw || tglMulaiRaw,
            tanggal_range:   tanggalRange,
            deskripsi:       deskripsi,
            kategori:        kategori,
            quantity:        numericQty,
            unit_cost:       numericCost,
            pax_cost:        hitungPaxCost,
            amount:          hitungAmount
        }).then(savedRow => {
            // Simpan id dari Supabase ke dataset baris agar edit/hapus bisa pakai id
            if (savedRow && savedRow.id) {
                const lastRow = document.querySelector('#expense-table-body tr:last-child');
                if (lastRow) lastRow.dataset.id = savedRow.id;
            }
        });

        overlay.style.display = 'none';
        tutupModal();
    };
}

// --- FUNGSI UNTUK EDIT BARIS ---
function editBarisTransaksi(button) {
    const row = button.closest('tr');
    const overlay = document.getElementById('modalOverlay');
    const title = document.getElementById('modalTitle');
    const content = document.getElementById('modalFormContent');
    const btnSimpan = document.getElementById('btnSimpanModal');

    title.innerText = "Edit Baris Pengeluaran";
    content.innerHTML = `
        <div class="form-group">
            <label>Tanggal Mulai Travel:</label>
            <input type="date" id="txTanggalMulai" value="${row.dataset.tglMulaiRaw || ''}">
        </div>
        <div class="form-group">
            <label>Tanggal Selesai Travel:</label>
            <input type="date" id="txTanggalSelesai" value="${row.dataset.tglSelesaiRaw || ''}">
        </div>
        <div class="form-group">
            <label>Kategori Komponen:</label>
            <select id="txKategori">
                <option value="Sarana dan Prasarana" ${row.dataset.kategori === 'Sarana dan Prasarana' ? 'selected' : ''}>Sarana dan Prasarana</option>
                <option value="Penginapan" ${row.dataset.kategori === 'Penginapan' ? 'selected' : ''}>Penginapan</option>
                <option value="Kendaraan" ${row.dataset.kategori === 'Kendaraan' ? 'selected' : ''}>Kendaraan</option>
                <option value="Kuliner" ${row.dataset.kategori === 'Kuliner' ? 'selected' : ''}>Kuliner</option>
                <option value="Dokumentasi dan Kesehatan" ${row.dataset.kategori === 'Dokumentasi dan Kesehatan' ? 'selected' : ''}>Dokumentasi dan Kesehatan</option>
                <option value="Wisata dan penunjangnya" ${row.dataset.kategori === 'Wisata dan penunjangnya' ? 'selected' : ''}>Wisata dan penunjangnya</option>
            </select>
        </div>
        <div class="form-group">
            <label>Deskripsi Pengeluaran:</label>
            <input type="text" id="txDeskripsi" value="${row.dataset.deskripsi}">
        </div>
        <div id="dynamicFormFields"></div>
        <div id="txLivePreviewTotal" style="margin-top: 10px; font-size: 13px; color: #2F699E; font-weight: 600;"></div>
    `;

    const katSelect = document.getElementById('txKategori');
    const dynamicFields = document.getElementById('dynamicFormFields');
    const livePreview = document.getElementById('txLivePreviewTotal');
    const tglMulaiInput = document.getElementById('txTanggalMulai');
    const tglSelesaiInput = document.getElementById('txTanggalSelesai');

    function renderDynamicFields() {
        const kat = katSelect.value;
        if (kat === "Kendaraan") {
            dynamicFields.innerHTML = `
                <div class="form-group">
                    <label>Berapa Kendaraan:</label>
                    <input type="number" id="txQty" value="${row.dataset.kategori === 'Kendaraan' ? row.dataset.qty : 1}">
                </div>
                <div class="form-group">
                    <label>Harga per Malam / Hari:</label>
                    <input type="number" id="txCost" value="${row.dataset.kategori === 'Kendaraan' ? row.dataset.cost : ''}">
                </div>
            `;
        } else if (kat === "Penginapan") {
            dynamicFields.innerHTML = `
                <div class="form-group">
                    <label>Jumlah Kamar (Quantity):</label>
                    <input type="number" id="txQty" value="${row.dataset.kategori === 'Penginapan' ? row.dataset.qty : 1}">
                </div>
                <div class="form-group">
                    <label>Harga per Malam:</label>
                    <input type="number" id="txCost" value="${row.dataset.kategori === 'Penginapan' ? row.dataset.cost : ''}">
                </div>
            `;
        } else {
            dynamicFields.innerHTML = `
                <div class="form-group">
                    <label>Quantity / Jumlah:</label>
                    <input type="number" id="txQty" value="${row.dataset.qty}">
                </div>
                <div class="form-group">
                    <label>Harga Satuan (Unit Cost):</label>
                    <input type="number" id="txCost" value="${row.dataset.cost}">
                </div>
            `;
        }
        pasangLiveKalkulasi();
    }

    function pasangLiveKalkulasi() {
        const qtyEl = document.getElementById('txQty');
        const costEl = document.getElementById('txCost');
        
        const hitungLive = () => {
            const tglMulai = tglMulaiInput.value;
            const tglSelesai = tglSelesaiInput.value;
            const kat = katSelect.value;
            const qty = parseInt(qtyEl?.value) || 0;
            const cost = parseFloat(costEl?.value) || 0;

            if (tglMulai && tglSelesai && (kat === "Penginapan" || kat === "Kendaraan")) {
                const durasi = hitungDetailDurasi(tglMulai, tglSelesai);
                const totalHargaRange = qty * cost * durasi.malam;
                livePreview.innerText = `* Estimasi Durasi: ${durasi.hari} Hari ${durasi.malam} Malam (Total: Rp ${totalHargaRange.toLocaleString('en-US', {minimumFractionDigits: 0})})`;
            } else if (qty && cost) {
                livePreview.innerText = `* Total: Rp ${(qty * cost).toLocaleString('en-US', {minimumFractionDigits: 0})}`;
            } else {
                livePreview.innerText = "";
            }
        };

        if (qtyEl) qtyEl.oninput = hitungLive;
        if (costEl) costEl.oninput = hitungLive;
        tglMulaiInput.onchange = hitungLive;
        tglSelesaiInput.onchange = hitungLive;
        hitungLive();
    }

    katSelect.onchange = renderDynamicFields;
    renderDynamicFields();

    overlay.style.display = 'flex';

    btnSimpan.onclick = function() {
        const tglMulaiRaw = tglMulaiInput.value;
        const tglSelesaiRaw = tglSelesaiInput.value;
        const deskripsi = document.getElementById('txDeskripsi').value;
        const kategori = katSelect.value;
        const qty = document.getElementById('txQty').value;
        const cost = document.getElementById('txCost').value;

        if (!tglMulaiRaw || !tglSelesaiRaw || !deskripsi || !qty || !cost || isNaN(qty) || isNaN(cost)) {
            alert("Mohon isi data dengan benar.");
            return;
        }

        updateAngkaGlobal(parseFloat(row.dataset.amount), row.dataset.kategori, "kurang");

        const partsMulai = tglMulaiRaw.split("-");
        const tglMulaiClean = `${partsMulai[2]}/${partsMulai[1]}/${partsMulai[0]}`;
        
        const partsSelesai = tglSelesaiRaw.split("-");
        const tglSelesaiClean = `${partsSelesai[2]}/${partsSelesai[1]}/${partsSelesai[0]}`;

        const tanggalRange = `${tglMulaiClean} - ${tglSelesaiClean}`;
        const numericQty = parseInt(qty);
        const numericCost = parseFloat(cost);
        
        let hitungAmount = 0;
        if (kategori === "Penginapan" || kategori === "Kendaraan") {
            const durasi = hitungDetailDurasi(tglMulaiRaw, tglSelesaiRaw);
            hitungAmount = numericQty * numericCost * durasi.malam;
        } else {
            hitungAmount = numericQty * numericCost;
        }

        const currentPax = (typeof personCount !== 'undefined' && personCount > 0) ? personCount : 1;
        const hitungPaxCost = hitungAmount / currentPax;

        rowDatasetSimpan(row, tanggalRange, deskripsi, kategori, numericQty, numericCost, hitungAmount);
        
        row.dataset.tglMulaiRaw  = tglMulaiRaw;
        row.dataset.tglSelesaiRaw = tglSelesaiRaw;

        row.cells[1].innerText = tanggalRange;
        row.cells[2].innerText = deskripsi;
        row.cells[3].innerText = kategori;
        row.cells[4].innerText = numericQty;
        row.cells[5].innerText = numericCost.toLocaleString('en-US', {minimumFractionDigits: 2});
        row.cells[6].innerText = hitungPaxCost.toLocaleString('en-US', {minimumFractionDigits: 2});
        row.cells[7].innerText = hitungAmount.toLocaleString('en-US', {minimumFractionDigits: 2});

        // UPDATE KE SUPABASE jika baris punya id
        if (row.dataset.id) {
            updateExpenseSupabase(row.dataset.id, {
                tanggal_mulai:   tglMulaiRaw,
                tanggal_selesai: tglSelesaiRaw,
                tanggal_range:   tanggalRange,
                deskripsi:       deskripsi,
                kategori:        kategori,
                quantity:        numericQty,
                unit_cost:       numericCost,
                pax_cost:        hitungPaxCost,
                amount:          hitungAmount
            });
        }

        updateAngkaGlobal(hitungAmount, kategori, "tambah");
        tutupModal();
    };
}

// --- FUNGSI BANTU SIMPAN DATASET BARIS ---
function rowDatasetSimpan(row, tgl, dsk, kat, qty, cst, amt) {
    row.dataset.tanggal = tgl;
    row.dataset.deskripsi = dsk;
    row.dataset.kategori = kat;
    row.dataset.qty = qty;
    row.dataset.cost = cst;
    row.dataset.amount = amt;
}

// --- FUNGSI UNTUK MENGHAPUS BARIS (SINKRONISASI TOTAL & GRAFIK ATAS) ---
function hapusBarisTransaksi(button) {
    const row = button.closest('tr');
    showConfirmHapus({
        judul: "Hapus Pengeluaran?",
        pesan: "Kamu yakin mau menghapus baris pengeluaran ini? Total dan grafik akan otomatis diperbarui.",
        onConfirm: () => {
            // Ambil data nominal dan kategori dari baris yang akan dihapus
            const amount   = parseFloat(row.dataset.amount) || 0;
            const kategori = row.dataset.kategori;
            const rowId    = row.dataset.id;

            // 1. Hapus dari Supabase jika ada id
            if (rowId) {
                hapusExpenseSupabase(rowId);
            }

            // 2. Hapus baris dari tabel HTML
            row.remove();

            // 3. Kurangi dan sinkronkan angka global di dashboard atas
            updateAngkaGlobal(amount, kategori, "kurang");
        }
    });
}

// --- FUNGSI UNTUK EDIT BARIS ---
/// --- FUNGSI UPDATE DATA DAN SINKRONISASI GRAFIK ---
function updateAngkaGlobal(amount, kategori, aksi) {
    const multiplier = (aksi === "tambah") ? 1 : -1;
    const deltaAmount = amount * multiplier;

    // 1. Update total pengeluaran keseluruhan
    if (typeof totalExpenses !== 'undefined') {
        totalExpenses += deltaAmount;
        if (totalExpenses < 0 || isNaN(totalExpenses)) totalExpenses = 0;
    }
    
    // 2. Update nominal khusus kategori yang bersangkutan (misal: Penginapan)
    if (typeof kategoriAmts !== 'undefined' && kategoriAmts.hasOwnProperty(kategori)) {
        kategoriAmts[kategori] += deltaAmount;
        if (kategoriAmts[kategori] < 0 || isNaN(kategoriAmts[kategori])) kategoriAmts[kategori] = 0;
    }

    // 3. Panggil fungsi bawaan dashboard Anda untuk menghitung ulang angka & progres
    if (typeof kalkulasiUlangRingkasan === 'function') kalkulasiUlangRingkasan();
    if (typeof updateProgressBarVisual === 'function') updateProgressBarVisual();
    if (typeof renderChart === 'function') renderChart(); // Jika ada fungsi draw ulang chart lingkaran

    // 4. JIKA DATA TOTAL SUDAH KOSONG (0), PAKSA SELEKTIF ELEMEN VISUAL ATAS BERSIH (TANPA MERUSAK MODAL)
    if (totalExpenses === 0) {
        // Reset semua database nominal kategori menjadi 0
        if (typeof kategoriAmts !== 'undefined') {
            for (let kat in kategoriAmts) {
                kategoriAmts[kat] = 0;
            }
        }

        // Paksa teks nominal kategori di dashboard menjadi 0 secara spesifik lewat ID elemennya
        const idNominals = ['amt-sarana', 'amt-penginapan', 'amt-kendaraan', 'amt-kuliner', 'amt-dokkes', 'amt-wisata'];
        idNominals.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerText = "0";
        });

        // Paksa teks persentase kategori di dashboard menjadi 0% secara spesifik lewat ID elemennya
        const idPercentages = ['pct-sarana', 'pct-penginapan', 'pct-kendaraan', 'pct-kuliner', 'pct-dokkes', 'pct-wisata'];
        idPercentages.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerText = "0%";
        });

        // Paksa manipulasi lebar progress bar menjadi 0%
        const idBars = ['bar-sarana', 'bar-penginapan', 'bar-kendaraan', 'bar-kuliner', 'bar-dokkes', 'bar-wisata'];
        idBars.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.width = "0%";
        });
        
        // Bersihkan text di dalam donat chart
        const centerTextChart = document.getElementById('donut-total-text');
        if (centerTextChart) centerTextChart.innerText = "Rp0";

        // Kembalikan background donut ke warna dasar netral
        const donutVisual = document.getElementById('donut-visual');
        if (donutVisual) donutVisual.style.background = "#E2E8F0";
    }
}

// ================= MULAI TRIP BARU — HAPUS SEMUA EXPENSE DI SUPABASE =================
async function mulaiTripBaru() {
    const konfirmasi = confirm(
        "⚠️ Mulai Trip Baru?\n\n" +
        "Semua data expense di dashboard akan DIHAPUS dari Supabase.\n" +
        "Pastikan sudah klik 'Simpan Ringkasan ke Itinerary Tree' sebelum lanjut.\n\n" +
        "Lanjutkan?"
    );
    if (!konfirmasi) return;

    try {
        // Hapus semua baris di tabel expenses Supabase
        const res = await fetch(`${SUPABASE_URL}/rest/v1/expenses?id=gt.0`, {
            method: 'DELETE',
            headers: sbHeaders()
        });

        if (!res.ok) {
            const err = await res.json();
            alert("Gagal menghapus data: " + JSON.stringify(err));
            return;
        }

        // Reset settings (budget & pax) ke 0
        await fetch(`${SUPABASE_URL}/rest/v1/settings?id=eq.1`, {
            method: 'PATCH',
            headers: sbHeaders(),
            body: JSON.stringify({ total_budget: 0, person_count: 0 })
        });

        // Reset state lokal
        totalBudget   = 0;
        totalExpenses = 0;
        personCount   = 0;
        for (let k in kategoriAmts) kategoriAmts[k] = 0;

        // Bersihkan tabel di layar
        const tableBody = document.getElementById('expense-table-body');
        if (tableBody) tableBody.innerHTML = "";

        // Reset summary cards
        ['total-budget','total-expenses','total-difference','cost-per-pax'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerText = "0";
        });
        const elPax = document.getElementById('table-pax-count');
        if (elPax) elPax.innerText = "Set Person: 0";
        const elPaxLabel = document.getElementById('pax-count-label');
        if (elPaxLabel) elPaxLabel.innerText = "0";

        // Reset grafik
        updateAngkaGlobal(0, "", "kurang");
        const donutEl = document.getElementById('donut-visual');
        if (donutEl) donutEl.style.background = "#E2E8F0";
        const donutText = document.getElementById('donut-total-text');
        if (donutText) donutText.innerText = "Rp0";

        // Hapus trip aktif dari localStorage dan tampilkan setup screen
        localStorage.removeItem('verve_trip_aktif');
        const barEl = document.getElementById('trip-context-bar');
        if (barEl) barEl.remove();
        tampilkanTripSetup();

    } catch(err) {
        console.error("Error mulai trip baru:", err);
        alert("Terjadi error: " + err.message);
    }
}

// ================= LOGIKA SIMPAN SUMMARY KE ITINERARY TREE (LOCALSTORAGE) =================
function simpanKeItineraryTree() {
    const barisPertama = document.querySelector("#expense-table-body tr");
    let tanggalKey = "15/08/2026";
    
    if (barisPertama) {
        tanggalKey = barisPertama.cells[1].innerText.trim();
    } else {
        alert("Belum ada baris data transaksi untuk disimpan!");
        return;
    }

    // Cek apakah sudah ada data dengan key ini (untuk pre-fill tujuan)
    let dbExisting = JSON.parse(localStorage.getItem("itineraryTreeDatabase")) || {};
    const tujuanLama = dbExisting[tanggalKey]?.tujuan || "";

    // Buka modal untuk input Tujuan Liburan sebelum menyimpan
    const overlay = document.getElementById('modalOverlay');
    const title   = document.getElementById('modalTitle');
    const content = document.getElementById('modalFormContent');
    const btnSimpan = document.getElementById('btnSimpanModal');

    title.innerText = "Simpan ke Itinerary Tree";
    content.innerHTML = `
        <div class="form-group">
            <label>📅 Tanggal Trip</label>
            <input type="text" value="${tanggalKey}" disabled style="background:#f1f5f9; color:#64748b;">
        </div>
        <div class="form-group">
            <label>🗺️ Tujuan Liburan</label>
            <input type="text" id="inputTujuanLiburan" value="${tujuanLama}" placeholder="Contoh: Liburan ke Bandung, Wisata Lombok...">
        </div>
    `;
    overlay.style.display = 'flex';
    setTimeout(() => document.getElementById('inputTujuanLiburan')?.focus(), 100);

    btnSimpan.onclick = function() {
        const tujuan = document.getElementById('inputTujuanLiburan')?.value.trim() || "Liburan";
        
        const dataSummaryTravel = {
            tanggal:      tanggalKey,
            tujuan:       tujuan,
            totalBudget:  typeof totalBudget   !== 'undefined' ? totalBudget   : 0,
            totalExpenses:typeof totalExpenses !== 'undefined' ? totalExpenses : 0,
            difference:   (typeof totalBudget !== 'undefined' && typeof totalExpenses !== 'undefined') ? (totalBudget - totalExpenses) : 0,
            pax:          typeof personCount   !== 'undefined' ? personCount   : 0,
            timestamp:    new Date().getTime(),
            // Pertahankan jurnal detail yang lama jika sudah pernah disimpan
            jurnalDetail: dbExisting[tanggalKey]?.jurnalDetail || []
        };

        let dbItinerary = JSON.parse(localStorage.getItem("itineraryTreeDatabase")) || {};
        dbItinerary[tanggalKey] = dataSummaryTravel;
        localStorage.setItem("itineraryTreeDatabase", JSON.stringify(dbItinerary));

        tutupModal();
        // Kalau sedang di halaman tree, refresh tampilannya
        if (document.getElementById('itinerary-tree-section')?.style.display !== 'none') {
            renderItineraryTreePage();
        }
        alert(`🎉 Sukses! Trip "${tujuan}" (${tanggalKey}) berhasil disimpan ke Itinerary Tree.`);
    };
}

// ================= AUTOMATIC NAVIGATION & MULTI-LIST INJECTION =================

// 1. Injeksi Navigasi Menu Baru "My Lists" ke Header
const navContainer = document.querySelector("header div, .navbar, nav"); // Menyesuaikan pembungkus menu atas kamu
const targetNav = Array.from(document.querySelectorAll('a, li, span')).find(el => el.innerText.includes('Itinerary Tree'));

if (targetNav && !document.getElementById('nav-my-lists')) {
    const newMenu = document.createElement(targetNav.tagName);
    newMenu.id = 'nav-my-lists';
    newMenu.innerHTML = `<a href="#" onclick="pindahHalamanTab('lists')" style="text-decoration:none; color:inherit; margin-left:15px;">My Lists</a>`;
    targetNav.parentNode.insertBefore(newMenu, targetNav.nextSibling);
    
    // Beri id juga ke menu Dashboard & Itinerary Tree biar gampang diatur klik-nya
    targetNav.id = 'nav-itinerary-tree';
    if (targetNav.previousElementSibling) targetNav.previousElementSibling.id = 'nav-dashboard';
}

// 2. Buat Kontainer Khusus untuk Halaman List (Awalnya disembunyikan)
const mainContainer = document.querySelector('.table-section-container')?.parentNode || document.body;
if (!document.getElementById('lists-page-section')) {
    const listsHTML = `
    <div id="lists-page-section" style="display: none; margin-top: 20px; font-family: 'Plus Jakarta Sans', sans-serif;">
        
        <div style="display: flex; gap: 10px; margin-bottom: 15px; flex-wrap: wrap; align-items: center; background: #FFF0F3; padding: 12px; border-radius: 14px; border: 1px solid #FFCAD4;">
            <button class="filter-list-btn" data-kat="Semua" onclick="filterKategoriList('Semua')" style="background-color:#C97A8E; color:white; border:none; padding:8px 14px; border-radius:8px; cursor:pointer; font-weight:600; transition:all 0.2s;">📁 Semua List</button>
            <button class="filter-list-btn" data-kat="Cafe" onclick="filterKategoriList('Cafe')" style="background-color:#FFE5EC; color:#4A2834; border:none; padding:8px 14px; border-radius:8px; cursor:pointer; font-weight:500; transition:all 0.2s;">☕ Cafe</button>
            <button class="filter-list-btn" data-kat="Kuliner" onclick="filterKategoriList('Kuliner')" style="background-color:#FFE5EC; color:#4A2834; border:none; padding:8px 14px; border-radius:8px; cursor:pointer; font-weight:500; transition:all 0.2s;">🍕 Kuliner</button>
            <button class="filter-list-btn" data-kat="Photobox" onclick="filterKategoriList('Photobox')" style="background-color:#FFE5EC; color:#4A2834; border:none; padding:8px 14px; border-radius:8px; cursor:pointer; font-weight:500; transition:all 0.2s;">📸 Photobox</button>
            <button class="filter-list-btn" data-kat="Wisata" onclick="filterKategoriList('Wisata')" style="background-color:#FFE5EC; color:#4A2834; border:none; padding:8px 14px; border-radius:8px; cursor:pointer; font-weight:500; transition:all 0.2s;">🗼 Wisata</button>
            <button class="filter-list-btn" data-kat="Penginapan" onclick="filterKategoriList('Penginapan')" style="background-color:#FFE5EC; color:#4A2834; border:none; padding:8px 14px; border-radius:8px; cursor:pointer; font-weight:500; transition:all 0.2s;">🏨 Penginapan</button>
            
            <button onclick="bukaModalTambahList()" style="background: linear-gradient(135deg, #E8A7B6, #C97A8E); color:white; border:none; padding:8px 16px; border-radius:8px; cursor:pointer; font-weight:bold; margin-left:auto; display:block; box-shadow: 0 4px 12px rgba(201, 122, 142, 0.2); transition:all 0.2s;">
                ➕ Tambah Rekomendasi
            </button>
        </div>
        
        <div class="table-section-container" style="background: white; padding: 30px; border-radius: 20px; box-shadow: 0 8px 24px rgba(74, 40, 52, 0.06); border: 1px solid #FFE5EC;">
            <h3 id="list-page-title" style="color: #4A2834; margin-top:0; margin-bottom:15px; font-size:18px; font-weight:700;">Semua Daftar Rekomendasi (List)</h3>
            <div class="table-responsive">
                <table style="width:100%; border-collapse: collapse; text-align: left;">
                    <thead>
                        <tr style="background-color: #C97A8E; color: white;">
                            <th style="padding:14px 16px; font-size: 0.85rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border-top-left-radius: 8px; border-bottom-left-radius: 8px; vertical-align: middle;">Kategori</th>
                            <th style="padding:14px 16px; font-size: 0.85rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; vertical-align: middle;">Nama Tempat / Item</th>
                            <th style="padding:14px 16px; font-size: 0.85rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; vertical-align: middle;">Lokasi / Catatan</th>
                            <th style="padding:14px 16px; font-size: 0.85rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; width:100px; text-align:center; border-top-right-radius: 8px; border-bottom-right-radius: 8px; vertical-align: middle;">Aksi</th>
                        </tr>
                    </thead>
                    <tbody id="list-table-body">
                    </tbody>
                </table>
            </div>
        </div>
    </div>
    `;
    mainContainer.insertAdjacentHTML('beforeend', listsHTML);
}

// 3. Database awal penyimpanan List (Disinkronkan dengan LocalStorage)
let myListsDatabase = JSON.parse(localStorage.getItem("myTravelListsDatabase")) || [
    { kategori: "Cafe", nama: "Sejiwa Coffee", catatan: "Kopi susu enak, tempat cocok buat nongkrong sore" },
    { kategori: "Kuliner", nama: "Paskal Food Market", catatan: "Pilihan makanannya lengkap banget" },
    { kategori: "Photobox", nama: "Photomatics Paris Van Java", catatan: "Lokasi di dekat bioskop, bawa uang pas" }
];

// Fungsi merender isi tabel list
// Fungsi merender isi tabel list (Sudah ditambah tombol Edit ✏️)
function renderTableLists(filterKategori = "Semua") {
    const tbody = document.getElementById('list-table-body');
    if (!tbody) return;
    tbody.innerHTML = "";
    
    document.getElementById('list-page-title').innerText = filterKategori === "Semua" ? "Semua Daftar Rekomendasi (List)" : `Daftar Rekomendasi - ${filterKategori}`;

    myListsDatabase.forEach((item, index) => {
        if (filterKategori !== "Semua" && item.kategori !== filterKategori) return;

        const row = document.createElement('tr');
        row.style.borderBottom = "1px solid #cbd5e1";
        row.innerHTML = `
            <td style="padding:12px;"><span style="background:#e2e8f0; padding:4px 8px; border-radius:4px; font-size:12px; font-weight:bold;">${item.kategori}</span></td>
            <td style="padding:12px; font-weight:600; color:#1e293b;">${item.nama}</td>
            <td style="padding:12px; color:#64748b;">${item.catatan || '-'}</td>
            <td style="padding:12px; text-align:center;">
                <div style="display: flex; gap: 8px; justify-content: center;">
                    <button onclick="bukaModalEditList(${index})" style="background:none; border:none; cursor:pointer; font-size:16px;" title="Edit">✏️</button>
                    <button onclick="hapusItemFromList(${index})" style="background:none; border:none; cursor:pointer; font-size:16px;" title="Hapus">🗑️</button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Fungsi untuk Mengedit Rekomendasi List yang Sudah Ada
function bukaModalEditList(index) {
    const overlay = document.getElementById('modalOverlay');
    const title = document.getElementById('modalTitle');
    const content = document.getElementById('modalFormContent');
    const btnSimpan = document.getElementById('btnSimpanModal');

    if (!overlay || !title || !content || !btnSimpan) {
        alert("Elemen modal di index.html tidak ditemukan!");
        return;
    }

    // Ambil data lama berdasarkan index yang diklik
    const dataLama = myListsDatabase[index];

    title.innerText = "Edit Rekomendasi List";
    content.innerHTML = `
        <div class="form-group">
            <label>Pilih Jenis Kategori List:</label>
            <select id="listKategori" style="width:100%; padding:8px; border-radius:4px; border:1px solid #cbd5e1;">
                <option value="Cafe" ${dataLama.kategori === 'Cafe' ? 'selected' : ''}>☕ Cafe</option>
                <option value="Kuliner" ${dataLama.kategori === 'Kuliner' ? 'selected' : ''}>🍕 Kuliner</option>
                <option value="Photobox" ${dataLama.kategori === 'Photobox' ? 'selected' : ''}>📸 Photobox</option>
                <option value="Wisata" ${dataLama.kategori === 'Wisata' ? 'selected' : ''}>🗼 Wisata</option>
                <option value="Penginapan" ${dataLama.kategori === 'Penginapan' ? 'selected' : ''}>🏨 Penginapan</option>
            </select>
        </div>
        <div class="form-group" style="margin-top:15px;">
            <label>Nama Tempat / Item:</label>
            <input type="text" id="listNama" value="${dataLama.nama}" style="width:100%; padding:8px; border-radius:4px; border:1px solid #cbd5e1;">
        </div>
        <div class="form-group" style="margin-top:15px;">
            <label>Catatan Singkat / Lokasi:</label>
            <input type="text" id="listCatatan" value="${dataLama.catatan || ''}" style="width:100%; padding:8px; border-radius:4px; border:1px solid #cbd5e1;">
        </div>
    `;

    overlay.style.display = 'flex';
    document.getElementById('listNama').focus();

    btnSimpan.onclick = function() {
        const kat = document.getElementById('listKategori').value;
        const nama = document.getElementById('listNama').value;
        const catatan = document.getElementById('listCatatan').value;

        if (!nama) {
            alert("Nama tempat tidak boleh kosong!");
            return;
        }

        // Update data pada array database berdasarkan index-nya
        myListsDatabase[index] = { kategori: kat, nama: nama, catatan: catatan };
        
        // Simpan ke LocalStorage dan refresh tabel
        localStorage.setItem("myTravelListsDatabase", JSON.stringify(myListsDatabase));
        renderTableLists();
        
        if (typeof tutupModal === "function") {
            tutupModal();
        } else {
            overlay.style.display = 'none';
        }
    };
}

// Fungsi Filter Tab Kategori
function filterKategoriList(kat) {
    // Sorot tombol yang sedang dipilih dengan efek zoom/bubble
    document.querySelectorAll('.filter-list-btn').forEach(btn => {
        if (btn.dataset.kat === kat) {
            // Tombol aktif: membesar + menonjol
            btn.style.backgroundColor = "#C97A8E";
            btn.style.color = "white";
            btn.style.fontWeight = "700";
            btn.style.transform = "scale(1.15)";
            btn.style.boxShadow = "0 6px 16px rgba(201, 122, 142, 0.45)";
            btn.style.zIndex = "2";
            btn.style.position = "relative";
        } else {
            // Tombol non-aktif: kembali ke ukuran normal
            btn.style.backgroundColor = "#FFE5EC";
            btn.style.color = "#4A2834";
            btn.style.fontWeight = "500";
            btn.style.transform = "scale(1)";
            btn.style.boxShadow = "none";
            btn.style.zIndex = "1";
        }
    });
    renderTableLists(kat);
}

// Fungsi Hapus Item dari List (memakai modal konfirmasi custom)
function hapusItemFromList(index) {
    const item = myListsDatabase[index] || {};
    showConfirmHapus({
        judul: "Hapus Rekomendasi?",
        pesan: `Kamu yakin mau menghapus <b>${item.nama || "item ini"}</b> dari daftar? Tindakan ini tidak bisa dibatalkan.`,
        onConfirm: () => {
            myListsDatabase.splice(index, 1);
            localStorage.setItem("myTravelListsDatabase", JSON.stringify(myListsDatabase));
            renderTableLists();
        }
    });
}

// Modal konfirmasi custom yang muncul di tengah layar
function showConfirmHapus({ judul = "Konfirmasi", pesan = "", onConfirm = () => {} } = {}) {
    // Hapus modal lama bila masih ada
    const existing = document.getElementById('confirmHapusOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'confirmHapusOverlay';
    overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 9999;
        background: rgba(74, 40, 52, 0.45); backdrop-filter: blur(3px);
        display: flex; align-items: center; justify-content: center;
        opacity: 0; transition: opacity 0.2s ease;
        font-family: 'Plus Jakarta Sans', sans-serif;
    `;

    overlay.innerHTML = `
        <div id="confirmHapusBox" style="
            background: white; width: 90%; max-width: 380px; padding: 28px 26px;
            border-radius: 20px; text-align: center;
            box-shadow: 0 20px 50px rgba(74, 40, 52, 0.25);
            transform: scale(0.85); transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
        ">
            <div style="
                width: 64px; height: 64px; margin: 0 auto 16px; border-radius: 50%;
                background: #FFE5EC; display: flex; align-items: center; justify-content: center;
                font-size: 30px;
            ">🗑️</div>
            <h3 style="margin: 0 0 8px; color: #4A2834; font-size: 19px; font-weight: 700;">${judul}</h3>
            <p style="margin: 0 0 24px; color: #8a6b74; font-size: 14px; line-height: 1.5;">${pesan}</p>
            <div style="display: flex; gap: 10px;">
                <button id="confirmHapusCancel" style="
                    flex: 1; padding: 11px; border: 1px solid #FFCAD4; background: white;
                    color: #4A2834; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 14px;
                    transition: all 0.15s;
                ">Batal</button>
                <button id="confirmHapusOk" style="
                    flex: 1; padding: 11px; border: none;
                    background: linear-gradient(135deg, #E8748A, #C94A63); color: white;
                    border-radius: 10px; cursor: pointer; font-weight: 700; font-size: 14px;
                    box-shadow: 0 4px 12px rgba(201, 74, 99, 0.35); transition: all 0.15s;
                ">Ya, Hapus</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Animasi masuk
    requestAnimationFrame(() => {
        overlay.style.opacity = "1";
        overlay.querySelector('#confirmHapusBox').style.transform = "scale(1)";
    });

    const tutup = () => {
        overlay.style.opacity = "0";
        overlay.querySelector('#confirmHapusBox').style.transform = "scale(0.85)";
        setTimeout(() => overlay.remove(), 200);
    };

    overlay.querySelector('#confirmHapusCancel').onclick = tutup;
    overlay.querySelector('#confirmHapusOk').onclick = () => { tutup(); onConfirm(); };
    // Klik area gelap di luar box = batal
    overlay.onclick = (e) => { if (e.target === overlay) tutup(); };
}

// 4. LOGIKA PADA MODAL OVERLAY UNTUK INPUT DATA LIST BARU
function bukaModalTambahList() {
    const overlay = document.getElementById('modalOverlay');
    const title = document.getElementById('modalTitle');
    const content = document.getElementById('modalFormContent');
    const btnSimpan = document.getElementById('btnSimpanModal');

    if (!overlay || !title || !content || !btnSimpan) {
        alert("Elemen modal di index.html tidak ditemukan!");
        return;
    }

    title.innerText = "Tambah Rekomendasi Baru";
    content.innerHTML = `
        <div class="form-group">
            <label>Pilih Jenis Kategori List:</label>
            <select id="listKategori" style="width:100%; padding:8px; border-radius:4px; border:1px solid #cbd5e1;">
                <option value="Cafe">☕ Cafe</option>
                <option value="Kuliner">🍕 Kuliner</option>
                <option value="Photobox">📸 Photobox</option>
                <option value="Wisata">🗼 Wisata</option>
                <option value="Penginapan">🏨 Penginapan</option>
            </select>
        </div>
        <div class="form-group" style="margin-top:15px;">
            <label>Nama Tempat / Item Baru:</label>
            <input type="text" id="listNama" placeholder="Contoh: Sangria Resort & Spa" style="width:100%; padding:8px; border-radius:4px; border:1px solid #cbd5e1;">
        </div>
        <div class="form-group" style="margin-top:15px;">
            <label>Catatan Singkat / Lokasi:</label>
            <input type="text" id="listCatatan" placeholder="Contoh: Dekat Alun-alun, buka jam 09.00" style="width:100%; padding:8px; border-radius:4px; border:1px solid #cbd5e1;">
        </div>
    `;

    overlay.style.display = 'flex';
    document.getElementById('listNama').focus();

    btnSimpan.onclick = function() {
        const kat = document.getElementById('listKategori').value;
        const nama = document.getElementById('listNama').value;
        const catatan = document.getElementById('listCatatan').value;

        if (!nama) {
            alert("Nama tempat tidak boleh kosong!");
            return;
        }

        myListsDatabase.push({ kategori: kat, nama: nama, catatan: catatan });
        localStorage.setItem("myTravelListsDatabase", JSON.stringify(myListsDatabase));
        
        renderTableLists();
        
        // Memanggil fungsi tutup modal bawaan kamu
        if (typeof tutupModal === "function") {
            tutupModal();
        } else {
            overlay.style.display = 'none';
        }
    };
}

// 5. SISTEM NAVIGASI PERPINDAHAN SELEKTIF HALAMAN TAB (VERSI AMAN & ANTI-BLANK)
// SUNTIKAN NAVIGASI SAKLAR 3 HALAMAN (DASHBOARD, ITINERARY TREE, MY LISTS)
function pindahHalamanTab(targetTab) {
    // Simpan halaman aktif supaya tetap sama setelah refresh
    try { localStorage.setItem('activeTab', targetTab); } catch (e) {}

    const listsSection = document.getElementById('lists-page-section');
    const treeSection = document.getElementById('itinerary-tree-section');
    const dashboardTableSection = document.querySelector(".table-section-container:not(#lists-page-section .table-section-container):not(#itinerary-tree-section .table-section-container)");
    const externalSaveButton = document.querySelector(".summary-action-wrapper-outside, button[id*='Simpan']");

    // Reset format cetak tebal semua link navigasi
    document.querySelectorAll('header a, .navbar a').forEach(a => a.style.fontWeight = 'normal');

    if (targetTab === 'tree') {
        // === HALAMAN 1: ITINERARY TREE ===
        // Sembunyikan panel dashboard atas (keuangan & breakdown)
        document.querySelectorAll('div').forEach(el => {
            if (el.innerText && (el.innerText.includes("My Budget & Expenses") || el.innerText.includes("Breakdown of Expenses") || el.innerText.includes("Total Person (Pax)"))) {
                if (el.style.display === 'flex' || el.classList.contains('row') || el.style.display === 'block') {
                    el.style.setProperty('display', 'none', 'important');
                }
            }
        });
        if (dashboardTableSection) dashboardTableSection.style.setProperty('display', 'none', 'important');
        if (externalSaveButton) externalSaveButton.style.setProperty('display', 'none', 'important');
        if (listsSection) listsSection.style.setProperty('display', 'none', 'important');
        
        // Tampilkan halaman Tree
        if (treeSection) {
            treeSection.style.setProperty('display', 'block', 'important');
            renderItineraryTreePage();
        }
        if (document.getElementById('nav-itinerary-tree')) {
            document.getElementById('nav-itinerary-tree').style.fontWeight = 'bold';
        }

    } else if (targetTab === 'lists') {
        // === HALAMAN 2: MY LISTS ===
        document.querySelectorAll('div').forEach(el => {
            if (el.innerText && (el.innerText.includes("My Budget & Expenses") || el.innerText.includes("Breakdown of Expenses") || el.innerText.includes("Total Person (Pax)"))) {
                if (el.style.display === 'flex' || el.classList.contains('row') || el.style.display === 'block') {
                    el.style.setProperty('display', 'none', 'important');
                }
            }
        });
        if (dashboardTableSection) dashboardTableSection.style.setProperty('display', 'none', 'important');
        if (externalSaveButton) externalSaveButton.style.setProperty('display', 'none', 'important');
        // Paksa sembunyikan semua komponen selain My Lists
if (treeSection) {
    treeSection.style.display = "none";
    treeSection.hidden = true;
}

const treeContainer = document.getElementById("itinerary-tree-section");
if (treeContainer) {
    treeContainer.style.display = "none";
}

if (listsSection) {
    listsSection.hidden = false;
    listsSection.style.display = "block";
    renderTableLists();
}
        if (document.getElementById('nav-my-lists')) {
            document.getElementById('nav-my-lists').querySelector('a').style.fontWeight = 'bold';
        }

    } else {
        // === HALAMAN 3: RETURN TO MAIN DASHBOARD KEUANGAN ===
        document.querySelectorAll('div').forEach(el => {
            if (el.innerText && (el.innerText.includes("My Budget & Expenses") || el.innerText.includes("Breakdown of Expenses"))) {
                el.style.setProperty('display', 'flex', 'important');
            }
            if (el.innerText && el.innerText.includes("Total Person (Pax)")) {
                el.style.setProperty('display', 'block', 'important');
            }
        });
        if (dashboardTableSection) dashboardTableSection.style.setProperty('display', 'block', 'important');
        if (externalSaveButton) externalSaveButton.style.setProperty('display', 'block', 'important');
        
        if (listsSection) listsSection.style.setProperty('display', 'none', 'important');
        if (treeSection) treeSection.style.setProperty('display', 'none', 'important');
    }
}

// Daftarkan trigger event klik pada elemen menu navbar 'Itinerary Tree' agar mengarah ke fungsi renderer kita
const menuItineraryTreeLink = Array.from(document.querySelectorAll('header a, .navbar a')).find(el => el.innerText.includes('Itinerary Tree'));
if (menuItineraryTreeLink) {
    // Beri penanda ID agar mudah dimanipulasi fungsinya
    menuItineraryTreeLink.parentNode.id = 'nav-itinerary-tree';
    menuItineraryTreeLink.addEventListener('click', function(e) {
        e.preventDefault();
        pindahHalamanTab('tree');
    });
}

// Pasang trigger event klik ke menu Dashboard bawaan agar bisa kembali ke menu utama
const elMenuDashboard = document.querySelector("a[href*='dashboard'], header a");
if (elMenuDashboard) {
    elMenuDashboard.addEventListener('click', function(e) {
        e.preventDefault();
        pindahHalamanTab('dashboard');
    });
}

// === TAMBAHAN LOGIKA AGAR TOMBOL DASHBOARD ASLI BISA DIKLIK ===
document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll('a, li, span').forEach(el => {
        if (el.innerText.trim() === 'Dashboard') {
            el.style.cursor = 'pointer';
            el.onclick = function(e) {
                try { localStorage.setItem('activeTab', 'dashboard'); } catch (err) {}
                window.location.reload();
            };
        }
    });

    // Inject Kendaraan bar setelah DOM siap
    injectKendaraanBar();

    // ===== LOAD DATA DARI SUPABASE SAAT HALAMAN PERTAMA DIBUKA =====
    loadDataDariSupabase();

    // ===== PULIHKAN HALAMAN AKTIF SETELAH REFRESH =====
    try {
        const savedTab = localStorage.getItem('activeTab');
        if (savedTab && savedTab !== 'dashboard') {
            // Beri jeda singkat agar section tree/lists selesai di-inject
            setTimeout(() => pindahHalamanTab(savedTab), 100);
        }
    } catch (e) {}
});

// Jalankan sekali lagi langsung tanpa menunggu DOMContentLoaded sebagai backup aman
document.querySelectorAll('a, li, span').forEach(el => {
    if (el.innerText.trim() === 'Dashboard') {
        el.style.cursor = 'pointer';
        el.onclick = function(e) {
            window.location.reload();
        };
    }
});

// ================= AUTOMATIC ITINERARY TREE INJECTION =================
if (!document.getElementById('itinerary-tree-section')) {
    const treeHTML = `
    <div id="itinerary-tree-section" style="display: none; margin-top: 20px; font-family: sans-serif;">
        <div class="table-section-container" style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #cbd5e1;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h3 style="color: #1e293b; margin: 0; font-size: 18px;">🌳 Riwayat Anggaran - Itinerary Tree</h3>
                <button onclick="bersihkanSemuaTree()" style="background-color: #dc2626; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;">🗑️ Reset Semua Data</button>
            </div>
            <div class="table-responsive">
                <table style="width:100%; border-collapse: collapse; text-align: left;">
                    <thead>
                        <tr style="background-color: #f8bbd0; color: #1e293b;">
                            <th style="padding:12px;">Tanggal Trip</th>
                            <th style="padding:12px;">Total Anggaran</th>
                            <th style="padding:12px;">Total Pengeluaran</th>
                            <th style="padding:12px;">Sisa Saldo</th>
                            <th style="padding:12px;">Jumlah Pax</th>
                            <th style="padding:12px;">Biaya / Pax</th>
                            <th style="padding:12px; text-align: center;">Aksi</th>
                        </tr>
                    </thead>
                    <tbody id="tree-table-body">
                        </tbody>
                </table>
            </div>
        </div>
    </div>
    `;
    // Cari container utama tempat menaruh section halaman
    const targetContainer = document.querySelector('.table-section-container')?.parentNode || document.body;
    targetContainer.insertAdjacentHTML('beforeend', treeHTML);
}

// ================= ITINERARY TREE — ACCORDION DESIGN =================

function renderItineraryTreePage() {
    const tbody = document.getElementById('tree-table-body');
    if (!tbody) return;
    tbody.innerHTML = "";

    // Update header tabel
    const thead = document.querySelector("#itinerary-tree-section table thead tr");
    if (thead) {
        thead.innerHTML = `
            <th style="padding:12px 16px; width:36px;"></th>
            <th style="padding:12px 16px;">Tanggal Trip</th>
            <th style="padding:12px 16px;">Tujuan</th>
            <th style="padding:12px 16px;">Person Pax</th>
            <th style="padding:12px 16px;">Total Budget</th>
            <th style="padding:12px 16px;">/Pax Cost</th>
            <th style="padding:12px 16px; text-align:center;">Aksi</th>
        `;
    }

    let dbItinerary = JSON.parse(localStorage.getItem("itineraryTreeDatabase")) || {};
    const keys = Object.keys(dbItinerary);

    if (keys.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; color:#94a3b8; font-style:italic;">Belum ada ringkasan budget yang disimpan.<br><span style="font-size:12px;">Klik tombol "Simpan Ringkasan ke Itinerary Tree" di dashboard.</span></td></tr>`;
        return;
    }

    keys.sort((a, b) => dbItinerary[b].timestamp - dbItinerary[a].timestamp);

    keys.forEach((key, idx) => {
        const item = dbItinerary[key];

        // Proteksi tanggal
        let tanggalMurni = item.tanggal ? item.tanggal.trim() : key;
        if (!tanggalMurni || tanggalMurni.includes("📅")) {
            tanggalMurni = key.includes("/") || key.includes("-") ? key : new Date().toLocaleDateString('id-ID');
            dbItinerary[key].tanggal = tanggalMurni;
            localStorage.setItem("itineraryTreeDatabase", JSON.stringify(dbItinerary));
        }

        const tujuan      = item.tujuan || "—";
        const currentPax  = item.pax > 0 ? item.pax : 1;
        const paxCost     = Math.round((item.totalExpenses || 0) / currentPax);
        const selisih     = (item.totalBudget || 0) - (item.totalExpenses || 0);
        const isOver      = selisih < 0;
        const detailId    = `tree-detail-${idx}`;
        const isEven      = idx % 2 === 0;

        // ── MAIN ROW ──
        const mainRow = document.createElement('tr');
        mainRow.className = 'tree-main-row';
        mainRow.dataset.key = key;
        mainRow.style.cssText = `background:${isEven ? '#ffffff' : '#f8fafc'};border-bottom:1px solid #e2e8f0;cursor:pointer;transition:background 0.15s;`;
        mainRow.onmouseover = () => mainRow.style.background = '#EFF6FF';
        mainRow.onmouseout  = () => mainRow.style.background = isEven ? '#ffffff' : '#f8fafc';

        mainRow.innerHTML = `
            <td style="padding:12px 16px; text-align:center; width:36px;">
                <span class="tree-arrow" id="arrow-${detailId}" style="display:inline-block;transition:transform 0.2s;color:#94a3b8;font-size:12px;">▶</span>
            </td>
            <td style="padding:12px 16px; font-weight:600; color:#1e293b; white-space:nowrap;">${tanggalMurni}</td>
            <td style="padding:12px 16px;">
                <span style="display:inline-flex;align-items:center;gap:6px;">
                    <span style="background:#FEF3C7;color:#92400E;padding:5px 14px;border-radius:20px;font-size:14px;font-weight:700;letter-spacing:0.3px;">🗺️ ${tujuan}</span>
                    <button class="btn-edit-tujuan" data-key="${key}" title="Edit Tujuan" style="background:none;border:none;cursor:pointer;font-size:12px;color:#94a3b8;padding:2px 4px;border-radius:4px;transition:color 0.2s;" onmouseover="this.style.color='#2F699E'" onmouseout="this.style.color='#94a3b8'">✏️</button>
                </span>
            </td>
            <td style="padding:12px 16px;"><span style="background:#e0f2fe;color:#0369a1;padding:4px 10px;border-radius:12px;font-size:12px;font-weight:700;">${item.pax} Pax</span></td>
            <td style="padding:12px 16px; color:#10b981; font-weight:600; white-space:nowrap;">Rp ${(item.totalBudget || 0).toLocaleString('id-ID')}</td>
            <td style="padding:12px 16px; color:#2F699E; font-weight:700; white-space:nowrap;">Rp ${paxCost.toLocaleString('id-ID')}</td>
            <td style="padding:12px 16px; text-align:center;">
                <button class="btn-action-hapus-tree" data-key="${key}" title="Hapus" style="background:#FEE2E2;border:none;color:#EF4444;width:30px;height:30px;border-radius:6px;cursor:pointer;font-size:14px;transition:background 0.2s;" onmouseover="this.style.background='#FECACA'" onmouseout="this.style.background='#FEE2E2'">🗑</button>
            </td>
        `;

        // ── DETAIL ROW (accordion) ──
        const detailRow = document.createElement('tr');
        detailRow.id = detailId;
        detailRow.style.cssText = 'display:none; background:#F0F7FF;';
        detailRow.innerHTML = `
            <td colspan="7" style="padding:0;">
                <div style="padding:16px 24px 20px; border-top:1px dashed #BFDBFE; display:flex; flex-wrap:wrap; gap:12px; align-items:center; justify-content:space-between;">
                    
                    <!-- Stats mini -->
                    <div style="display:flex;gap:16px;flex-wrap:wrap;">
                        <div style="text-align:center;background:white;padding:10px 16px;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,0.06);min-width:100px;">
                            <div style="font-size:10px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Total Expenses</div>
                            <div style="font-size:14px;font-weight:700;color:#10b981;margin-top:4px;">Rp ${(item.totalExpenses||0).toLocaleString('id-ID')}</div>
                        </div>
                        <div style="text-align:center;background:white;padding:10px 16px;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,0.06);min-width:100px;">
                            <div style="font-size:10px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Selisih</div>
                            <div style="font-size:14px;font-weight:700;color:${isOver?'#EF4444':'#3B82F6'};margin-top:4px;">Rp ${selisih.toLocaleString('id-ID')}</div>
                        </div>
                        <div style="text-align:center;background:white;padding:10px 16px;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,0.06);min-width:80px;">
                            <div style="font-size:10px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Aktivitas</div>
                            <div style="font-size:14px;font-weight:700;color:#9B59B6;margin-top:4px;">${(item.jurnalDetail||[]).length} item</div>
                        </div>
                    </div>

                    <!-- Action buttons -->
                    <div style="display:flex;gap:10px;flex-wrap:wrap;">
                        <button class="btn-action-susun-jurnal" data-key="${key}" style="background:#2F699E;color:white;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;">✏️ Susun Jadwal</button>
                        <button class="btn-action-excel-tree" data-key="${key}" style="background:#10b981;color:white;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;">📊 Download Excel</button>
                    </div>
                </div>
            </td>
        `;

        tbody.appendChild(mainRow);
        tbody.appendChild(detailRow);

        // Toggle accordion saat klik baris utama
        mainRow.addEventListener('click', function(e) {
            // Jangan toggle kalau klik tombol hapus atau edit
            if (e.target.closest('.btn-action-hapus-tree') || e.target.closest('.btn-edit-tujuan')) return;

            const isOpen = detailRow.style.display !== 'none';
            detailRow.style.display = isOpen ? 'none' : 'table-row';
            const arrow = document.getElementById(`arrow-${detailId}`);
            if (arrow) arrow.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(90deg)';
        });
    });

    hubungkanEventTombolTree();
}

// Fungsi mendaftarkan klik tombol
function hubungkanEventTombolTree() {
    document.querySelectorAll('.btn-action-susun-jurnal').forEach(btn => {
        btn.onclick = function(e) {
            e.stopPropagation();
            bukaModalJurnalJadwal(this.getAttribute('data-key'));
        };
    });

    document.querySelectorAll('.btn-action-hapus-tree').forEach(btn => {
        btn.onclick = function(e) {
            e.stopPropagation();
            const key = this.getAttribute('data-key');
            if (confirm(`Hapus trip "${key}"?`)) {
                let db = JSON.parse(localStorage.getItem("itineraryTreeDatabase")) || {};
                delete db[key];
                localStorage.setItem("itineraryTreeDatabase", JSON.stringify(db));
                renderItineraryTreePage();
            }
        };
    });

    document.querySelectorAll('.btn-action-excel-tree').forEach(btn => {
        btn.onclick = function(e) {
            e.stopPropagation();
            downloadJurnalKeExcel(this.getAttribute('data-key'));
        };
    });

    // Tombol edit tujuan inline
    document.querySelectorAll('.btn-edit-tujuan').forEach(btn => {
        btn.onclick = function(e) {
            e.stopPropagation();
            const key = this.getAttribute('data-key');
            let db = JSON.parse(localStorage.getItem("itineraryTreeDatabase")) || {};
            const tujuanLama = db[key]?.tujuan || "";

            const overlay   = document.getElementById('modalOverlay');
            const title     = document.getElementById('modalTitle');
            const content   = document.getElementById('modalFormContent');
            const btnSimpan = document.getElementById('btnSimpanModal');

            title.innerText = "Edit Tujuan Liburan";
            content.innerHTML = `
                <div class="form-group">
                    <label>🗺️ Tujuan Liburan</label>
                    <input type="text" id="inputEditTujuan" value="${tujuanLama}" placeholder="Contoh: Liburan ke Bali">
                </div>
            `;
            overlay.style.display = 'flex';
            setTimeout(() => document.getElementById('inputEditTujuan')?.focus(), 100);

            btnSimpan.onclick = function() {
                const tujuanBaru = document.getElementById('inputEditTujuan')?.value.trim() || tujuanLama;
                db[key].tujuan = tujuanBaru;
                localStorage.setItem("itineraryTreeDatabase", JSON.stringify(db));
                tutupModal();
                renderItineraryTreePage();
            };
        };
    });
}

// DOMContentLoaded — header akan diisi oleh renderItineraryTreePage()
document.addEventListener("DOMContentLoaded", () => {});

// ============================================================
// JURNAL FULLSCREEN PAGE — REDESIGN ELEGAN
// ============================================================

function bukaModalJurnalJadwal(key) {
    let dbItinerary = JSON.parse(localStorage.getItem("itineraryTreeDatabase")) || {};
    let currentData = dbItinerary[key];
    if (!currentData) return;

    // Sinkronisasi data awal dari main dashboard jika jurnalDetail masih kosong
    if (!currentData.jurnalDetail || currentData.jurnalDetail.length === 0) {
        currentData.jurnalDetail = [];
        document.querySelectorAll("#expense-table-body tr").forEach(row => {
            currentData.jurnalDetail.push({
                day: "DAY 01", time: "00:00",
                activity: row.dataset.deskripsi || row.cells[2]?.innerText || "-",
                category: row.dataset.kategori  || row.cells[3]?.innerText || "-",
                qty: parseInt(row.dataset.qty)   || 1,
                unitCost: parseFloat(row.dataset.cost) || 0,
                notes: ""
            });
        });
        dbItinerary[key] = currentData;
        localStorage.setItem("itineraryTreeDatabase", JSON.stringify(dbItinerary));
    }

    // Hapus overlay lama kalau ada
    const oldOverlay = document.getElementById('jurnal-fullscreen-overlay');
    if (oldOverlay) oldOverlay.remove();

    const currentPax    = currentData.pax > 0 ? currentData.pax : 1;
    const totalExpAmt   = (currentData.totalExpenses || 0);
    const totalBudgetAmt= (currentData.totalBudget   || 0);
    const selisih       = totalBudgetAmt - totalExpAmt;
    const paxCostTotal  = Math.round(totalExpAmt / currentPax);

    // Hitung jumlah hari dari tanggal
    let hariTrip = 1;
    try {
        const parts = key.split(' - ');
        if (parts.length === 2) {
            const [d1,m1,y1] = parts[0].trim().split('/');
            const [d2,m2,y2] = parts[1].trim().split('/');
            const tgl1 = new Date(`${y1}-${m1}-${d1}`);
            const tgl2 = new Date(`${y2}-${m2}-${d2}`);
            hariTrip = Math.max(1, Math.round((tgl2-tgl1)/(1000*60*60*24))+1);
        }
    } catch(e) {}

    // Opsi day dropdown (DAY 01 - DAY 14)
    const dayOptions = Array.from({length:14},(_,i)=>`DAY ${String(i+1).padStart(2,'0')}`).map(d=>`<option value="${d}">${d}</option>`).join('');
    const katOptions = ['Sarana dan Prasarana','Penginapan','Kendaraan','Kuliner','Dokumentasi dan Kesehatan','Wisata dan penunjangnya','Lain-lain'].map(k=>`<option value="${k}">${k}</option>`).join('');

    const overlay = document.createElement('div');
    overlay.id = 'jurnal-fullscreen-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(15,23,42,0.7);z-index:99999;overflow-y:auto;backdrop-filter:blur(4px);';

    overlay.innerHTML = `
    <div style="max-width:1200px;margin:24px auto 40px;border-radius:12px;overflow:hidden;box-shadow:0 25px 60px rgba(0,0,0,0.4);font-family:'Plus Jakarta Sans',sans-serif;">

        <!-- HEADER -->
        <div style="background:linear-gradient(135deg,#1E4E79 0%,#2F699E 60%,#4A82B8 100%);padding:24px 32px;display:flex;justify-content:space-between;align-items:flex-start;">
            <div>
                <div style="color:rgba(255,255,255,0.7);font-size:12px;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">📋 TRAVEL ITINERARY JOURNAL</div>
                <h2 style="color:white;margin:0;font-size:1.5rem;font-weight:700;">Trip: ${key}</h2>
                <div style="color:rgba(255,255,255,0.8);font-size:13px;margin-top:8px;display:flex;gap:20px;flex-wrap:wrap;">
                    <span>👥 ${currentData.pax} Person</span>
                    <span>📅 ${hariTrip} Hari</span>
                    <span>💰 Budget: Rp ${totalBudgetAmt.toLocaleString('id-ID')}</span>
                </div>
            </div>
            <button onclick="tutupJurnalFullscreen()" style="background:rgba(255,255,255,0.15);border:none;color:white;width:36px;height:36px;border-radius:50%;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;transition:background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.15)'">✕</button>
        </div>

        <!-- SUMMARY CARDS -->
        <div style="background:#F1F5F9;padding:20px 32px;display:grid;grid-template-columns:repeat(4,1fr);gap:16px;border-bottom:1px solid #E2E8F0;">
            <div style="background:white;border-radius:8px;padding:16px;border-left:4px solid #2F699E;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
                <div style="font-size:11px;color:#64748B;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Total Budget</div>
                <div style="font-size:1.2rem;font-weight:700;color:#1E293B;margin-top:4px;">Rp ${totalBudgetAmt.toLocaleString('id-ID')}</div>
            </div>
            <div style="background:white;border-radius:8px;padding:16px;border-left:4px solid #10B981;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
                <div style="font-size:11px;color:#64748B;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Total Expenses</div>
                <div style="font-size:1.2rem;font-weight:700;color:#10B981;margin-top:4px;">Rp ${totalExpAmt.toLocaleString('id-ID')}</div>
            </div>
            <div style="background:white;border-radius:8px;padding:16px;border-left:4px solid ${selisih>=0?'#3B82F6':'#EF4444'};box-shadow:0 1px 3px rgba(0,0,0,0.06);">
                <div style="font-size:11px;color:#64748B;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Selisih</div>
                <div style="font-size:1.2rem;font-weight:700;color:${selisih>=0?'#3B82F6':'#EF4444'};margin-top:4px;">Rp ${selisih.toLocaleString('id-ID')}</div>
            </div>
            <div style="background:white;border-radius:8px;padding:16px;border-left:4px solid #9B59B6;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
                <div style="font-size:11px;color:#64748B;font-weight:600;text-transform:uppercase;letter-spacing:1px;">/Pax Cost</div>
                <div style="font-size:1.2rem;font-weight:700;color:#9B59B6;margin-top:4px;">Rp ${paxCostTotal.toLocaleString('id-ID')}</div>
            </div>
        </div>

        <!-- TABEL JURNAL -->
        <div style="background:white;padding:24px 32px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                <h3 style="margin:0;color:#1E293B;font-size:1rem;font-weight:700;">📝 Travel Schedule & Budget Journal</h3>
                <button id="btn-tambah-baris-jurnal" style="background:#10B981;color:white;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;display:flex;align-items:center;gap:6px;">
                    ＋ Tambah Baris Aktivitas
                </button>
            </div>

            <div style="overflow-x:auto;border:1px solid #E2E8F0;border-radius:8px;">
                <table id="jurnal-table-main" style="width:100%;border-collapse:collapse;font-size:13px;min-width:960px;">
                    <thead>
                        <tr style="background:#1E293B;color:white;">
                            <th style="padding:12px 10px;font-weight:600;text-align:left;white-space:nowrap;">#</th>
                            <th style="padding:12px 10px;font-weight:600;text-align:left;white-space:nowrap;">Day</th>
                            <th style="padding:12px 10px;font-weight:600;text-align:left;white-space:nowrap;">Time</th>
                            <th style="padding:12px 10px;font-weight:600;text-align:left;">Activity / Destination</th>
                            <th style="padding:12px 10px;font-weight:600;text-align:left;">Category</th>
                            <th style="padding:12px 10px;font-weight:600;text-align:center;white-space:nowrap;">Qty</th>
                            <th style="padding:12px 10px;font-weight:600;text-align:right;white-space:nowrap;">Unit Cost (Rp)</th>
                            <th style="padding:12px 10px;font-weight:600;text-align:right;white-space:nowrap;">/Pax Cost</th>
                            <th style="padding:12px 10px;font-weight:600;text-align:right;white-space:nowrap;">Total Amount</th>
                            <th style="padding:12px 10px;font-weight:600;text-align:left;">Notes</th>
                            <th style="padding:12px 10px;font-weight:600;text-align:center;">Del</th>
                        </tr>
                    </thead>
                    <tbody id="jurnal-modal-table-body"></tbody>
                    <tfoot id="jurnal-tfoot"></tfoot>
                </table>
            </div>
        </div>

        <!-- FOOTER ACTIONS -->
        <div style="background:#F8FAFC;border-top:1px solid #E2E8F0;padding:16px 32px;display:flex;justify-content:space-between;align-items:center;">
            <div style="font-size:12px;color:#94A3B8;">Perubahan akan disimpan ke browser. Klik Simpan untuk mengunci data.</div>
            <div style="display:flex;gap:12px;">
                <button onclick="tutupJurnalFullscreen()" style="background:#E2E8F0;color:#475569;border:none;padding:10px 20px;border-radius:6px;font-weight:600;cursor:pointer;font-size:13px;">✕ Batal</button>
                <button id="btn-simpan-jurnal" style="background:#2F699E;color:white;border:none;padding:10px 20px;border-radius:6px;font-weight:600;cursor:pointer;font-size:13px;">💾 Simpan</button>
                <button id="btn-download-excel-jurnal" style="background:#10B981;color:white;border:none;padding:10px 20px;border-radius:6px;font-weight:600;cursor:pointer;font-size:13px;">📊 Download Excel</button>
            </div>
        </div>
    </div>`;

    document.body.appendChild(overlay);
    renderIsiBarisJurnalModal(key);

    // Tombol tambah baris
    document.getElementById('btn-tambah-baris-jurnal').onclick = function() {
        simpanDataJurnalDariModal(key);
        let db = JSON.parse(localStorage.getItem("itineraryTreeDatabase")) || {};
        db[key].jurnalDetail.push({ day: "DAY 01", time: "00:00", activity: "", category: "Kuliner", qty: 1, unitCost: 0, notes: "" });
        localStorage.setItem("itineraryTreeDatabase", JSON.stringify(db));
        renderIsiBarisJurnalModal(key);
    };

    // Tombol simpan
    document.getElementById('btn-simpan-jurnal').onclick = function() {
        simpanDataJurnalDariModal(key);
        const btn = this;
        btn.innerText = "✅ Tersimpan!";
        btn.style.background = "#10B981";
        setTimeout(() => { btn.innerText = "💾 Simpan"; btn.style.background = "#2F699E"; }, 1800);
        renderItineraryTreePage();
    };

    // Tombol download excel
    document.getElementById('btn-download-excel-jurnal').onclick = function() {
        simpanDataJurnalDariModal(key);
        downloadJurnalKeExcel(key);
    };
}

function tutupJurnalFullscreen() {
    const overlay = document.getElementById('jurnal-fullscreen-overlay');
    if (overlay) overlay.remove();
}

function renderIsiBarisJurnalModal(key) {
    const tbody = document.getElementById('jurnal-modal-table-body');
    const tfoot = document.getElementById('jurnal-tfoot');
    if (!tbody) return;
    tbody.innerHTML = "";

    let dbItinerary = JSON.parse(localStorage.getItem("itineraryTreeDatabase")) || {};
    let jurnalRows = dbItinerary[key]?.jurnalDetail || [];
    let currentPax = dbItinerary[key]?.pax > 0 ? dbItinerary[key].pax : 1;

    const dayOptions  = Array.from({length:14},(_,i)=>`DAY ${String(i+1).padStart(2,'0')}`).map(d=>`<option value="${d}">${d}</option>`).join('');
    const katOptions  = ['Sarana dan Prasarana','Penginapan','Kendaraan','Kuliner','Dokumentasi dan Kesehatan','Wisata dan penunjangnya','Lain-lain'].map(k=>`<option value="${k}">${k}</option>`).join('');

    let grandTotal = 0;
    let grandPax   = 0;

    jurnalRows.forEach((item, index) => {
        const totalAmount = (item.qty || 0) * (item.unitCost || 0);
        const paxCost     = totalAmount / currentPax;  // total amount dibagi pax
        grandTotal += totalAmount;
        grandPax   += paxCost;

        const isEven = index % 2 === 0;
        const tr = document.createElement('tr');
        tr.style.cssText = `background:${isEven ? '#FAFAFA' : 'white'};border-bottom:1px solid #F1F5F9;transition:background 0.15s;`;
        tr.onmouseover = () => tr.style.background = '#EFF6FF';
        tr.onmouseout  = () => tr.style.background = isEven ? '#FAFAFA' : 'white';

        const inputStyle = 'width:100%;padding:6px 8px;border:1px solid transparent;border-radius:4px;font-size:12px;font-family:inherit;background:transparent;outline:none;transition:border-color 0.2s;';
        const selectStyle = 'width:100%;padding:6px 8px;border:1px solid transparent;border-radius:4px;font-size:12px;font-family:inherit;background:transparent;outline:none;cursor:pointer;transition:border-color 0.2s;';

        // Build day select dengan selected value
        const dayOptSel = Array.from({length:14},(_,i)=>{
            const d = `DAY ${String(i+1).padStart(2,'0')}`;
            return `<option value="${d}" ${d===item.day?'selected':''}>${d}</option>`;
        }).join('');
        const katOptSel = ['Sarana dan Prasarana','Penginapan','Kendaraan','Kuliner','Dokumentasi dan Kesehatan','Wisata dan penunjangnya','Lain-lain'].map(k=>`<option value="${k}" ${k===item.category?'selected':''}>${k}</option>`).join('');

        tr.innerHTML = `
            <td style="padding:8px 10px;color:#94A3B8;font-weight:600;text-align:center;font-size:12px;">${index+1}</td>
            <td style="padding:4px 6px;min-width:95px;">
                <select class="jurnal-input-day" style="${selectStyle}">
                    ${dayOptSel}
                </select>
            </td>
            <td style="padding:4px 6px;min-width:85px;">
                <input type="time" class="jurnal-input-time" value="${item.time||'00:00'}" style="${inputStyle}">
            </td>
            <td style="padding:4px 6px;min-width:180px;">
                <input type="text" class="jurnal-input-activity" value="${item.activity||''}" placeholder="Nama aktivitas..." style="${inputStyle}">
            </td>
            <td style="padding:4px 6px;min-width:160px;">
                <select class="jurnal-input-category" style="${selectStyle}">
                    ${katOptSel}
                </select>
            </td>
            <td style="padding:4px 6px;min-width:55px;">
                <input type="number" class="jurnal-input-qty" value="${item.qty||1}" min="1" style="${inputStyle}text-align:center;">
            </td>
            <td style="padding:4px 6px;min-width:110px;">
                <input type="number" class="jurnal-input-cost" value="${item.unitCost||0}" placeholder="0" style="${inputStyle}text-align:right;">
            </td>
            <td style="padding:8px 10px;text-align:right;color:#2F699E;font-weight:600;font-size:12px;white-space:nowrap;" class="jurnal-view-pax">${paxCost.toLocaleString('id-ID',{minimumFractionDigits:0})}</td>
            <td style="padding:8px 10px;text-align:right;color:#1E293B;font-weight:700;font-size:12px;white-space:nowrap;" class="jurnal-view-amount">${totalAmount.toLocaleString('id-ID',{minimumFractionDigits:0})}</td>
            <td style="padding:4px 6px;min-width:120px;">
                <input type="text" class="jurnal-input-notes" value="${item.notes||''}" placeholder="Catatan..." style="${inputStyle}">
            </td>
            <td style="padding:4px 6px;text-align:center;">
                <button type="button" class="btn-hapus-sub-jurnal" data-index="${index}" style="background:#FEE2E2;border:none;color:#EF4444;width:28px;height:28px;border-radius:4px;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;margin:auto;transition:background 0.2s;" onmouseover="this.style.background='#FECACA'" onmouseout="this.style.background='#FEE2E2'">🗑</button>
            </td>
        `;

        // Focus style on inputs/selects
        tr.querySelectorAll('input,select').forEach(el => {
            el.onfocus = () => el.style.borderColor = '#2F699E';
            el.onblur  = () => el.style.borderColor = 'transparent';
        });

        // Live kalkulasi saat Qty / Cost diubah
        const inputQty  = tr.querySelector('.jurnal-input-qty');
        const inputCost = tr.querySelector('.jurnal-input-cost');
        [inputQty, inputCost].forEach(inp => {
            inp.oninput = function() {
                const q = parseFloat(inputQty.value)  || 0;
                const c = parseFloat(inputCost.value) || 0;
                tr.querySelector('.jurnal-view-amount').innerText = (q*c).toLocaleString('id-ID',{minimumFractionDigits:0});
                tr.querySelector('.jurnal-view-pax').innerText    = (q*c/currentPax).toLocaleString('id-ID',{minimumFractionDigits:0});
                hitungGrandTotalJurnal(key);
            };
        });

        tbody.appendChild(tr);
    });

    // Footer total
    if (tfoot) {
        tfoot.innerHTML = `
        <tr style="background:#EFF6FF;border-top:2px solid #2F699E;font-weight:700;">
            <td colspan="7" style="padding:12px 10px;text-align:right;font-size:13px;color:#1E293B;">TOTAL KESELURUHAN</td>
            <td style="padding:12px 10px;text-align:right;font-size:13px;color:#2F699E;" id="jurnal-footer-pax">Rp ${grandPax.toLocaleString('id-ID',{minimumFractionDigits:0})}</td>
            <td style="padding:12px 10px;text-align:right;font-size:13px;color:#10B981;font-size:14px;" id="jurnal-footer-total">Rp ${grandTotal.toLocaleString('id-ID',{minimumFractionDigits:0})}</td>
            <td colspan="2"></td>
        </tr>`;
    }

    // Tombol hapus baris
    tbody.querySelectorAll('.btn-hapus-sub-jurnal').forEach(btn => {
        btn.onclick = function() {
            const idx = parseInt(this.getAttribute('data-index'));
            simpanDataJurnalDariModal(key);
            let db = JSON.parse(localStorage.getItem("itineraryTreeDatabase")) || {};
            db[key].jurnalDetail.splice(idx, 1);
            localStorage.setItem("itineraryTreeDatabase", JSON.stringify(db));
            renderIsiBarisJurnalModal(key);
        };
    });
}

function hitungGrandTotalJurnal(key) {
    let total = 0;
    let dbItinerary = JSON.parse(localStorage.getItem("itineraryTreeDatabase")) || {};
    const currentPax = dbItinerary[key]?.pax > 0 ? dbItinerary[key].pax : 1;

    document.querySelectorAll('#jurnal-modal-table-body tr').forEach(tr => {
        const q = parseFloat(tr.querySelector('.jurnal-input-qty')?.value)  || 0;
        const c = parseFloat(tr.querySelector('.jurnal-input-cost')?.value) || 0;
        total += q * c;
    });

    const elTotal = document.getElementById('jurnal-footer-total');
    const elPax   = document.getElementById('jurnal-footer-pax');
    if (elTotal) elTotal.innerText = 'Rp ' + total.toLocaleString('id-ID',{minimumFractionDigits:0});
    if (elPax)   elPax.innerText   = 'Rp ' + (total/currentPax).toLocaleString('id-ID',{minimumFractionDigits:0});
}

function simpanDataJurnalDariModal(key) {
    let dbItinerary = JSON.parse(localStorage.getItem("itineraryTreeDatabase")) || {};
    const tbody = document.getElementById('jurnal-modal-table-body');
    if (!tbody) return;

    let dataTerupdate = [];
    tbody.querySelectorAll('tr').forEach(tr => {
        dataTerupdate.push({
            day:      tr.querySelector('.jurnal-input-day')?.value      || 'DAY 01',
            time:     tr.querySelector('.jurnal-input-time')?.value     || '00:00',
            activity: tr.querySelector('.jurnal-input-activity')?.value || '',
            category: tr.querySelector('.jurnal-input-category')?.value || '',
            qty:      parseInt(tr.querySelector('.jurnal-input-qty')?.value)      || 0,
            unitCost: parseFloat(tr.querySelector('.jurnal-input-cost')?.value)   || 0,
            notes:    tr.querySelector('.jurnal-input-notes')?.value    || ''
        });
    });

    dbItinerary[key].jurnalDetail = dataTerupdate;
    localStorage.setItem("itineraryTreeDatabase", JSON.stringify(dbItinerary));
}

function downloadJurnalKeExcel(key) {
    let dbItinerary = JSON.parse(localStorage.getItem("itineraryTreeDatabase")) || {};
    const item = dbItinerary[key];

    if (!item || !item.jurnalDetail || item.jurnalDetail.length === 0) {
        alert("Data jurnal kosong. Tambahkan baris aktivitas terlebih dahulu.");
        return;
    }

    const currentPax     = item.pax > 0 ? item.pax : 1;
    const tanggalBersih  = (item.tanggal || key).trim();
    const totalExpenses  = item.totalExpenses || 0;
    const totalBudget    = item.totalBudget   || 0;
    const selisih        = totalBudget - totalExpenses;

    let grandTotal = 0;
    item.jurnalDetail.forEach(jd => { grandTotal += (jd.qty||0) * (jd.unitCost||0); });
    const grandPax = grandTotal / currentPax;

    // Group by Day for schedule rows
    const dayGroups = {};
    item.jurnalDetail.forEach(jd => {
        if (!dayGroups[jd.day]) dayGroups[jd.day] = [];
        dayGroups[jd.day].push(jd);
    });

    let excelTemplate = `
<xml version="1.0">
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
           xmlns:o="urn:schemas-microsoft-com:office:office"
           xmlns:x="urn:schemas-microsoft-com:office:excel"
           xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
           xmlns:html="http://www.w3.org/TR/REC-html40">

<!-- SHEET 1: OVERVIEW -->
<Worksheet ss:Name="Overview">
<Table>
    <Row><Cell ss:MergeAcross="5"><Data ss:Type="String">TRAVELLING OVERVIEW - VERVE ITINERARIES</Data></Cell></Row>
    <Row><Cell><Data ss:Type="String"></Data></Cell></Row>
    <Row>
        <Cell><Data ss:Type="String">Trip Period</Data></Cell>
        <Cell><Data ss:Type="String">${tanggalBersih}</Data></Cell>
    </Row>
    <Row>
        <Cell><Data ss:Type="String">Total Person (Pax)</Data></Cell>
        <Cell><Data ss:Type="Number">${item.pax}</Data></Cell>
        <Cell><Data ss:Type="String">Person</Data></Cell>
    </Row>
    <Row><Cell><Data ss:Type="String"></Data></Cell></Row>
    <Row>
        <Cell><Data ss:Type="String">BUDGET SUMMARY</Data></Cell>
        <Cell><Data ss:Type="String">AMOUNT (Rp)</Data></Cell>
    </Row>
    <Row>
        <Cell><Data ss:Type="String">Total Budget (Planned)</Data></Cell>
        <Cell><Data ss:Type="Number">${totalBudget}</Data></Cell>
    </Row>
    <Row>
        <Cell><Data ss:Type="String">Total Expenses (Actual)</Data></Cell>
        <Cell><Data ss:Type="Number">${totalExpenses}</Data></Cell>
    </Row>
    <Row>
        <Cell><Data ss:Type="String">Selisih (Difference)</Data></Cell>
        <Cell><Data ss:Type="Number">${selisih}</Data></Cell>
    </Row>
    <Row>
        <Cell><Data ss:Type="String">Cost Per Pax</Data></Cell>
        <Cell><Data ss:Type="Number">${Math.round(totalExpenses/currentPax)}</Data></Cell>
    </Row>
</Table>
</Worksheet>

<!-- SHEET 2: TRAVEL SCHEDULE -->
<Worksheet ss:Name="Travel Schedule">
<Table>
    <Row><Cell ss:MergeAcross="4"><Data ss:Type="String">TRAVEL SCHEDULE - ${tanggalBersih}</Data></Cell></Row>
    <Row><Cell><Data ss:Type="String">Total Pax: ${item.pax} Person</Data></Cell></Row>
    <Row><Cell><Data ss:Type="String"></Data></Cell></Row>
    <Row>
        <Cell><Data ss:Type="String">Day Period</Data></Cell>
        <Cell><Data ss:Type="String">Time</Data></Cell>
        <Cell><Data ss:Type="String">Activity / Destination</Data></Cell>
        <Cell><Data ss:Type="String">Category</Data></Cell>
        <Cell><Data ss:Type="String">Notes</Data></Cell>
    </Row>`;

    Object.keys(dayGroups).sort().forEach(day => {
        dayGroups[day].forEach(jd => {
            excelTemplate += `
    <Row>
        <Cell><Data ss:Type="String">${jd.day}</Data></Cell>
        <Cell><Data ss:Type="String">${jd.time||'00:00'}</Data></Cell>
        <Cell><Data ss:Type="String">${jd.activity}</Data></Cell>
        <Cell><Data ss:Type="String">${jd.category}</Data></Cell>
        <Cell><Data ss:Type="String">${jd.notes||''}</Data></Cell>
    </Row>`;
        });
    });

    excelTemplate += `
</Table>
</Worksheet>

<!-- SHEET 3: BUDGET DETAIL -->
<Worksheet ss:Name="Budget Detail">
<Table>
    <Row><Cell ss:MergeAcross="7"><Data ss:Type="String">BUDGET DETAIL - ${tanggalBersih}</Data></Cell></Row>
    <Row><Cell><Data ss:Type="String"></Data></Cell></Row>
    <Row>
        <Cell><Data ss:Type="String">No.</Data></Cell>
        <Cell><Data ss:Type="String">Day</Data></Cell>
        <Cell><Data ss:Type="String">Time</Data></Cell>
        <Cell><Data ss:Type="String">Activity / Destination</Data></Cell>
        <Cell><Data ss:Type="String">Category</Data></Cell>
        <Cell><Data ss:Type="String">Qty</Data></Cell>
        <Cell><Data ss:Type="String">Unit Cost (Rp)</Data></Cell>
        <Cell><Data ss:Type="String">/Pax Cost (Rp)</Data></Cell>
        <Cell><Data ss:Type="String">Total Amount (Rp)</Data></Cell>
        <Cell><Data ss:Type="String">Notes</Data></Cell>
    </Row>`;

    item.jurnalDetail.forEach((jd, i) => {
        const amt     = (jd.qty||0) * (jd.unitCost||0);
        const paxCost = ((jd.qty||0) * (jd.unitCost||0)) / currentPax;  // total amount / pax
        excelTemplate += `
    <Row>
        <Cell><Data ss:Type="Number">${i+1}</Data></Cell>
        <Cell><Data ss:Type="String">${jd.day}</Data></Cell>
        <Cell><Data ss:Type="String">${jd.time||'00:00'}</Data></Cell>
        <Cell><Data ss:Type="String">${jd.activity}</Data></Cell>
        <Cell><Data ss:Type="String">${jd.category}</Data></Cell>
        <Cell><Data ss:Type="Number">${jd.qty||0}</Data></Cell>
        <Cell><Data ss:Type="Number">${jd.unitCost||0}</Data></Cell>
        <Cell><Data ss:Type="Number">${paxCost}</Data></Cell>
        <Cell><Data ss:Type="Number">${amt}</Data></Cell>
        <Cell><Data ss:Type="String">${jd.notes||''}</Data></Cell>
    </Row>`;
    });

    excelTemplate += `
    <Row><Cell><Data ss:Type="String"></Data></Cell></Row>
    <Row>
        <Cell ss:MergeAcross="6"><Data ss:Type="String">TOTAL</Data></Cell>
        <Cell><Data ss:Type="Number">${grandPax}</Data></Cell>
        <Cell><Data ss:Type="Number">${grandTotal}</Data></Cell>
    </Row>
</Table>
</Worksheet>
</Workbook>`;

    const fileName = `Itinerary_${tanggalBersih.replace(/\s+/g,'_').replace(/[\/]/g,'-')}.xls`;
    const blob     = new Blob([excelTemplate], { type: "application/vnd.ms-excel" });
    const url      = URL.createObjectURL(blob);
    const a        = document.createElement("a");
    a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
}

// Fungsi Hapus baris riwayat tertentu
function hapusItemTree(key) {
    if (confirm(`Hapus riwayat ringkasan untuk tanggal ${key}?`)) {
        let dbItinerary = JSON.parse(localStorage.getItem("itineraryTreeDatabase")) || {};
        delete dbItinerary[key];
        localStorage.setItem("itineraryTreeDatabase", JSON.stringify(dbItinerary));
        renderItineraryTreePage();
    }
}

// Fungsi reset total database riwayat
function bersihkanSemuaTree() {
    showConfirmHapus({
        judul: "Reset Semua Data?",
        pesan: "Kamu yakin mau menghapus <b>seluruh log riwayat</b> di Itinerary Tree? Semua data akan hilang dan tidak bisa dikembalikan.",
        onConfirm: () => {
            localStorage.removeItem("itineraryTreeDatabase");
            renderItineraryTreePage();
        }
    });
}
