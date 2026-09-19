/**
 * سامانه مدیریت اتوماسیون و ارتباطات - هسته پردازش منطق، دیتابیس و ارتباط با سخت‌افزار
 * سازگار با Cloudflare Pages، PWA و کارکرد ۱۰۰٪ آفلاین (Offline-First)
 */

// ==========================================
// ۱. تبدیل تاریخ میلادی به هجری شمسی (Jalali)
// ==========================================
function gregorianToJalali(gy, gm, gd) {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = (gy <= 1600) ? 0 : 979;
  gy -= (gy <= 1600) ? 621 : 1600;
  const gy2 = (gm > 2) ? (gy + 1) : gy;
  let days = (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) - 80 + gd + g_d_m[gm - 1];
  jy += 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  jy += Math.floor((days - 1) / 365);
  if (days > 0) days = (days - 1) % 365;
  const jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
  return { jy, jm, jd };
}

function getFormattedJalali(date = new Date()) {
  const { jy, jm, jd } = gregorianToJalali(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const pad = (n) => String(n).padStart(2, '0');
  const daysOfWeek = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'];
  const months = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
  const dayName = daysOfWeek[date.getDay()];
  const monthName = months[jm - 1];
  const timeStr = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  const dateNumStr = `${jy}/${pad(jm)}/${pad(jd)}`;
  const fullPersian = `${dayName}، ${jd} ${monthName} ${jy} - ساعت ${timeStr.slice(0, 5)}`;
  return { jy, jm, jd, dateNumStr, timeStr, fullPersian };
}

// ==========================================
// ۲. مدیریت دیتابیس محلی (IndexedDB)
// ==========================================
const DB_NAME = 'AutomationGraphDB';
const DB_VERSION = 2;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e) => {
      const db = request.result;
      if (!db.objectStoreNames.contains('graphs')) {
        const store = db.createObjectStore('graphs', { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('syncStatus', 'syncStatus', { unique: false });
        store.createIndex('unit', 'operator.unit', { unique: false });
        store.createIndex('activityType', 'activityType', { unique: false });
      }
      if (!db.objectStoreNames.contains('admins')) {
        const adminStore = db.createObjectStore('admins', { keyPath: 'username' });
        adminStore.createIndex('username', 'username', { unique: true });
      }
    };
  });
}

async function saveGraphRecord(record) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('graphs', 'readwrite');
    const store = tx.objectStore('graphs');
    const req = store.add(record);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getAllGraphRecords() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('graphs', 'readonly');
    const store = tx.objectStore('graphs');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function deleteGraphRecord(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('graphs', 'readwrite');
    const store = tx.objectStore('graphs');
    const req = store.delete(Number(id));
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function updateGraphRecord(record) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('graphs', 'readwrite');
    const store = tx.objectStore('graphs');
    const req = store.put(record);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getAdminsList() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('admins', 'readonly');
    const store = tx.objectStore('admins');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function saveAdminUser(admin) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('admins', 'readwrite');
    const store = tx.objectStore('admins');
    const req = store.put(admin);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function deleteAdminUser(username) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('admins', 'readwrite');
    const store = tx.objectStore('admins');
    const req = store.delete(username);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ==========================================
// ۳. وضعیت برنامه و متغیرهای سراسری
// ==========================================
window.AppState = {
  currentView: 'home',
  currentUser: null,
  operator: null,
  capturedImageBase64: null,
  currentLocation: { lat: null, lng: null, accuracy: null, timestamp: null },
  colleagues: [],
  deferredPrompt: null,
  selectedQrTargetField: null,
  activeCameraStream: null,
};

function loadOperatorProfile() {
  try {
    const stored = localStorage.getItem('automation_operator_profile');
    if (stored) {
      window.AppState.operator = JSON.parse(stored);
    }
  } catch (e) {
    console.error('Error loading operator profile', e);
  }
  updateOperatorSummaryUI();
}

function updateOperatorSummaryUI() {
  const container = document.getElementById('operatorSummaryContainer');
  const alertBox = document.getElementById('operatorMissingAlert');
  const op = window.AppState.operator;

  if (op && op.firstName && op.lastName && op.personnelId) {
    if (alertBox) alertBox.classList.add('hidden');
    if (container) {
      container.classList.remove('hidden');
      document.getElementById('opFullName').textContent = `${op.firstName} ${op.lastName}`;
      document.getElementById('opPersonnelId').textContent = op.personnelId;
      document.getElementById('opUnit').textContent = op.unit || '---';
      document.getElementById('opSupervision').textContent = op.supervision || '---';
      document.getElementById('opRole').textContent = op.role || '---';
    }
  } else {
    if (alertBox) alertBox.classList.remove('hidden');
    if (container) container.classList.add('hidden');
  }
}

function saveOperatorProfile(e) {
  e.preventDefault();
  const firstName = document.getElementById('modalFirstName').value.trim();
  const lastName = document.getElementById('modalLastName').value.trim();
  const personnelId = document.getElementById('modalPersonnelId').value.trim();
  const supervision = document.getElementById('modalSupervision').value.trim();
  const unit = document.getElementById('modalUnit').value.trim();
  const role = document.getElementById('modalRole').value.trim();

  if (!firstName || !lastName || !personnelId) {
    showToast('لطفاً نام، نام خانوادگی و شماره پرسنلی را وارد نمایید', 'error');
    return;
  }

  const profile = { firstName, lastName, personnelId, supervision, unit, role };
  localStorage.setItem('automation_operator_profile', JSON.stringify(profile));
  window.AppState.operator = profile;
  updateOperatorSummaryUI();
  closeModal('personnelModal');
  showToast('مشخصات مجری با موفقیت در دستگاه ذخیره شد', 'success');
}

// ==========================================
// ۴. منطق فیلدهای شرطی نوار کشویی (Select)
// ==========================================
function handleActivityChange() {
  const select = document.getElementById('activityTypeSelect');
  const val = select.value;

  const equipIdGroup = document.getElementById('equipIdGroup');
  const settingsGroup = document.getElementById('settingsGroup');
  const footageGroup = document.getElementById('footageGroup');

  if (equipIdGroup) equipIdGroup.classList.add('hidden');
  if (settingsGroup) settingsGroup.classList.add('hidden');
  if (footageGroup) footageGroup.classList.add('hidden');

  const equipInput = document.getElementById('equipmentIdInput');
  const deviceTag = document.getElementById('deviceTagInput');
  const refTool = document.getElementById('referenceToolInput');
  const footage = document.getElementById('footageInput');

  if (equipInput) equipInput.required = false;
  if (deviceTag) deviceTag.required = false;
  if (refTool) refTool.required = false;
  if (footage) footage.required = false;

  if (val === 'مونتاژ تجهیزات' || val === 'دمونتاژ تجهیزات') {
    if (equipIdGroup) {
      equipIdGroup.classList.remove('hidden');
      if (equipInput) equipInput.required = true;
    }
  } else if (val === 'انجام تنظیمات حرفه‌ای') {
    if (settingsGroup) {
      settingsGroup.classList.remove('hidden');
      if (deviceTag) deviceTag.required = true;
      if (refTool) refTool.required = true;
    }
  } else if (val === 'انجام کابل‌کشی' || val === 'انجام کاندوئیت‌کاری') {
    if (footageGroup) {
      footageGroup.classList.remove('hidden');
      if (footage) footage.required = true;
    }
  }
}

// ==========================================
// ۵. مدیریت همکاران همراه (Dynamic Colleagues)
// ==========================================
function addColleague() {
  const input = document.getElementById('colleaguePersonnelInput');
  const val = input.value.trim();
  if (!val) {
    showToast('لطفاً شماره پرسنلی همکار را وارد کنید', 'error');
    return;
  }
  if (window.AppState.colleagues.includes(val)) {
    showToast('این شماره پرسنلی قبلاً افزوده شده است', 'warning');
    return;
  }
  window.AppState.colleagues.push(val);
  input.value = '';
  renderColleaguesList();
}

function removeColleague(code) {
  window.AppState.colleagues = window.AppState.colleagues.filter((c) => c !== code);
  renderColleaguesList();
}

function renderColleaguesList() {
  const container = document.getElementById('colleaguesListContainer');
  if (!container) return;
  container.innerHTML = '';
  if (window.AppState.colleagues.length === 0) {
    container.innerHTML = '<span class="text-xs text-slate-400">همکاری ثبت نشده است.</span>';
    return;
  }
  window.AppState.colleagues.forEach((code) => {
    const badge = document.createElement('div');
    badge.className = 'inline-flex items-center gap-2 bg-slate-700/80 border border-slate-600 text-amber-300 px-3 py-1.5 rounded-lg text-sm font-mono';
    badge.innerHTML = `
      <span>کد: ${code}</span>
      <button type="button" onclick="removeColleague('${code}')" class="text-slate-400 hover:text-red-400 transition" title="حذف">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
      </button>
    `;
    container.appendChild(badge);
  });
}

// ==========================================
// ۶. دریافت موقعیت مکانی (GPS)
// ==========================================
function updateGPSLocation() {
  const statusEl = document.getElementById('gpsStatusText');
  const coordsEl = document.getElementById('gpsCoordsText');
  const indicator = document.getElementById('gpsIndicator');

  if (!navigator.geolocation) {
    if (statusEl) statusEl.textContent = 'دستگاه شما از GPS پشتیبانی نمی‌کند';
    if (indicator) indicator.className = 'w-3 h-3 rounded-full bg-red-500';
    return;
  }

  if (statusEl) statusEl.textContent = 'در حال دریافت مختصات دقیق...';
  if (indicator) indicator.className = 'w-3 h-3 rounded-full bg-amber-400 animate-ping';

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude.toFixed(6);
      const lng = position.coords.longitude.toFixed(6);
      const accuracy = Math.round(position.coords.accuracy);
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      window.AppState.currentLocation = { lat, lng, accuracy, timestamp: now.toISOString() };

      if (statusEl) statusEl.textContent = `موقعیت به‌روز است (دقت: ±${accuracy} متر - ساعت ${timeStr})`;
      if (coordsEl) coordsEl.textContent = `عرض: ${lat} | طول: ${lng}`;
      if (indicator) indicator.className = 'w-3 h-3 rounded-full bg-emerald-500';

      const mapBtn = document.getElementById('viewOnMapBtn');
      if (mapBtn) {
        mapBtn.classList.remove('hidden');
        mapBtn.onclick = () => window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
      }
    },
    (err) => {
      console.warn('Geolocation error:', err);
      let msg = 'خطا در دریافت مختصات (مجوز مکان داده نشد یا GPS خاموش است)';
      if (statusEl) statusEl.textContent = msg;
      if (indicator) indicator.className = 'w-3 h-3 rounded-full bg-amber-500';
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
  );
}

