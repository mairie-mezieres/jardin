// pousses.js — Banque de photos de pousses
// Expose window.PoussesModule (AR3)
// Aucun import croisé avec les autres modules PM (NFR17)

/** @type {{ version: number, familles: Array, especes: Array, mauvaisesHerbes: Array } | null} */
let _data = null;

// ─── Chargement des données ───────────────────────────────────────────────────

async function _loadData() {
  if (_data) return;
  try {
    const res = await fetch('./pousses-data.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    _data = await res.json();
  } catch {
    // NFR7 — zéro crash en cas d'erreur réseau ou JSON invalide
    _data = { version: 0, familles: [], especes: [], mauvaisesHerbes: [] };
  }
}

// ─── API publique ─────────────────────────────────────────────────────────────

/** Retourne la liste des familles botaniques avec leurs espèces.
 *  @returns {Array<{ id: string, label: string, especes: string[] }>}
 */
function getFamilles() {
  if (!_data) return [];
  return _data.familles || [];
}

/** Retourne les espèces d'une famille donnée.
 *  @param {string} familleId
 *  @returns {Array<{ id: string, nom: string, famille: string, stades: string[], photos: object, confusions: string[] }>}
 */
function getEspecesByFamille(familleId) {
  if (!_data) return [];
  const famille = (_data.familles || []).find(f => f.id === familleId);
  if (!famille) return [];
  return famille.especes
    .map(id => (_data.especes || []).find(e => e.id === id))
    .filter(Boolean);
}

/** Retourne les chemins photos d'une espèce.
 *  @param {string} especeId
 *  @returns {{ germination?: string, cotyledons?: string, 'vraies-feuilles'?: string }}
 */
function getPhotos(especeId) {
  if (!_data) return {};
  const espece = (_data.especes || []).find(e => e.id === especeId);
  return espece ? (espece.photos || {}) : {};
}

/** Retourne la liste des mauvaises herbes communes.
 *  @returns {Array<{ id: string, nom: string, photo: string }>}
 */
function getMauvaisesHerbes() {
  if (!_data) return [];
  return _data.mauvaisesHerbes || [];
}

// ─── Initialisation ───────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  await _loadData();
  // Signale que les données sont prêtes — consommé par pousses-ui.js (Stories 4.2–4.4)
  document.dispatchEvent(new CustomEvent('pm:pousses-ready'));
});

// ─── API publique (AR3) ───────────────────────────────────────────────────────
/** Retourne les mauvaises herbes confondues avec une espèce donnée.
 *  @param {string} especeId
 *  @returns {Array<{ id: string, nom: string, photo: string }>}
 */
function getConfusionsForEspece(especeId) {
  if (!_data) return [];
  const espece = (_data.especes || []).find(e => e.id === especeId);
  if (!espece || !espece.confusions) return [];
  const herbes = _data.mauvaisesHerbes || [];
  return espece.confusions
    .map(id => herbes.find(h => h.id === id))
    .filter(Boolean);
}

window.PoussesModule = { getFamilles, getEspecesByFamille, getPhotos, getMauvaisesHerbes, getConfusionsForEspece };
