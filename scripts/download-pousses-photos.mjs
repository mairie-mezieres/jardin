/**
 * download-pousses-photos.mjs
 * Télécharge des photos de plantes depuis Wikimedia Commons
 * et les sauvegarde dans assets/pousses/ pour chaque espèce × stade.
 *
 * Usage : node scripts/download-pousses-photos.mjs
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ─── Mapping espèce → terme de recherche Wikimedia (seedling si dispo) ────────
// On cherche d'abord des photos de plantules/semis, puis la plante adulte en fallback

const SEARCH_TERMS = {
  // Solanées
  tomate:    ['Tomato seedling', 'Tomato plant'],
  poivron:   ['Capsicum seedling', 'Bell pepper plant'],
  aubergine: ['Eggplant seedling', 'Solanum melongena'],

  // Cucurbitacées
  concombre: ['Cucumber seedling', 'Cucumis sativus'],
  courgette: ['Zucchini seedling', 'Cucurbita pepo'],
  courge:    ['Pumpkin seedling', 'Cucurbita maxima'],

  // Légumineuses
  haricot:   ['Bean seedling', 'Phaseolus vulgaris seedling'],
  pois:      ['Pea seedling', 'Pisum sativum'],
  feve:      ['Vicia faba seedling', 'Broad bean seedling'],

  // Apiacées
  carotte:   ['Carrot seedling', 'Daucus carota seedling'],
  fenouil:   ['Fennel seedling', 'Foeniculum vulgare'],
  persil:    ['Parsley seedling', 'Petroselinum crispum'],

  // Astéracées
  laitue:    ['Lettuce seedling', 'Lactuca sativa seedling'],
  chichoree: ['Chicory seedling', 'Cichorium intybus'],

  // Brassicacées
  brocoli:   ['Broccoli seedling', 'Brassica oleracea seedling'],
  chou:      ['Cabbage seedling', 'Brassica oleracea capitata'],
  radis:     ['Radish seedling', 'Raphanus sativus seedling'],

  // Chénopodiacées
  epinard:   ['Spinach seedling', 'Spinacia oleracea'],
  blette:    ['Swiss chard seedling', 'Beta vulgaris cicla'],

  // Alliacées
  ail:       ['Garlic seedling', 'Allium sativum'],
  oignon:    ['Onion seedling', 'Allium cepa seedling'],
  poireau:   ['Leek seedling', 'Allium porrum seedling'],
};

const STADES = ['germination', 'cotyledons', 'vraies-feuilles'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'PotagerMagique/1.0 (educational project)' }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  return res.json();
}

/**
 * Recherche une image sur Wikimedia Commons pour un terme donné.
 * Retourne l'URL directe du fichier image ou null.
 */
async function searchWikimediaImage(searchTerm) {
  const searchUrl = new URL('https://commons.wikimedia.org/w/api.php');
  searchUrl.searchParams.set('action', 'query');
  searchUrl.searchParams.set('list', 'search');
  searchUrl.searchParams.set('srsearch', `${searchTerm} filetype:bitmap`);
  searchUrl.searchParams.set('srnamespace', '6'); // NS File
  searchUrl.searchParams.set('srlimit', '5');
  searchUrl.searchParams.set('format', 'json');
  searchUrl.searchParams.set('origin', '*');

  const data = await fetchJson(searchUrl.toString());
  const results = data?.query?.search || [];
  if (results.length === 0) return null;

  // Prendre le premier résultat — récupérer son URL directe
  const title = results[0].title; // ex: "File:Tomato_seedling.jpg"
  return getFileUrl(title);
}

/**
 * Obtient l'URL directe d'un fichier Wikimedia Commons.
 */
async function getFileUrl(fileTitle) {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('titles', fileTitle);
  url.searchParams.set('prop', 'imageinfo');
  url.searchParams.set('iiprop', 'url');
  url.searchParams.set('iiurlwidth', '400');
  url.searchParams.set('format', 'json');
  url.searchParams.set('origin', '*');

  const data = await fetchJson(url.toString());
  const pages = data?.query?.pages || {};
  const page = Object.values(pages)[0];
  return page?.imageinfo?.[0]?.thumburl || page?.imageinfo?.[0]?.url || null;
}

/**
 * Télécharge une image depuis une URL et la sauvegarde en fichier.
 */
async function downloadImage(imageUrl, destPath) {
  const res = await fetch(imageUrl, {
    headers: { 'User-Agent': 'PotagerMagique/1.0 (educational project)' }
  });
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
  const buffer = await res.arrayBuffer();
  await writeFile(destPath, Buffer.from(buffer));
  return buffer.byteLength;
}

/**
 * Trouve et télécharge une image pour une espèce.
 * Essaie les termes de recherche dans l'ordre.
 * Retourne l'URL utilisée ou null en cas d'échec.
 */
async function fetchBestImage(especeId) {
  const terms = SEARCH_TERMS[especeId] || [especeId];
  for (const term of terms) {
    try {
      const imageUrl = await searchWikimediaImage(term);
      if (imageUrl) return imageUrl;
    } catch (err) {
      console.warn(`  ⚠️  "${term}" : ${err.message}`);
    }
  }
  return null;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('📥 Téléchargement des photos de pousses depuis Wikimedia Commons\n');

  // Lire pousses-data.json pour connaître la structure
  const dataPath = path.join(ROOT, 'pousses-data.json');
  const rawData  = JSON.parse(await readFile(dataPath, 'utf8'));

  let downloaded = 0;
  let failed     = 0;

  for (const famille of rawData.familles || []) {
    for (const especeId of (famille.especes || [])) {
      // Trouver l'espèce dans _data.especes
      const espece = (rawData.especes || []).find(e => e.id === especeId);
      if (!espece) continue;

      console.log(`🌱 ${espece.nom} (${especeId})`);

      // Chercher une image représentative pour cette espèce
      let imageUrl = null;
      try {
        imageUrl = await fetchBestImage(especeId);
      } catch (err) {
        console.error(`  ❌ Erreur recherche : ${err.message}`);
      }

      if (!imageUrl) {
        console.log(`  ⚠️  Aucune image trouvée\n`);
        failed++;
        continue;
      }

      console.log(`  ✅ Image : ${imageUrl.slice(0, 80)}…`);

      // Télécharger et sauvegarder pour chaque stade (même image pour tous les stades)
      const photos = espece.photos || {};
      let especeOk = true;

      for (const stade of STADES) {
        const relPath = photos[stade];
        if (!relPath) continue;

        const destPath = path.join(ROOT, relPath);
        const destDir  = path.dirname(destPath);

        // Créer le dossier si nécessaire
        if (!existsSync(destDir)) {
          await mkdir(destDir, { recursive: true });
        }

        try {
          const bytes = await downloadImage(imageUrl, destPath);
          console.log(`  💾 ${relPath} (${(bytes / 1024).toFixed(0)} Ko)`);
        } catch (err) {
          console.error(`  ❌ Download échoué [${stade}] : ${err.message}`);
          especeOk = false;
        }

        // Pause courte pour ne pas surcharger Wikimedia
        await new Promise(r => setTimeout(r, 300));
      }

      if (especeOk) downloaded++;
      else failed++;
      console.log('');
    }
  }

  console.log('─'.repeat(50));
  console.log(`✅ ${downloaded} espèces téléchargées`);
  if (failed > 0) console.log(`⚠️  ${failed} espèces en échec — vérifiez les messages ci-dessus`);
  console.log('\nRelance git add + commit + push pour mettre à jour GitHub Pages.');
}

main().catch(err => {
  console.error('Erreur fatale :', err);
  process.exit(1);
});