// ==========================================
// ۷. مدیریت دوربین و عکس‌برداری صنعتی
// ==========================================
function setupCameraInput() {
  const fileInput = document.getElementById('cameraFileInput');
  if (!fileInput) return;

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1280;
        const MAX_HEIGHT = 1280;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
        ctx.fillRect(0, height - 40, width, 40);
        ctx.fillStyle = '#f59e0b';
        ctx.font = '16px Tahoma, sans-serif';
        ctx.direction = 'rtl';
        const jalali = getFormattedJalali();
        const stampText = `مدیریت اتوماسیون | ${jalali.fullPersian}`;
        ctx.fillText(stampText, width - 20, height - 15);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        window.AppState.capturedImageBase64 = dataUrl;
        renderImagePreview();
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function renderImagePreview() {
  const previewContainer = document.getElementById('cameraPreviewContainer');
  const previewImg = document.getElementById('cameraPreviewImg');
  const uploadPlaceholder = document.getElementById('cameraUploadPlaceholder');

  if (window.AppState.capturedImageBase64) {
    if (previewContainer) previewContainer.classList.remove('hidden');
    if (previewImg) previewImg.src = window.AppState.capturedImageBase64;
    if (uploadPlaceholder) uploadPlaceholder.classList.add('hidden');
  } else {
    if (previewContainer) previewContainer.classList.add('hidden');
    if (previewImg) previewImg.src = '';
    if (uploadPlaceholder) uploadPlaceholder.classList.remove('hidden');
  }
}

function removeCapturedImage() {
  window.AppState.capturedImageBase64 = null;
  const fileInput = document.getElementById('cameraFileInput');
  if (fileInput) fileInput.value = '';
  renderImagePreview();
  showToast('تصویر با موفقیت حذف شد', 'info');
}

// ==========================================
// ۸. اسکن بارکد و QR Code
// ==========================================
function openQrScannerModal(targetFieldId) {
  window.AppState.selectedQrTargetField = targetFieldId;
  const modal = document.getElementById('qrScannerModal');
  const title = document.getElementById('qrModalTitle');
  if (title) {
    title.textContent = targetFieldId === 'asettInput' ? 'اسکن بارکد / QR کد تجهیز (ASETT)' : 'اسکن بارکد / QR کد قطعه (Rebuildable)';
  }
  if (modal) modal.classList.remove('hidden');
  startQrVideoScan();
}

function closeQrScannerModal() {
  stopQrVideoScan();
  const modal = document.getElementById('qrScannerModal');
  if (modal) modal.classList.add('hidden');
  window.AppState.selectedQrTargetField = null;
}

async function startQrVideoScan() {
  const video = document.getElementById('qrVideo');
  const status = document.getElementById('qrScannerStatus');
  if (!video) return;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } }
    });
    window.AppState.activeCameraStream = stream;
    video.srcObject = stream;
    video.setAttribute('playsinline', 'true');
    await video.play();

    if (status) status.textContent = 'دوربین فعال است؛ لطفاً بارکد را مقابل کادر نگاه دارید...';

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    let isBarcodeDetectorSupported = 'BarcodeDetector' in window;
    let detector = null;
    if (isBarcodeDetectorSupported) {
      try {
        detector = new BarcodeDetector({ formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'data_matrix'] });
      } catch (e) {
        detector = null;
      }
    }

    let isScanning = true;
    const scanLoop = async () => {
      if (!window.AppState.activeCameraStream || !isScanning) return;

      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        // ۱. تلاش با BarcodeDetector محلی
        if (detector) {
          try {
            const barcodes = await detector.detect(video);
            if (barcodes.length > 0 && barcodes[0].rawValue) {
              isScanning = false;
              handleQrCodeDetected(barcodes[0].rawValue);
              return;
            }
          } catch (e) {}
        }

        // ۲. اسکن با موتور فوق‌سریع jsQR
        if (window.jsQR && isScanning) {
          try {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const qrResult = window.jsQR(imgData.data, imgData.width, imgData.height, {
              inversionAttempts: 'attemptBoth'
            });
            if (qrResult && qrResult.data) {
              isScanning = false;
              handleQrCodeDetected(qrResult.data);
              return;
            }
          } catch (err) {}
        }
      }

      requestAnimationFrame(scanLoop);
    };

    requestAnimationFrame(scanLoop);
  } catch (err) {
    console.warn('Camera stream error:', err);
    if (status) status.textContent = 'امکان دسترسی به دوربین وجود ندارد. لطفاً مجوز دسترسی به دوربین را در مرورگر تایید کنید.';
  }
}

function stopQrVideoScan() {
  if (window.AppState.activeCameraStream) {
    window.AppState.activeCameraStream.getTracks().forEach((t) => t.stop());
    window.AppState.activeCameraStream = null;
  }
}

function handleQrCodeDetected(code) {
  if (navigator.vibrate) navigator.vibrate(120);
  const targetId = window.AppState.selectedQrTargetField;
  if (targetId) {
    const targetInput = document.getElementById(targetId);
    if (targetInput) {
      targetInput.value = code;
      targetInput.classList.add('ring-2', 'ring-amber-400');
      setTimeout(() => targetInput.classList.remove('ring-2', 'ring-amber-400'), 1500);

      const clearBtn = targetId === 'asettInput' ? document.getElementById('clearAsettBtn') : document.getElementById('clearRebuildableBtn');
      if (clearBtn) clearBtn.classList.remove('hidden');
    }
  }
  showToast(`بارکد با موفقیت اسکن شد: ${code}`, 'success');
  closeQrScannerModal();
}

function clearQrField(targetFieldId) {
  const targetInput = document.getElementById(targetFieldId);
  if (targetInput) {
    targetInput.value = '';
  }
  const clearBtn = targetFieldId === 'asettInput' ? document.getElementById('clearAsettBtn') : document.getElementById('clearRebuildableBtn');
  if (clearBtn) clearBtn.classList.add('hidden');
  showToast('کد اسکن‌شده پاکسازی شد', 'info');
}

// ==========================================
// ۹. ثبت و ذخیره‌سازی گراف در IndexedDB
// ==========================================
async function handleGraphFormSubmit(e) {
  e.preventDefault();

  if (!window.AppState.operator || !window.AppState.operator.personnelId) {
    showToast('لطفاً ابتدا مشخصات شخص (مجری) را ثبت نمایید', 'error');
    openModal('personnelModal');
    return;
  }

  const asett = document.getElementById('asettInput').value.trim();
  const rebuildable = document.getElementById('rebuildableInput').value.trim();
  const reportNotes = document.getElementById('reportNotesInput').value.trim();
  const activityType = document.getElementById('activityTypeSelect').value;

  if (!activityType) {
    showToast('لطفاً نوع فعالیت را انتخاب نمایید', 'error');
    return;
  }
  if (!reportNotes) {
    showToast('لطفاً شرح کامل گزارش را وارد نمایید', 'error');
    return;
  }

  const conditionalFields = {};
  if (activityType === 'مونتاژ تجهیزات' || activityType === 'دمونتاژ تجهیزات') {
    const val = document.getElementById('equipmentIdInput').value.trim();
    if (!val) {
      showToast('لطفاً شماره شناسایی تجهیز را وارد نمایید', 'error');
      return;
    }
    conditionalFields.equipmentId = val;
  } else if (activityType === 'انجام تنظیمات حرفه‌ای') {
    const devTag = document.getElementById('deviceTagInput').value.trim();
    const refTool = document.getElementById('referenceToolInput').value.trim();
    if (!devTag || !refTool) {
      showToast('لطفاً هر دو فیلد شماره تجهیز و شماره مرجع را وارد نمایید', 'error');
      return;
    }
    conditionalFields.deviceTag = devTag;
    conditionalFields.referenceTool = refTool;
  } else if (activityType === 'انجام کابل‌کشی' || activityType === 'انجام کاندوئیت‌کاری') {
    const footage = document.getElementById('footageInput').value.trim();
    if (!footage) {
      showToast('لطفاً متراژ را وارد نمایید', 'error');
      return;
    }
    conditionalFields.footage = footage;
  }

  const isOnline = navigator.onLine;
  const now = new Date();
  const jalali = getFormattedJalali(now);
  const deviceId = getOrCreateDeviceId();
  const clientRecordId = 'REC-' + deviceId + '-' + now.getTime() + '-' + Math.random().toString(36).substring(2, 7).toUpperCase();

  const graphRecord = {
    clientRecordId,
    timestamp: now.getTime(),
    jalaliDate: jalali.dateNumStr,
    jalaliTime: jalali.timeStr,
    jalaliFull: jalali.fullPersian,
    operator: { ...window.AppState.operator },
    asett,
    rebuildable,
    photo: window.AppState.capturedImageBase64 || null,
    reportNotes,
    activityType,
    conditionalFields,
    colleagues: [...window.AppState.colleagues],
    location: { ...window.AppState.currentLocation },
    syncStatus: 'pending',
    syncedAt: null,
    deviceId
  };

  try {
    const id = await saveGraphRecord(graphRecord);
    graphRecord.id = id;

    // در صورتی که هم‌اکنون آنلاین هستیم، ارسال آنی و بلادرنگ به سرور مرکزی انجام می‌شود
    if (isOnline) {
      try {
        const resp = await fetch('/api/records', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(graphRecord),
        });

        if (resp.ok) {
          graphRecord.syncStatus = 'synced';
          graphRecord.syncedAt = new Date().toISOString();
          graphRecord.serverConfirmed = true;
          await updateGraphRecord(graphRecord);
          showToast(`گراف شماره #${id} با موفقیت ثبت و بلادرنگ به سرور مرکزی ارسال شد.`, 'success');
        } else {
          throw new Error('Server returned status: ' + resp.status);
        }
      } catch (netErr) {
        console.warn('Direct real-time post failed, saved to pending queue:', netErr);
        showToast(`گراف #${id} در صف ذخیره شد. در اولین اتصال به اینترنت، بلادرنگ به سرور ارسال خواهد شد.`, 'warning');
      }
    } else {
      showToast(`گراف شماره #${id} در حافظه آفلاین ذخیره شد. در اولین اتصال به اینترنت، بلادرنگ به سرور ارسال خواهد شد.`, 'warning');
    }

    resetGraphForm();
    await updatePendingQueueCount();
  } catch (err) {
    console.error('Error saving record', err);
    showToast('خطا در ذخیره‌سازی رکورد در دیتابیس محلی', 'error');
  }
}

