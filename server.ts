import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

// تنظیم حجم مجاز برای دریافت داده‌های چندرسانه‌ای و تصاویر گراف‌ها
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// مسیر ذخیره‌سازی داده‌های سرور مرکزی
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'server_records.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadServerRecords(): any[] {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      const data = JSON.parse(content);
      return Array.isArray(data) ? data : [];
    }
  } catch (err) {
    console.error('Error reading server records:', err);
  }
  return [];
}

function saveServerRecords(records: any[]) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(records, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing server records:', err);
  }
}

// مدیریت اتصالات بلادرنگ (Server-Sent Events - SSE)
const sseClients = new Set<express.Response>();

function broadcastSse(eventType: string, payload: any) {
  const message = `event: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(message);
    } catch {
      sseClients.delete(client);
    }
  }
}

// ارسال هارت‌بیت دوره‌ای برای زنده نگه‌داشتن اتصال SSE
setInterval(() => {
  for (const client of sseClients) {
    try {
      client.write(': ping\n\n');
    } catch {
      sseClients.delete(client);
    }
  }
}, 25000);

// =========================================================================
// API ENDPOINTS
// =========================================================================

// ۱. بررسی وضعیت اتصال به سرور مرکزی (Health & Status Check)
app.get('/api/health', (req, res) => {
  const records = loadServerRecords();
  res.json({
    status: 'ok',
    message: 'سامانه مرکزی ثبت گراف و اتوماسیون برخط است',
    timestamp: new Date().toISOString(),
    totalRecords: records.length,
    activeSseClients: sseClients.size,
  });
});

// ۲. اشتراک بلادرنگ پیام‌ها و گزارش‌های دریافتی از PWAها (SSE Stream)
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // برای Nginx
  res.flushHeaders?.();

  sseClients.add(res);

  // ارسال پیام خوش‌آمدگویی و تایید برقراری ارتباط بلادرنگ
  res.write(
    `event: connected\ndata: ${JSON.stringify({
      message: 'اتصال بلادرنگ با سرور مرکزی برقرار شد',
      time: new Date().toISOString(),
    })}\n\n`
  );

  req.on('close', () => {
    sseClients.delete(res);
  });
});

// ۳. دریافت تمامی رکوردهای مرکزی برای نرم‌افزار اصلی و پنل ادمین
app.get('/api/records', (req, res) => {
  const records = loadServerRecords();
  res.json({
    success: true,
    count: records.length,
    records,
  });
});

// ۴. دریافت آنی تک رکورد هنگام آنلاین بودن PWA
app.post('/api/records', (req, res) => {
  try {
    const record = req.body;
    if (!record || !record.id) {
      return res.status(400).json({ success: false, message: 'اطلاعات رکورد نامعتبر است' });
    }

    const records = loadServerRecords();
    const existingIndex = records.findIndex((r) => r.id === record.id);

    const enrichedRecord = {
      ...record,
      serverReceivedAt: new Date().toISOString(),
      syncStatus: 'synced',
    };

    if (existingIndex >= 0) {
      records[existingIndex] = enrichedRecord;
    } else {
      records.unshift(enrichedRecord);
    }

    saveServerRecords(records);

    // ارسال بلادرنگ به پنل ادمین و سایر کلاینت‌های متصل
    broadcastSse('new_record', {
      record: enrichedRecord,
      operator: enrichedRecord.operatorName || 'نامشخص',
      asettCode: enrichedRecord.asettCode || '-',
      message: `گراف جدید توسط ${enrichedRecord.operatorName || 'تکنسین'} به صورت بلادرنگ دریافت شد.`,
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, record: enrichedRecord });
  } catch (err: any) {
    console.error('Error saving single record:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ۵. نقطه اتصال اصلی همگام‌سازی بلادرنگ PWA در اولین اتصال به اینترنت (Bulk Realtime Sync)
app.post('/api/sync', (req, res) => {
  try {
    const { deviceId, operator, records: incomingRecords } = req.body;

    if (!Array.isArray(incomingRecords) || incomingRecords.length === 0) {
      return res.json({ success: true, message: 'هیچ رکوردی برای همگام‌سازی ارسال نشده است', count: 0 });
    }

    const currentRecords = loadServerRecords();
    let newCount = 0;
    let updatedCount = 0;
    const nowIso = new Date().toISOString();

    for (const inc of incomingRecords) {
      if (!inc) continue;
      const incKey = inc.clientRecordId || inc.id;
      const idx = currentRecords.findIndex(
        (r) => (r.clientRecordId && r.clientRecordId === incKey) || r.id === incKey
      );
      const enriched = {
        ...inc,
        clientRecordId: inc.clientRecordId || incKey,
        syncStatus: 'synced',
        serverReceivedAt: nowIso,
        syncedVia: 'pwa_auto_realtime_sync',
      };

      if (idx >= 0) {
        currentRecords[idx] = enriched;
        updatedCount++;
      } else {
        currentRecords.unshift(enriched);
        newCount++;
      }
    }

    saveServerRecords(currentRecords);

    // انتشار نوتیفیکیشن بلادرنگ برای نرم‌افزار اصلی و پنل مدیریت
    broadcastSse('sync_batch', {
      operator: operator || 'تکنسین میدانی',
      deviceId: deviceId || 'PWA Client',
      newCount,
      updatedCount,
      totalSynced: incomingRecords.length,
      records: incomingRecords,
      timestamp: nowIso,
      message: `همگام‌سازی موفق: تعداد ${incomingRecords.length} رکورد از تکنسین (${operator || 'میدانی'}) به صورت بلادرنگ دریافت شد.`,
    });

    res.json({
      success: true,
      received: incomingRecords.length,
      newCount,
      updatedCount,
      serverTime: nowIso,
    });
  } catch (err: any) {
    console.error('Sync endpoint error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ۶. حذف رکورد از سرور مرکزی
app.delete('/api/records/:id', (req, res) => {
  try {
    const { id } = req.params;
    let records = loadServerRecords();
    const initialLen = records.length;
    records = records.filter((r) => String(r.id) !== String(id));

    if (records.length !== initialLen) {
      saveServerRecords(records);
      broadcastSse('record_deleted', { id, timestamp: new Date().toISOString() });
      res.json({ success: true, message: 'رکورد از سرور حذف گردید' });
    } else {
      res.status(404).json({ success: false, message: 'رکورد در سرور یافت نشد' });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// =========================================================================
// راه‌اندازی سرور و اتصال میدلور Vite
// =========================================================================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Central Automation Server] running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
