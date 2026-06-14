// Konfigurasi endpoint Google Apps Script Web App.
const GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbwxQ54Wu6AmrKkNct-k9F2C2F-YAelb3HWJjKci37ZTG796R2H2F86bZnpN9hc6gBZG/exec";
const STORAGE_KEY = "employee";

// Hardcoded outlet untuk validasi GPS di frontend.
const STORES = {
  RZ01: {
    name: "COOLER CITY",
    lat: -7.97521191086531,
    lng: 112.61983167177651,
    radius: 100
  },
  RZ02: {
    name: "GOMEE MITRA",
    lat: -7.983929066558858,
    lng: 112.63170717993525,
    radius: 100
  },
  RZ03: {
    name: "PRODUKSI",
    lat: -7.97521191086531,
    lng: 112.61983167177651,
    radius: 100
  }
};

// Elemen DOM utama untuk login dan dashboard.
const loginCard = document.getElementById("login-card");
const attendanceCard = document.getElementById("attendance-card");
const toastElement = document.getElementById("toast");
const loadingOverlay = document.getElementById("loading-overlay");
const employeeNameField = document.getElementById("employee-name");
const employeeJobField = document.getElementById("employee-job");
const employeeIdValue = document.getElementById("employee-id-value");
const employeeDefaultStoreField = document.getElementById("employee-default-store");
const employeeActiveStoreField = document.getElementById("employee-active-store");
const attendanceStatusField = document.getElementById("attendance-status");
const storeSelect = document.getElementById("store-select");
const loginButton = document.getElementById("login-button");
const logoutButton = document.getElementById("logout-button");
const checkInButton = document.getElementById("check-in-button");
const checkOutButton = document.getElementById("check-out-button");

let currentUser = null;

// Inisialisasi aplikasi ketika DOM selesai dimuat.
document.addEventListener("DOMContentLoaded", () => {
  populateStoreDropdown();
  setupEventListeners();
  restoreSession();
});

window.addEventListener("load", () => {
  registerServiceWorker();
});

// Isi dropdown outlet dari daftar STORES.
function populateStoreDropdown() {
  Object.keys(STORES).forEach((storeKey) => {
    const option = document.createElement("option");
    option.value = storeKey;
    option.textContent = STORES[storeKey].name;
    storeSelect.appendChild(option);
  });
}

// Pasang event listener untuk form dan tombol.
function setupEventListeners() {
  loginButton.addEventListener("click", loginUser);
  logoutButton.addEventListener("click", logoutUser);
  checkInButton.addEventListener("click", () => handleAttendance("MASUK"));
  checkOutButton.addEventListener("click", () => handleAttendance("PULANG"));
  storeSelect.addEventListener("change", () => {
    const selected = STORES[storeSelect.value];
    employeeActiveStoreField.textContent = selected ? selected.name : "-";
  });
}

// Coba restore session jika data employee tersimpan di localStorage.
function restoreSession() {
  const savedEmployee = getSavedEmployee();
  if (!savedEmployee) {
    return;
  }

  currentUser = savedEmployee;
  prepareAttendanceView(currentUser);
  refreshSession();
}

function getSavedEmployee() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

// Menyimpan sesi login ke localStorage.
function saveSession(employee) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(employee));
}

// Hapus session dan kembali ke halaman login.
function logoutUser() {
  localStorage.removeItem(STORAGE_KEY);
  currentUser = null;
  window.location.reload();
}

// Validasi login dan ambil data karyawan dari backend.
function loginUser() {
  const id = document.getElementById("employee-id").value.trim();
  const pin = document.getElementById("employee-pin").value.trim();

  if (!id || !pin) {
    showToast("Isi ID dan PIN terlebih dahulu.", false);
    return;
  }

  if (!GAS_ENDPOINT || GAS_ENDPOINT.includes("AKfycbwxQ54Wu6AmrKkNct-k9F2C2F-YAelb3HWJjKci37ZTG796R2H2F86bZnpN9hc6gBZG")) {
    showToast("GAS_ENDPOINT belum dikonfigurasi.", false);
    return;
  }

  setLoading(true, "Memeriksa login...");

  fetch(GAS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ action: "LOGIN", id, pin })
  })
    .then((response) => response.json())
    .then((data) => {
      if (!data.success) {
        showToast(data.message || "Login gagal. Periksa ID dan PIN.", false);
        return;
      }

      currentUser = {
        ...data.user,
        attendanceStatus: data.attendanceStatus || "Belum Absen"
      };
      saveSession(currentUser);
      prepareAttendanceView(currentUser);
      showToast("Login berhasil.");
    })
    .catch((error) => {
      console.error(error);
      showToast("Tidak dapat menghubungi server. Coba lagi nanti.", false);
    })
    .finally(() => setLoading(false));
}

// Refresh session untuk memperbarui status absensi di dashboard.
function refreshSession() {
  if (!currentUser || !currentUser.ID || !currentUser.PIN) {
    return;
  }

  if (!GAS_ENDPOINT || GAS_ENDPOINT.includes("AKfycbwxQ54Wu6AmrKkNct-k9F2C2F-YAelb3HWJjKci37ZTG796R2H2F86bZnpN9hc6gBZG")) {
    showToast("GAS_ENDPOINT belum dikonfigurasi.", false);
    return;
  }

  fetch(GAS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ action: "LOGIN", id: currentUser.ID, pin: currentUser.PIN })
  })
    .then((response) => response.json())
    .then((data) => {
      if (!data.success) {
        localStorage.removeItem(STORAGE_KEY);
        window.location.reload();
        return;
      }

      currentUser = {
        ...data.user,
        attendanceStatus: data.attendanceStatus || "Belum Absen"
      };
      saveSession(currentUser);
      prepareAttendanceView(currentUser);
    })
    .catch((error) => {
      console.warn("Refresh session gagal", error);
    });
}

