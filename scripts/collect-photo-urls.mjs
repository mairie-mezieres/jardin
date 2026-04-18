/**
 * collect-photo-urls.mjs
 * Collecte les URLs d'images depuis Wikimedia Commons et met à jour pousses-data.json
 * pour utiliser des URLs en ligne à la place des chemins locaux vides.
 *
 * Usage : node scripts/collect-photo-urls.mjs
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const SEARCH_TERMS = {
  tomate:    ['Tomato seedling', 'Tomato plant'],
  poivron:   ['Capsicum seedling', 'Bell pepper seedling'],
  aubergine: ['Eggplant seedling', 'Solanum melongena seedling'],
  concombre: ['Cucumber seedling', 'Cucumis sativus seedling'],
  courgette: ['Zucchini seedling', 'Cucurbita pepo seedling'],
  courge:    ['Pumpkin seedling', 'Cucurbita maxima'],
  haricot:   ['Bean seedling', 'Phaseolus vulgaris seedling'],
  pois:      ['Pea seedling', 'Pisum sativum seedling'],
  feve:      ['Vicia faba seedling', 'Broad bean seedling'],
  carotte:   ['Carrot seedling', 'Daucus carota seedling'],
  fenouil:   ['Fennel seedling', 'Foeniculum vulgare seedling'],
  persil:    ['Parsley seedling', 'Petroselinum crispum seedling'],
  laitue:    ['Lettuce seedling', 'Lactuca sativa seedling'],
  chichoree: ['Chicory seedling', 'Cichorium intybus seedling'],
  brocoli:   ['Broccoli seedling', 'Brassica oleracea seedling'],
  chou:      ['Cabbage seedling', 'Brassica oleracea capitata seedling'],
  radis:     ['Radish seedling', 'Raphanus sativus seedling'],
  epinard:   ['Spinach seedling', 'Spinacia oleracea seedling'],
  blette:    ['Swiss chard seedling', 'Beta vulgaris seedling'],
  ail:       ['Garlic seedling', 'Allium sativum seedling'],
  oignon:    ['Onion seedling', 'Allium cepa seedling'],
  poireau:   ['Leek seedling', 'Allium porrum seedling'],
};

async function fetchJson(url) {
  await new Promise(r => setTimeout(r, 500)); // éviter rate-limit
  const res = await fetch(url, {
    headers: { 'User-Agent': 'PotagerMagique/1.0 (educational-bot)' }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function searchWikimediaImage(searchTerm) {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('list', 'search');
  url.searchParams.set('srsearch', `${searchTerm} filetype:bitmap`);
  url.searchParams.set('srnamespace', '6');
  url.searchParams.set('srlimit', '5');
  url.searchParams.set('format', 'json');
  url.searchParams.set('origin', '*');
  const data = await fetchJson(url.toString());
  const results = data?.query?.search || [];
  if (results.length === 0) return null;
  return getFileUrl(results[0].title);
}

async function getFileUrl(fileTitle) {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('titles', fileTitle);
  url.searchParams.set('prop', 'imageinfo');
  url.searchParams.set('iiprop', 'url');
  url.searchParams.set('iiurlwidth', '500');
  url.searchParams.set('format', 'json');
  url.searchParams.set('origin', '*');
  const data = await fetchJson(url.toString());
  const pages = data?.query?.pages || {};
  const page = Object.values(pages)[0];
  return page?.imageinfo?.[0]?.thumburl || page?.imageinfo?.[0]?.url || null;
}

async function findBestUrl(especeId) {
  const terms = SEARCH_TERMS[especeId] || [especeId];
  for (const term of terms) {
    try {
      const imgUrl = await searchWikimediaImage(term);
      if (imgUrl) return imgUrl;
    } catch (e) {
      console.warn(`  ⚠️  "${term}": ${e.message}`);
    }
  }
  return null;
}

async function main() {
  console.log('🔍 Collecte des URLs Wikimedia Commons…\n');

  const dataPath = path.join(ROOT, 'pousses-data.json');
  const data = JSON.parse(await readFile(dataPath, 'utf8'));

  // Collecter toutes les espèces en une seule passe
  const allEspeces = data.especes || [];
  const urlMap = {};

  for (const espece of allEspeces) {
    process.stdout.write(`🌱 ${espece.nom.padEnd(14)} `);
    const imgUrl = await findBestUrl(espece.id);
    if (imgUrl) {
      urlMap[espece.id] = imgUrl;
      console.log(`✅ ${imgUrl.slice(0, 70)}…`);
    } else {
      console.log(`❌ pas d'image`);
    }
  }

  // Mettre à jour pousses-data.json : remplacer les chemins locaux par les URLs
  let updated = 0;
  for (const espece of data.especes) {
    const imgUrl = urlMap[espece.id];
    if (!imgUrl) continue;
    // Utiliser la même URL pour les 3 stades (faute de photos par stade)
    espece.photos = {
      germination:       imgUrl,
      cotyledons:        imgUrl,
      'vraies-feuilles': imgUrl,
    };
    updated++;
  }

  await writeFile(dataPath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`\n✅ ${updated}/${allEspeces.length} espèces mises à jour dans pousses-data.json`);
  console.log('👉 Lance maintenant : git add pousses-data.json && git commit && git push\n');
}

main().catch(err => { console.error(err); process.exit(1); });
