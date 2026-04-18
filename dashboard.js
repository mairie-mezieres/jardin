// dashboard.js — Composants WeatherSummary & FreshnessIndicator
// Écoute pm:weather-updated (émis par meteo.js) — aucun import croisé (NFR17)

// ─── Table WMO weathercode → emoji ─────────────────────────────────────────
const WMO_EMOJI = {
  0:  '☀️',                          // Ciel dégagé
  1:  '🌤️', 2: '⛅', 3: '☁️',      // Partiellement nuageux
  45: '🌫️', 48: '🌫️',              // Brouillard
  51: '🌦️', 53: '🌦️', 55: '🌧️',  // Bruine légère / modérée / dense
  61: '🌧️', 63: '🌧️', 65: '🌧️',  // Pluie légère / modérée / forte
  71: '🌨️', 73: '🌨️', 75: '❄️',   // Neige légère / modérée / forte
  77: '🌨️',                          // Grains de neige
  80: '🌦️', 81: '🌧️', 82: '⛈️',  // Averses légères / modérées / violentes
  85: '🌨️', 86: '❄️',               // Averses de neige
  95: '⛈️',                          // Orage
  96: '⛈️', 99: '⛈️'               // Orage avec grêle
};

function getWeatherEmoji(code) {
  return WMO_EMOJI[code] || '🌡️';
}

// ─── WeatherSummary ─────────────────────────────────────────────────────────

/**
 * Affiche température max, min/max et emoji météo dans #pm-weather-summary
 * AC1 : données disponibles → affichage complet
 * AC4 : data === null → état vide bienveillant
 */
function renderWeatherSummary(data) {
  const el = document.getElementById('pm-weather-summary');
  if (!el) return;

  if (!data || !data.daily) {
    // AC4 — aucune donnée en cache
    el.className = 'weather-summary weather-summary--empty';
    el.innerHTML = '<span class="weather-summary__empty">📡</span>';
    return;
  }

  const tempMax = Math.round(data.daily.temperature_2m_max[0]);
  const tempMin = Math.round(data.daily.temperature_2m_min[0]);
  const code    = data.daily.weathercode[0];
  const emoji   = getWeatherEmoji(code);

  el.className = 'weather-summary weather-summary--loaded';
  el.innerHTML = `
    <span class="weather-summary__emoji" aria-hidden="true">${emoji}</span>
    <span class="weather-summary__temp-main" aria-label="Température max ${tempMax} degrés">${tempMax}°</span>
    <span class="weather-summary__minmax">${tempMin}° / ${tempMax}°</span>
  `;
}

// ─── FreshnessIndicator ─────────────────────────────────────────────────────

/**
 * Affiche l'ancienneté des données météo
 * AC1 : < 1h → "Actualisé il y a Xmin" (gris discret)
 * AC2 : > 1h → "Données de il y a Xh" (orange)
 * AC3 : offline → "Hors connexion — données du JJ/MM" (orange)
 * AC4 : pas de cache → "Connexion requise pour les données météo"
 */
function renderFreshnessIndicator(stale) {
  const el        = document.getElementById('pm-freshness');
  if (!el) return;

  const updatedAt = localStorage.getItem('pm_weather_updated_at');

  if (!updatedAt) {
    // AC4 — jamais eu de données
    el.className   = 'freshness-indicator freshness-indicator--empty';
    el.textContent = '📡 Connexion requise pour les données météo';
    return;
  }

  const ageMs   = Date.now() - new Date(updatedAt).getTime();
  const ageMin  = Math.floor(ageMs / 60000);
  const ageH    = Math.floor(ageMs / 3600000);
  const dateStr = new Date(updatedAt).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit'
  });

  const isOffline = stale && !navigator.onLine;

  if (isOffline) {
    // AC3 — hors connexion
    el.className   = 'freshness-indicator freshness-indicator--offline';
    el.textContent = `Hors connexion — données du ${dateStr}`;
  } else if (ageMs > 3600000) {
    // AC2 — données périmées (> 1h)
    el.className   = 'freshness-indicator freshness-indicator--stale';
    el.textContent = `Données de il y a ${ageH}h`;
  } else {
    // AC1 — données fraîches (< 1h)
    el.className   = 'freshness-indicator freshness-indicator--fresh';
    el.textContent = ageMin < 1 ? 'Actualisé à l\'instant' : `Actualisé il y a ${ageMin}min`;
  }
}

// ─── Date d'aujourd'hui ─────────────────────────────────────────────────────

function renderTodayDate() {
  const el = document.getElementById('pm-today-date');
  if (!el) return;
  el.textContent = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long'
  });
}

// ─── Orchestration ──────────────────────────────────────────────────────────

function renderDashboard({ data, stale }) {
  renderWeatherSummary(data);
  renderFreshnessIndicator(stale);
}

// ─── Écoute pm:weather-updated ──────────────────────────────────────────────
document.addEventListener('pm:weather-updated', (e) => {
  renderDashboard(e.detail);
});

// ─── Init date au chargement ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', renderTodayDate);
