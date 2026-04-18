// pousses-ui.js — Navigation banque de photos de pousses
// Consomme window.PoussesModule (pousses.js) — zéro import croisé (NFR17)
// Expose window.PoussesUI = { renderFamilies } (AR3)

// ─── État de navigation ───────────────────────────────────────────────────────

/** 'families' | 'especes' | 'detail' */
let _currentView    = 'families';
let _currentFamille = null;   // id famille sélectionnée
let _currentEspece  = null;   // id espèce sélectionnée (utilisé par Story 4.4)

// ─── Utilitaires ─────────────────────────────────────────────────────────────

function _escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function _getContainer() {
  return document.getElementById('pm-pousses-container');
}

// ─── Rendu des 3 vues ────────────────────────────────────────────────────────

function renderFamilies() {
  const container = _getContainer();
  if (!container) return;

  const familles = window.PoussesModule?.getFamilles() || [];
  _currentView    = 'families';
  _currentFamille = null;
  _currentEspece  = null;

  if (familles.length === 0) {
    container.innerHTML = '<p class="pm-pousses-empty">Données non disponibles.</p>';
    return;
  }

  const cards = familles.map(f => {
    const count = (f.especes || []).length;
    return `<button class="pm-famille-card touch-target" data-famille="${_escapeHtml(f.id)}"
      tabindex="0" aria-label="${_escapeHtml(f.label)}, ${count} espèce${count > 1 ? 's' : ''}">
      <span class="pm-famille-card__label">${_escapeHtml(f.label)}</span>
      <span class="pm-famille-card__count">${count} espèce${count > 1 ? 's' : ''}</span>
    </button>`;
  }).join('');

  container.innerHTML = `<div class="pm-famille-grid">${cards}</div>`;
}

function _renderEspeces(familleId) {
  const container = _getContainer();
  if (!container) return;

  const especes = window.PoussesModule?.getEspecesByFamille(familleId) || [];
  const familles = window.PoussesModule?.getFamilles() || [];
  const famille  = familles.find(f => f.id === familleId);
  const label    = famille ? _escapeHtml(famille.label) : _escapeHtml(familleId);

  _currentView    = 'especes';
  _currentFamille = familleId;
  _currentEspece  = null;

  const items = especes.map(e =>
    `<li class="pm-espece-item">
      <button class="touch-target" data-espece="${_escapeHtml(e.id)}" tabindex="0">${_escapeHtml(e.nom)}</button>
    </li>`
  ).join('');

  container.innerHTML = `
    <div class="pm-pousses-nav">
      <button class="pm-back-btn touch-target" data-back="families" aria-label="Retour aux familles">← Retour</button>
      <h2 class="pm-pousses-title">${label}</h2>
    </div>
    <ul class="pm-espece-list" role="list">${items}</ul>`;

  // P3 — restaurer le focus sur le bouton retour après navigation (AC4)
  container.querySelector('.pm-back-btn')?.focus();
}