function resetGraphForm() {
  document.getElementById('asettInput').value = '';
  document.getElementById('rebuildableInput').value = '';
  document.getElementById('reportNotesInput').value = '';
  document.getElementById('activityTypeSelect').value = '';
  document.getElementById('equipmentIdInput').value = '';
  document.getElementById('deviceTagInput').value = '';
  document.getElementById('referenceToolInput').value = '';
  document.getElementById('footageInput').value = '';
  handleActivityChange();

  window.AppState.capturedImageBase64 = null;
  renderImagePreview();

  window.AppState.colleagues = [];
  renderColleaguesList();

  updateLiveClock();
}

// ==========================================
// ۱۰. مدیریت وضعیت آنلاین / آفلاین و همگام‌سازی بلادرنگ PWA
// ==========================================

function getOrCreateDeviceId() {
  let devId = localStorage.getItem('automation_device_id');
  if (!devId) {
    devId = 'PWA-' + Math.random().toString(36).substring(2, 8).toUpperCase() + '-' + Date.now().toString(36).toUpperCase();
    localStorage.setItem('automation_device_id', devId);
  }
  return devId;
}

function updateNetworkStatusIndicator() {
  const isOnline = navigator.onLine;
  const badge = document.getElementById('networkStatusBadge');
  const dot = document.getElementById('networkStatusDot');
  const text = document.getElementById('networkStatusText');

  if (isOnline) {
    if (badge) badge.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950/70 border border-emerald-500/50 text-emerald-300 shadow-sm';
    if (dot) dot.className = 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse';
    if (text) text.textContent = 'آنلاین (متصل به سرور مرکزی)';
  } else {
    if (badge) badge.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-950/70 border border-amber-500/50 text-amber-300 shadow-sm';
    if (dot) dot.className = 'w-2 h-2 rounded-full bg-amber-400 animate-ping';
    if (text) text.textContent = 'آفلاین (صف آماده ارسال خودکار)';
  }
}

async function updatePendingQueueCount() {
  try {
    const records = await getAllGraphRecords();
    const pendingList = records.filter((r) => r.syncStatus === 'pending');
    const count = pendingList.length;

    const countEl = document.getElementById('pendingQueueCount');
    const badgeEl = document.getElementById('pendingQueueBadge');
    const bannerEl = document.getElementById('realtimeSyncAlertBanner');
    const bannerCountEl = document.getElementById('bannerPendingCount');

    if (countEl) countEl.textContent = count;
    if (bannerCountEl) bannerCountEl.textContent = count;

    if (badgeEl) {
      if (count > 0) {
        badgeEl.classList.remove('hidden');
      } else {
        badgeEl.classList.add('hidden');
      }
    }

    if (bannerEl) {
      if (count > 0) {
        bannerEl.classList.remove('hidden');
      } else {
        bannerEl.classList.add('hidden');
      }
    }
    return count;
  } catch (e) {
    console.error('Queue count check error', e);
    return 0;
  }
}

let isSyncInProgress = false;

// تابع همگام‌سازی بلادرنگ کلیه داده‌ها در اولین اتصال به اینترنت
async function syncPendingRecords(options = {}) {
  const isAuto = options.isAuto || false;
  const silent = options.silent || false;

  if (isSyncInProgress) return;
  if (!navigator.onLine) {
    if (!isAuto && !silent) {
      showToast('دستگاه به اینترنت متصل نیست. اطلاعات در صف محلی محفوظند.', 'warning');
    }
    return;
  }

  try {
    const records = await getAllGraphRecords();
    const pendingList = records.filter((r) => r.syncStatus === 'pending');

    if (pendingList.length === 0) {
      await updatePendingQueueCount();
      if (!isAuto && !silent) {
        showToast('تمامی اطلاعات قبلاً با سرور مرکزی همگام‌سازی شده‌اند.', 'info');
      }
      return;
    }

    isSyncInProgress = true;
    const badgeEl = document.getElementById('pendingQueueBadge');
    if (badgeEl) {
      badgeEl.classList.add('animate-pulse');
    }

    if (!silent) {
      showToast(`⚡ در حال ارسال بلادرنگ ${pendingList.length} رکورد به سرور مرکزی...`, 'info');
    }

    const deviceId = getOrCreateDeviceId();
    const op = window.AppState.operator;
    const operatorSummary = op ? `${op.firstName} ${op.lastName} (${op.unit || op.personnelId || ''})` : 'تکنسین محلی';

    const resp = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId,
        operator: operatorSummary,
        records: pendingList,
      }),
    });

    if (!resp.ok) {
      throw new Error(`خطای سرور: ${resp.status}`);
    }

    const resData = await resp.json();
    const nowIso = new Date().toISOString();

    for (const rec of pendingList) {
      rec.syncStatus = 'synced';
      rec.syncedAt = nowIso;
      rec.serverConfirmed = true;
      await updateGraphRecord(rec);
    }

    await updatePendingQueueCount();
    showToast(`✅ ارسال بلادرنگ موفق: تعداد ${pendingList.length} رکورد آفلاین با موفقیت به سرور مرکزی و نرم‌افزار اصلی ارسال شدند.`, 'success');

    if (window.AppState.currentView === 'admin') {
      loadAdminReports();
    }
  } catch (e) {
    console.error('Real-time sync failed:', e);
    if (!silent) {
      showToast('خطا در ارتباط با سرور مرکزی؛ سیستم به صورت خودکار مجدداً تلاش خواهد کرد.', 'error');
    }
  } finally {
    isSyncInProgress = false;
    const badgeEl = document.getElementById('pendingQueueBadge');
    if (badgeEl) {
      badgeEl.classList.remove('animate-pulse');
    }
  }
}

// گوش‌به‌زنگ‌های بلادرنگ در اولین برقراری اتصال به اینترنت
window.addEventListener('online', () => {
  updateNetworkStatusIndicator();
  showToast('🌐 اتصال به اینترنت برقرار شد! ارسال خودکار و بلادرنگ اطلاعات به سرور مرکزی آغاز گردید...', 'info');
  syncPendingRecords({ isAuto: true });
});

window.addEventListener('offline', () => {
  updateNetworkStatusIndicator();
  showToast('⚠️ ارتباط با شبکه قطع شد. اطلاعات در صف محلی نگهداری شده و در اولین اتصال به اینترنت بلادرنگ ارسال خواهند شد.', 'warning');
});

// ارسال خودکار بلادرنگ هنگام بازگشت تکنسین به تب یا روشن شدن گوشی
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && navigator.onLine) {
    syncPendingRecords({ isAuto: true, silent: true });
  }
});

window.addEventListener('focus', () => {
  if (navigator.onLine) {
    syncPendingRecords({ isAuto: true, silent: true });
  }
});

// بازبینی دوره‌ای در پس‌زمینه هر ۱۵ ثانیه برای اطمینان از پاکسازی صف
setInterval(() => {
  if (navigator.onLine) {
    syncPendingRecords({ isAuto: true, silent: true });
  }
}, 15000);

// متصل کردن جریان داده‌های زنده سرور مرکزی (Server-Sent Events)
let sseSource = null;

function initCentralServerSSE() {
  if (sseSource) return;
  if (!window.EventSource) return;

  try {
    sseSource = new EventSource('/api/events');

    sseSource.addEventListener('connected', () => {
      setCentralServerStatus(true);
    });

    sseSource.addEventListener('sync_batch', (evt) => {
      try {
        const data = JSON.parse(evt.data);
        showToast(`📡 دریافت بلادرنگ: تعداد ${data.totalSynced} رکورد جدید از ${data.operator} روی سرور مرکزی ذخیره شد.`, 'info');
        if (window.AppState.currentView === 'admin') {
          loadAdminReports();
        }
      } catch (e) {
        console.error('SSE sync_batch parse error', e);
      }
    });

    sseSource.addEventListener('new_record', (evt) => {
      try {
        const data = JSON.parse(evt.data);
        showToast(`📡 دریافت بلادرنگ: گراف جدید با موفقیت بر روی سرور مرکزی دریافت گردید.`, 'info');
        if (window.AppState.currentView === 'admin') {
          loadAdminReports();
        }
      } catch (e) {
        console.error('SSE new_record parse error', e);
      }
    });

    sseSource.addEventListener('record_deleted', () => {
      if (window.AppState.currentView === 'admin') {
        loadAdminReports();
      }
    });

    sseSource.onerror = () => {
      setCentralServerStatus(false);
      if (sseSource) {
        sseSource.close();
        sseSource = null;
      }
      setTimeout(initCentralServerSSE, 10000);
    };
  } catch (err) {
    console.error('SSE init error', err);
    setCentralServerStatus(false);
  }
}