// Tampilkan dashboard setelah login berhasil.
function prepareAttendanceView(user) {
  employeeNameField.textContent = user.NAMA || "Nama Karyawan";
  employeeJobField.textContent = user.JABATAN || "Jabatan tidak tersedia";
  employeeIdValue.textContent = user.ID || "-";
  employeeDefaultStoreField.textContent = user["NAME STORE"] || "-";
  attendanceStatusField.textContent = user.attendanceStatus || "Belum Absen";

  const defaultStoreKey = Object.keys(STORES).find(
    (key) => STORES[key].name === user["NAME STORE"]
  );

  if (defaultStoreKey) {
    storeSelect.value = defaultStoreKey;
  }

  employeeActiveStoreField.textContent = storeSelect.value ? STORES[storeSelect.value].name : "-";
  loginCard.classList.add("hidden");
  attendanceCard.classList.remove("hidden");
}

// Tangani request absensi masuk atau pulang.
function handleAttendance(jenisAbsen) {
  if (!currentUser || !currentUser.ID) {
    showToast("Lakukan login terlebih dahulu.", false);
    return;
  }

  const selectedStoreKey = storeSelect.value;
  if (!selectedStoreKey) {
    showToast("Pilih lokasi kerja terlebih dahulu", false);
    return;
  }

  const store = STORES[selectedStoreKey];
  if (!store) {
    showToast("Lokasi kerja tidak valid.", false);
    return;
  }

  if (!navigator.geolocation) {
    showToast("Geolocation tidak didukung di browser ini.", false);
    return;
  }

  setLoading(true, "Mengambil lokasi...");

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;
      const distance = haversineDistance(latitude, longitude, store.lat, store.lng);
      const distanceText = `Jarak ke ${store.name}: ${Math.round(distance)} m / radius ${store.radius} m.`;
      setStatus(distanceText, distance <= store.radius);

      const payload = {
        action: "ABSENSI",
        id: currentUser.ID,
        pin: currentUser.PIN,
        store_aktif: store.name,
        jenis_absen: jenisAbsen,
        latitude,
        longitude,
        radius_hasil: Math.round(distance),
        device: navigator.userAgent || "Tidak diketahui",
        waktu: new Date().toISOString()
      };

      sendAttendance(payload);
    },
    (error) => {
      console.error(error);
      showToast("Gagal mengambil lokasi. Pastikan izin lokasi diberikan.", false);
      setLoading(false);
    },
    {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 10000
    }
  );
}

// Kirim data absensi ke backend dan tampilkan hasil.
function sendAttendance(payload) {
  if (!GAS_ENDPOINT || GAS_ENDPOINT.includes("AKfycbwxQ54Wu6AmrKkNct-k9F2C2F-YAelb3HWJjKci37ZTG796R2H2F86bZnpN9hc6gBZG")) {
    showToast("GAS_ENDPOINT belum dikonfigurasi.", false);
    setLoading(false);
    return;
  }

  fetch(GAS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  })
    .then((response) => response.json())
    .then((data) => {
      if (!data.success) {
        showToast(data.message || "Absensi gagal, coba lagi.", false);
        return;
      }

      showToast(data.message || "Absensi berhasil.");
      attendanceStatusField.textContent = payload.jenis_absen === "MASUK" ? "Sudah Masuk" : "Sudah Pulang";
    })
    .catch((error) => {
      console.error(error);
      showToast("Terjadi kesalahan saat mengirim data.", false);
    })
    .finally(() => setLoading(false));
}

// Tampilkan status pesan di dashboard.
function setStatus(text, success = true) {
  const messageContainer = document.getElementById("status-message");
  if (messageContainer) {
    messageContainer.textContent = text;
    messageContainer.classList.toggle("error", !success);
  }
}

// Tampilkan toast notification.
function showToast(message, success = true) {
  toastElement.textContent = message;
  toastElement.classList.toggle("error", !success);
  toastElement.classList.remove("hidden");

  window.clearTimeout(toastElement.timeoutId);
  toastElement.timeoutId = window.setTimeout(() => {
    toastElement.classList.add("hidden");
  }, 3500);
}

// Nonaktifkan dan aktifkan tombol saat proses berlangsung.
function setLoading(isLoading, message) {
  loadingOverlay.classList.toggle("hidden", !isLoading);
  loginButton.disabled = isLoading;
  logoutButton.disabled = isLoading;
  checkInButton.disabled = isLoading;
  checkOutButton.disabled = isLoading;

  if (message) {
    setStatus(message, true);
  }
}

// Haversine untuk menghitung jarak antara dua titik GPS.
function haversineDistance(lat1, lon1, lat2, lon2) {
  const toRad = (value) => (value * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Daftarkan service worker untuk dukungan PWA.
function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("sw.js")
      .then(() => console.log("Service worker terdaftar."))
      .catch((error) => console.warn("Gagal mendaftar service worker", error));
  }
}
