// expert.js — Moteur de Recommandations (Système Expert)
// Écoute pm:weather-updated et pm:mode-changed (AR3, NFR17)
// Zéro import croisé — accès aux modules via window.X?.method()

let _rules           = [];
let _lastWeatherData = null;
let _currentMode     = 'exterieur';

// ─── Chargement des règles ───────────────────────────────────────────────────

async function _loadRules() {
  try {
    const resp = await fetch('./expert-rules.json');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    _rules = Array.isArray(data.rules) ? data.rules : [];
  } catch {
    _rules = []; // NFR7 — pas de plantage si fichier absent ou malformé
  }
}

// ─── Évaluation condition météo ──────────────────────────────────────────────

function _evalCondition(condition, daily) {
  if (!condition || condition.generic === true) return true;
  if (!daily) return false;

  const horizon = condition.horizon === '48h' ? 2 : 1;

  if (typeof condition.temperature_min_lte === 'number') {
    const mins = daily.temperature_2m_min || [];
    for (let i = 0; i < horizon && i < mins.length; i++) {
      // Guard typeof pour éviter null <= n = true en JS (leçon story 3.1)
      if (typeof mins[i] === 'number' && mins[i] <= condition.temperature_min_lte) return true;
    }
    return false;
  }

  if (typeof condition.temperature_max_gte === 'number') {
    const maxs = daily.temperature_2m_max || [];
    for (let i = 0; i < horizon && i < maxs.length; i++) {
      if (typeof maxs[i] === 'number' && maxs[i] >= condition.temperature_max_gte) return true;
    }
    return false;
  }

  if (typeof condition.precipitation_probability_gte === 'number') {
    const prob = (daily.precipitation_probability_max || [])[0];
    return typeof prob === 'number' && prob >= condition.precipitation_probability_gte;
  }

  return false; // condition inconnue → règle ignorée (sécurité, NFR7)
}

// ─── Tri par priorité ────────────────────────────────────────────────────────

const PRIORITY_ORDER = { haute: 3, moyenne: 2, basse: 1 };

function _priorityOrder(p) {
  return PRIORITY_ORDER[p] || 0;
}

// ─── API publique ─────────────────────────────────────────────────────────────

/**
 * Retourne jusqu'à 5 recommandations triées par priorité décroissante.
 * Chaque recommandation est un objet règle complet de expert-rules.json.
 * Retourne [] en cas d'erreur, données null ou aucune règle (NFR7).
 */
function getRecommandations() {
  try {
    if (_rules.length === 0) return [];

    const daily = _lastWeatherData?.daily || null;

    // Utilise getActive() qui filtre statut !== 'recoltee' (FR28)
    const activeCultures = (window.CulturesModule?.getActive() || []).map(c => c.espece);

    const matching = _rules.filter(rule => {
      // 1. Filtre mode (FR11)
      if (rule.mode === 'serre'     && _currentMode !== 'serre')     return false;
      if (rule.mode === 'exterieur' && _currentMode !== 'exterieur') return false;

      // 2. Filtre espèces cibles (FR10)
      const cibles = rule.especes_cibles || [];
      // [] ou ['*'] → wildcard, s'applique à toutes
      if (cibles.length > 0 && !cibles.includes('*')) {
        if (!cibles.some(e => activeCultures.includes(e))) return false;
      }

      // 3. Évaluation condition météo
      return _evalCondition(rule.condition, daily);
    });

    // Tri par priorité décroissante, limite 5 (FR12)
    return matching
      .sort((a, b) => _priorityOrder(b.priorité) - _priorityOrder(a.priorité))
      .slice(0, 5);
  } catch {
    return []; // NFR7
  }
}

// ─── Abonnements DOM ─────────────────────────────────────────────────────────

document.addEventListener('pm:weather-updated', (e) => {
  if (e.detail?.data) _lastWeatherData = e.detail.data;
});

document.addEventListener('pm:mode-changed', (e) => {
  if (e.detail?.mode) _currentMode = e.detail.mode;
});

document.addEventListener('DOMContentLoaded', async () => {
  // Initialiser le mode depuis PrefsModule si disponible
  if (window.PrefsModule) {
    _currentMode = window.PrefsModule.get().modeDefault || 'exterieur';
  }
  // Charger météo déjà en cache si disponible
  if (window.MeteoModule) {
    try {
      const result = await window.MeteoModule.getWeather();
      if (result?.data) _lastWeatherData = result.data;
    } catch { /* NFR7 */ }
  }
  // Charger les règles expertes
  await _loadRules();
  // Signaler que le moteur expert est prêt (règles chargées ou vides si erreur NFR7)
  document.dispatchEvent(new CustomEvent('pm:expert-ready'));
});

// ─── API publique (AR3) ───────────────────────────────────────────────────────
window.ExpertModule = { getRecommandations };
