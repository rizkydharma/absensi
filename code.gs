const SPREADSHEET_ID = "REPLACE_WITH_SPREADSHEET_ID";

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

const COLUMNS = {
  TANGGAL: 1,
  NAMA: 2,
  ID: 3,
  STORE: 4,
  STATUS: 5,
  GAJI: 6,
  KETERANGAN: 7,
  STATUS_GAJI: 8,
  JAM_DATANG: 9,
  JAM_PULANG: 10,
  LOCATE: 11,
  RADIUS: 12,
  DEVICE: 13
};

function doGet(e) {
  return buildResponse(true, "Google Apps Script Web App siap.");
}

function doPost(e) {
  const request = parseRequest(e);
  if (!request || !request.action) {
    return buildResponse(false, "Permintaan tidak valid.");
  }

  if (request.action === "LOGIN") {
    return handleLogin(request);
  }

  if (request.action === "ABSENSI") {
    return handleAbsensi(request);
  }

  return buildResponse(false, "Aksi tidak dikenali.");
}

function parseRequest(e) {
  try {
    return JSON.parse(e.postData.contents);
  } catch (error) {
    return null;
  }
}

function handleLogin(request) {
  const id = String(request.id || "").trim();
  const pin = String(request.pin || "").trim();

  if (!id || !pin) {
    return buildResponse(false, "ID dan PIN harus diisi.");
  }

  const user = findUserByIdPin(id, pin);
  if (!user) {
    return buildResponse(false, "ID atau PIN salah.");
  }

  const attendanceRecord = findAttendanceRecord(id, getTodayString());
  const attendanceStatus = attendanceRecord ? getAttendanceStatus(attendanceRecord) : "Belum Absen";

  return buildResponse(true, "Login berhasil.", {
    user,
    attendanceStatus
  });
}

function handleAbsensi(request) {
  const id = String(request.id || "").trim();
  const pin = String(request.pin || "").trim();
  const jenisAbsen = String(request.jenis_absen || "").toUpperCase().trim();
  const storeAktif = String(request.store_aktif || "").trim();
  const latitude = parseFloat(request.latitude);
  const longitude = parseFloat(request.longitude);
  const device = String(request.device || "").trim();
  const waktu = String(request.waktu || "").trim();

  if (!id || !pin || !jenisAbsen || !storeAktif || isNaN(latitude) || isNaN(longitude) || !waktu) {
    return buildResponse(false, "Data absensi tidak lengkap.");
  }

  const user = findUserByIdPin(id, pin);
  if (!user) {
    return buildResponse(false, "ID atau PIN tidak valid.");
  }

  const storeKey = Object.keys(STORES).find((key) => STORES[key].name === storeAktif);
  if (!storeKey) {
    return buildResponse(false, "Store aktif tidak valid.");
  }

  const store = STORES[storeKey];
  const distance = calculateDistance(latitude, longitude, store.lat, store.lng);
  if (distance > store.radius) {
    return buildResponse(false, "Anda berada di luar area absensi");
  }

  const sheet = getSpreadsheet().getSheetByName("ABSENSI");
  if (!sheet) {
    return buildResponse(false, "Sheet ABSENSI tidak ditemukan.");
  }

  const today = getTodayString();
  const rowIndex = findAttendanceRow(sheet, today, id);
  if (!rowIndex) {
    return buildResponse(false, "Data absensi hari ini tidak ditemukan. Hubungi admin.");
  }

  const rowValues = sheet.getRange(rowIndex, 1, 1, COLUMNS.DEVICE).getValues()[0];
  const jamDatangValue = String(rowValues[COLUMNS.JAM_DATANG - 1] || "").trim();
  const jamPulangValue = String(rowValues[COLUMNS.JAM_PULANG - 1] || "").trim();

  const locateUrl = `https://maps.google.com/?q=${latitude},${longitude}`;

  if (jenisAbsen === "MASUK") {
    if (jamDatangValue) {
      return buildResponse(false, "Anda sudah absen masuk hari ini");
    }

    sheet.getRange(rowIndex, COLUMNS.STORE).setValue(store.name);
    sheet.getRange(rowIndex, COLUMNS.STATUS).setValue("MASUK");
    sheet.getRange(rowIndex, COLUMNS.JAM_DATANG).setValue(waktu);
    sheet.getRange(rowIndex, COLUMNS.LOCATE).setValue(locateUrl);
    sheet.getRange(rowIndex, COLUMNS.RADIUS).setValue(Math.round(distance));
    sheet.getRange(rowIndex, COLUMNS.DEVICE).setValue(device);

    return buildResponse(true, "Absensi berhasil");
  }

  if (jenisAbsen === "PULANG") {
    if (jamPulangValue) {
      return buildResponse(false, "Anda sudah absen pulang hari ini");
    }

    sheet.getRange(rowIndex, COLUMNS.STORE).setValue(store.name);
    sheet.getRange(rowIndex, COLUMNS.JAM_PULANG).setValue(waktu);
    sheet.getRange(rowIndex, COLUMNS.LOCATE).setValue(locateUrl);
    sheet.getRange(rowIndex, COLUMNS.RADIUS).setValue(Math.round(distance));
    sheet.getRange(rowIndex, COLUMNS.DEVICE).setValue(device);

    return buildResponse(true, "Absensi berhasil");
  }

  return buildResponse(false, "Jenis absensi tidak valid.");
}

