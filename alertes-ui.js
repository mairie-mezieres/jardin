// alertes-ui.js — Composant AlertBanner
// Consomme window.AlertesModule (alertes.js) — zéro import croisé (NFR17)
// role="alert" + aria-live="assertive" (UX-DR2)

// ─── Config par type d'alerte ────────────────────────────────────────────────

const ALERT_CONFIG = {
  gel:      { couleur: 'var(--color-alert-gel)',      icone: '❄️',  label: 'Risque de gel' },
  canicule: { couleur: 'var(--color-alert-canicule)', icone: '🌡️', label: 'Risque de canicule' },
  grele:    { couleur: 'var(--color-alert-grele)',    icone: '⛈️',  label: 'Risque de grêle' }
};

// Criticité pour tri : gel > canicule > grêle (valeur plus haute = priorité plus haute)
const CRITICITE = { gel: 3, canicule: 2, grele: 1 };
const URGENCE   = { 'Maintenant': 2, "Aujourd'hui": 1 };

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Trie les alertes : criticité décroissante, puis urgence décroissante */
function _sortAlertes(alertes) {
  return [...alertes].sort((a, b) => {
    const dc = (CRITICITE[b.type] || 0) - (CRITICITE[a.type] || 0);
    if (dc !== 0) return dc;
    return (URGENCE[b.urgence] || 0) - (URGENCE[a.urgence] || 0);
  });
}

/** Échappe les caractères HTML pour éviter le XSS (données utilisateur) */
function _escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Construit le texte des cultures à risque */
function _buildCulturesText(alerte) {
  if (!alerte.cultures || alerte.cultures.length === 0) return '';
  const noms = alerte.cultures.map(_escapeHtml).join(', ');
  if (alerte.type === 'grele') return `Cultures extérieures : ${noms}`;
  return `Cultures : ${noms}`;
}

// ─── Rendus HTML ─────────────────────────────────────────────────────────────

/** Alerte principale — bandeau plein */
function _renderPrimaire(alerte) {
  const cfg = ALERT_CONFIG[alerte.type] || { couleur: '#888', icone: '⚠️', label: 'Alerte' };
  const culturesText = _buildCulturesText(alerte);
  const urgenceEsc   = _escapeHtml(alerte.urgence);
  return `
    <div class="alert-banner alert-banner--${alerte.type}" role="alert"
         style="background:${cfg.couleur}">
      <span class="alert-banner__icon" aria-hidden="true">${cfg.icone}</span>
      <div class="alert-banner__body">
        <p class="alert-banner__title">${cfg.label} — ${urgenceEsc}</p>
        ${culturesText ? `<p class="alert-banner__cultures">${culturesText}</p>` : ''}
      </div>
    </div>`.trim();
}

/** Alerte secondaire — accordéon natif <details>/<summary> */
function _renderSecondaire(alerte) {
  const cfg = ALERT_CONFIG[alerte.type] || { couleur: '#888', icone: '⚠️', label: 'Alerte' };
  const culturesText = _buildCulturesText(alerte);
  const urgenceEsc   = _escapeHtml(alerte.urgence);
  return `
    <details class="alert-banner alert-banner--${alerte.type} alert-banner--secondary"
             style="background:${cfg.couleur}">
      <summary class="alert-banner__summary">
        <span class="alert-banner__icon" aria-hidden="true">${cfg.icone}</span>
        <span class="alert-banner__title">${cfg.label} — ${urgenceEsc}</span>
        <span class="alert-banner__chevron" aria-hidden="true">▾</span>
      </summary>
      ${culturesText ? `<p class="alert-banner__cultures">${culturesText}</p>` : ''}
    </details>`.trim();
}

// ─── Render principal ─────────────────────────────────────────────────────────

/**
 * Lit AlertesModule.getAlertes() et injecte le HTML dans #pm-alert-container.
 * État masqué si aucune alerte active (AC4).
 */
function renderAlertBanner() {
  const container = document.getElementById('pm-alert-container');
  if (!container) return;

  const alertes = window.AlertesModule?.getAlertes() || [];

  if (alertes.length === 0) {
    container.innerHTML = '';
    container.style.display = 'none';
    container.setAttribute('aria-hidden', 'true');
    return;
  }

  const sorted = _sortAlertes(alertes);
  const html   = sorted.map((a, i) =>
    i === 0 ? _renderPrimaire(a) : _renderSecondaire(a)
  ).join('\n');

  container.innerHTML = html;
  container.style.display = '';
  container.removeAttribute('aria-hidden');
}

// ─── Abonnements DOM ─────────────────────────────────────────────────────────

document.addEventListener('pm:weather-updated', renderAlertBanner);
document.addEventListener('pm:mode-changed',    renderAlertBanner);
document.addEventListener('DOMContentLoaded',   renderAlertBanner);

// ─── API publique (AR3) ──────────────────────────────────────────────────────
window.AlertBannerUI = { renderAlertBanner };
