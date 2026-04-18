// pousses.js — Banque de photos de pousses
// Expose window.PoussesModule (AR3)
(function () {
  'use strict';

  let _data = null;

  async function _loadData() {
    if (_data) return;
    try {
      const res = await fetch('./pousses-data.json');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      _data = await res.json();
    } catch {
      _data = { version: 0, familles: [], especes: [], mauvaisesHerbes: [] };
    }
  }

  function getFamilles() {
    if (!_data) return [];
    return _data.familles || [];
  }

  function getEspecesByFamille(familleId) {
    if (!_data) return [];
    const famille = (_data.familles || []).find(f => f.id === familleId);
    if (!famille) return [];
    return famille.especes
      .map(id => (_data.especes || []).find(e => e.id === id))
      .filter(Boolean);
  }

  function getPhotos(especeId) {
    if (!_data) return {};
    const espece = (_data.especes || []).find(e => e.id === especeId);
    return espece ? (espece.photos || {}) : {};
  }

  function getMauvaisesHerbes() {
    if (!_data) return [];
    return _data.mauvaisesHerbes || [];
  }

  function getConfusionsForEspece(especeId) {
    if (!_data) return [];
    const espece = (_data.especes || []).find(e => e.id === especeId);
    if (!espece || !espece.confusions) return [];
    const herbes = _data.mauvaisesHerbes || [];
    return espece.confusions
      .map(id => herbes.find(h => h.id === id))
      .filter(Boolean);
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await _loadData();
    document.dispatchEvent(new CustomEvent('pm:pousses-ready'));
  });

  window.PoussesModule = { getFamilles, getEspecesByFamille, getPhotos, getMauvaisesHerbes, getConfusionsForEspece };
}());
