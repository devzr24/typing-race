# ADR 0010 — Direction artistique Keyclue

- **Statut :** accepté
- **Date :** 2026-10-07
- **Remplace en partie :** ADR 0009 (valeurs neutres provisoires et police système)

## Contexte

La direction artistique a été réalisée par l'équipe (thème « Rue néon ») : nom, palette, polices
et effets. L'ADR 0009 prévoyait des couleurs neutres provisoires et la police du système ;
ces deux points changent. Le mécanisme de thème (cookie, `light-dark()`, pas de flash) est conservé.

## Décision

- **Nom** : Keyclue (dans `src/i18n/messages/`). Pas encore de logo.
- **Palette** : 8 couleurs de l'équipe, chacune en version pâle et foncée, définies une seule fois
  dans `@theme` (`src/app/globals.css`) : `neon`, `cyan`, `alert`, `ink`, `night`, `card`, `steel`,
  `mist`. Le jeton `line` (bordures) réutilise `mist` en thème pâle (contraste ≥ 3:1) et `steel` en foncé.
- **Polices** (Google Fonts via `next/font`, auto-hébergées au build) : Monoton (nom et intro),
  Righteous (titres), Nunito (texte), JetBrains Mono (code de salle, futur texte de course).
- **Effets** : intro « enseigne néon » une fois par visite, slogan tapé, route néon en perspective
  (CSS, `transform` animé), réseau d'indices (canvas, 40 points au plus), lueurs, sons générés par
  la Web Audio API. Tous coupés par le bouton « Effets » (cookie `fx`) et par `prefers-reduced-motion` ;
  le son est coupé par défaut (cookie `sound`). Icônes : `lucide-react`.
- **Robustesse** : l'intro est animée en CSS et se retire seule (≈ 1 s) même si le JavaScript tarde ;
  un script de quelques lignes dans `<head>` décide de l'intro et du slogan avant l'affichage.

## Conséquences

- Changer une couleur ou une police = modifier `globals.css` (et `layout.tsx` pour charger une police).
- Les effets ont un coût mesuré : sur téléphone simulé à processeur ralenti ×4, 55-58 images/s avec
  tous les effets, 60 sans. La route anime un `transform` plutôt que `background-position`
  (38 images/s avant cette optimisation).
- Points de contraste connus, à arbitrer par l'équipe : texte `night` sur `neon` en thème pâle
  (≈ 4,4:1, juste sous 4,5:1) ; bordures `steel` en thème foncé (≈ 2,3:1).

## Alternatives écartées

- **Three.js / WebGL** pour la route et le réseau : dépendance lourde pour un décor discret.
- **Fichiers audio** : poids et licences ; des sons synthétisés suffisent.
- **Polices chargées depuis le CDN Google au runtime** : `next/font` les auto-héberge (pas de requête tierce).
