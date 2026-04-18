// cultures-ui.js — Interface Journal & Bottom Sheet
// Dépend de window.CulturesModule (cultures.js) — aucun import croisé (NFR17)

// ─── Helpers ────────────────────────────────────────────────────────────────

function _getPrefs() {
  try {
    const raw = localStorage.getItem('pm_preferences');
    return raw ? JSON.parse(raw) : { modeDefault: 'exterieur' };
  } catch {
    return { modeDefault: 'exterieur' };
  }
}

function _localDateString() {
  const today = new Date();
  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0')
  ].join('-');
}

function _stadeFromDate(dateSemis) {
  const jours = Math.floor((Date.now() - new Date(dateSemis).getTime()) / 86400000);
  if (jours <= 7)  return 'Germination';
  if (jours <= 21) return 'Plantule';
  if (jours <= 45) return 'Croissance';
  return 'Maturité';
}

function _stadeLabel(statut) {
  const labels = {
    semee:    'Semée',
    repiquee: 'Repiquée',
    floraison:'En floraison',
    recoltee: 'Récoltée'
  };
  return labels[statut] || statut;
}

// ─── Rendu carte culture ─────────────────────────────────────────────────────

function _renderCultureCard(c, vegMap, archived, inConflict) {
  const veg   = vegMap[c.espece] || {};
  const emoji = veg.e || '🌱';
  const nom   = veg.n || c.espece;
  const stade = archived ? _stadeLabel(c.statut) : _stadeFromDate(c.dateSemis);
  const date  = new Date(c.dateSemis).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  const badge = c.localisation === 'serre'
    ? '<span class="pm-culture-card__badge pm-culture-card__badge--serre">🌱 Serre</span>'
    : '<span class="pm-culture-card__badge pm-culture-card__badge--exterieur">☀️ Ext.</span>';
  const archivedClass = archived ? ' pm-culture-card--archived' : '';
  const conflictBadge = inConflict
    ? '<span class="companion-badge companion-badge--warned pm-conflict-badge" role="img" aria-label="Association déconseillée">⚠️ Association déconseillée</span>'
    : '';
  return `<div class="pm-culture-card${archivedClass}" data-id="${c.id}">
    <span class="pm-culture-card__icon">${emoji}</span>
    <div class="pm-culture-card__info">
      <div class="pm-culture-card__name">${nom}</div>
      <div class="pm-culture-card__meta">Semé le ${date} · ${stade}</div>
      ${conflictBadge}
    </div>
    ${badge}
  </div>`;
}

// ─── Rendu journal ───────────────────────────────────────────────────────────

function renderJournal() {
  const el = document.getElementById('pm-journal-list');
  if (!el) return;

  const allCultures = window.CulturesModule ? window.CulturesModule.getAll() : [];
  const actives = allCultures
    .filter(c => c.statut !== 'recoltee')
    .sort((a, b) => new Date(b.dateSemis) - new Date(a.dateSemis));
  const archivees = allCultures
    .filter(c => c.statut === 'recoltee')
    .sort((a, b) => new Date(b.dateStatut || '1970-01-01') - new Date(a.dateStatut || '1970-01-01'));

  const vegMap = {};
  (window.VEG || []).forEach(v => { vegMap[v.id] = v; });

  // Story 5.3 — Détection des conflits de compagnonnage
  const especesActives = [...new Set(actives.map(c => c.espece).filter(Boolean))];
  const conflits = window.CompagnonnageModule?.detecterConflits(especesActives) || [];
  const conflictSet = new Set();
  conflits.forEach(p => { conflictSet.add(p.a.id); conflictSet.add(p.b.id); });

  const bannerEl = document.getElementById('pm-conflict-banner');
  if (bannerEl) {
    if (conflits.length > 0) {
      const s = conflits.length > 1;
      bannerEl.textContent = `⚠️ ${conflits.length} association${s ? 's' : ''} déconseillée${s ? 's' : ''} détectée${s ? 's' : ''}`;
      bannerEl.hidden = false;
    } else {
      bannerEl.hidden = true;
    }
  }

  // Cultures actives
  if (!actives.length) {
    el.innerHTML = `<div class="pm-journal__empty">
      Aucune culture en cours —<br>tape <strong>＋</strong> pour commencer !
    </div>`;
  } else {
    el.innerHTML = actives.map(c => _renderCultureCard(c, vegMap, false, conflictSet.has(c.espece))).join('');
    el.querySelectorAll('.pm-culture-card').forEach(card => {
      card.addEventListener('click', () => openActionSheet(card.dataset.id));
    });
  }

  // Section Archives
  const archivesEl = document.getElementById('pm-journal-archives');
  if (!archivesEl) return;
  if (!archivees.length) {
    archivesEl.innerHTML = '';
    return;
  }
  archivesEl.innerHTML =
    `<div class="pm-journal__archives-header">Archives</div>` +
    archivees.map(c => _renderCultureCard(c, vegMap, true)).join('');
}

// ─── Action Sheet ────────────────────────────────────────────────────────────

