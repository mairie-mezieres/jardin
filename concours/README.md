# Concours photo

Page autonome (`concours/index.html`) : 5 thèmes, une photo par personne et par thème,
puis un vote par thème, et enfin un classement. Aucun compte n'est demandé aux
participants : le lien se partage tel quel (WhatsApp…).

Les photos et les votes sont stockés sur **Supabase** (offre gratuite).

## Mise en place (une fois, ~5 minutes)

1. Créer un compte et un projet sur https://supabase.com (offre gratuite).
2. **SQL Editor → New query** : coller `concours/supabase.sql`, remplacer
   `CHANGEZ-MOI` par le code organisateur choisi, puis **Run**.
3. **Project Settings → API** : copier la *Project URL* et la clé publique
   (*anon public* ou *publishable*) dans `concours/config.js`.
   ⛔ Jamais la clé *service_role* / *secret*.
4. Projet installé avant le 17/10/2026 : exécuter aussi `concours/supabase-maj-1.sql`
   (photos des autres masquées pendant les dépôts).
5. Publier sur `main` : la page est servie par GitHub Pages à `…/jardin/concours/`.

## Déroulé

| Étape | Qui | Ce qui se passe |
|---|---|---|
| 1. Dépôt | tout le monde | Chacun dépose une photo par thème, avec son prénom et une légende facultative (remplaçable, retirable). Chacun ne voit **que ses propres photos** (le serveur ne renvoie pas les autres) ; seul l'organisateur les voit toutes, pour modérer. |
| 2. Vote | tout le monde | Une voix par thème, modifiable, jamais pour sa propre photo. Les auteurs sont anonymes. |
| 3. Résultats | tout le monde | Classement par thème, avec les prénoms et le nombre de voix. |

L'organisateur appuie sur **« Espace organisateur »** en bas de page (ou ouvre `…/concours/#orga`),
saisit son code (mémorisé sur l'appareil) et change d'étape. Il voit aussi un décompte en direct et peut retirer une photo.

## Limites connues

- **Un participant = un appareil.** L'identité est un identifiant aléatoire gardé dans le
  navigateur : changer de navigateur ou vider ses données permet de voter à nouveau, et fait
  perdre la main sur ses photos déjà déposées. Suffisant entre amis, pas pour un concours à enjeu.
- Une photo remplacée ou retirée reste dans le stockage Supabase (non affichée).
- La page n'est pas mise en cache par le service worker du potager (`service-worker.js`
  l'ignore) : elle demande une connexion.
