// alertes.js — Moteur d'Alertes Critiques Potager Magique
// Écoute pm:weather-updated et pm:mode-changed (AR3, NFR17)
// Zéro import croisé

// ─── Seuils d'alerte ────────────────────────────────────────────────────────

const GEL_EXT        = 2;     // °C — seuil gel mode extérieur (FR5, FR8)
const GEL_SERRE      = -2;    // °C — seuil gel mode serre
const CANICULE_EXT   = 35;    // °C — seuil canicule mode extérieur (FR6, FR8)
const CANICULE_SERRE = 40;    // °C — seuil canicule mode serre
const GRELE_PROB     = 80;    // % — probabilité précipitations pour alerte grêle (FR7)
const GRELE_CODES    = [95, 96, 99]; // weathercodes orage avec grêle (WMO)

// ─── État interne ────────────────────────────────────────────────────────────

let _lastWeatherData = null;
let _currentMode     = 'exterieur';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Retourne l'urgence selon l'index du jour détecté (0=aujourd'hui, 1=demain) */
function _urgence(index) {
  return index === 0 ? 'Maintenant' : "Aujourd'hui";
}

/** Retourne les noms d'espèces de toutes les cultures (gel = risque universel) */
function _toutesEspeces() {
  try {
    return (window.CulturesModule?.getAll() || []).map(c => c.espece).filter(Boolean);
  } catch {
    return [];
  }
}

/** Retourne les noms d'espèces des cultures en extérieur uniquement */
function _especesExterieur() {
  try {
    return (window.CulturesModule?.getAll() || [])
      .filter(c => c.localisation === 'exterieur')
      .map(c => c.espece)
      .filter(Boolean);
  } catch {
    return [];
  }
}

// ─── Évaluateurs d'alerte ────────────────────────────────────────────────────

/**
 * Détecte risque gel dans les 48h (indices 0 et 1)
 * @param {object} daily - objet daily de Open-Meteo
 * @param {string} mode  - 'exterieur' | 'serre'
 * @returns {{ type, urgence, cultures }|null}
 */
function _evaluerGel(daily, mode) {
  const seuil = mode === 'serre' ? GEL_SERRE : GEL_EXT;
  const mins  = daily.temperature_2m_min || [];
  for (let i = 0; i < 2 && i < mins.length; i++) {
    if (typeof mins[i] === 'number' && mins[i] <= seuil) {
      return { type: 'gel', urgence: _urgence(i), cultures: _toutesEspeces() };
    }
  }
  return null;
}

/**
 * Détecte risque canicule dans les 48h (indices 0 et 1)
 * @param {object} daily - objet daily de Open-Meteo
 * @param {string} mode  - 'exterieur' | 'serre'
 * @returns {{ type, urgence, cultures }|null}
 */
function _evaluerCanicule(daily, mode) {
  const seuil = mode === 'serre' ? CANICULE_SERRE : CANICULE_EXT;
  const maxs  = daily.temperature_2m_max || [];
  for (let i = 0; i < 2 && i < maxs.length; i++) {
    if (typeof maxs[i] === 'number' && maxs[i] >= seuil) {
      return { type: 'canicule', urgence: _urgence(i), cultures: _toutesEspeces() };
    }
  }
  return null;
}

/**
 * Détecte risque grêle dans les 24h (index 0 uniquement)
 * Uniquement pour les cultures en mode extérieur.
 * @param {object} daily - objet daily de Open-Meteo
 * @returns {{ type, urgence, cultures }|null}
 */
function _evaluerGrele(daily) {
  const prob = (daily.precipitation_probability_max || [])[0];
  const code = (daily.weathercode || [])[0];
  if (prob >= GRELE_PROB && GRELE_CODES.includes(code)) {
    const culturesExt = _especesExterieur();
    if (culturesExt.length === 0) return null; // aucune culture ext → pas d'alerte
    return { type: 'grele', urgence: 'Maintenant', cultures: culturesExt };
  }
  return null;
}

// ─── API publique ────────────────────────────────────────────────────────────

/**
 * Retourne la liste des alertes actives.
 * Chaque alerte : { type: 'gel'|'canicule'|'grele', urgence: string, cultures: string[] }
 * Retourne [] si aucune donnée météo ou en cas d'erreur (NFR7).
 */
function getAlertes() {
  try {
    const daily = _lastWeatherData?.daily;
    if (!daily) return [];
    return [
      _evaluerGel(daily, _currentMode),
      _evaluerCanicule(daily, _currentMode),
      _evaluerGrele(daily)
    ].filter(Boolean);
  } catch {
    return []; // zéro plantage (NFR7)
  }
}

// ─── Abonnements DOM ─────────────────────────────────────────────────────────

document.addEventListener('pm:weather-updated', (e) => {
  if (e.detail?.data) _lastWeatherData = e.detail.data;
});

document.addEventListener('pm:mode-changed', (e) => {
  if (e.detail?.mode) _currentMode = e.detail.mode;
});

document.addEventListener('DOMContentLoaded', () => {
  // Lire le mode courant depuis PrefsModule si disponible
  if (window.PrefsModule) {
    _currentMode = window.PrefsModule.get().modeDefault || 'exterieur';
  }
  // Initialiser avec données météo déjà en cache
  if (window.MeteoModule) {
    window.MeteoModule.getWeather().then(result => {
      if (result?.data) _lastWeatherData = result.data;
    }).catch(() => {});
  }
});

// ─── Export global (AR3) ─────────────────────────────────────────────────────
window.AlertesModule = { getAlertes };
