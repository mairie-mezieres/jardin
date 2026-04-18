// dashboard-ui.js — Page Aujourd'hui (météo, cultures, tâches, recommandations)
// Consomme window.ExpertModule, window.CulturesModule, window.VEG (NFR17)
// Expose window.DashboardUI = { renderAujourdhuiPage } (AR3)

const LS_DONE_PREFIX = 'pm_recos_done_';

const PRIORITY_CONFIG = {
  haute:   { label: '🔴 Maintenant',    icon: '🔴', cssClass: 'haute'   },
  moyenne: { label: '🟡 Ce matin',      icon: '🟡', cssClass: 'moyenne' },
  basse:   { label: '🟢 Cette semaine', icon: '🟢', cssClass: 'basse'   }
};

const STADE_CONFIG = {
  Germination: { label: 'Germination', color: '#6db33f', icon: '🌱' },
  Plantule:    { label: 'Plantule',    color: '#4caf50', icon: '🌿' },
  Croissance:  { label: 'Croissance',  color: '#2196f3', icon: '🌾' },
  Maturité:    { label: 'Maturité',    color: '#ff9800', icon: '🍅' }
};

const ZONE_LABELS = { sn:'Serre Nord', sm:'Serre Centre', ss:'Serre Sud', pa:'Plein air', pt:'Potager' };

let _rulesReady = false;
let _isOffline  = false;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function _todayKey() { return LS_DONE_PREFIX + new Date().toLocaleDateString('sv'); }

function _getDoneIds() {
  try { return new Set(JSON.parse(localStorage.getItem(_todayKey()) || '[]')); }
  catch { return new Set(); }
}

function _toggleDone(ruleId) {
  const done = _getDoneIds();
  done.has(ruleId) ? done.delete(ruleId) : done.add(ruleId);
  try { localStorage.setItem(_todayKey(), JSON.stringify([...done])); } catch { /* quota */ }
}

function _joursDepuis(dateSemis) {
  return Math.floor((Date.now() - new Date(dateSemis).getTime()) / 86400000);
}

function _stadeFromJours(jours) {
  if (jours <= 7)  return 'Germination';
  if (jours <= 21) return 'Plantule';
  if (jours <= 45) return 'Croissance';
  return 'Maturité';
}

// ─── Section : résumé cultures ───────────────────────────────────────────────

function _renderCulturesSection(actives, vegMap) {
  if (!actives.length) {
    return `<div class="today-section">
      <h2 class="today-section__title">🌱 Mes cultures</h2>
      <div class="today-empty">
        Aucune culture — <button class="today-link" onclick="showTab('journal',document.querySelector('[onclick*=journal]'));window.CulturesUI?.openBottomSheet()">Ajoute ta première plante →</button>
      </div>
    </div>`;
  }

  const rows = actives.map(c => {
    const veg    = vegMap[c.espece] || {};
    const emoji  = veg.e || '🌱';
    const nom    = veg.n || c.espece;
    const jours  = _joursDepuis(c.dateSemis);
    const stade  = _stadeFromJours(jours);
    const cfg    = STADE_CONFIG[stade];
    const zone   = c.zone ? (ZONE_LABELS[c.zone] || c.zone) : (c.localisation === 'serre' ? 'Serre' : 'Ext.');

    return `<div class="today-culture-row">
      <span class="today-culture-row__icon">${emoji}</span>
      <div class="today-culture-row__info">
        <span class="today-culture-row__name">${_esc(nom)}</span>
        <span class="today-culture-row__meta">J+${jours} · ${_esc(zone)}</span>
      </div>
      <span class="today-stade-badge" style="background:${cfg.color}22;color:${cfg.color}">${cfg.icon} ${cfg.label}</span>
    </div>`;
  }).join('');

  return `<div class="today-section">
    <h2 class="today-section__title">🌱 Mes cultures <span class="today-section__count">${actives.length}</span></h2>
    ${rows}
  </div>`;
}

// ─── Section : tâches dérivées des stades ────────────────────────────────────

function _computeStageTasks(actives, vegMap) {
  const tasks = [];

  actives.forEach(c => {
    const veg   = vegMap[c.espece] || {};
    const nom   = veg.n || c.espece;
    const jours = _joursDepuis(c.dateSemis);
    const stade = _stadeFromJours(jours);

    if (stade === 'Germination') {
      tasks.push({ prio: 'haute', text: `Gardez le sol humide pour la levée de ${nom} (J+${jours})`, emoji: '💧' });
    }

    if (stade === 'Plantule' && (c.action === 'si') && jours >= 14) {
      tasks.push({ prio: 'moyenne', text: `${nom} prêt${veg.e?'':'e'} à repiquer en serre ou sous abri`, emoji: '↗️' });
    }

    if (stade === 'Croissance' && c.statut === 'semee' && c.action === 'si') {
      tasks.push({ prio: 'moyenne', text: `${nom} — pensez à la mise en place définitive`, emoji: '🌿' });
    }

    if (stade === 'Maturité') {
      tasks.push({ prio: 'haute', text: `${nom} en Maturité — surveillez la récolte (J+${jours})`, emoji: '🍅' });
    }

    if (c.statut === 'floraison') {
      tasks.push({ prio: 'moyenne', text: `${nom} en floraison — favorisez la pollinisation (vibration douce)`, emoji: '🌸' });
    }
  });

  return tasks;
}

