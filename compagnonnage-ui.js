// compagnonnage-ui.js — Matrice visuelle de compagnonnage (Story 5.4)
// Dépend de window.CompagnonnageModule (compagnonnage.js) — zéro import croisé (NFR17)

(function () {
  'use strict';

  let _listenersAttached = false;

  // ─── Tooltip ────────────────────────────────────────────────────────────────

  function _showTooltip(nomA, nomB, type) {
    const tooltip = document.getElementById('cm-tooltip');
    if (!tooltip) return;
    const label = type === 'beneficial' ? '✅ Association bénéfique' : '⚠️ Association déconseillée';
    tooltip.innerHTML = `<strong>${nomA}</strong> + <strong>${nomB}</strong><br>${label}`;
    tooltip.hidden = false;
  }

  function _hideTooltip() {
    const tooltip = document.getElementById('cm-tooltip');
    if (tooltip) tooltip.hidden = true;
  }

  // ─── Rendu matrice ───────────────────────────────────────────────────────────

  function renderMatrice() {
    const wrap = document.getElementById('pm-matrice-wrap');
    if (!wrap) return;

    if (!window.CompagnonnageModule) {
      wrap.innerHTML = '<p class="cm-loading">Chargement des données…</p>';
      return;
    }

    const { especes, cellules } = window.CompagnonnageModule.getMatrice();

    if (!especes || especes.length === 0) {
      wrap.innerHTML = '<p class="cm-loading">Données non disponibles.</p>';
      return;
    }

    const trunc = nom => nom.length > 8 ? nom.slice(0, 7) + '…' : nom;

    let html = '<table class="cm-table" role="grid" aria-label="Matrice de compagnonnage"><thead><tr>';
    // Coin vide
    html += '<th class="cm-th-corner" scope="col"></th>';
    especes.forEach(e => {
      html += `<th class="cm-th" scope="col" title="${e.nom}">${trunc(e.nom)}</th>`;
    });
    html += '</tr></thead><tbody>';

    especes.forEach((row, ri) => {
      html += `<tr><th class="cm-th-row" scope="row" title="${row.nom}">${trunc(row.nom)}</th>`;
      especes.forEach((col, ci) => {
        if (ri === ci) {
          html += '<td class="cm-cell cm-cell--self" aria-label="Même espèce">—</td>';
          return;
        }
        const key = [row.id, col.id].sort().join('__');
        const type = cellules[key] || null;
        if (type === 'beneficial') {
          html += `<td class="cm-cell cm-cell--beneficial" data-a="${row.id}" data-b="${col.id}" data-nom-a="${row.nom}" data-nom-b="${col.nom}" data-type="beneficial" tabindex="0" role="gridcell" aria-label="${row.nom} + ${col.nom} : bénéfique">●</td>`;
        } else if (type === 'warned') {
          html += `<td class="cm-cell cm-cell--warned" data-a="${row.id}" data-b="${col.id}" data-nom-a="${row.nom}" data-nom-b="${col.nom}" data-type="warned" tabindex="0" role="gridcell" aria-label="${row.nom} + ${col.nom} : déconseillé">●</td>`;
        } else {
          html += '<td class="cm-cell cm-cell--neutral" role="gridcell" aria-label="Neutre"></td>';
        }
      });
      html += '</tr>';
    });

    html += '</tbody></table>';
    wrap.innerHTML = html;

    // Attacher les listeners une seule fois (guard contre double-render DOMContentLoaded + pm:compagnonnage-ready)
    if (!_listenersAttached) {
      wrap.addEventListener('click', _onCellClick);
      wrap.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') _onCellClick(e);
      });
      document.addEventListener('click', e => {
        if (!wrap.contains(e.target)) _hideTooltip();
      });
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape') _hideTooltip();
      });
      _listenersAttached = true;
    }
  }

  function _onCellClick(e) {
    const cell = e.target.closest('[data-type]');
    if (!cell) { _hideTooltip(); return; }
    e.stopPropagation();
    _showTooltip(cell.dataset.nomA, cell.dataset.nomB, cell.dataset.type);
  }

  // ─── Initialisation ─────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', () => {
    // Render immédiat si module déjà chargé, sinon attendre l'événement
    if (window.CompagnonnageModule) {
      renderMatrice();
    }
    document.addEventListener('pm:compagnonnage-ready', () => renderMatrice());
  });

  // ─── API publique ────────────────────────────────────────────────────────────
  window.CompagnonnageUI = { renderMatrice };
}());
