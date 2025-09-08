import { importVinaturelFromCsv } from '../services/vinaturel-csv-importer';

async function main() {
  const count = await importVinaturelFromCsv();
  console.log(`Imported/updated ${count} wines from CSV.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
