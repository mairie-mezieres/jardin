/**
 * download-pexels-photos.mjs
 * Télécharge des photos de pousses/plantules depuis l'API Pexels
 * et les sauvegarde dans assets/pousses/ pour chaque espèce × stade.
 *
 * Usage : node scripts/download-pexels-photos.mjs
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const API_KEY = 'ba858MgveCAdM8YUHecPzvvTKDhM9v0F73Tf7s1g2RVpaJIEDY52GhL5';

// Termes de recherche Pexels par espèce et par stade
// Stade 1 : germination (tout petit, hypocotyle)
// Stade 2 : cotylédons (premières feuilles embryonnaires)
// Stade 3 : vraies feuilles (plantule reconnaissable)
const ESPECES = [
  { id: 'tomate',    famille: 'solanees',        queries: ['tomato seedling sprout', 'tomato sprout germination', 'tomato young plant seedling'] },
  { id: 'poivron',   famille: 'solanees',        queries: ['pepper seedling sprout', 'capsicum seedling', 'pepper plant seedling young'] },
  { id: 'aubergine', famille: 'solanees',        queries: ['eggplant seedling sprout', 'aubergine seedling', 'eggplant young plant'] },
  { id: 'concombre', famille: 'cucurbitacees',   queries: ['cucumber seedling sprout', 'cucumber germination seedling', 'cucumber plant young'] },
  { id: 'courgette', famille: 'cucurbitacees',   queries: ['zucchini seedling sprout', 'courgette seedling', 'zucchini young plant'] },
  { id: 'courge',    famille: 'cucurbitacees',   queries: ['pumpkin seedling sprout', 'squash seedling germination', 'pumpkin young plant'] },
  { id: 'haricot',   famille: 'legumineuses',    queries: ['bean seedling sprout', 'bean germination sprout', 'bean plant seedling young'] },
  { id: 'pois',      famille: 'legumineuses',    queries: ['pea seedling sprout', 'pea plant germination', 'pea young plant seedling'] },
  { id: 'feve',      famille: 'legumineuses',    queries: ['broad bean seedling sprout', 'fava bean seedling', 'broad bean young plant'] },
  { id: 'carotte',   famille: 'apiacees',        queries: ['carrot seedling sprout', 'carrot germination seedling', 'carrot young plant'] },
  { id: 'fenouil',   famille: 'apiacees',        queries: ['fennel seedling sprout', 'fennel plant young seedling', 'fennel germination'] },
  { id: 'persil',    famille: 'apiacees',        queries: ['parsley seedling sprout', 'parsley germination plant', 'parsley young seedling'] },
  { id: 'laitue',    famille: 'asteracees',      queries: ['lettuce seedling sprout', 'lettuce germination seedling', 'lettuce young plant'] },
  { id: 'chichoree', famille: 'asteracees',      queries: ['chicory seedling sprout', 'chicory plant young seedling', 'chicory germination'] },
  { id: 'brocoli',   famille: 'brassicacees',    queries: ['broccoli seedling sprout', 'broccoli germination seedling', 'broccoli young plant'] },
  { id: 'chou',      famille: 'brassicacees',    queries: ['cabbage seedling sprout', 'cabbage germination seedling', 'cabbage young plant'] },
  { id: 'radis',     famille: 'brassicacees',    queries: ['radish seedling sprout', 'radish germination seedling', 'radish young plant'] },
  { id: 'epinard',   famille: 'chenopodiacees',  queries: ['spinach seedling sprout', 'spinach germination seedling', 'spinach young plant'] },
  { id: 'blette',    famille: 'chenopodiacees',  queries: ['swiss chard seedling sprout', 'chard seedling germination', 'swiss chard young plant'] },
  { id: 'ail',       famille: 'alliacees',       queries: ['garlic seedling sprout', 'garlic germination seedling', 'garlic young plant'] },
  { id: 'oignon',    famille: 'alliacees',       queries: ['onion seedling sprout', 'onion germination seedling', 'onion young plant'] },
  { id: 'poireau',   famille: 'alliacees',       queries: ['leek seedling sprout', 'leek germination seedling', 'leek young plant'] },
];

const STADES = ['germination', 'cotyledons', 'vraies-feuilles'];

async function pexelsSearch(query, page = 1) {
  const url = new URL('https://api.pexels.com/v1/search');
  url.searchParams.set('query', query);
  url.searchParams.set('per_page', '3');
  url.searchParams.set('page', String(page));
  url.searchParams.set('orientation', 'square');

  const res = await fetch(url.toString(), {
    headers: { Authorization: API_KEY }
  });
  if (!res.ok) throw new Error(`Pexels API HTTP ${res.status}`);
  return res.json();
}

async function downloadBytes(imageUrl) {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Download HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function fetchPhotoForStade(query, stadeIndex) {
  const data = await pexelsSearch(query);
  const photos = data.photos || [];
  if (photos.length === 0) return null;
  // Prendre des photos différentes selon le stade si possible
  const photo = photos[Math.min(stadeIndex, photos.length - 1)];
  return photo?.src?.large || photo?.src?.medium || null;
}

async function main() {
  console.log('📥 Téléchargement photos Pexels — pousses de légumes\n');

  // Charger pousses-data.json pour mettre à jour les chemins
  const dataPath = path.join(ROOT, 'pousses-data.json');
  const poussesData = JSON.parse(await readFile(dataPath, 'utf8'));
  const especesData = poussesData.especes || [];

  let ok = 0, fail = 0;

  for (const espece of ESPECES) {
    console.log(`🌱 ${espece.id}`);
    const especeData = especesData.find(e => e.id === espece.id);
    const newPhotos = {};

    for (let si = 0; si < STADES.length; si++) {
      const stade = STADES[si];
      const query = espece.queries[si] || espece.queries[0];
      const localRelPath = `assets/pousses/${espece.famille}/${espece.id}/${stade}.webp`;
      const destPath = path.join(ROOT, localRelPath);
      const destDir  = path.dirname(destPath);
      if (!existsSync(destDir)) await mkdir(destDir, { recursive: true });

      try {
        const imgUrl = await fetchPhotoForStade(query, si);
        if (!imgUrl) { console.log(`  ⚠️  [${stade}] aucun résultat`); fail++; continue; }

        const bytes = await downloadBytes(imgUrl);
        await writeFile(destPath, bytes);
        console.log(`  ✅ [${stade}] ${(bytes.length / 1024).toFixed(0)} Ko`);
        newPhotos[stade] = localRelPath;
        ok++;
      } catch (err) {
        console.log(`  ❌ [${stade}] ${err.message}`);
        fail++;
      }

      await new Promise(r => setTimeout(r, 400));
    }

    // Mettre à jour pousses-data.json avec les chemins locaux téléchargés
    if (especeData && Object.keys(newPhotos).length > 0) {
      especeData.photos = { ...especeData.photos, ...newPhotos };
    }
    console.log('');
  }

  // Sauvegarder pousses-data.json mis à jour
  await writeFile(dataPath, JSON.stringify(poussesData, null, 2), 'utf8');

  console.log('─'.repeat(40));
  console.log(`✅ ${ok} photos téléchargées  ❌ ${fail} échecs`);
  console.log('pousses-data.json mis à jour avec les chemins locaux.');
}

main().catch(err => { console.error(err); process.exit(1); });
