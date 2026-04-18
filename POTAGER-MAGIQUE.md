# Potager Magique — Document d'Audit & Guide de Développement

> Document créé lors de la Story 1.1 — référence pour tous les agents dev des stories suivantes.
> Branche : `feature/potager-magique` | Base : `mairie-mezieres/jardin@main`

---

## 1. Structure des Fichiers JS Existants

L'app `jardin` est une **application single-file** : tout le CSS, HTML et JS est inline dans `index.html`.

| Fichier | Rôle | Taille |
|---|---|---|
| `index.html` | App complète : CSS + HTML + JS inline | ~60KB |
| `service-worker.js` | Service worker minimal — **jamais enregistré** | 5 lignes |
| `manifest.json` | PWA manifest minimal (sans icônes) | 8 lignes |
| `README.md` | Vide | — |

### Variables et fonctions JS clés dans `index.html`

| Symbole | Type | Rôle |
|---|---|---|
| `const VEG` | Array (53 objets) | Catalogue complet des légumes avec données culturales, calendrier, compagnonnage partiel |
| `const PESTS` | Array | Catalogue des nuisibles |
| `const GROUPS` | Array | Regroupements botaniques pour le calendrier |
| `let sowings` | Array (localStorage) | Liste des semis/plantations de l'utilisateur |
| `showTab(id, btn)` | Function | Switching des onglets — retire/ajoute classe `active` |
| `openM(id)` | Function | Ouvre la bottom-sheet fiche légume |
| `addSow()` | Function | Ajoute un semis via le formulaire |
| `delSow(id)` | Function | Supprime un semis |
| `getStage(date, dth)` | Function | Calcule le stade de croissance depuis la date de semis |
| `renderSowings()` | Function | Affiche la liste des semis |
| `buildCal(tid, mini)` | Function | Construit les tableaux de calendrier |
| `renderGrid(f)` | Function | Affiche la grille de légumes filtrée |
| `initToday()` | Function | Initialise l'onglet Tableau (tâches du jour statiques) |
| `saveSow()` | Function | Persiste les semis en localStorage |

### Structure d'un objet VEG

```js
{
  id: 'tomate',          // identifiant unique kebab-case
  n: 'Tomate',           // nom affiché
  lat: 'Solanum lycopersicum', // nom latin
  e: '🍅',              // emoji
  fam: 'solanees',       // famille botanique
  li: 'sun',             // lumière : 'sun' | 'half' | 'shade'
  wa: 'high',            // arrosage
  ha: 'fragile',         // rusticité : 'very-hardy' | 'hardy' | 'fragile'
  di: 'medium',          // difficulté : 'easy' | 'medium' | 'hard'
  tmi: 15, tma: 30,      // températures min/max °C
  dth: 80,               // jours à récolte
  si: [2,3,4],           // mois semis serre
  so: [],                // mois semis extérieur
  pl: [5,6],             // mois plantation
  ha: [7,8,9,10],        // mois récolte
  pk: [8,9],             // mois récolte optimale
  pr: [],                // mois protection
  wd: 'Régulier...',     // description arrosage
  sd: 'Plein soleil',    // description lumière
  pl2: 'sn',             // zone serre recommandée
  desc: '...',           // description
  tips: '...',           // conseils
  co: ['Basilic'],       // associations bénéfiques (co = companions)
  en: ['Fenouil'],       // associations déconseillées (en = enemies)
}
```

---

## 2. Schéma localStorage Existant — NE PAS MODIFIER

> ⚠️ **CRITIQUE** : Ces clés appartiennent à `jardin`. Ne jamais les renommer, supprimer ou modifier leur format.

| Clé | Type | Contenu |
|---|---|---|
| `gdn3` | `JSON` (Array) | Tableau des semis/plantations enregistrés par l'utilisateur |

### Structure d'un semis (clé `gdn3`)

```js
{
  id: 1234567890,    // timestamp comme identifiant unique
  vid: 'tomate',     // id de la variété (référence VEG.id)
  act: 'si',         // action : 'si'=semis serre, 'so'=semis ext, 'pl'=plantation, 'rp'=repiquage
  date: '2026-04-10', // date ISO string
  loc: 'sn',         // localisation : 'sn'=Serre Nord, 'sm'=Serre Centre, 'ss'=Serre Sud, 'pa'=Plein air, 'pt'=Potager
  note: 'Roma',      // note libre (variété, quantité...)
  vn: 'Tomate',      // nom du légume (dénormalisé)
  ve: '🍅',          // emoji du légume (dénormalisé)
  dth: 80,           // jours à récolte (dénormalisé depuis VEG)
}
```