function setCentralServerStatus(isConnected) {
  const dot = document.getElementById('centralServerDot');
  const tag = document.getElementById('centralServerStatusTag');
  const desc = document.getElementById('centralServerStatusDesc');

  if (isConnected) {
    if (dot) dot.className = 'w-3.5 h-3.5 rounded-full bg-emerald-400 animate-pulse shrink-0';
    if (tag) {
      tag.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
      tag.textContent = 'برخط و فعال (بلادرنگ)';
    }
    if (desc) desc.textContent = 'PWAهای محلی به محض اولین اتصال به اینترنت، تمام گراف‌ها و گزارش‌ها را به صورت خودکار و بلادرنگ برای این سرور ارسال می‌کنند.';
  } else {
    if (dot) dot.className = 'w-3.5 h-3.5 rounded-full bg-amber-400 shrink-0';
    if (tag) {
      tag.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30';
      tag.textContent = 'در انتظار اتصال';
    }
    if (desc) desc.textContent = 'ارتباط با سرور موقتاً در دسترس نیست؛ اطلاعات در صف محلی نگهداری شده و به محض اتصال بلادرنگ منتقل می‌شوند.';
  }
}

// ==========================================
// ۱۱. ساعت و تاریخ زنده
// ==========================================
function updateLiveClock() {
  const clockEl = document.getElementById('liveJalaliDateText');
  if (clockEl) {
    const jalali = getFormattedJalali();
    clockEl.textContent = jalali.fullPersian;
  }
}

// ==========================================
// ۱۲. احراز هویت و ورود به پنل ادمین
// ==========================================
const SUPER_ADMIN = {
  username: 'admin',
  password: 'Ehsan2559',
  fullName: 'احسان ابوالقاسمی',
  isSuperAdmin: true,
  unit: 'کل واحدها',
  supervision: 'کل سرپرستی‌ها'
};

function checkAdminAuthSession() {
  const stored = sessionStorage.getItem('automation_admin_session');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed && (parsed.username === 'admin' || parsed.isSuperAdmin)) {
        window.AppState.currentUser = SUPER_ADMIN;
      } else {
        window.AppState.currentUser = parsed;
      }
      return true;
    } catch (e) {
      sessionStorage.removeItem('automation_admin_session');
    }
  }
  return false;
}

async function handleAdminLogin(e) {
  e.preventDefault();
  const user = document.getElementById('loginUsername').value.trim();
  const pass = document.getElementById('loginPassword').value.trim();

  if (user.toLowerCase() === 'admin' && (pass === 'Ehsan2559' || pass.toLowerCase() === 'ehsan2559')) {
    window.AppState.currentUser = SUPER_ADMIN;
    sessionStorage.setItem('automation_admin_session', JSON.stringify(SUPER_ADMIN));
    showToast('خوش آمدید، احسان ابوالقاسمی', 'success');
    closeModal('loginModal');
    switchToAdminView();
    return;
  }

  try {
    const admins = await getAdminsList();
    const match = admins.find((a) => a.username === user && a.password === pass);
    if (match) {
      window.AppState.currentUser = match;
      sessionStorage.setItem('automation_admin_session', JSON.stringify(match));
      showToast(`خوش آمدید، ${match.fullName || match.username}`, 'success');
      closeModal('loginModal');
      switchToAdminView();
      return;
    }
  } catch (err) {
    console.error('Login check error', err);
  }

  showToast('نام کاربری یا رمز عبور اشتباه است', 'error');
}

function handleAdminLogout() {
  window.AppState.currentUser = null;
  sessionStorage.removeItem('automation_admin_session');
  showToast('با موفقیت از سیستم خارج شدید', 'info');
  switchToHomeView();
}

function openAdminAccess() {
  if (checkAdminAuthSession()) {
    switchToAdminView();
  } else {
    openModal('loginModal');
  }
}

