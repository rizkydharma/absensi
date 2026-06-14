const SPREADSHEET_ID = "REPLACE_WITH_SPREADSHEET_ID";

const STORES = {
  RZ01: {
    name: "COOLER CITY",
    lat: -7.97521191086531,
    lng: 112.61983167177651,
    radius: 1000000
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
  DEVICE: 13,
  MENIT_TELAT: 14,
  ALASAN_TELAT: 15
};

function doGet(e) {
  return buildResponse(true, "Google Apps Script Web App siap.");
}

function doPost(e) {
  // Log parameter and raw postData for debugging (helps identify how the browser sent the form)
  try {
    Logger.log('PARAMETER:' + JSON.stringify(e.parameter));
    console.log('PARAMETER:' + JSON.stringify(e.parameter));
  } catch (err) {
    Logger.log('PARAMETER: <unserializable>');
    console.log('PARAMETER: <unserializable>');
  }
  try {
    Logger.log('POSTDATA_TYPE:' + (e.postData && e.postData.type));
    console.log('POSTDATA_TYPE:' + (e.postData && e.postData.type));
    Logger.log('POSTDATA_CONTENTS:' + (e.postData && String(e.postData.contents)));
    console.log('POSTDATA_CONTENTS:' + (e.postData && String(e.postData.contents)));
  } catch (err) {
    Logger.log('POSTDATA: <unserializable>');
    console.log('POSTDATA: <unserializable>');
  }

  const request = parseRequest(e);
  try {
    Logger.log('PARSED_REQUEST:' + JSON.stringify(request));
    console.log('PARSED_REQUEST:' + JSON.stringify(request));
  } catch (err) {
    Logger.log('PARSED_REQUEST: <unserializable>');
    console.log('PARSED_REQUEST: <unserializable>');
  }

  if (!request || !request.action) {
    const debugInfo = {
      parameterKeys: e.parameter ? Object.keys(e.parameter) : [],
      parametersKeys: e.parameters ? Object.keys(e.parameters) : [],
      postDataType: e.postData && e.postData.type ? e.postData.type : null,
      postDataLength: e.postData && e.postData.contents ? String(e.postData.contents).length : 0,
      postDataSample: e.postData && e.postData.contents ? String(e.postData.contents).slice(0, 200) : null,
      parsedRequest: request || null
    };
    return buildResponse(false, "Permintaan tidak valid.", { debug: debugInfo });
  }

  if (request.action === "LOGIN") {
    return handleLogin(request);
  }

  if (request.action === "ABSENSI") {
    return handleAbsensi(request);
  }

  return buildResponse(false, "Aksi tidak dikenali.");
}

/**
 * Parse request from different content types.
 * Supports:
 * - e.parameter (form fields parsed by Apps Script)
 * - application/x-www-form-urlencoded in e.postData.contents
 * - JSON body in e.postData.contents
 * - basic multipart/form-data parsing (best-effort)
 */
function parseRequest(e) {
  // 1) Prefer parsed parameters if available
  if (e.parameter && Object.keys(e.parameter).length > 0) {
    return e.parameter;
  }

  // 2) If postData exists, inspect contents
  if (e.postData && e.postData.contents) {
    var contents = e.postData.contents;

    // Try JSON first
    try {
      var parsedJson = JSON.parse(contents);
      return parsedJson;
    } catch (err) {
      // not JSON
    }

    // Try URL-encoded form like: a=1&b=2
    try {
      var obj = {};
      contents.split('&').forEach(function (pair) {
        if (!pair) return;
        var parts = pair.split('=');
        var key = decodeURIComponent(parts[0] || '').trim();
        var val = decodeURIComponent(parts[1] || '').trim();
        if (key) obj[key] = val;
      });
      if (Object.keys(obj).length > 0) return obj;
    } catch (err) {
      // ignore
    }

    // Try a simple multipart/form-data parse (best-effort, extracts text fields)
    try {
      var mp = String(contents);
      var boundary = null;
      if (typeof e.postData.type === 'string') {
        var match = e.postData.type.match(/boundary=(.*)$/);
        if (match) {
          boundary = match[1];
        }
      }

      if (boundary) {
        var parts = mp.split('--' + boundary);
        var out = {};
        parts.forEach(function (part) {
          if (!part || part === '--' || part.trim() === '') return;
          var headerBodySplit = part.split('\r\n\r\n');
          if (headerBodySplit.length < 2) return;
          var header = headerBodySplit[0];
          var body = headerBodySplit.slice(1).join('\r\n\r\n');
          var nameMatch = header.match(/name="([^"]+)"/);
          if (!nameMatch) return;
          var key = nameMatch[1];
          var value = body.replace(/\r?\n$/, '').replace(/\r?\n--$/, '').trim();
          out[key] = value;
        });
        if (Object.keys(out).length > 0) return out;
      }

      var re = /name="([^"]+)"[\s\S]*?\r?\n\r?\n([\s\S]*?)(?=\r?\n--|$)/g;
      var m;
      var out = {};
      while ((m = re.exec(mp)) !== null) {
        var k = m[1];
        var v = m[2];
        v = v.replace(/\r?\n$/, '');
        out[k] = v;
      }
      if (Object.keys(out).length > 0) return out;
    } catch (err) {
      // ignore
    }
  }

  // Nothing matched
  return null;
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
    user: sanitizeUser(user),
    attendanceStatus
  });
}