function _renderDetail(especeId) {
  const container = _getContainer();
  if (!container) return;

  // P2 — guard : _currentFamille requis pour résoudre l'espèce
  if (!_currentFamille) { renderFamilies(); return; }

  const especes  = window.PoussesModule?.getEspecesByFamille(_currentFamille) || [];
  const espece   = especes.find(e => e.id === especeId)
                || { nom: especeId, stades: [], photos: {} };

  _currentView   = 'detail';
  _currentEspece = especeId;

  const stades = espece.stades || [];
  const photos = espece.photos || {};
  const stadeLabels = { germination: 'Germination', cotyledons: 'Cotylédons', 'vraies-feuilles': 'Vraies feuilles' };

  // P1 — pas de handlers inline : onerror/onload gérés via event listeners après render
  const cards = stades.map(s => {
    const src   = photos[s] || '';
    const label = stadeLabels[s] || _escapeHtml(s);
    return `<div class="photo-card photo-card--loading" data-stade="${_escapeHtml(s)}">
      <img class="photo-card__image"
        src="${_escapeHtml(src)}"
        alt="${_escapeHtml(espece.nom)} — ${label}"
        loading="${s === stades[0] ? 'eager' : 'lazy'}">
      <p class="photo-card__label">${label}</p>
      <p class="photo-card__error-msg" aria-hidden="true">Photo bientôt disponible</p>
    </div>`;
  }).join('');

  // T1 — Bouton "Comparer" conditionnel (AC2 : absent si aucune confusion)
  const confusions = window.PoussesModule?.getConfusionsForEspece(especeId) || [];
  const compareSection = confusions.length > 0
    ? `<button class="pm-compare-btn touch-target" id="pm-compare-btn"
         data-espece="${_escapeHtml(especeId)}" aria-expanded="false">
         🔍 Comparer avec les mauvaises herbes
       </button>
       <div class="pm-compare-panel" id="pm-compare-panel"
            role="region" aria-labelledby="pm-compare-title" hidden></div>`
    : '';

  container.innerHTML = `
    <div class="pm-pousses-nav">
      <button class="pm-back-btn touch-target" data-back="especes" aria-label="Retour aux espèces">← Retour</button>
      <h2 class="pm-pousses-title">${_escapeHtml(espece.nom)}</h2>
    </div>
    <div class="pm-detail-photos" id="pm-detail-photos">${cards}</div>
    ${compareSection}`;

  // P1 — attacher les handlers image après render (évite inline handlers)
  container.querySelectorAll('.photo-card__image').forEach(img => {
    img.addEventListener('load', function () {
      this.closest('.photo-card')?.classList.remove('photo-card--loading');
    }, { once: true });
    img.addEventListener('error', function () {
      const card = this.closest('.photo-card');
      card?.classList.add('photo-card--error');
      this.classList.add('photo-card__image--hidden');
      // Rendre le message d'erreur lisible par les AT
      card?.querySelector('.photo-card__error-msg')?.removeAttribute('aria-hidden');
    }, { once: true });
  });

  // P3 — restaurer le focus sur le bouton retour après navigation (AC4)
  container.querySelector('.pm-back-btn')?.focus();
}

// ─── Panneau comparatif (Story 4.4) ─────────────────────────────────────────

function _renderComparatif(especeId) {
  const panel = document.getElementById('pm-compare-panel');
  const btn   = document.getElementById('pm-compare-btn');
  if (!panel || !btn) return;

  // P1 — toggle : si panneau déjà ouvert, fermer
  if (!panel.hidden) { _closeComparatif(); return; }

  const confusions = window.PoussesModule?.getConfusionsForEspece(especeId) || [];
  if (confusions.length === 0) return;

  // P3 — guard _currentFamille (peut être null en cas de race)
  if (!_currentFamille) return;

  // Espèce courante — récupérer la photo germination
  const especes = window.PoussesModule?.getEspecesByFamille(_currentFamille) || [];
  const espece  = especes.find(e => e.id === especeId) || { nom: especeId, photos: {} };
  const srcGermi = espece.photos?.germination || '';

  const especeCard = `
    <div class="pm-compare-card pm-compare-card--espece">
      <div class="photo-card photo-card--loading">
        <img class="photo-card__image"
          src="${_escapeHtml(srcGermi)}"
          alt="${_escapeHtml(espece.nom)} — Germination"
          loading="eager">
        <p class="photo-card__label">Germination</p>
        <p class="photo-card__error-msg" aria-hidden="true">Photo bientôt disponible</p>
      </div>
      <p class="pm-compare-legend pm-compare-legend--espece">Votre pousse : ${_escapeHtml(espece.nom)}</p>
    </div>`;

  const herbeCards = confusions.map(h => `
    <div class="pm-compare-card pm-compare-card--herbe">
      <div class="photo-card photo-card--loading">
        <img class="photo-card__image"
          src="${_escapeHtml(h.photo || '')}"
          alt="${_escapeHtml(h.nom || '')} — Germination"
          loading="lazy">
        <p class="photo-card__label">Germination</p>
        <p class="photo-card__error-msg" aria-hidden="true">Photo bientôt disponible</p>
      </div>
      <p class="pm-compare-legend pm-compare-legend--herbe">Mauvaise herbe : ${_escapeHtml(h.nom || '')}</p>
    </div>`).join('');

  panel.innerHTML = `
    <div class="pm-compare-header">
      <h3 class="pm-compare-title" id="pm-compare-title">Comparaison</h3>
      <button class="pm-compare-close touch-target" id="pm-compare-close" aria-label="Fermer">✕</button>
    </div>
    <div class="pm-compare-grid">${especeCard}${herbeCards}</div>`;

  panel.hidden = false;
  btn.setAttribute('aria-expanded', 'true');
  // P4 — déplacer le focus sur le bouton Fermer à l'ouverture (accessibilité clavier)
  panel.querySelector('#pm-compare-close')?.focus();

  // Attacher les handlers image (même pattern P1 de 4.2)
  panel.querySelectorAll('.photo-card__image').forEach(img => {
    img.addEventListener('load', function () {
      this.closest('.photo-card')?.classList.remove('photo-card--loading');
    }, { once: true });
    img.addEventListener('error', function () {
      const card = this.closest('.photo-card');
      card?.classList.add('photo-card--error');
      this.classList.add('photo-card__image--hidden');
      card?.querySelector('.photo-card__error-msg')?.removeAttribute('aria-hidden');
    }, { once: true });
  });
}