// ==========================================
// ۱۳. پنل ادمین: سوئیچ نماها
// ==========================================
function switchToHomeView() {
  window.AppState.currentView = 'home';
  document.getElementById('homeViewSection').classList.remove('hidden');
  document.getElementById('adminViewSection').classList.add('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function switchToAdminView() {
  window.AppState.currentView = 'admin';
  document.getElementById('homeViewSection').classList.add('hidden');
  document.getElementById('adminViewSection').classList.remove('hidden');

  const user = window.AppState.currentUser;
  if (user) {
    const titleEl = document.getElementById('adminUserTitle');
    if (titleEl) {
      if (user.isSuperAdmin || user.username === 'admin') {
        titleEl.textContent = 'احسان ابوالقاسمی';
      } else {
        titleEl.textContent = user.fullName || user.username;
      }
    }
    
    const adminManageTab = document.getElementById('tabBtnAdminManage');
    const orgManageTab = document.getElementById('tabBtnOrgManage');
    if (user.isSuperAdmin) {
      if (adminManageTab) adminManageTab.classList.remove('hidden');
      if (orgManageTab) orgManageTab.classList.remove('hidden');
    } else {
      if (adminManageTab) adminManageTab.classList.add('hidden');
      if (orgManageTab) orgManageTab.classList.add('hidden');
    }
  }

  loadAdminReports();
  loadAdminUsersList();
  renderOrgManagementUI();
  populateOrgDropdowns();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================
// ۱۴. پنل ادمین: گزارش‌گیری، جستجو و فیلتر (RBAC) و همگام‌سازی بلادرنگ سرور
// ==========================================
async function loadAdminReports() {
  try {
    let localRecords = await getAllGraphRecords();

    // در صورتی که آنلاین هستیم، آخرین رکوردهای سرور مرکزی (ارسال‌شده از تمام PWAها) را استعلام و همگام‌سازی می‌کنیم
    if (navigator.onLine) {
      try {
        const resp = await fetch('/api/records', { cache: 'no-store' });
        if (resp.ok) {
          const serverData = await resp.json();
          if (Array.isArray(serverData.records)) {
            for (const sRec of serverData.records) {
              const recKey = sRec.clientRecordId || sRec.id;
              const exists = localRecords.some(
                (lr) => (lr.clientRecordId && lr.clientRecordId === recKey) || lr.id === recKey
              );
              if (!exists) {
                // ذخیره در دیتابیس محلی مدیر جهت دسترسی در حالت آفلاین
                const copyRec = { ...sRec, syncStatus: 'synced', serverConfirmed: true };
                delete copyRec.id; // اجازه می‌دهیم IndexedDB شناسه محلی خود را تخصیص دهد
                const newId = await saveGraphRecord(copyRec);
                copyRec.id = newId;
                localRecords.push(copyRec);
              }
            }
          }
        }
      } catch (netErr) {
        console.warn('Central server query skipped (offline/unreachable):', netErr);
      }
    }

    let records = localRecords;
    const user = window.AppState.currentUser;

    if (user && !user.isSuperAdmin) {
      records = records.filter((r) => {
        const unitMatch = !user.unit || user.unit === 'همه واحدها' || (r.operator && r.operator.unit === user.unit);
        const supMatch = !user.supervision || user.supervision === 'همه سرپرستی‌ها' || (r.operator && r.operator.supervision === user.supervision);
        return unitMatch && supMatch;
      });
    }

    records.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    window.AppState.allReports = records;

    renderAdminKPIs(records);
    applyAdminFilters();
  } catch (err) {
    console.error('Error loading reports', err);
  }
}

function renderAdminKPIs(records) {
  const total = records.length;
  const pending = records.filter((r) => r.syncStatus === 'pending').length;
  const synced = records.filter((r) => r.syncStatus === 'synced').length;

  const todayStr = getFormattedJalali().dateNumStr;
  const todayCount = records.filter((r) => r.jalaliDate === todayStr).length;

  document.getElementById('kpiTotalCount').textContent = total;
  document.getElementById('kpiTodayCount').textContent = todayCount;
  document.getElementById('kpiPendingCount').textContent = pending;
  document.getElementById('kpiSyncedCount').textContent = synced;
}

function applyAdminFilters() {
  let list = window.AppState.allReports || [];

  const search = (document.getElementById('filterSearchInput')?.value || '').toLowerCase().trim();
  const activity = document.getElementById('filterActivitySelect')?.value || '';
  const unit = document.getElementById('filterUnitSelect')?.value || '';
  const dateFrom = document.getElementById('filterDateFrom')?.value.trim() || '';
  const dateTo = document.getElementById('filterDateTo')?.value.trim() || '';

  if (search) {
    list = list.filter((r) => {
      const notes = (r.reportNotes || '').toLowerCase();
      const asett = (r.asett || '').toLowerCase();
      const rebuild = (r.rebuildable || '').toLowerCase();
      const opName = r.operator ? `${r.operator.firstName} ${r.operator.lastName} ${r.operator.personnelId}`.toLowerCase() : '';
      const colleagues = (r.colleagues || []).join(' ');
      return notes.includes(search) || asett.includes(search) || rebuild.includes(search) || opName.includes(search) || colleagues.includes(search);
    });
  }

  if (activity) {
    list = list.filter((r) => r.activityType === activity);
  }

  if (unit) {
    list = list.filter((r) => r.operator && r.operator.unit === unit);
  }

  if (dateFrom) {
    list = list.filter((r) => (r.jalaliDate || '') >= dateFrom);
  }

  if (dateTo) {
    list = list.filter((r) => (r.jalaliDate || '') <= dateTo);
  }

  window.AppState.filteredReports = list;
  renderReportsTable(list);
}

function resetAdminFilters() {
  if (document.getElementById('filterSearchInput')) document.getElementById('filterSearchInput').value = '';
  if (document.getElementById('filterActivitySelect')) document.getElementById('filterActivitySelect').value = '';
  if (document.getElementById('filterUnitSelect')) document.getElementById('filterUnitSelect').value = '';
  if (document.getElementById('filterDateFrom')) document.getElementById('filterDateFrom').value = '';
  if (document.getElementById('filterDateTo')) document.getElementById('filterDateTo').value = '';
  applyAdminFilters();
}

function renderReportsTable(list) {
  const tbody = document.getElementById('reportsTableBody');
  const emptyBox = document.getElementById('reportsEmptyState');
  if (!tbody) return;

  tbody.innerHTML = '';
  if (!list || list.length === 0) {
    if (emptyBox) emptyBox.classList.remove('hidden');
    return;
  }
  if (emptyBox) emptyBox.classList.add('hidden');

  list.forEach((r, idx) => {
    const tr = document.createElement('tr');
    tr.className = 'border-b border-slate-800 hover:bg-slate-800/40 transition';

    const opName = r.operator ? `${r.operator.firstName} ${r.operator.lastName}` : '---';
    const personnel = r.operator ? r.operator.personnelId : '---';
    const unit = r.operator ? r.operator.unit : '---';

    let conditionInfo = '';
    if (r.conditionalFields) {
      if (r.conditionalFields.footage) conditionInfo = `متراژ: ${r.conditionalFields.footage}م`;
      if (r.conditionalFields.equipmentId) conditionInfo = `تجهیز: ${r.conditionalFields.equipmentId}`;
      if (r.conditionalFields.deviceTag) conditionInfo = `تگ: ${r.conditionalFields.deviceTag} (مرجع: ${r.conditionalFields.referenceTool})`;
    }

    const isSynced = r.syncStatus === 'synced';
    const statusBadge = isSynced
      ? '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-950 text-emerald-300 border border-emerald-800">همگام‌شده</span>'
      : '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-950 text-amber-300 border border-amber-800">در صف</span>';

    const photoThumb = r.photo
      ? `<img src="${r.photo}" onclick="showDetailModal(${r.id})" class="w-10 h-10 object-cover rounded cursor-pointer border border-slate-700 hover:scale-105 transition" title="مشاهده تصویر">`
      : '<span class="text-xs text-slate-600">بدون عکس</span>';

    tr.innerHTML = `
      <td class="p-3 text-center text-slate-400 font-mono text-xs">${idx + 1}</td>
      <td class="p-3 whitespace-nowrap">
        <div class="font-medium text-slate-200 text-sm">${r.jalaliDate || '---'}</div>
        <div class="text-xs text-slate-400 font-mono">${r.jalaliTime || ''}</div>
      </td>
      <td class="p-3 whitespace-nowrap">
        <div class="font-medium text-slate-200">${opName}</div>
        <div class="text-xs text-slate-400 font-mono">پرسنلی: ${personnel}</div>
      </td>
      <td class="p-3 text-slate-300 text-xs whitespace-nowrap">${unit}</td>
      <td class="p-3 whitespace-nowrap">
        <div class="text-amber-400 font-medium text-xs">${r.activityType}</div>
        ${conditionInfo ? `<div class="text-xs text-slate-400 mt-0.5">${conditionInfo}</div>` : ''}
      </td>
      <td class="p-3 text-xs font-mono text-slate-300 whitespace-nowrap">
        <div>ASETT: ${r.asett || '-'}</div>
        <div>Rebuild: ${r.rebuildable || '-'}</div>
      </td>
      <td class="p-3 text-center whitespace-nowrap">${statusBadge}</td>
      <td class="p-3 text-center">${photoThumb}</td>
      <td class="p-3 text-center whitespace-nowrap">
        <div class="flex items-center justify-center gap-1.5">
          <button onclick="showDetailModal(${r.id})" class="p-1.5 rounded-lg bg-blue-900/40 hover:bg-blue-800 text-blue-300 transition" title="مشاهده کامل">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
          </button>
          <button onclick="confirmDeleteReport(${r.id})" class="p-1.5 rounded-lg bg-red-950/50 hover:bg-red-900 text-red-400 transition" title="حذف رکورد">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function showDetailModal(id) {
  const record = (window.AppState.allReports || []).find((r) => r.id === id);
  if (!record) return;

  const content = document.getElementById('reportDetailContent');
  if (!content) return;

  const op = record.operator || {};
  let conditionRows = '';
  if (record.conditionalFields) {
    if (record.conditionalFields.footage) conditionRows += `<div class="flex justify-between border-b border-slate-700 py-2"><span class="text-slate-400">متراژ:</span><span class="font-bold text-amber-400">${record.conditionalFields.footage} متر</span></div>`;
    if (record.conditionalFields.equipmentId) conditionRows += `<div class="flex justify-between border-b border-slate-700 py-2"><span class="text-slate-400">شماره شناسایی تجهیز:</span><span class="font-mono text-amber-400">${record.conditionalFields.equipmentId}</span></div>`;
    if (record.conditionalFields.deviceTag) conditionRows += `<div class="flex justify-between border-b border-slate-700 py-2"><span class="text-slate-400">شماره تجهیز:</span><span class="font-mono text-amber-400">${record.conditionalFields.deviceTag}</span></div>`;
    if (record.conditionalFields.referenceTool) conditionRows += `<div class="flex justify-between border-b border-slate-700 py-2"><span class="text-slate-400">شماره مرجع (ابزار):</span><span class="font-mono text-amber-400">${record.conditionalFields.referenceTool}</span></div>`;
  }

  const mapLink = record.location && record.location.lat
    ? `<a href="https://www.google.com/maps?q=${record.location.lat},${record.location.lng}" target="_blank" class="text-blue-400 underline font-mono">نمایش روی نقشه (${record.location.lat}, ${record.location.lng})</a>`
    : '<span class="text-slate-500">ثبت نشده</span>';

  content.innerHTML = `
    <div class="space-y-4 text-sm">
      <div class="grid grid-cols-2 gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div><span class="text-slate-400 text-xs">تاریخ و ساعت:</span> <div class="font-bold text-slate-200 mt-1">${record.jalaliFull || record.jalaliDate}</div></div>
        <div><span class="text-slate-400 text-xs">وضعیت همگام‌سازی:</span> <div class="mt-1">${record.syncStatus === 'synced' ? '<span class="text-emerald-400 font-bold">همگام‌شده با سرور</span>' : '<span class="text-amber-400 font-bold">در صف انتظار محلی</span>'}</div></div>
      </div>

      <div class="bg-slate-900/60 p-3 rounded-xl border border-slate-800 space-y-2">
        <h4 class="font-bold text-amber-400 text-xs border-b border-slate-800 pb-1">اطلاعات مجری و سرپرستی</h4>
        <div class="grid grid-cols-2 gap-2 text-xs">
          <div>نام و پرسنلی: <strong class="text-slate-200">${op.firstName || ''} ${op.lastName || ''} (${op.personnelId || '-'})</strong></div>
          <div>واحد خدمتی: <strong class="text-slate-200">${op.unit || '-'}</strong></div>
          <div>سرپرستی: <strong class="text-slate-200">${op.supervision || '-'}</strong></div>
          <div>سمت: <strong class="text-slate-200">${op.role || '-'}</strong></div>
        </div>
      </div>

      <div class="bg-slate-900/60 p-3 rounded-xl border border-slate-800 space-y-2">
        <h4 class="font-bold text-amber-400 text-xs border-b border-slate-800 pb-1">جزئیات فعالیت و بارکدها</h4>
        <div class="flex justify-between border-b border-slate-700 py-2"><span class="text-slate-400">نوع فعالیت:</span><span class="font-bold text-amber-300">${record.activityType}</span></div>
        ${conditionRows}
        <div class="flex justify-between border-b border-slate-700 py-2"><span class="text-slate-400">کد تجهیز (ASETT):</span><span class="font-mono text-slate-200">${record.asett || '---'}</span></div>
        <div class="flex justify-between border-b border-slate-700 py-2"><span class="text-slate-400">قطعه داغی (Rebuildable):</span><span class="font-mono text-slate-200">${record.rebuildable || '---'}</span></div>
        <div class="flex justify-between border-b border-slate-700 py-2"><span class="text-slate-400">موقعیت مکانی (GPS):</span>${mapLink}</div>
        <div class="flex justify-between py-2"><span class="text-slate-400">همکاران همراه:</span><span class="font-mono text-slate-200">${(record.colleagues || []).join(', ') || 'ندارد'}</span></div>
      </div>

      <div class="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <h4 class="font-bold text-amber-400 text-xs mb-2">شرح کامل گزارش میدانی:</h4>
        <p class="text-slate-200 whitespace-pre-wrap leading-relaxed bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">${record.reportNotes}</p>
      </div>

      ${record.photo ? `
        <div class="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
          <h4 class="font-bold text-amber-400 text-xs mb-2">تصویر ثبت شده از تجهیز / محل:</h4>
          <img src="${record.photo}" class="w-full max-h-80 object-contain rounded-lg border border-slate-700" alt="عکس تجهیز">
        </div>
      ` : ''}
    </div>
  `;

  openModal('reportDetailModal');
}

async function confirmDeleteReport(id) {
  if (confirm(`آیا از حذف دائمی گراف شماره #${id} اطمینان دارید؟`)) {
    try {
      await deleteGraphRecord(id);
      showToast('گراف با موفقیت حذف گردید.', 'success');
      loadAdminReports();
    } catch (e) {
      showToast('خطا در حذف رکورد', 'error');
    }
  }
}

// ==========================================
// ۱۵. خروجی اکسل (Excel / CSV با BOM فارسی)
// ==========================================
function exportToExcel() {
  const list = window.AppState.filteredReports || window.AppState.allReports || [];
  if (list.length === 0) {
    showToast('رکوردی جهت خروجی اکسل وجود ندارد', 'warning');
    return;
  }

  const headers = [
    'شناسه',
    'تاریخ شمسی',
    'ساعت',
    'نام و نام خانوادگی مجری',
    'شماره پرسنلی',
    'واحد خدمتی',
    'سرپرستی',
    'سمت',
    'نوع فعالیت',
    'متراژ (متر)',
    'شماره تجهیز',
    'شماره مرجع ابزار',
    'کد تجهیز (ASETT)',
    'قطعه داغی (Rebuildable)',
    'همکاران همراه',
    'عرض جغرافیایی (Lat)',
    'طول جغرافیایی (Lng)',
    'وضعیت همگام‌سازی',
    'شرح کامل گزارش'
  ];

  const rows = list.map((r) => {
    const op = r.operator || {};
    const cond = r.conditionalFields || {};
    const loc = r.location || {};
    const notesClean = (r.reportNotes || '').replace(/"/g, '""').replace(/\r?\n/g, ' ');

    return [
      r.id,
      r.jalaliDate || '',
      r.jalaliTime || '',
      `"${op.firstName || ''} ${op.lastName || ''}"`,
      `"${op.personnelId || ''}"`,
      `"${op.unit || ''}"`,
      `"${op.supervision || ''}"`,
      `"${op.role || ''}"`,
      `"${r.activityType || ''}"`,
      cond.footage || '',
      `"${cond.equipmentId || cond.deviceTag || ''}"`,
      `"${cond.referenceTool || ''}"`,
      `"${r.asett || ''}"`,
      `"${r.rebuildable || ''}"`,
      `"${(r.colleagues || []).join(' - ')}"`,
      loc.lat || '',
      loc.lng || '',
      r.syncStatus === 'synced' ? 'همگام‌شده' : 'در صف',
      `"${notesClean}"`
    ].join(',');
  });

  const csvContent = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Automation_Graphs_${getFormattedJalali().dateNumStr.replace(/\//g, '-')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('فایل اکسل با موفقیت ایجاد و دانلود شد', 'success');
}

// ==========================================
// ۱۶. خروجی PDF و چاپ رسمی فرم صنعتی
// ==========================================
function printReportsAsPDF() {
  const list = window.AppState.filteredReports || window.AppState.allReports || [];
  if (list.length === 0) {
    showToast('رکوردی جهت چاپ وجود ندارد', 'warning');
    return;
  }

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    window.print();
    return;
  }

  const jalaliNow = getFormattedJalali().fullPersian;
  let tableRows = '';
  list.forEach((r, idx) => {
    const op = r.operator || {};
    const cond = r.conditionalFields || {};
    let extra = '';
    if (cond.footage) extra = `متراژ: ${cond.footage}م`;
    if (cond.equipmentId) extra = `تجهیز: ${cond.equipmentId}`;
    if (cond.deviceTag) extra = `تگ: ${cond.deviceTag}`;

    tableRows += `
      <tr>
        <td style="text-align:center;">${idx + 1}</td>
        <td>${r.jalaliDate} ${r.jalaliTime}</td>
        <td>${op.firstName || ''} ${op.lastName || ''} (${op.personnelId || '-'})</td>
        <td>${op.unit || '-'}</td>
        <td><strong>${r.activityType}</strong> ${extra ? `<br><small>${extra}</small>` : ''}</td>
        <td>ASETT: ${r.asett || '-'}<br>Rebuild: ${r.rebuildable || '-'}</td>
        <td>${(r.reportNotes || '').slice(0, 100)}${(r.reportNotes || '').length > 100 ? '...' : ''}</td>
        <td style="text-align:center;">${r.syncStatus === 'synced' ? 'تایید و ارسال' : 'محلی'}</td>
      </tr>
    `;
  });

  printWindow.document.write(`
    <!DOCTYPE html>
    <html dir="rtl" lang="fa">
    <head>
      <meta charset="utf-8">
      <title>گزارش رسمی فعالیت‌های اتوماسیون و ارتباطات</title>
      <style>
        body { font-family: Tahoma, 'Segoe UI', sans-serif; direction: rtl; padding: 25px; color: #111; }
        .header { border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
        .header h2 { margin: 0; font-size: 18px; }
        .header p { margin: 5px 0 0 0; font-size: 12px; color: #555; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px; }
        th, td { border: 1px solid #777; padding: 6px 8px; text-align: right; }
        th { background: #f0f0f0; }
        .signatures { margin-top: 50px; display: flex; justify-content: space-between; font-size: 12px; padding: 0 40px; }
        @media print {
          @page { size: landscape; margin: 15mm; }
          button { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h2>مدیریت اتوماسیون و ارتباطات</h2>
          <p>صورت‌جلسه و گراف رسمی فعالیت‌های فنی، تعمیراتی و نگهداری میدانی</p>
        </div>
        <div style="text-align:left; font-size:12px;">
          <div>تاریخ چاپ: ${jalaliNow}</div>
          <div>تعداد رکوردها: ${list.length}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width:30px;">ردیف</th>
            <th style="width:90px;">تاریخ/ساعت</th>
            <th style="width:130px;">مجری (پرسنلی)</th>
            <th style="width:100px;">واحد خدمتی</th>
            <th style="width:140px;">نوع فعالیت</th>
            <th style="width:110px;">کدهای تجهیز</th>
            <th>شرح خلاصه اقدام</th>
            <th style="width:70px;">وضعیت</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>

      <div class="signatures">
        <div><strong>امضاء تکنسین / مجری عملیات</strong><br><br>.....................................</div>
        <div><strong>امضاء سرپرست مربوطه</strong><br><br>.....................................</div>
        <div><strong>تایید رئیس اداره اتوماسیون و ارتباطات</strong><br><br>.....................................</div>
      </div>
      <script>
        window.onload = function() { window.print(); };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

// ==========================================
// ۱۷. پشتیبان‌گیری (Backup) و بازنشانی (Restore)
// ==========================================
async function exportFullBackup() {
  try {
    const graphs = await getAllGraphRecords();
    const admins = await getAdminsList();
    const operator = window.AppState.operator;
    const supervisions = getStoredSupervisions();
    const units = getStoredUnits();

    const backupData = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      jalaliExportedAt: getFormattedJalali().fullPersian,
      data: { graphs, admins, operator, supervisions, units }
    };

    const str = JSON.stringify(backupData, null, 2);
    const blob = new Blob([str], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Automation_Backup_${getFormattedJalali().dateNumStr.replace(/\//g, '-')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('فایل پشتیبان JSON با موفقیت دریافت گردید', 'success');
  } catch (err) {
    console.error('Backup error', err);
    showToast('خطا در تهیه فایل پشتیبان', 'error');
  }
}

async function handleRestoreFile(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  if (!confirm('آیا مطمئن هستید؟ بازنشانی پشتیبان ممکن است رکوردهای قبلی را به‌روزرسانی کند.')) {
    e.target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = async (ev) => {
    try {
      const parsed = JSON.parse(ev.target.result);
      if (!parsed || !parsed.data || !Array.isArray(parsed.data.graphs)) {
        showToast('فرمت فایل پشتیبان نامعتبر است', 'error');
        return;
      }

      for (const item of parsed.data.graphs) {
        await updateGraphRecord(item);
      }

      if (Array.isArray(parsed.data.admins)) {
        for (const admin of parsed.data.admins) {
          await saveAdminUser(admin);
        }
      }

      if (parsed.data.operator) {
        localStorage.setItem('automation_operator_profile', JSON.stringify(parsed.data.operator));
        loadOperatorProfile();
      }

      if (Array.isArray(parsed.data.supervisions)) {
        saveStoredSupervisions(parsed.data.supervisions);
      }

      if (Array.isArray(parsed.data.units)) {
        saveStoredUnits(parsed.data.units);
      }

      showToast(`بازنشانی با موفقیت انجام شد: ${parsed.data.graphs.length} رکورد بازیابی گردید.`, 'success');
      loadAdminReports();
      loadAdminUsersList();
      renderOrgManagementUI();
      populateOrgDropdowns();
      updatePendingQueueCount();
    } catch (err) {
      console.error('Restore error', err);
      showToast('خطا در پردازش فایل پشتیبان', 'error');
    }
    e.target.value = '';
  };
  reader.readAsText(file);
}

// ==========================================
// ۱۸. مدیریت مدیران توسط Super Admin
// ==========================================
async function loadAdminUsersList() {
  const container = document.getElementById('adminUsersListContainer');
  if (!container) return;

  try {
    const list = await getAdminsList();
    container.innerHTML = '';

    const superRow = document.createElement('div');
    superRow.className = 'flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-700/60';
    superRow.innerHTML = `
      <div>
        <div class="font-bold text-amber-300 text-sm">احسان ابوالقاسمی</div>
        <div class="text-xs text-slate-400 font-mono">نام کاربری: admin | دسترسی: نامحدود (کل واحدها و سرپرستی‌ها)</div>
      </div>
      <span class="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-1 rounded-lg font-bold">مدیر اصلی</span>
    `;
    container.appendChild(superRow);

    if (list.length === 0) {
      const p = document.createElement('p');
      p.className = 'text-xs text-slate-400 p-2';
      p.textContent = 'مدیر فرعی دیگری هنوز تعریف نشده است.';
      container.appendChild(p);
      return;
    }

    list.forEach((admin) => {
      const row = document.createElement('div');
      row.className = 'flex items-center justify-between p-3 rounded-xl bg-slate-900/40 border border-slate-800';
      row.innerHTML = `
        <div>
          <div class="font-bold text-slate-200 text-sm">${admin.fullName || admin.username}</div>
          <div class="text-xs text-slate-400 font-mono">کاربری: ${admin.username} | واحد: ${admin.unit || 'همه'} | سرپرستی: ${admin.supervision || 'همه'}</div>
        </div>
        <button onclick="confirmDeleteAdmin('${admin.username}')" class="p-1.5 rounded-lg bg-red-950 text-red-400 hover:bg-red-900 transition" title="حذف مدیر">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </button>
      `;
      container.appendChild(row);
    });
  } catch (err) {
    console.error('Error loading admins', err);
  }
}

async function handleCreateNewAdmin(e) {
  e.preventDefault();
  const fullName = document.getElementById('newAdminFullName').value.trim();
  const username = document.getElementById('newAdminUsername').value.trim().toLowerCase();
  const password = document.getElementById('newAdminPassword').value.trim();
  const unit = document.getElementById('newAdminUnit').value.trim();
  const supervision = document.getElementById('newAdminSupervision').value.trim();

  if (!username || !password) {
    showToast('نام کاربری و رمز عبور الزامی است', 'error');
    return;
  }
  if (username === 'admin') {
    showToast('نام کاربری admin مخصوص مدیر ارشد است', 'error');
    return;
  }

  const newAdmin = {
    fullName: fullName || username,
    username,
    password,
    unit: unit || 'همه واحدها',
    supervision: supervision || 'همه سرپرستی‌ها',
    createdAt: new Date().toISOString()
  };

  try {
    await saveAdminUser(newAdmin);
    showToast(`مدیر جدید با نام کاربری ${username} با موفقیت ثبت شد`, 'success');
    document.getElementById('newAdminForm').reset();
    loadAdminUsersList();
  } catch (err) {
    console.error('Admin create error', err);
    showToast('خطا در ذخیره‌سازی مدیر جدید', 'error');
  }
}

async function confirmDeleteAdmin(username) {
  if (confirm(`آیا از حذف مدیر با نام کاربری "${username}" اطمینان دارید؟`)) {
    try {
      await deleteAdminUser(username);
      showToast('مدیر حذف گردید', 'success');
      loadAdminUsersList();
    } catch (e) {
      showToast('خطا در حذف مدیر', 'error');
    }
  }
}

// ==========================================
// ۱۹. مدیریت سرپرستی‌ها و واحدهای سازمانی (Org Structure)
// ==========================================
const DEFAULT_SUPERVISIONS = [
  'سرپرستی اتوماسیون صنعتی',
  'سرپرستی تله‌متری و ابزار دقیق',
  'سرپرستی مخابرات و ارتباطات رادیویی',
  'سرپرستی شبکه‌های صنعتی و اسکادا'
];

const DEFAULT_UNITS = [
  { name: 'واحد اتوماسیون صنعتی و PLC', supervision: 'سرپرستی اتوماسیون صنعتی' },
  { name: 'واحد تله‌متری و ابزار دقیق', supervision: 'سرپرستی تله‌متری و ابزار دقیق' },
  { name: 'واحد مخابرات و ارتباطات رادیویی', supervision: 'سرپرستی مخابرات و ارتباطات رادیویی' },
  { name: 'واحد شبکه‌های صنعتی و SCADA', supervision: 'سرپرستی شبکه‌های صنعتی و اسکادا' },
  { name: 'واحد فیبر نوری و خطوط ارتباطی', supervision: 'سرپرستی مخابرات و ارتباطات رادیویی' }
];

function getStoredSupervisions() {
  try {
    const raw = localStorage.getItem('automation_supervisions');
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Error reading supervisions', e);
  }
  return [...DEFAULT_SUPERVISIONS];
}

function saveStoredSupervisions(list) {
  localStorage.setItem('automation_supervisions', JSON.stringify(list));
  populateOrgDropdowns();
  renderOrgManagementUI();
}

function getStoredUnits() {
  try {
    const raw = localStorage.getItem('automation_units');
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((u) => (typeof u === 'string' ? { name: u, supervision: '' } : u));
      }
    }
  } catch (e) {
    console.error('Error reading units', e);
  }
  return [...DEFAULT_UNITS];
}

function saveStoredUnits(list) {
  localStorage.setItem('automation_units', JSON.stringify(list));
  populateOrgDropdowns();
  renderOrgManagementUI();
}

function handleCreateSupervision(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('newSupervisionInput');
  const name = input ? input.value.trim() : '';
  if (!name) {
    showToast('لطفاً عنوان سرپرستی را وارد کنید', 'error');
    return;
  }
  const current = getStoredSupervisions();
  if (current.includes(name)) {
    showToast('این سرپرستی قبلاً در سامانه ثبت شده است', 'warning');
    return;
  }
  current.push(name);
  saveStoredSupervisions(current);
  if (input) input.value = '';
  showToast(`سرپرستی «${name}» با موفقیت اضافه شد`, 'success');
}

function handleDeleteSupervision(index) {
  const current = getStoredSupervisions();
  const item = current[index];
  if (!item) return;
  if (confirm(`آیا از حذف سرپرستی «${item}» اطمینان دارید؟`)) {
    current.splice(index, 1);
    saveStoredSupervisions(current);
    showToast(`سرپرستی «${item}» حذف گردید`, 'info');
  }
}

function handleEditSupervision(index) {
  const current = getStoredSupervisions();
  const item = current[index];
  if (!item) return;
  const newName = prompt('عنوان جدید سرپرستی را وارد نمایید:', item);
  if (newName && newName.trim() && newName.trim() !== item) {
    const cleanName = newName.trim();
    current[index] = cleanName;
    const units = getStoredUnits();
    units.forEach((u) => {
      if (u.supervision === item) u.supervision = cleanName;
    });
    localStorage.setItem('automation_units', JSON.stringify(units));
    saveStoredSupervisions(current);
    showToast('عنوان سرپرستی با موفقیت ویرایش شد', 'success');
  }
}

function handleCreateUnit(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('newUnitInput');
  const supSelect = document.getElementById('newUnitSupervisionSelect');
  const name = input ? input.value.trim() : '';
  const supervision = supSelect ? supSelect.value : '';

  if (!name) {
    showToast('لطفاً عنوان واحد سازمانی را وارد نمایید', 'error');
    return;
  }
  const current = getStoredUnits();
  if (current.some((u) => u.name === name)) {
    showToast('این واحد قبلاً در سامانه تعریف شده است', 'warning');
    return;
  }
  current.push({ name, supervision });
  saveStoredUnits(current);
  if (input) input.value = '';
  showToast(`واحد سازمانی «${name}» با موفقیت افزوده شد`, 'success');
}

function handleDeleteUnit(index) {
  const current = getStoredUnits();
  const item = current[index];
  if (!item) return;
  if (confirm(`آیا از حذف واحد «${item.name}» اطمینان دارید؟`)) {
    current.splice(index, 1);
    saveStoredUnits(current);
    showToast(`واحد «${item.name}» حذف گردید`, 'info');
  }
}

function handleEditUnit(index) {
  const current = getStoredUnits();
  const item = current[index];
  if (!item) return;
  const newName = prompt('عنوان جدید واحد سازمانی را وارد نمایید:', item.name);
  if (newName && newName.trim() && newName.trim() !== item.name) {
    current[index].name = newName.trim();
    saveStoredUnits(current);
    showToast('عنوان واحد با موفقیت ویرایش شد', 'success');
  }
}

function resetOrgStructureToDefault() {
  if (confirm('آیا از بازنشانی سرپرستی‌ها و واحدها به مقادیر پیش‌فرض اطمینان دارید؟')) {
    saveStoredSupervisions([...DEFAULT_SUPERVISIONS]);
    saveStoredUnits([...DEFAULT_UNITS]);
    showToast('ساختار سازمانی به حالت پیش‌فرض بازنشانی شد', 'success');
  }
}

function renderOrgManagementUI() {
  const supContainer = document.getElementById('supervisionsListContainer');
  const unitContainer = document.getElementById('unitsListContainer');
  const supCountBadge = document.getElementById('supervisionsCountBadge');
  const unitCountBadge = document.getElementById('unitsCountBadge');
  const supSelectInUnitForm = document.getElementById('newUnitSupervisionSelect');

  const supervisions = getStoredSupervisions();
  const units = getStoredUnits();

  if (supCountBadge) supCountBadge.textContent = `${supervisions.length} سرپرستی`;
  if (unitCountBadge) unitCountBadge.textContent = `${units.length} واحد`;

  // رندر لیست سرپرستی‌ها
  if (supContainer) {
    supContainer.innerHTML = '';
    if (supervisions.length === 0) {
      supContainer.innerHTML = '<div class="text-xs text-slate-500 py-3 text-center">هیچ سرپرستی‌ای ثبت نشده است.</div>';
    } else {
      supervisions.forEach((sup, idx) => {
        const itemEl = document.createElement('div');
        itemEl.className = 'flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition';
        itemEl.innerHTML = `
          <div class="flex items-center gap-2.5">
            <span class="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs flex items-center justify-center font-mono font-bold">${idx + 1}</span>
            <span class="text-sm font-semibold text-slate-200">${sup}</span>
          </div>
          <div class="flex items-center gap-1.5">
            <button type="button" onclick="handleEditSupervision(${idx})" class="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-amber-300 hover:bg-slate-700 transition" title="ویرایش">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
            </button>
            <button type="button" onclick="handleDeleteSupervision(${idx})" class="p-1.5 rounded-lg bg-red-950/60 text-red-400 hover:bg-red-900 hover:text-red-200 transition" title="حذف">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
        `;
        supContainer.appendChild(itemEl);
      });
    }
  }

  // رندر انتخاب سرپرستی والد در فرم واحد جدید
  if (supSelectInUnitForm) {
    const prevVal = supSelectInUnitForm.value;
    supSelectInUnitForm.innerHTML = '<option value="">-- بدون سرپرستی والد (مستقل) --</option>';
    supervisions.forEach((sup) => {
      const opt = document.createElement('option');
      opt.value = sup;
      opt.textContent = sup;
      supSelectInUnitForm.appendChild(opt);
    });
    if (prevVal) supSelectInUnitForm.value = prevVal;
  }

  // رندر لیست واحدها
  if (unitContainer) {
    unitContainer.innerHTML = '';
    if (units.length === 0) {
      unitContainer.innerHTML = '<div class="text-xs text-slate-500 py-3 text-center">هیچ واحدی ثبت نشده است.</div>';
    } else {
      units.forEach((unit, idx) => {
        const itemEl = document.createElement('div');
        itemEl.className = 'flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition';
        itemEl.innerHTML = `
          <div>
            <div class="flex items-center gap-2">
              <span class="w-6 h-6 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs flex items-center justify-center font-mono font-bold">${idx + 1}</span>
              <span class="text-sm font-semibold text-slate-200">${unit.name}</span>
            </div>
            ${unit.supervision ? `<div class="text-xs text-slate-400 font-sans mt-0.5 pr-8">سرپرستی: ${unit.supervision}</div>` : ''}
          </div>
          <div class="flex items-center gap-1.5">
            <button type="button" onclick="handleEditUnit(${idx})" class="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-amber-300 hover:bg-slate-700 transition" title="ویرایش">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
            </button>
            <button type="button" onclick="handleDeleteUnit(${idx})" class="p-1.5 rounded-lg bg-red-950/60 text-red-400 hover:bg-red-900 hover:text-red-200 transition" title="حذف">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
        `;
        unitContainer.appendChild(itemEl);
      });
    }
  }
}

function updateModalUnitsDropdown(preserveValue) {
  const modalSupSelect = document.getElementById('modalSupervision');
  const modalUnitSelect = document.getElementById('modalUnit');
  if (!modalUnitSelect) return;

  const selectedSup = modalSupSelect ? modalSupSelect.value.trim() : '';
  const allUnits = getStoredUnits();
  const curVal = preserveValue !== undefined ? preserveValue : modalUnitSelect.value;

  modalUnitSelect.innerHTML = '<option value="">-- انتخاب واحد خدمتی --</option>';

  const filteredUnits = selectedSup
    ? allUnits.filter((u) => !u.supervision || u.supervision === selectedSup)
    : allUnits;

  if (filteredUnits.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.disabled = true;
    opt.textContent = selectedSup
      ? 'واحدی برای این سرپرستی توسط مدیر تعریف نشده است'
      : 'هیچ واحدی توسط مدیر ثبت نشده است';
    modalUnitSelect.appendChild(opt);
  } else {
    filteredUnits.forEach((u) => {
      const opt = document.createElement('option');
      opt.value = u.name;
      opt.textContent = u.supervision && !selectedSup ? `${u.name} (${u.supervision})` : u.name;
      modalUnitSelect.appendChild(opt);
    });
  }

  if (curVal && filteredUnits.some((u) => u.name === curVal)) {
    modalUnitSelect.value = curVal;
  } else if (curVal) {
    const opt = document.createElement('option');
    opt.value = curVal;
    opt.textContent = curVal;
    modalUnitSelect.appendChild(opt);
    modalUnitSelect.value = curVal;
  }
}

function populateOrgDropdowns() {
  const supervisions = getStoredSupervisions();
  const units = getStoredUnits();

  // ۱. نوار انتخاب سرپرستی در مشخصات پرسنلی
  const modalSupSelect = document.getElementById('modalSupervision');
  if (modalSupSelect) {
    const curVal = modalSupSelect.value;
    modalSupSelect.innerHTML = '<option value="">-- انتخاب سرپرستی مربوطه --</option>';
    if (supervisions.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.disabled = true;
      opt.textContent = 'هیچ سرپرستی‌ای توسط مدیر تعریف نشده است';
      modalSupSelect.appendChild(opt);
    } else {
      supervisions.forEach((sup) => {
        const opt = document.createElement('option');
        opt.value = sup;
        opt.textContent = sup;
        modalSupSelect.appendChild(opt);
      });
    }
    if (curVal && supervisions.includes(curVal)) {
      modalSupSelect.value = curVal;
    }
  }

  // ۲. نوار انتخاب واحد در مشخصات پرسنلی
  updateModalUnitsDropdown();

  // ۳. فیلتر واحد در گزارش‌های ادمین
  const filterUnitSelect = document.getElementById('filterUnitSelect');
  if (filterUnitSelect) {
    const curVal = filterUnitSelect.value;
    filterUnitSelect.innerHTML = '<option value="">همه واحدها</option>';
    units.forEach((u) => {
      const opt = document.createElement('option');
      opt.value = u.name;
      opt.textContent = u.name;
      filterUnitSelect.appendChild(opt);
    });
    if (curVal) filterUnitSelect.value = curVal;
  }

  // ۴. تعریف مدیر جدید - واحد و سرپرستی
  const newAdminUnitSelect = document.getElementById('newAdminUnit');
  if (newAdminUnitSelect) {
    const curVal = newAdminUnitSelect.value;
    newAdminUnitSelect.innerHTML = '<option value="همه واحدها">کل واحدها (بدون محدودیت)</option>';
    units.forEach((u) => {
      const opt = document.createElement('option');
      opt.value = u.name;
      opt.textContent = u.name;
      newAdminUnitSelect.appendChild(opt);
    });
    if (curVal) newAdminUnitSelect.value = curVal;
  }

  const newAdminSupSelect = document.getElementById('newAdminSupervision');
  if (newAdminSupSelect) {
    const curVal = newAdminSupSelect.value;
    newAdminSupSelect.innerHTML = '<option value="همه سرپرستی‌ها">کل سرپرستی‌ها (بدون محدودیت)</option>';
    supervisions.forEach((sup) => {
      const opt = document.createElement('option');
      opt.value = sup;
      opt.textContent = sup;
      newAdminSupSelect.appendChild(opt);
    });
    if (curVal) newAdminSupSelect.value = curVal;
  }
}

function preparePersonnelModal() {
  populateOrgDropdowns();
  const op = window.AppState.operator;
  if (op) {
    const fn = document.getElementById('modalFirstName');
    const ln = document.getElementById('modalLastName');
    const pid = document.getElementById('modalPersonnelId');
    const sup = document.getElementById('modalSupervision');
    const role = document.getElementById('modalRole');

    if (fn) fn.value = op.firstName || '';
    if (ln) ln.value = op.lastName || '';
    if (pid) pid.value = op.personnelId || '';
    if (sup && op.supervision) sup.value = op.supervision;
    updateModalUnitsDropdown(op.unit || '');
    if (role) role.value = op.role || '';
  } else {
    updateModalUnitsDropdown('');
  }
}

// ==========================================
// ۲۰. سیستم اعلان‌ها (Toasts) و مودال‌ها
// ==========================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  let bg = 'bg-slate-800 text-slate-100 border-slate-700';
  let icon = '<svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';

  if (type === 'success') {
    bg = 'bg-emerald-950/95 text-emerald-100 border-emerald-600';
    icon = '<svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>';
  } else if (type === 'error') {
    bg = 'bg-red-950/95 text-red-100 border-red-600';
    icon = '<svg class="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>';
  } else if (type === 'warning') {
    bg = 'bg-amber-950/95 text-amber-100 border-amber-600';
    icon = '<svg class="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>';
  }

  toast.className = `flex items-center gap-3 p-3.5 rounded-xl border shadow-xl text-sm font-medium transition-all transform duration-300 translate-y-2 opacity-0 ${bg}`;
  toast.innerHTML = `
    <div class="shrink-0">${icon}</div>
    <div class="flex-1 text-right leading-snug">${message}</div>
    <button type="button" class="text-slate-400 hover:text-slate-200" onclick="this.parentElement.remove()">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
    </button>
  `;

  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 350);
  }, 4500);
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove('hidden');
    if (id === 'personnelModal') {
      preparePersonnelModal();
    } else if (id === 'loginModal') {
      const loginForm = document.getElementById('adminLoginForm');
      if (loginForm) loginForm.reset();
      const userInp = document.getElementById('loginUsername');
      const passInp = document.getElementById('loginPassword');
      if (userInp) userInp.value = '';
      if (passInp) passInp.value = '';
    }
  }
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('hidden');
}

// ==========================================
// ۲۱. آماده‌سازی PWA و نصب روی موبایل
// ==========================================
function setupPWAInstall() {
  const btn = document.getElementById('pwaInstallBtn');

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.AppState.deferredPrompt = e;
    if (btn) btn.classList.remove('hidden');
  });

  if (btn) {
    btn.addEventListener('click', async () => {
      if (window.AppState.deferredPrompt) {
        window.AppState.deferredPrompt.prompt();
        const { outcome } = await window.AppState.deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          showToast('برنامه با موفقیت در حال نصب روی دستگاه شماست', 'success');
          btn.classList.add('hidden');
        }
        window.AppState.deferredPrompt = null;
      } else {
        openModal('iosInstallModal');
      }
    });
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js')
        .then((reg) => console.log('[PWA] Service Worker registered with scope:', reg.scope))
        .catch((err) => console.warn('[PWA] Service Worker registration failed:', err));
    });
  }
}

// ==========================================
// ۲۲. آغاز به کار سیستم (Init)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  loadOperatorProfile();
  populateOrgDropdowns();
  renderOrgManagementUI();
  updateLiveClock();
  setInterval(updateLiveClock, 1000);
  updateGPSLocation();
  setupCameraInput();
  updateNetworkStatusIndicator();
  updatePendingQueueCount();
  setupPWAInstall();
  initCentralServerSSE();

  // در صورتی که سیستم در زمان باز شدن آنلاین باشد، کلیه رکوردهای باقیمانده بلادرنگ ارسال می‌شوند
  setTimeout(() => {
    if (navigator.onLine) {
      syncPendingRecords({ isAuto: true, silent: true });
    }
  }, 1200);

  const graphForm = document.getElementById('graphRegistrationForm');
  if (graphForm) graphForm.addEventListener('submit', handleGraphFormSubmit);

  const personnelForm = document.getElementById('personnelProfileForm');
  if (personnelForm) personnelForm.addEventListener('submit', saveOperatorProfile);

  const modalSupSelect = document.getElementById('modalSupervision');
  if (modalSupSelect) {
    modalSupSelect.addEventListener('change', () => updateModalUnitsDropdown());
  }

  const loginForm = document.getElementById('adminLoginForm');
  if (loginForm) loginForm.addEventListener('submit', handleAdminLogin);

  const newAdminForm = document.getElementById('newAdminForm');
  if (newAdminForm) newAdminForm.addEventListener('submit', handleCreateNewAdmin);

  const newSupForm = document.getElementById('newSupervisionForm');
  if (newSupForm) newSupForm.addEventListener('submit', handleCreateSupervision);

  const newUnitForm = document.getElementById('newUnitForm');
  if (newUnitForm) newUnitForm.addEventListener('submit', handleCreateUnit);

  const restoreInput = document.getElementById('restoreFileInput');
  if (restoreInput) restoreInput.addEventListener('change', handleRestoreFile);
});
