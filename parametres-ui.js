// parametres-ui.js — Paramètres & Préférences
// Module indépendant (NFR17) — aucun import croisé
// Communication inter-modules via événement DOM pm:mode-changed (AR3)

const LS_PREFS_KEY = 'pm_preferences';
const DEFAULT_PREFS = {
  modeDefault:  'exterieur',
  coordinates:  { lat: 47.7914, lon: 1.7664 }   // Mézières-lez-Cléry (NFR15)
};

// ─── Helpers localStorage ────────────────────────────────────────────────────

function _readPrefs() {
  try {
    const raw = localStorage.getItem(LS_PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS, coordinates: { ...DEFAULT_PREFS.coordinates } };
    const parsed = JSON.parse(raw);
    return {
      modeDefault:  parsed.modeDefault  || DEFAULT_PREFS.modeDefault,
      coordinates: {
        lat: parsed.coordinates?.lat ?? DEFAULT_PREFS.coordinates.lat,
        lon: parsed.coordinates?.lon ?? DEFAULT_PREFS.coordinates.lon
      }
    };
  } catch {
    return { ...DEFAULT_PREFS, coordinates: { ...DEFAULT_PREFS.coordinates } };
  }
}

function _savePrefs(prefs) {
  try {
    localStorage.setItem(LS_PREFS_KEY, JSON.stringify(prefs));
  } catch (err) {
    console.warn('[ParametresUI] localStorage write failed:', err.message);
  }
}

// ─── Rendu ───────────────────────────────────────────────────────────────────

function renderParametres() {
  const prefs = _readPrefs();

  // ModeToggle — met à jour l'état actif (pattern role="radio" + aria-checked)
  document.querySelectorAll('.pm-mode-btn').forEach(btn => {
    const isActive = btn.dataset.mode === prefs.modeDefault;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
  });

  // Coordonnées
  const latInput = document.getElementById('pm-coord-lat');
  const lonInput = document.getElementById('pm-coord-lon');
  if (latInput) latInput.value = prefs.coordinates.lat;
  if (lonInput) lonInput.value = prefs.coordinates.lon;
}

// ─── ModeToggle ──────────────────────────────────────────────────────────────

function _setMode(mode) {
  const prefs = _readPrefs();
  prefs.modeDefault = mode;
  _savePrefs(prefs);
  renderParametres();
  document.dispatchEvent(new CustomEvent('pm:mode-changed', { detail: { mode } }));
}

function _initModeToggle() {
  document.querySelectorAll('.pm-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => _setMode(btn.dataset.mode));
  });
}

// ─── Formulaire coordonnées ───────────────────────────────────────────────────

function _initCoordForm() {
  document.getElementById('pm-coord-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const lat = parseFloat(document.getElementById('pm-coord-lat')?.value);
    const lon = parseFloat(document.getElementById('pm-coord-lon')?.value);
    if (isNaN(lat) || isNaN(lon)) return;

    const prefs = _readPrefs();
    prefs.coordinates = { lat, lon };
    _savePrefs(prefs);

    // Feedback visuel — bouton "Enregistrer" confirme
    const btn = document.getElementById('pm-coord-save');
    renderParametres(); // confirme le round-trip depuis localStorage
    if (btn) {
      btn.textContent = '✓ Enregistré';
      setTimeout(() => { btn.textContent = 'Enregistrer'; }, 2000);
    }
  });
}

// ─── Auto-init ───────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  _initModeToggle();
  _initCoordForm();
  renderParametres();
});

// ─── API publique ────────────────────────────────────────────────────────────
window.ParametresUI = { renderParametres };

// ─── API inter-modules (AR3) ─────────────────────────────────────────────────
// Permet aux modules Epic 3 (expert.js, alertes.js) de lire les préférences
// sans accéder directement au localStorage
window.PrefsModule = { get: _readPrefs };