### Convention Potager Magique pour les nouvelles clés

Toutes les nouvelles clés localStorage sont **préfixées `pm_`** pour éviter toute collision avec `jardin` :

| Clé (future) | Story | Contenu |
|---|---|---|
| `pm_schema_version` | Epic 2 Story 2.1 | `"2"` — numéro de version du schéma PM |
| `pm_cultures` | Epic 2 Story 2.1 | Tableau des cultures trackées PM |
| `pm_preferences` | Epic 2 Story 2.4 | `{ modeDefault, coordinates }` |
| `pm_weather_updated_at` | Epic 1 Story 1.3 | Timestamp ISO du dernier fetch météo |
| `pm_weather_cache` | Epic 1 Story 1.3 | Données météo Open-Meteo cachées |

---

## 3. Points d'Extension — Comment Ajouter des Fonctionnalités

### 3.1 Ajouter un Nouvel Onglet

La navigation est dans `<nav>` et les sections dans `<body>`. Le mécanisme de switching est géré par `showTab(id, btn)`.

**Pour ajouter l'onglet "Aujourd'hui" (Epic 1 Story 1.2) :**

```html
<!-- Dans <nav>, AVANT le premier .nav-btn existant -->
<button class="nav-btn active" onclick="showTab('aujourd-hui',this)">Aujourd'hui</button>
<!-- Retirer la classe "active" du bouton "Tableau" existant -->
```

```html
<!-- Nouvelle <section> juste après <body> (avant les sections existantes) -->
<section id="tab-aujourd-hui" class="active">
  <!-- Contenu du dashboard Aujourd'hui -->
</section>
<!-- Retirer la classe "active" de <section id="tab-tableau"> -->
```

**Mécanique de `showTab()` :**
```js
function showTab(id, btn) {
  // retire 'active' de tous les boutons nav et toutes les sections
  // ajoute 'active' sur btn et sur document.getElementById('tab-' + id)
}
```
→ Le pattern `tab-{id}` est utilisé. Nommer les sections `tab-aujourd-hui`, `tab-pousses`, etc.

### 3.2 Enrichir la Fiche Légume

La fiche légume est construite dans `openM(id)` — bottom-sheet HTML généré dynamiquement.

**Ajouter une section dans la modal (Epic 5 Story 5.2, Epic 6 Story 6.1) :**
1. Identifier le `const html = ...` dans `openM(id)`
2. Ajouter les nouvelles sections HTML avant `document.getElementById('mov').innerHTML = html`
3. Les données de la fiche viennent de `VEG.find(x => x.id === id)` — utiliser l'objet `v`

**Ajouter associations compagnonnage :**
Les champs `co` (bénéfiques) et `en` (déconseillés) sont déjà dans VEG — mais incomplètes pour toutes les espèces. La Story 5.1 créera `compagnonnage-data.json` comme source de vérité.

### 3.3 Service Worker — Augmentation Requise

Le fichier `service-worker.js` actuel est **non fonctionnel** pour nos besoins :

```js
// ÉTAT ACTUEL — ne cache rien
self.addEventListener('install', e => { console.log("SW installé"); });
self.addEventListener('fetch', e => {});
```

**Problèmes identifiés :**
1. Le SW n'est **jamais enregistré** dans `index.html` — aucun `navigator.serviceWorker.register()` n'est présent
2. Aucune stratégie de cache (stale-while-revalidate, précache)
3. Le fichier `manifest.json` ne référence pas d'icônes PWA

**À faire en Epic 1 Story 1.3 :**
- Enregistrer le SW dans le listener `DOMContentLoaded` existant de `index.html`
- Augmenter `service-worker.js` avec précache assets + stale-while-revalidate pour Open-Meteo

**Enregistrement du SW à ajouter dans `index.html` :**
```js
// Dans document.addEventListener('DOMContentLoaded', () => { ... })
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js')
    .catch(err => console.warn('SW registration failed:', err));
}
```

### 3.4 Communication Inter-Modules

