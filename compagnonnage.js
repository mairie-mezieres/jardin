// compagnonnage.js — Module compagnonnage Potager Magique
// Expose window.CompagnonnageModule (AR3)
(function () {
  'use strict';

  let _data = null;

  async function _loadData() {
    try {
      const res = await fetch('./compagnonnage-data.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      _data = await res.json();
      document.dispatchEvent(new CustomEvent('pm:compagnonnage-ready'));
    } catch (err) {
      console.warn('[CompagnonnageModule] Données non disponibles :', err.message);
    }
  }

  function getAssociations(especeId) {
    if (!_data) return { benefiques: [], deconseilles: [] };
    const espece = (_data.especes || []).find(e => e.id === especeId);
    if (!espece) return { benefiques: [], deconseilles: [] };
    const all = _data.especes || [];
    const resolve = ids => ids
      .map(id => all.find(e => e.id === id))
      .filter(Boolean)
      .map(e => ({ id: e.id, nom: e.nom }));
    return {
      benefiques:   resolve(espece.benefiques  || []),
      deconseilles: resolve(espece.deconseilles || []),
    };
  }

  function detecterConflits(listeIds) {
    if (!_data || !Array.isArray(listeIds) || listeIds.length < 2) return [];
    const conflits = [];
    const seen = new Set();
    for (let i = 0; i < listeIds.length; i++) {
      for (let j = i + 1; j < listeIds.length; j++) {
        const idA = listeIds[i];
        const idB = listeIds[j];
        const pairKey = [idA, idB].sort().join('__');
        if (seen.has(pairKey)) continue;
        const assocA = getAssociations(idA);
        const assocB = getAssociations(idB);
        const conflit = assocA.deconseilles.some(h => h.id === idB)
                     || assocB.deconseilles.some(h => h.id === idA);
        if (conflit) {
          const a = (_data.especes || []).find(e => e.id === idA);
          const b = (_data.especes || []).find(e => e.id === idB);
          if (a && b) { conflits.push({ a: { id: a.id, nom: a.nom }, b: { id: b.id, nom: b.nom } }); seen.add(pairKey); }
        }
      }
    }
    return conflits;
  }

  function getMatrice() {
    if (!_data) return { especes: [], cellules: {} };
    const especes = (_data.especes || []).map(e => ({ id: e.id, nom: e.nom }));
    const cellules = {};
    (_data.especes || []).forEach(e => {
      (e.benefiques || []).forEach(bid => {
        const key = [e.id, bid].sort().join('__');
        cellules[key] = 'beneficial';
      });
      (e.deconseilles || []).forEach(did => {
        const key = [e.id, did].sort().join('__');
        cellules[key] = 'warned';
      });
    });
    return { especes, cellules };
  }

  _loadData();

  window.CompagnonnageModule = { getAssociations, detecterConflits, getMatrice };
}());