let _actionSheetCultureId = null;

function openActionSheet(cultureId) {
  _actionSheetCultureId = cultureId;
  document.getElementById('pm-as-overlay')?.classList.add('as-open');
}

function closeActionSheet() {
  _actionSheetCultureId = null;
  document.getElementById('pm-as-overlay')?.classList.remove('as-open');
}

function _applyStatusAction(statut) {
  if (!_actionSheetCultureId || !window.CulturesModule) return;
  window.CulturesModule.update(_actionSheetCultureId, {
    statut,
    dateStatut: _localDateString()
  });
  closeActionSheet();
  renderJournal();
}

// ─── Bottom Sheet ────────────────────────────────────────────────────────────

let _selectedMode = 'exterieur';

function _buildEspeceSelect() {
  const sel = document.getElementById('pm-bs-espece');
  if (!sel || sel.options.length > 1) return;
  [...(window.VEG || [])].sort((a, b) => a.n.localeCompare(b.n, 'fr')).forEach(v => {
    const opt = document.createElement('option');
    opt.value       = v.id;
    opt.textContent = `${v.e} ${v.n}`;
    sel.appendChild(opt);
  });
}

function openBottomSheet() {
  const overlay = document.getElementById('pm-bs-overlay');
  if (!overlay) return;

  _buildEspeceSelect();

  // Pré-remplir date du jour (date locale, pas UTC)
  const dateInput = document.getElementById('pm-bs-date');
  if (dateInput) {
    dateInput.value = _localDateString();
  }

  // Pré-remplir mode depuis préférences
  _selectedMode = _getPrefs().modeDefault || 'exterieur';
  _updateModeButtons(_selectedMode);

  overlay.classList.add('bs-open');
  document.getElementById('pm-bs-espece')?.focus();
}

function closeBottomSheet() {
  const overlay = document.getElementById('pm-bs-overlay');
  if (!overlay) return;
  overlay.classList.remove('bs-open');
  document.getElementById('pm-bs-form')?.reset();
}

function _updateModeButtons(mode) {
  document.querySelectorAll('.bs-mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
    btn.setAttribute('aria-pressed', btn.dataset.mode === mode ? 'true' : 'false');
  });
}

// ─── Initialisation des événements ──────────────────────────────────────────

function _initEvents() {
  // FAB
  document.getElementById('pm-fab-add')?.addEventListener('click', openBottomSheet);

  // Bottom sheet — fermeture
  document.getElementById('pm-bs-close')?.addEventListener('click', closeBottomSheet);
  document.getElementById('pm-bs-cancel')?.addEventListener('click', closeBottomSheet);
  document.getElementById('pm-bs-overlay')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeBottomSheet();
  });

  // Boutons mode
  document.querySelectorAll('.bs-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _selectedMode = btn.dataset.mode;
      _updateModeButtons(_selectedMode);
    });
  });

  // Soumission formulaire ajout culture
  document.getElementById('pm-bs-form')?.addEventListener('submit', e => {
    e.preventDefault();
    if (!window.CulturesModule) return;

    const espece    = document.getElementById('pm-bs-espece')?.value;
    const dateSemis = document.getElementById('pm-bs-date')?.value;
    if (!espece || !dateSemis) return;

    window.CulturesModule.add({
      espece,
      dateSemis,
      localisation: _selectedMode,
      statut:       'semee',
      dateStatut:   _localDateString()
    });

    closeBottomSheet();
    // renderJournal() déclenché par pm:culture-added (évite le double rendu)
  });

  // Écoute pm:culture-added pour re-rendre le journal
  document.addEventListener('pm:culture-added', () => renderJournal());

  // Écoute pm:compagnonnage-ready — relance la détection de conflits (AC5)
  document.addEventListener('pm:compagnonnage-ready', () => renderJournal());

  // Action sheet — fermeture
  document.getElementById('pm-as-overlay')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeActionSheet();
  });
  document.getElementById('pm-as-cancel')?.addEventListener('click', closeActionSheet);

  // Action sheet — actions
  document.getElementById('pm-as-repiquee')?.addEventListener('click', () => _applyStatusAction('repiquee'));
  document.getElementById('pm-as-floraison')?.addEventListener('click', () => _applyStatusAction('floraison'));
  document.getElementById('pm-as-recoltee')?.addEventListener('click',  () => _applyStatusAction('recoltee'));
  document.getElementById('pm-as-supprimer')?.addEventListener('click', () => {
    const id = _actionSheetCultureId;
    if (!id) return;
    // Confirmer AVANT de fermer la sheet — si annulé, la sheet reste ouverte
    if (confirm('Supprimer cette culture ?')) {
      closeActionSheet();
      window.CulturesModule?.delete(id);
      renderJournal();
    }
  });
}

// ─── Auto-init ───────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  _initEvents();
  renderJournal();
});

// ─── API publique ────────────────────────────────────────────────────────────
window.CulturesUI = {
  openBottomSheet,
  closeBottomSheet,
  renderJournal,
  openActionSheet,
  closeActionSheet
};