function _closeComparatif() {
  const panel = document.getElementById('pm-compare-panel');
  const btn   = document.getElementById('pm-compare-btn');
  if (!panel) return;
  panel.hidden = true;
  panel.innerHTML = '';
  if (btn) {
    btn.setAttribute('aria-expanded', 'false');
    btn.focus();  // AC4 — focus restauré sur le bouton Comparer
  }
}

// ─── Délégation d'événements ─────────────────────────────────────────────────

function _handleNavInteraction(e) {
  const target = e.target;

  // Clavier : seulement Enter, Space, Escape
  if (e.type === 'keydown') {
    if (e.key === 'Escape') {
      // Escape : fermer le panneau comparatif en priorité (AC4)
      const panel = document.getElementById('pm-compare-panel');
      if (panel && !panel.hidden) {
        e.preventDefault();
        _closeComparatif();
        return;
      }
      // Sinon, Escape remonte d'un niveau
      if (_currentView === 'detail') {
        e.preventDefault();
        _renderEspeces(_currentFamille);
      } else if (_currentView === 'especes') {
        e.preventDefault();
        renderFamilies();
      }
      return;
    }
    if (e.key !== 'Enter' && e.key !== ' ') return;
  }

  // Bouton comparer (AC1)
  const compareBtn = target.closest('#pm-compare-btn');
  if (compareBtn) {
    // P2 — e.preventDefault() uniquement pour Enter/Space (ne pas bloquer Tab)
    if (e.type === 'keydown' && (e.key === 'Enter' || e.key === ' ')) e.preventDefault();
    _renderComparatif(compareBtn.dataset.espece);
    return;
  }

  // Bouton fermer panneau (AC4)
  const closeBtn = target.closest('#pm-compare-close');
  if (closeBtn) {
    if (e.type === 'keydown' && (e.key === 'Enter' || e.key === ' ')) e.preventDefault();
    _closeComparatif();
    return;
  }

  // Bouton retour
  const backBtn = target.closest('[data-back]');
  if (backBtn) {
    if (e.type === 'keydown') e.preventDefault();
    const dest = backBtn.dataset.back;
    if (dest === 'families') {
      renderFamilies();
    } else if (dest === 'especes') {
      // P2 — fallback vers familles si _currentFamille null
      if (_currentFamille) _renderEspeces(_currentFamille);
      else renderFamilies();
    }
    return;
  }

  // Card famille
  const familleCard = target.closest('[data-famille]');
  if (familleCard) {
    if (e.type === 'keydown') e.preventDefault();
    _renderEspeces(familleCard.dataset.famille);
    return;
  }

  // Bouton espèce
  const especeBtn = target.closest('[data-espece]');
  if (especeBtn) {
    if (e.type === 'keydown') e.preventDefault();
    _renderDetail(especeBtn.dataset.espece);
    return;
  }
}

// ─── Abonnements ─────────────────────────────────────────────────────────────

// Restreindre la délégation à #tab-pousses pour éviter les conflits
document.addEventListener('click', (e) => {
  if (!document.getElementById('tab-pousses')?.contains(e.target)) return;
  _handleNavInteraction(e);
});
document.addEventListener('keydown', (e) => {
  if (!document.getElementById('tab-pousses')?.contains(document.activeElement)) return;
  _handleNavInteraction(e);
});

/** Déclenché par pousses.js après _loadData() — premier rendu fiable (AC5) */
document.addEventListener('pm:pousses-ready', () => {
  renderFamilies();
});

// Story 6.1 — Navigation directe vers le détail d'une espèce depuis la fiche légume (AC2)
function showEspece(especeId) {
  const familles = window.PoussesModule?.getFamilles() || [];
  for (const f of familles) {
    if ((f.especes || []).includes(especeId)) {
      _currentFamille = f.id;
      _renderDetail(especeId);
      return;
    }
  }
  renderFamilies();
}

// ─── API publique (AR3) ───────────────────────────────────────────────────────
window.PoussesUI = { renderFamilies, showEspece };
