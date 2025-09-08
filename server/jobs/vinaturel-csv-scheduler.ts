import { importVinaturelFromCsv } from '../services/vinaturel-csv-importer';

function msUntilNext(hour: number, minute: number): number {
  const now = new Date();
  const next = new Date();
  next.setHours(hour, minute, 0, 0);
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime() - now.getTime();
}

async function runOnce() {
  try {
    const count = await importVinaturelFromCsv();
    console.log(`[VINATUREL CSV] Import finished. ${count} rows imported.`);
  } catch (e) {
    console.error('[VINATUREL CSV] Import failed:', e);
  }
}

export function scheduleDailyVinaturelCsvImport(hour = 9, minute = 30) {
  const scheduleNext = () => {
    const delay = msUntilNext(hour, minute);
    console.log(`[VINATUREL CSV] Next import scheduled in ${(delay/1000/60).toFixed(1)} minutes`);
    setTimeout(async () => {
      await runOnce();
      scheduleNext();
    }, delay).unref?.();
  };
  scheduleNext();
}

