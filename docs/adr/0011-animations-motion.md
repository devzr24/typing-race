# ADR 0011 — Animations : motion, CSS composité et budget de performance

- **Statut :** accepté
- **Date :** 2026-10-07

## Contexte

L'équipe a demandé des animations riches (sites de référence : Igloo, Persona, Salmon Ascent,
jamesmurray.ca) avec sa palette : logo néon qui vacille et glitch, décodage du code de salle,
cartes de joueurs animées, boutons à bordure néon animée et effet magnétique, halo qui suit le
curseur, transitions de page, réseau d'indices réactif, scanlines. Contraintes : bouton « Effets »,
`prefers-reduced-motion`, lisibilité intacte, fluidité sur téléphone.

## Décision

- **motion** (anciennement framer-motion, import `motion/react`) seulement là où il apporte
  quelque chose : entrée/sortie des cartes de joueurs (`AnimatePresence`) et ressort du halo.
- **CSS** pour tout le reste (logo, glitch, bordures, scanlines, transition de page), afin que
  rien ne dépende du chargement du JavaScript. Transition de page via `app/template.tsx`.
- **Uniquement des propriétés composées** (`transform`, `opacity`) dans les animations continues :
  la bordure néon fait tourner un carré en dégradé conique, la route anime un `transform`.
- **Canvas sans opérations coûteuses** : ni `shadowBlur`, ni `mask-image` sur le canvas, ni
  composition `destination-out` ; lueur des points pré-rendue, lignes regroupées par intensité,
  colonne centrale estompée par un calcul d'opacité par élément.
- **Coupures** : tout passe par la classe `fx-off` (bouton « Effets ») et par
  `prefers-reduced-motion` ; halo et réseau d'indices absents sous 768 px ou sans souris.
- **Budget mesuré** (Playwright, processeur ralenti ×4) : ≥ 50 images/s sur ordinateur avec tous
  les effets et la souris en mouvement, 60 images/s sur téléphone.

## Conséquences

- Nouvelle dépendance `motion` (~ côté client uniquement).
- Toute nouvelle animation continue doit être vérifiée avec ce budget avant d'être fusionnée.
- Mesures qui ont guidé ces choix : `mask-image` sur le canvas plein écran ≈ −8 images/s ;
  `destination-out` à chaque image : 11 images/s au lieu de 43.

## Alternatives écartées

- **Tout en motion** : rendu initial dépendant du JavaScript (contenu invisible tant qu'il n'est pas chargé).
- **GSAP** : licence et poids pour un besoin couvert par motion + CSS.
- **Three.js / WebGL** : disproportionné pour ces décors.