function sanitizeUser(user) {
  if (!user || typeof user !== 'object') return user;
  const allowedKeys = ["ID", "NAMA", "JABATAN", "NAME STORE", "DEFAULT_STORE"];
  const cleanUser = {};
  allowedKeys.forEach(function (key) {
    if (user.hasOwnProperty(key)) {
      cleanUser[key] = user[key];
    }
  });
  return cleanUser;
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
  const alasanTelat = String(request.alasan_telat || "").trim();

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
  let rowIndex = findAttendanceRow(sheet, today, id);
  const existingRow = rowIndex ? sheet.getRange(rowIndex, 1, 1, COLUMNS.ALASAN_TELAT).getValues()[0] : null;
  const existingStatusGaji = existingRow ? existingRow[COLUMNS.STATUS_GAJI - 1] : "";
  const existingGaji = existingRow ? existingRow[COLUMNS.GAJI - 1] : "";
  const gajiValue = user.GAJI || existingGaji || "";
  const statusGajiValue = existingStatusGaji || user["STATUS GAJI"] || "";
  const locateUrl = `https://maps.google.com/?q=${latitude},${longitude}`;
  const employeeName = user.NAMA || id;
  const defaultRow = [
    today,
    user.NAMA || "",
    id,
    store.name,
    "",
    gajiValue,
    "",
    statusGajiValue,
    "",
    "",
    locateUrl,
    Math.round(distance),
    device,
    0,
    ""
  ];

  function saveRow(values) {
    if (rowIndex) {
      sheet.getRange(rowIndex, 1, 1, values.length).setValues([values]);
    } else {
      sheet.appendRow(values);
      rowIndex = sheet.getLastRow();
    }
  }

  if (jenisAbsen === "MASUK") {
    const hasilWaktu = getJakartaDateTime(waktu);
    const totalMinutes = hasilWaktu.hour * 60 + hasilWaktu.minute;
    const mulaiKerja = 10 * 60;
    const batasTepatWaktu = 10 * 60 + 5;

    let keterangan = "";
    let menitTelat = 0;
    let alasanTelatValue = "";
    let responseMessage = "Absensi berhasil.";

    if (totalMinutes < mulaiKerja) {
      const earlyMinutes = mulaiKerja - totalMinutes;
      keterangan = `Datang lebih awal ${earlyMinutes} menit`;
      responseMessage = `Hai ${employeeName}\n\nSelamat pagi.\n\nTerima kasih sudah datang lebih awal ${earlyMinutes} menit.\n\nSelamat bekerja dan semoga harimu menyenangkan.`;
    } else if (totalMinutes <= batasTepatWaktu) {
      keterangan = "Tepat waktu";
      responseMessage = `Hai ${employeeName}\n\nSelamat pagi.\n\nTerima kasih sudah datang bekerja tepat waktu.\n\nSelamat bekerja.`;
    } else {
      const lateMinutes = totalMinutes - mulaiKerja;
      if (!alasanTelat) {
        return buildResponse(false, "Alasan keterlambatan wajib diisi.");
      }
      keterangan = "Terlambat";
      menitTelat = lateMinutes;
      alasanTelatValue = alasanTelat;
      responseMessage = `Hai ${employeeName}\n\nSelamat pagi.\n\nAnda terlambat ${lateMinutes} menit.\n\nTerima kasih telah mengisi alasan keterlambatan.\n\nSelamat bekerja.`;
    }

    const row = defaultRow.slice();
    row[COLUMNS.STATUS - 1] = "MASUK";
    row[COLUMNS.KETERANGAN - 1] = keterangan;
    row[COLUMNS.JAM_DATANG - 1] = waktu;
    row[COLUMNS.LOCATE - 1] = locateUrl;
    row[COLUMNS.RADIUS - 1] = Math.round(distance);
    row[COLUMNS.DEVICE - 1] = device;
    row[COLUMNS.MENIT_TELAT - 1] = menitTelat;
    row[COLUMNS.ALASAN_TELAT - 1] = alasanTelatValue;

    saveRow(row);
    return buildResponse(true, responseMessage);
  }

  if (jenisAbsen === "PULANG") {
    if (!rowIndex) {
      return buildResponse(false, "Data absensi hari ini tidak ditemukan. Hubungi admin.");
    }

    const hasilWaktu = getJakartaDateTime(waktu);
    const totalMinutes = hasilWaktu.hour * 60 + hasilWaktu.minute;
    const waktuPulang = 19 * 60 + 45;

    if (totalMinutes < waktuPulang) {
      return buildResponse(false, "Jam pulang belum tersedia. Absensi pulang dapat dilakukan mulai pukul 19:45 WIB.");
    }

    const row = defaultRow.slice();
    row[COLUMNS.STATUS - 1] = "PULANG";
    row[COLUMNS.KETERANGAN - 1] = existingRow ? existingRow[COLUMNS.KETERANGAN - 1] : "";
    row[COLUMNS.JAM_DATANG - 1] = existingRow ? existingRow[COLUMNS.JAM_DATANG - 1] : "";
    row[COLUMNS.JAM_PULANG - 1] = waktu;
    row[COLUMNS.MENIT_TELAT - 1] = existingRow ? existingRow[COLUMNS.MENIT_TELAT - 1] : 0;
    row[COLUMNS.ALASAN_TELAT - 1] = existingRow ? existingRow[COLUMNS.ALASAN_TELAT - 1] : "";

    saveRow(row);
    return buildResponse(true, `Hai ${employeeName}\n\nTerima kasih atas kerja kerasnya hari ini.\n\nHati-hati di jalan dan selamat beristirahat.`);
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

function getJakartaDateTime(isoString) {
  const date = new Date(isoString);
  const hour = parseInt(Utilities.formatDate(date, "Asia/Jakarta", "HH"), 10);
  const minute = parseInt(Utilities.formatDate(date, "Asia/Jakarta", "mm"), 10);
  return { hour, minute };
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
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader("Access-Control-Allow-Origin", "*");
}
