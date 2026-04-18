// dashboard-ui.js — RecoCards & Segmentation Temporelle
// Consomme window.ExpertModule (expert.js) — zéro import croisé (NFR17)
// Expose window.DashboardUI = { renderRecoCards } (AR3)

const LS_DONE_PREFIX = 'pm_recos_done_';

const PRIORITY_CONFIG = {
  haute:   { label: '🔴 Maintenant',    icon: '🔴', cssClass: 'haute'   },
  moyenne: { label: '🟡 Ce matin',      icon: '🟡', cssClass: 'moyenne' },
  basse:   { label: '🟢 Cette semaine', icon: '🟢', cssClass: 'basse'   }
};

// ─── État du module ───────────────────────────────────────────────────────────

/** true après réception de pm:expert-ready — évite le flash "état vide" (Story 3.5) */
let _rulesReady = false;

/** true si la dernière mise à jour météo était stale ou sans données (Story 3.5) */
let _isOffline  = false;

// ─── Persistance état "done" ────────────────────────────────────────────────

function _todayKey() {
  return LS_DONE_PREFIX + new Date().toLocaleDateString('sv');
}

function _getDoneIds() {
  try {
    const raw = localStorage.getItem(_todayKey());
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

function _toggleDone(ruleId) {
  const done = _getDoneIds();
  if (done.has(ruleId)) { done.delete(ruleId); } else { done.add(ruleId); }
  try {
    localStorage.setItem(_todayKey(), JSON.stringify([...done]));
  } catch { /* quota */ }
}

// ─── Rendu ───────────────────────────────────────────────────────────────────

function _escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function _renderRecoCard(rule, isDone) {
  const cfg     = PRIORITY_CONFIG[rule.priorité] || PRIORITY_CONFIG.basse;
  const icon    = isDone ? '✅' : cfg.icon;
  const species = (rule.especes_cibles || [])
    .filter(e => e !== '*').map(_escapeHtml).join(', ');
  const action  = _escapeHtml(rule.action || '');
  const pressed = isDone ? 'true' : 'false';
  const doneClass = isDone ? ' reco-card--done' : '';

  return `<div class="reco-card reco-card--${cfg.cssClass}${doneClass} touch-target"
       role="button" tabindex="0" data-rule-id="${_escapeHtml(rule.id)}"
       aria-pressed="${pressed}" aria-label="${action}">
    <span class="reco-card__icon" aria-hidden="true">${icon}</span>
    <div class="reco-card__body">
      <p class="reco-card__action">${action}</p>
      ${species ? `<p class="reco-card__species">${species}</p>` : ''}
    </div>
    <span class="reco-card__check" aria-hidden="true">${isDone ? '✓' : ''}</span>
  </div>`;
}

function renderRecoCards() {
  const container  = document.getElementById('pm-recos-container');
  const emptyMsg   = document.getElementById('pm-recos-empty');
  const offlineMsg = document.getElementById('pm-recos-offline');
  if (!container) return;

  const recos = window.ExpertModule?.getRecommandations() || [];
  const done  = _getDoneIds();

  if (recos.length === 0) {
    container.innerHTML = '';
    // N'afficher l'état vide qu'une fois les règles chargées — évite le flash (AC1)
    if (emptyMsg)   emptyMsg.style.display   = _rulesReady ? '' : 'none';
    if (offlineMsg) offlineMsg.style.display = _isOffline ? '' : 'none';
    return;
  }

  if (emptyMsg)   emptyMsg.style.display   = 'none';
  if (offlineMsg) offlineMsg.style.display = _isOffline ? '' : 'none';

  const byPriority = { haute: [], moyenne: [], basse: [] };
  recos.forEach(r => {
    const p = r.priorité || 'basse';
    if (byPriority[p]) byPriority[p].push(r);
  });

  let html = '';
  ['haute', 'moyenne', 'basse'].forEach(p => {
    const group = byPriority[p];
    if (group.length === 0) return;
    const cfg     = PRIORITY_CONFIG[p];
    const labelId = `reco-label-${p}`;
    html += `<section class="reco-section" aria-labelledby="${labelId}">
    <h3 class="reco-section__label" id="${labelId}">${cfg.label}</h3>
    ${group.map(r => _renderRecoCard(r, done.has(r.id))).join('')}
  </section>`;
  });

  container.innerHTML = html;
}

// ─── Délégation d'événements (tap + clavier) ─────────────────────────────────

function _handleCardInteraction(e) {
  const card = e.target.closest('.reco-card[data-rule-id]');
  if (!card) return;
  if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
  e.preventDefault();
  _toggleDone(card.dataset.ruleId);
  renderRecoCards();
}

// ─── Abonnements DOM ─────────────────────────────────────────────────────────

/** Déclenché par expert.js après _loadRules() — premier rendu fiable (Story 3.5) */
document.addEventListener('pm:expert-ready', () => {
  _rulesReady = true;
  renderRecoCards();
});

/** Capturer l'état offline depuis le détail de l'événement météo */
document.addEventListener('pm:weather-updated', (e) => {
  _isOffline = e.detail != null && (!e.detail.data || e.detail.stale === true);
  renderRecoCards();
});

document.addEventListener('pm:culture-added',   renderRecoCards);
document.addEventListener('pm:culture-updated', renderRecoCards);

document.addEventListener('click',   _handleCardInteraction);
document.addEventListener('keydown', _handleCardInteraction);

document.addEventListener('DOMContentLoaded', renderRecoCards);

// ─── API publique (AR3) ───────────────────────────────────────────────────────
window.DashboardUI = { renderRecoCards };