L'app est actuellement monolithique (tout inline). Potager Magique introduit des modules JS séparés.

**Pattern de communication validé (AR3, NFR17) :**
```js
// Émission d'événement (dans un module)
document.dispatchEvent(new CustomEvent('pm:mode-changed', { detail: { mode: 'serre' } }));

// Écoute dans un autre module
document.addEventListener('pm:mode-changed', (e) => {
  const { mode } = e.detail;
  // recalculer...
});
```

**Événements Potager Magique définis :**
| Événement | Émis par | Consommé par |
|---|---|---|
| `pm:weather-updated` | `meteo.js` | `alertes.js`, `expert.js` |
| `pm:mode-changed` | `cultures.js` (ModeToggle) | `alertes.js`, `expert.js` |
| `pm:culture-added` | `cultures.js` | `compagnonnage.js` |

---

## 4. Architecture Modulaire Potager Magique — Fichiers à Créer

> Ces fichiers N'EXISTENT PAS encore. Ils seront créés story par story.

| Fichier | Module | Epic | Story | Rôle |
|---|---|---|---|---|
| `meteo.js` | Météo | 1 | 1.3 | Fetch Open-Meteo, cache localStorage, événement `pm:weather-updated` |
| `cultures.js` | Cultures | 2 | 2.1 | CRUD cultures localStorage (clé `pm_cultures`), API publique `CulturesModule` |
| `alertes.js` | Alertes | 3 | 3.1 | Moteur seuils gel/canicule/grêle, écoute `pm:weather-updated` |
| `expert.js` | Système expert | 3 | 3.3 | Génération recommandations, charge `expert-rules.json` |
| `expert-rules.json` | Règles expertes | 3 | 3.3 | Règles agronomiques versionnées, séparé du code |
| `pousses.js` | Identification pousses | 4 | 4.1 | Navigation banque photos, API publique `PoussesModule` |
| `pousses-data.json` | Données pousses | 4 | 4.1 | Index espèces/stades/chemins photos |
| `compagnonnage.js` | Compagnonnage | 5 | 5.1 | Associations, détection conflits, API publique `CompagnonnageModule` |
| `compagnonnage-data.json` | Données compagnonnage | 5 | 5.1 | Matrice 34 espèces (bénéfiques/déconseillés) |

### CSS à créer (Epic 1 Story 1.2)

| Fichier | Module |
|---|---|
| `dashboard.css` | Onglet Aujourd'hui |
| `alertes.css` | Composant AlertBanner |
| `pousses.css` | Onglet Pousses + PhotoCard |
| `compagnonnage.css` | Guide compagnonnage + CompanionBadge |

### Assets à créer (Epic 4)

```
assets/
  pousses/
    {famille}/
      {espece}/
        germination.webp
        cotyledons.webp
        vraies-feuilles.webp
    mauvaises-herbes/
      mouron.webp
      chenapode.webp
      liseron.webp
      ortie.webp
      laiteron.webp
```

---

## 5. Serveur de Développement

```bash
# Depuis le dossier potager-magique/
python -m http.server 8000
# Ouvrir : http://localhost:8000

# Alternative (si Node.js disponible)
npx serve .
```

> **IMPORTANT** : Pas de bundler, pas de build step. Les fichiers sont servis directement. Les modules ES6 via `<script type="module">`.

---

## 6. Points de Vigilance Critiques

1. **Rétro-compatibilité absolue** : ne jamais modifier les fonctions existantes (`showTab`, `openM`, `addSow`, etc.) sauf si la story l'exige explicitement — uniquement des ajouts.
2. **Clé localStorage `gdn3`** : ne JAMAIS toucher à cette clé — les données existantes de l'utilisateur sont stockées ici.
3. **VEG array** : peut être lu (lecture seule) par les nouveaux modules. Ne pas le modifier inline — les données compagnonnage complètes seront dans `compagnonnage-data.json`.
4. **CSS existant** : les variables CSS `--soil`, `--moss`, `--leaf`, `--paper`, `--cream`, `--text`, `--muted` sont déjà définies. Les nouvelles variables PM (`--color-primary`, `--color-alert-gel`, etc.) les enrichissent sans les remplacer.
5. **Service worker non enregistré** : À corriger en Story 1.3 — pas en scope de Story 1.1.
