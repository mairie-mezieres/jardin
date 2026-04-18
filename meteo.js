// meteo.js — Module Météo Potager Magique
// Fetch Open-Meteo, cache localStorage 1h, événement pm:weather-updated
// Module indépendant — pas d'imports croisés (NFR17)

const METEO_URL =
  'https://api.open-meteo.com/v1/forecast' +
  '?latitude=47.7914&longitude=1.7664' +
  '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode' +
  '&timezone=Europe%2FParis&forecast_days=7';

const LS_CACHE_KEY   = 'pm_weather_cache';
const LS_UPDATED_KEY = 'pm_weather_updated_at';
const CACHE_TTL_MS   = 3600000; // 1 heure (NFR14)

// ─── Cache helpers ──────────────────────────────────────────────────────────

function isCacheValid() {
  const ts = localStorage.getItem(LS_UPDATED_KEY);
  if (!ts) return false;
  return (Date.now() - new Date(ts).getTime()) < CACHE_TTL_MS;
}

function getFromCache() {
  try {
    const raw = localStorage.getItem(LS_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveToCache(data) {
  try {
    localStorage.setItem(LS_CACHE_KEY, JSON.stringify(data));
    localStorage.setItem(LS_UPDATED_KEY, new Date().toISOString());
  } catch (err) {
    console.warn('[MeteoModule] localStorage write failed:', err.message);
  }
}

// ─── Fetch réseau ────────────────────────────────────────────────────────────

async function fetchFromNetwork() {
  const res = await fetch(METEO_URL);
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
  const data = await res.json();
  saveToCache(data);
  return data;
}

// ─── Logique principale ──────────────────────────────────────────────────────

/**
 * Retourne { data, stale }
 * - AC2 : cache < 1h → pas d'appel réseau
 * - AC1 : cache expiré → fetch réseau
 * - AC3 : offline/erreur → retourne cache stale sans planter
 */
async function getWeather() {
  if (isCacheValid()) {
    // AC2 — cache frais, aucun appel réseau
    return { data: getFromCache(), stale: false };
  }
  try {
    // AC1 — fetch réseau
    const data = await fetchFromNetwork();
    return { data, stale: false };
  } catch (err) {
    // AC3 — offline ou erreur réseau : fallback sur cache
    console.warn('[MeteoModule] Fetch failed, using stale cache:', err.message);
    const cached = getFromCache();
    return { data: cached, stale: true };
  }
}

// ─── Init : fetch + émission événement ──────────────────────────────────────

async function init() {
  const result = await getWeather();
  document.dispatchEvent(
    new CustomEvent('pm:weather-updated', { detail: result })
  );
}

// Auto-init au chargement du module (différé grâce à type="module")
document.addEventListener('DOMContentLoaded', init);

// ─── API publique (AR3) ──────────────────────────────────────────────────────
window.MeteoModule = { getWeather, init };
