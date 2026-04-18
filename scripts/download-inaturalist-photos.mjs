/**
 * download-inaturalist-photos.mjs
 * Télécharge des photos de plantules depuis iNaturalist (API publique, sans clé).
 * Priorité aux observations annotées "juvenile/plantule", sinon observations vérifiées.
 *
 * Usage : node scripts/download-inaturalist-photos.mjs
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Mapping espèce → nom scientifique iNaturalist
const TAXA = {
  tomate:    'Solanum lycopersicum',
  poivron:   'Capsicum annuum',
  aubergine: 'Solanum melongena',
  concombre: 'Cucumis sativus',
  courgette: 'Cucurbita pepo',
  courge:    'Cucurbita maxima',
  haricot:   'Phaseolus vulgaris',
  pois:      'Pisum sativum',
  feve:      'Vicia faba',
  carotte:   'Daucus carota',
  fenouil:   'Foeniculum vulgare',
  persil:    'Petroselinum crispum',
  laitue:    'Lactuca sativa',
  chichoree: 'Cichorium intybus',
  brocoli:   'Brassica oleracea',
  chou:      'Brassica oleracea',
  radis:     'Raphanus sativus',
  epinard:   'Spinacia oleracea',
  blette:    'Beta vulgaris',
  ail:       'Allium sativum',
  oignon:    'Allium cepa',
  poireau:   'Allium ampeloprasum',
};

const STADES = ['germination', 'cotyledons', 'vraies-feuilles'];

async function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchJson(url) {
  await delay(800); // respecter le rate-limit iNaturalist
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'PotagerMagique/1.0 (educational project; contact: potager@example.com)',
      'Accept': 'application/json'
    }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * Recherche des observations iNaturalist pour un taxon.
 * @param {string} taxonName  nom scientifique
 * @param {object} opts  options supplémentaires (term_id, term_value_id, page)
 * @returns {Array} liste de photos URLs
 */
async function searchObservations(taxonName, opts = {}) {
  const url = new URL('https://api.inaturalist.org/v1/observations');
  url.searchParams.set('taxon_name', taxonName);
  url.searchParams.set('quality_grade', 'research');
  url.searchParams.set('photos', 'true');
  url.searchParams.set('per_page', '5');
  url.searchParams.set('order_by', 'votes');
  if (opts.term_id)       url.searchParams.set('term_id', opts.term_id);
  if (opts.term_value_id) url.searchParams.set('term_value_id', opts.term_value_id);
  if (opts.page)          url.searchParams.set('page', opts.page);

  const data = await fetchJson(url.toString());
  const photos = [];
  for (const obs of (data.results || [])) {
    for (const p of (obs.photos || [])) {
      // Remplacer "square" par "medium" dans l'URL (400px)
      const src = (p.url || '').replace('/square.', '/medium.');
      if (src && !photos.includes(src)) photos.push(src);
    }
    if (photos.length >= 6) break;
  }
  return photos;
}

/**
 * Récupère jusqu'à 3 photos distinctes pour une espèce :
 * - D'abord avec annotation "Life Stage = juvenile" (term_id=1, term_value_id=5)
 * - Puis sans filtre (observations vérifiées quelconques)
 * En combinant les deux listes on obtient des photos variées.
 */
async function getPhotosForEspece(especeId) {
  const taxon = TAXA[especeId];
  if (!taxon) return [];

  // 1. Chercher observations annotées "juvenile/plantule"
  let juvenilePhotos = [];
  try {
    juvenilePhotos = await searchObservations(taxon, { term_id: 1, term_value_id: 5 });
  } catch (e) {
    console.warn(`  ⚠️  juvenile search failed: ${e.message}`);
  }

  // 2. Chercher observations vérifiées page 1 et page 2 pour avoir de la variété
  let generalPhotos = [];
  try {
    const p1 = await searchObservations(taxon, { page: 1 });
    const p2 = await searchObservations(taxon, { page: 2 });
    generalPhotos = [...new Set([...p1, ...p2])];
  } catch (e) {
    console.warn(`  ⚠️  general search failed: ${e.message}`);
  }

  // Priorité : juvenile en premier, puis général, dédupliqué
  const merged = [...new Set([...juvenilePhotos, ...generalPhotos])];
  return merged.slice(0, 3);
}

async function downloadImage(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(destPath, buf);
  return buf.length;
}

async function main() {
  console.log('📥 iNaturalist — téléchargement photos plantules\n');

  const dataPath = path.join(ROOT, 'pousses-data.json');
  const data = JSON.parse(await readFile(dataPath, 'utf8'));

  let ok = 0, fail = 0;

  for (const espece of (data.especes || [])) {
    const famille = (data.familles || []).find(f => (f.especes || []).includes(espece.id));
    const familleId = famille?.id || 'divers';
    console.log(`🌱 ${espece.nom} (${TAXA[espece.id] || '?'})`);

    const photos = await getPhotosForEspece(espece.id);

    if (photos.length === 0) {
      console.log('  ❌ aucune photo trouvée\n');
      fail++;
      continue;
    }

    const newPhotos = {};
    for (let si = 0; si < STADES.length; si++) {
      const stade = STADES[si];
      const photoUrl = photos[si] || photos[0]; // réutilise la 1ère si moins de 3 photos
      const localPath = `assets/pousses/${familleId}/${espece.id}/${stade}.webp`;
      const destPath  = path.join(ROOT, localPath);
      const destDir   = path.dirname(destPath);

      if (!existsSync(destDir)) await mkdir(destDir, { recursive: true });

      try {
        await delay(300);
        const bytes = await downloadImage(photoUrl, destPath);
        console.log(`  ✅ [${stade}] ${(bytes / 1024).toFixed(0)} Ko — ${photoUrl.slice(0, 60)}…`);
        newPhotos[stade] = localPath;
        ok++;
      } catch (e) {
        console.log(`  ❌ [${stade}] ${e.message}`);
        fail++;
      }
    }

    if (Object.keys(newPhotos).length > 0) {
      espece.photos = { ...(espece.photos || {}), ...newPhotos };
    }
    console.log('');
  }

  await writeFile(dataPath, JSON.stringify(data, null, 2), 'utf8');
  console.log('─'.repeat(50));
  console.log(`✅ ${ok} photos  ❌ ${fail} échecs`);
  console.log('pousses-data.json mis à jour.');
}

main().catch(err => { console.error(err); process.exit(1); });