function _renderTachesSection(actives, vegMap) {
  const tasks = _computeStageTasks(actives, vegMap);
  if (!tasks.length && !actives.length) return '';

  if (!tasks.length) {
    return `<div class="today-section">
      <h2 class="today-section__title">✅ À faire aujourd'hui</h2>
      <div class="today-empty">Rien de particulier — tes cultures se portent bien !</div>
    </div>`;
  }

  const prioOrder = { haute: 0, moyenne: 1, basse: 2 };
  tasks.sort((a, b) => prioOrder[a.prio] - prioOrder[b.prio]);

  const rows = tasks.map(t => {
    const cls = t.prio === 'haute' ? 'today-task--urgent' : '';
    return `<div class="today-task ${cls}">
      <span class="today-task__icon">${t.emoji}</span>
      <span class="today-task__text">${_esc(t.text)}</span>
    </div>`;
  }).join('');

  return `<div class="today-section">
    <h2 class="today-section__title">✅ À faire aujourd'hui</h2>
    ${rows}
  </div>`;
}

// ─── Section : recommandations expertes ──────────────────────────────────────

function _renderRecoCard(rule, isDone) {
  const cfg     = PRIORITY_CONFIG[rule.priorité] || PRIORITY_CONFIG.basse;
  const icon    = isDone ? '✅' : cfg.icon;
  const species = (rule.especes_cibles || []).filter(e => e !== '*').map(_esc).join(', ');
  const action  = _esc(rule.action || '');
  const doneClass = isDone ? ' reco-card--done' : '';
  return `<div class="reco-card reco-card--${cfg.cssClass}${doneClass} touch-target"
     role="button" tabindex="0" data-rule-id="${_esc(rule.id)}"
     aria-pressed="${isDone}" aria-label="${action}">
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
    if (emptyMsg)   emptyMsg.style.display = _rulesReady ? '' : 'none';
    if (offlineMsg) offlineMsg.style.display = _isOffline ? '' : 'none';
    return;
  }

  if (emptyMsg)   emptyMsg.style.display = 'none';
  if (offlineMsg) offlineMsg.style.display = _isOffline ? '' : 'none';

  const byPriority = { haute: [], moyenne: [], basse: [] };
  recos.forEach(r => { const p = r.priorité || 'basse'; if (byPriority[p]) byPriority[p].push(r); });

  let html = '';
  ['haute', 'moyenne', 'basse'].forEach(p => {
    const group = byPriority[p];
    if (!group.length) return;
    const cfg     = PRIORITY_CONFIG[p];
    const labelId = `reco-label-${p}`;
    html += `<section class="reco-section" aria-labelledby="${labelId}">
    <h3 class="reco-section__label" id="${labelId}">${cfg.label}</h3>
    ${group.map(r => _renderRecoCard(r, done.has(r.id))).join('')}
  </section>`;
  });

  container.innerHTML = html;
}

// ─── Rendu global de la page Aujourd'hui ─────────────────────────────────────

function renderAujourdhuiPage() {
  const culturesEl = document.getElementById('pm-today-cultures');
  const tachesEl   = document.getElementById('pm-today-tasks');
  if (!culturesEl || !tachesEl) return;

  const actives = (window.CulturesModule?.getActive() || [])
    .sort((a, b) => new Date(b.dateSemis) - new Date(a.dateSemis));

  const vegMap = {};
  (window.VEG || []).forEach(v => { vegMap[v.id] = v; });

  culturesEl.innerHTML = _renderCulturesSection(actives, vegMap);
  tachesEl.innerHTML   = _renderTachesSection(actives, vegMap);

  renderRecoCards();
}

// ─── Événements ──────────────────────────────────────────────────────────────

function _handleCardInteraction(e) {
  const card = e.target.closest('.reco-card[data-rule-id]');
  if (!card) return;
  if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
  e.preventDefault();
  _toggleDone(card.dataset.ruleId);
  renderRecoCards();
}

document.addEventListener('pm:expert-ready', () => { _rulesReady = true; renderAujourdhuiPage(); });
document.addEventListener('pm:weather-updated', (e) => {
  _isOffline = e.detail != null && (!e.detail.data || e.detail.stale === true);
  renderAujourdhuiPage();
});
document.addEventListener('pm:culture-added',   renderAujourdhuiPage);
document.addEventListener('pm:culture-updated', renderAujourdhuiPage);
document.addEventListener('pm:culture-deleted', renderAujourdhuiPage);

document.addEventListener('click',   _handleCardInteraction);
document.addEventListener('keydown', _handleCardInteraction);
document.addEventListener('DOMContentLoaded', renderAujourdhuiPage);

// ─── API publique (AR3) ───────────────────────────────────────────────────────
window.DashboardUI = { renderAujourdhuiPage, renderRecoCards };
