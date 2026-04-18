// cultures.js — Module Cultures Potager Magique
// Couche de persistance localStorage — aucun import croisé (NFR17)

const LS_CULTURES_KEY       = 'pm_cultures';
const LS_PREFS_KEY          = 'pm_preferences';
const LS_SCHEMA_VERSION_KEY = 'pm_schema_version';
const SCHEMA_VERSION        = '2';

const DEFAULT_PREFERENCES = {
  modeDefault:  'exterieur',
  coordinates:  { lat: 47.7914, lon: 1.7664 }  // Mézières-lez-Cléry (NFR15)
};

// ─── Migration / Init schéma ────────────────────────────────────────────────

/**
 * Initialise ou migre le schéma localStorage PM.
 * N'écrase jamais la clé `gdn3` (données jardin existantes — AR4).
 */
function _initSchema() {
  const version = localStorage.getItem(LS_SCHEMA_VERSION_KEY);
  if (!version) {
    // Premier démarrage ou migration depuis jardin pur
    if (!localStorage.getItem(LS_CULTURES_KEY)) {
      try { localStorage.setItem(LS_CULTURES_KEY, JSON.stringify([])); } catch (_) { /* quota */ }
    }
    if (!localStorage.getItem(LS_PREFS_KEY)) {
      try { localStorage.setItem(LS_PREFS_KEY, JSON.stringify(DEFAULT_PREFERENCES)); } catch (_) { /* quota */ }
    }
    try { localStorage.setItem(LS_SCHEMA_VERSION_KEY, SCHEMA_VERSION); } catch (_) { /* quota */ }
  }
  // Espace réservé pour migrations futures (version "3", etc.)
}

// ─── Helpers internes ────────────────────────────────────────────────────────

function _readCultures() {
  try {
    const raw = localStorage.getItem(LS_CULTURES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];  // localStorage corrompu — retour silencieux (NFR7)
  }
}

function _saveCultures(arr) {
  try {
    localStorage.setItem(LS_CULTURES_KEY, JSON.stringify(arr));
  } catch (err) {
    console.warn('[CulturesModule] localStorage write failed:', err.message);
  }
}

function _generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

// ─── API publique ────────────────────────────────────────────────────────────

/** Retourne toutes les cultures (tableau, jamais null) */
function getAll() {
  return _readCultures();
}

/** Retourne les cultures actives — statut ≠ 'recoltee' (FR28) */
function getActive() {
  return _readCultures().filter(c => c.statut !== 'recoltee');
}

/** Retourne une culture par id, ou undefined */
function getById(id) {
  return _readCultures().find(c => c.id === id);
}

/**
 * Ajoute une culture.
 * @param {object} culture - { espece, dateSemis, localisation, statut, dateStatut }
 * @returns {object} culture créée avec son id
 */
function add(culture) {
  const cultures = _readCultures();
  const entry = {
    id:          _generateId(),
    espece:      culture.espece      || '',
    dateSemis:   culture.dateSemis   || new Date().toISOString().split('T')[0],
    localisation:culture.localisation || DEFAULT_PREFERENCES.modeDefault,
    statut:      culture.statut      || 'semee',
    dateStatut:  culture.dateStatut  || new Date().toISOString().split('T')[0]
  };
  cultures.push(entry);
  _saveCultures(cultures);
  document.dispatchEvent(new CustomEvent('pm:culture-added', { detail: entry }));
  return entry;
}

/**
 * Met à jour une culture existante.
 * @param {string} id
 * @param {object} changes - champs à modifier
 * @returns {object|null} culture mise à jour, ou null si introuvable
 */
function update(id, changes) {
  const cultures = _readCultures();
  const idx = cultures.findIndex(c => c.id === id);
  if (idx === -1) return null;
  cultures[idx] = Object.assign({}, cultures[idx], changes);
  _saveCultures(cultures);
  document.dispatchEvent(new CustomEvent('pm:culture-updated', { detail: { id, changes } }));
  return cultures[idx];
}

/**
 * Supprime une culture.
 * @param {string} id
 * @returns {boolean} true si supprimée, false si introuvable
 */
function deleteCulture(id) {
  const cultures = _readCultures();
  const filtered = cultures.filter(c => c.id !== id);
  if (filtered.length === cultures.length) return false;
  _saveCultures(filtered);
  document.dispatchEvent(new CustomEvent('pm:culture-deleted', { detail: { id } }));
  return true;
}

// ─── Auto-init au chargement du module ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', _initSchema);

// ─── API publique globale (AR3) ──────────────────────────────────────────────
window.CulturesModule = {
  getAll,
  getActive,
  getById,
  add,
  update,
  delete: deleteCulture
};