function findUserByIdPin(id, pin) {
  const sheet = getSpreadsheet().getSheetByName("DAFTAR_KARYAWAN");
  if (!sheet) {
    throw new Error("Sheet DAFTAR_KARYAWAN tidak ditemukan.");
  }

  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  const idIndex = headers.indexOf("ID");
  const pinIndex = headers.indexOf("PIN");

  if (idIndex < 0 || pinIndex < 0) {
    throw new Error("Kolom ID atau PIN tidak ditemukan di sheet DAFTAR_KARYAWAN.");
  }

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (String(row[idIndex]).trim() === id && String(row[pinIndex]).trim() === pin) {
      const user = {};
      headers.forEach((header, index) => {
        user[header] = row[index];
      });
      return user;
    }
  }

  return null;
}

function findAttendanceRow(sheet, tanggal, id) {
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  const tanggalIndex = headers.indexOf("TANGGAL");
  const idIndex = headers.indexOf("ID");

  if (tanggalIndex < 0 || idIndex < 0) {
    throw new Error("Kolom TANGGAL atau ID tidak ditemukan di sheet ABSENSI.");
  }

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (normalizeDateValue(row[tanggalIndex]) === tanggal && String(row[idIndex]).trim() === id) {
      return i + 2;
    }
  }

  return null;
}

function findAttendanceRecord(id, tanggal) {
  const sheet = getSpreadsheet().getSheetByName("ABSENSI");
  if (!sheet) {
    return null;
  }

  const rowIndex = findAttendanceRow(sheet, tanggal, id);
  if (!rowIndex) {
    return null;
  }

  return sheet.getRange(rowIndex, 1, 1, COLUMNS.DEVICE).getValues()[0];
}

function getAttendanceStatus(rowValues) {
  const jamDatang = String(rowValues[COLUMNS.JAM_DATANG - 1] || "").trim();
  const jamPulang = String(rowValues[COLUMNS.JAM_PULANG - 1] || "").trim();

  if (jamPulang) {
    return "Sudah Pulang";
  }
  if (jamDatang) {
    return "Sudah Masuk";
  }
  return "Belum Absen";
}

function getTodayString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDateValue(value) {
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  if (typeof value === "number") {
    return normalizeDateValue(new Date(value));
  }

  return String(value || "").trim();
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const toRad = function (value) {
    return (value * Math.PI) / 180;
  };

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

function getSpreadsheet() {
  if (!SPREADSHEET_ID || SPREADSHEET_ID.indexOf("REPLACE_WITH") !== -1) {
    throw new Error("SPREADSHEET_ID belum dikonfigurasi.");
  }
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function buildResponse(success, message, data) {
  const response = {
    success,
    message
  };
  if (data) {
    Object.assign(response, data);
  }
  return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);
}
