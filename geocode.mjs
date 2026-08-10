import fs from 'node:fs/promises';

const DETAILS_URL = 'https://raw.githubusercontent.com/VladislavChval/data_json/main/details.json';
const CACHE_FILE = 'geocache.json';
const USER_AGENT = 'kam-na-obed-app/1.0 (lada.chval@gmail.com)';

function normalizeAddress(address) {
  return String(address || '').trim();
}

async function loadCache() {
  try {
    const raw = await fs.readFile(CACHE_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveCache(cache) {
  await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function geocodeAddress(address) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`Nominatim error ${res.status}`);
  const data = await res.json();
  if (!data.length) return null;
  return { lat: Number(data[0].lat), lng: Number(data[0].lon) };
}

async function run() {
  console.log('Stahuji details.json...');
  const res = await fetch(DETAILS_URL);
  const details = await res.json();

  const cache = await loadCache();
  const addresses = [...new Set(details.restaurants.map(r => normalizeAddress(r.address)).filter(Boolean))];

  console.log(`Nalezeno ${addresses.length} unikátních adres, ${Object.keys(cache).length} už v cache.`);

  let geocoded = 0;
  let failed = 0;

  for (const address of addresses) {
    if (address in cache) continue;

    try {
      const coords = await geocodeAddress(address);
      if (coords) {
        cache[address] = coords;
        geocoded++;
        console.log(`OK: ${address} -> ${coords.lat}, ${coords.lng}`);
      } else {
        cache[address] = null;
        failed++;
        console.log(`Nenalezeno: ${address}`);
      }
    } catch (err) {
      console.error(`Chyba u "${address}":`, err.message);
      failed++;
    }

    await sleep(1100);
    await saveCache(cache);
  }

  console.log(`Hotovo. Geokódováno: ${geocoded}, selhalo: ${failed}, celkem v cache: ${Object.keys(cache).length}`);
}

run().catch(err => {
  console.error('Chyba:', err.message);
  process.exit(1);
});