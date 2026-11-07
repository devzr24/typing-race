# Matrice de traçabilité des exigences

Identifiants : ceux de l'énoncé « Web V — Travail de session ».
Statut : **complet**, **partiel** (une partie livrée, le reste à faire), **non fait**.
Tests : `*.test.ts` = tests unitaires (Vitest) ; `e2e/…` = tests de bout en bout (Playwright).

Mise à jour : 2026-11-07.

## Bilan

| Statut | Nombre |
|---|---|
| Complet | 14 |
| Partiel | 21 |
| Non fait | 55 |
| **Total** | **90** |

## 3. Contraintes techniques

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
|---|---|---|---|---|
| TECH-01 | complet | `package.json`, `src/app/` | toute la suite | Next.js 16 (App Router) et React 19. |
| TECH-02 | complet | `tsconfig.json`, `eslint.config.ts` | CI : `npm run lint`, `npm run typecheck` | Aucun fichier `.js`/`.jsx` suivi par Git ; `strict: true`. `no-explicit-any` et `ban-ts-comment` sont en erreur par héritage de `eslint-config-next/typescript` (recommandé de typescript-eslint) ; aucun `any`, `@ts-ignore` ni `@ts-expect-error` dans le code écrit à la main. Le client Prisma généré (`src/generated/`, ignoré par Git et par ESLint) en contient. |
| TECH-03 | complet | `src/app/globals.css` | — | Tailwind CSS 4. |
| TECH-04 | partiel | `prisma/schema.prisma`, `prisma/migrations/` | `src/server/migrate.test.ts` | PostgreSQL + Prisma 7, migrations versionnées et appliquées au démarrage (ADR 0008). **Manque : script de seed** (corpus de textes, utilisateurs, historique). |
| TECH-05 | partiel | `railway.json`, `server.ts` | `/api/health` | Déployé en HTTPS sur Railway : https://typing-race-production-4a76.up.railway.app. **Écart** : Railway est une plateforme hébergée (PaaS), pas un VPS. Choix à faire valider par l'enseignant ou à remplacer par un VPS (ADR 0001). |
| TECH-06 | partiel | `server.ts`, `src/server/room-socket.ts`, `src/server/realtime.ts` | `e2e/room.spec.ts` | Socket.IO sur le serveur Node (ADR 0002). Utilisé pour la liste des participants ; la progression de course n'existe pas encore. |
| TECH-07 | non fait | — | — | Aucune bibliothèque de schéma (Zod ou autre). Les entrées sont vérifiées à la main (`validateUsername`, `validateRoomCode`…), y compris le message Socket.IO `room:watch`. |
| TECH-08 | complet | — | — | Aucun service externe payant. GitHub et Discord OAuth sont gratuits ; les frais Railway sont à la charge de l'étudiant. |
| TECH-09 | complet | `.github/workflows/ci.yml` | exécutions vertes sur GitHub Actions | Chaque push sur `master` et chaque PR : lint, `tsc --noEmit`, tests unitaires, build, tests de bout en bout. |
| TECH-10 | complet | `.env.example`, `.gitignore` | `src/server/env.test.ts` | `.env` n'est jamais commité ; le serveur s'arrête si une variable obligatoire manque en production. |

## 4. Identité visuelle et design

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
|---|---|---|---|---|
| DES-01 | partiel | `src/i18n/messages/` | — | Nom « Keyclue » utilisé dans l'interface. **Manque** : `docs/DEMARCHE-CREATIVE.md` (noms envisagés, raison du choix, vérification d'originalité). |
| DES-02 | non fait | — | — | Aucun logo ; le favicon (`src/app/favicon.ico`) est celui de Next.js par défaut. Croquis à joindre à la démarche créative. |
| DES-03 | partiel | `docs/adr/0010-direction-artistique-keyclue.md`, `src/app/globals.css` | — | Palette et typographies définies (ADR 0010). **Manque** : moodboard de 3 à 5 références dans `docs/DEMARCHE-CREATIVE.md`. |
| DES-04 | partiel | `src/app/globals.css`, `src/components/effects.tsx`, `src/components/clue-network.tsx`, `src/components/motion-effects.tsx` | `e2e/room.spec.ts` | Direction artistique propre, sans shadcn/ui ni émojis (icônes Lucide). **Manque** : la piste de progression comme élément signature (pas encore de course). |
| DES-05 | complet | `src/components/preferences.tsx`, `src/app/layout.tsx`, `src/i18n/server.ts` | `e2e/room.spec.ts` (langue et thème) | Choix système / clair / sombre ; système par défaut. Le thème est lu dans un cookie et appliqué au rendu serveur : aucun flash au chargement (ADR 0009). |
| DES-06 | partiel | pages de `src/app/` | captures Playwright (vérification manuelle) | Pages existantes utilisables sur téléphone. **Manque** : message « clavier physique recommandé » à la place de la course sur mobile. |

## 5.2 Comptes et profil

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
|---|---|---|---|---|
| AUTH-01 | complet | `src/auth.ts`, `src/app/login/`, `src/app/register/`, `src/lib/auth/` | `src/lib/auth/username.test.ts`, `src/lib/auth/password.test.ts`, `src/lib/auth/account-linking.test.ts`, `src/lib/auth/auth.test.ts` | GitHub, Discord, et nom d'utilisateur + mot de passe (ADR 0004, 0005). Parcours OAuth vérifié manuellement. Un compte GitHub/Discord n'est jamais relié à une session déjà ouverte ; `/login` et `/register` redirigent une personne connectée (ADR 0012). |
| AUTH-02 | partiel | `src/auth.ts` (fournisseur `guest`), `src/lib/auth/guest.ts`, `src/app/login/login-forms.tsx` | `e2e/room.spec.ts` | Session d'invité dans le cookie signé d'Auth.js. **Écarts** : le pseudo est facultatif (généré si vide) et limité à 3–24 caractères au lieu de 3–20. |
| AUTH-03 | partiel | `src/components/avatar.tsx`, `src/lib/rooms/actions.ts`, `src/app/home-actions.tsx` | `src/lib/rooms/service.test.ts`, `e2e/room.spec.ts` (un invité ne peut pas créer de salle) | Un invité ne peut pas créer de salle : refus côté serveur et lien vers la connexion à la place du formulaire. Pas de photo pour l'invité ; avatar = initiale du nom. **Partiel** : l'historique n'existe pas encore (HIST-01), la règle « pas d'historique pour l'invité » reste à appliquer. |
| AUTH-04 | non fait | — | — | Seule la photo fournie par GitHub/Discord est affichée ; pas de téléversement. |
| AUTH-05 | non fait | — | — | — |
| AUTH-06 | non fait | — | — | Pas de page de profil. |

## 5.3 Salles et visibilité

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
|---|---|---|---|---|
| SALLE-01 | complet | `src/lib/rooms/service.ts`, `src/lib/rooms/actions.ts`, `src/app/home-actions.tsx`, `src/app/room/[code]/room-view.tsx`, `prisma/migrations/20261106120000_room_spectator/` | `src/lib/rooms/service.test.ts`, `e2e/room.spec.ts` | Création réservée aux utilisateurs connectés ; le créateur devient l'hôte et choisit d'être participant (par défaut) ou spectateur (`RoomParticipant.isSpectator`), visible en direct dans la salle. Les spectateurs ne pourront pas taper : à appliquer avec la course (COURSE-05). |
| SALLE-02 | complet | `src/lib/rooms/code.ts`, `src/lib/rooms/code-generator.ts` | `src/lib/rooms/code.test.ts` | 6 caractères, alphabet sans 0/O/1/I/L, générateur cryptographique, unicité en base. |
| SALLE-03 | non fait | — | — | Toutes les salles sont actuellement accessibles par code. |
| SALLE-04 | non fait | — | — | — |
| SALLE-05 | non fait | — | — | Aucune capacité maximale. |
| SALLE-06 | partiel | `prisma/schema.prisma` (`@@unique([roomId, key])`) | `src/lib/rooms/service.test.ts` | Pas de doublon dans une même salle (deuxième onglet). **Manque** : contrainte en base « une seule salle par personne » et proposition de quitter la salle actuelle. |
| SALLE-07 | non fait | — | — | — |
| SALLE-08 | partiel | `src/lib/rooms/service.ts`, `src/server/room-socket.ts` | `src/lib/rooms/service.test.ts` | Transfert automatique au plus ancien ; la salle est supprimée quand le dernier part (ADR 0006). **Manque** : exclure les bots et les personnes déconnectées du transfert. |
| SALLE-09 | non fait | — | — | Pas encore de course : aucune vérification de l'état de la salle à l'arrivée. |
| SALLE-10 | non fait | — | — | Aucune limite de tentatives par IP sur le code. |

## 5.4 Rejoindre une course

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
|---|---|---|---|---|
| JOIN-01 | complet | `src/app/page.tsx`, `src/app/home-actions.tsx` | `e2e/room.spec.ts` | Champ de code sur la page d'accueil ; message clair si le code n'existe pas. |
| JOIN-02 | non fait | — | — | — |
| JOIN-03 | non fait | — | — | — |

## 5.5 Configuration de la course

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
|---|---|---|---|---|
| CONF-01 | non fait | — | — | — |
| CONF-02 | non fait | — | — | — |
| CONF-03 | non fait | — | — | — |
| CONF-04 | non fait | — | — | — |
| CONF-05 | non fait | — | — | Critères de complexité à définir et documenter. |
| CONF-06 | non fait | — | — | — |
| CONF-07 | non fait | — | — | Comportement en mode cohérent à choisir et documenter. |
| CONF-08 | non fait | — | — | — |
| CONF-09 | non fait | — | — | — |
| CONF-10 | non fait | — | — | — |
| CONF-11 | non fait | — | — | Dépend de SALLE-03 et SALLE-05. |
| CONF-12 | non fait | — | — | — |

## 5.6 Déroulement d'une course

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
|---|---|---|---|---|
| COURSE-01 | partiel | `docs/ARCHITECTURE.md`, `docs/architecture/machine-a-etats.md`, `prisma/schema.prisma` (`RoomStatus`) | — | Machine à états documentée avec les états de l'énoncé (`EN_ATTENTE → DECOMPTE → EN_COURSE → RESULTATS → EN_ATTENTE \| FERMEE`). L'énumération ne contient que `EN_ATTENTE`, `EN_COURSE`, `TERMINEE` ; seul `EN_ATTENTE` est utilisé. **Manque** : `DECOMPTE`, `RESULTATS`, `FERMEE` et les transitions. |
| COURSE-02 | non fait | — | — | — |
| COURSE-03 | non fait | — | — | — |
| COURSE-04 | non fait | — | — | — |
| COURSE-05 | non fait | — | — | — |
| COURSE-06 | non fait | — | — | — |
| COURSE-07 | non fait | — | — | — |
| COURSE-08 | partiel | `src/app/room/[code]/room-view.tsx`, `src/server/room-socket.ts` | `e2e/room.spec.ts` | Reconnexion Socket.IO et délai de grâce de 30 s, seulement dans la salle d'attente. **Manque** : reprise de la course et abandon automatique. |
| COURSE-09 | non fait | — | — | — |
| COURSE-10 | non fait | — | — | — |
| COURSE-11 | non fait | — | — | — |

## 5.7 Bots

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
|---|---|---|---|---|
| BOT-01 | non fait | — | — | — |
| BOT-02 | non fait | — | — | — |
| BOT-03 | non fait | — | — | — |
| BOT-04 | non fait | — | — | — |
| BOT-05 | non fait | — | — | — |

## 5.8 Bonus de remontée

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
|---|---|---|---|---|
| BONUS-01 | non fait | — | — | Règle exacte à documenter. |
| BONUS-02 | non fait | — | — | — |
| BONUS-03 | non fait | — | — | — |
| BONUS-04 | non fait | — | — | — |

## 5.9 Résultats et statistiques

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
|---|---|---|---|---|
| RES-01 | non fait | — | — | — |
| RES-02 | non fait | — | — | — |
| RES-03 | non fait | — | — | — |
| RES-04 | non fait | — | — | — |
| RES-05 | non fait | — | — | Tables prévues dans `docs/architecture/modele-de-donnees.md`, non créées. |

## 5.10 Historique

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
|---|---|---|---|---|
| HIST-01 | non fait | — | — | — |
| HIST-02 | non fait | — | — | — |

## 5.11 Internationalisation

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
|---|---|---|---|---|
| I18N-01 | complet | `src/i18n/messages/fr.ts`, `src/i18n/messages/en.ts` | `src/i18n/messages.test.ts` | Libellés, erreurs (codes `ErrorCode`) et métadonnées des pages (`generateMetadata`) en FR et EN (ADR 0009). |
| I18N-02 | complet | `src/components/preferences.tsx`, `src/i18n/server.ts`, `src/i18n/accept-language.ts` | `src/i18n/accept-language.test.ts`, `e2e/langue.spec.ts`, `e2e/room.spec.ts` (langue et thème) | Sélecteur dans l'en-tête de toutes les pages, choix conservé dans un cookie. Sans cookie, la langue suit `Accept-Language`, puis le français (ADR 0014). |
| I18N-03 | partiel | `src/i18n/format.ts` | — | Aucune date ni statistique n'est encore affichée ; le formatage `Intl` selon la langue reste à mettre en place. |

## 6.1 Tests

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
|---|---|---|---|---|
| TEST-01 | partiel | `src/**/*.test.ts` | 120 tests unitaires (16 fichiers) | Couvre l'authentification (dont limitation des tentatives et refus de liaison OAuth), les codes, le service de salles, la configuration serveur, la langue. Les logiques à venir (course, bots, bonus, MPM) devront être testées. |
| TEST-02 | partiel | `e2e/room.spec.ts`, `playwright.config.ts` | 5 tests de bout en bout | Inscription puis création de salle, arrivée et départ en direct, refus de création pour un invité, code inexistant, langue et thème. |
| TEST-03 | partiel | `e2e/room.spec.ts` | — | Aucun test n'utilise OAuth. L'hôte s'inscrit avec un nom d'utilisateur + mot de passe ; le joueur qui rejoint est un invité. |

## 6.2 Performance

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
|---|---|---|---|---|
| PERF-01 | non fait | — | — | Lighthouse pas encore mesuré sur la page d'accueil. |
| PERF-02 | non fait | — | — | Aucune progression envoyée pour l'instant. |
| PERF-03 | non fait | — | — | Budget d'animation défini (ADR 0011), à vérifier avec 30 participants. |

## 6.3 Accessibilité

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
|---|---|---|---|---|
| A11Y-01 | partiel | `src/app/globals.css` | — | Palette choisie pour le contraste ; aucun audit WCAG AA mesuré dans les deux thèmes. |
| A11Y-02 | partiel | `src/components/site-header.tsx`, pages de `src/app/` | — | `<header>`, `<main>`, `<h1>`/`<h2>`, `<button>` et `<a>` utilisés. **Manque** : `<nav>` et `<footer>`. |
| A11Y-03 | partiel | `src/components/form-field.tsx`, `src/components/avatar.tsx` | — | Champs de formulaire avec libellé. Les avatars ont `alt=""` (décoratifs, le nom est affiché à côté) ; à revoir quand d'autres images seront ajoutées (logo, photos). |
| A11Y-04 | partiel | `src/app/globals.css` | — | Éléments natifs accessibles au clavier ; indicateur de focus et parcours complet non vérifiés. |

## 6.4 Sécurité

| ID | Statut | Fichiers principaux | Tests associés | Notes et choix |
|---|---|---|---|---|
| SEC-01 | non fait | — | — | Aucune action réservée à l'hôte n'existe encore (lancer, configurer, liens, expulser, fermer). |
| SEC-02 | non fait | — | — | Pas de téléversement (voir AUTH-04). |
| SEC-03 | complet | `src/lib/auth/password.ts`, `src/lib/auth/rate-limit.ts`, `src/auth.ts` | `src/lib/auth/password.test.ts`, `src/lib/auth/password-concurrency.test.ts`, `src/lib/auth/rate-limit.test.ts`, `src/lib/auth/actions.test.ts` | scrypt avec sel aléatoire, comparaison à temps constant, hachage factice pour les noms inconnus ; aucun mot de passe journalisé. Limitation des tentatives (connexion par IP et par nom, inscription par IP) et plafond de 2 hachages simultanés (ADR 0012). |

## Livrables de la remise finale (section 8)

| Livrable | Statut | Notes |
|---|---|---|
| Dépôt GitHub et historique régulier | partiel | https://github.com/devzr24/typing-race. Accès de l'enseignant à confirmer ; commits à poursuivre régulièrement. |
| URL de production | complet | https://typing-race-production-4a76.up.railway.app |
| `README.md` | partiel | Manque : captures d'écran, PostgreSQL via Docker Compose, compte de démonstration. |
| `docs/ARCHITECTURE.md` | partiel | Version initiale : vue d'ensemble, modèle de données, machine à états, ADR temps réel, flux temps réel actuels et prévus, approche prévue pour les bots. Manque pour la remise finale : ADR sur les bots, flux de course réels. |
| `docs/EXIGENCES.md` | complet | Ce fichier. |
| `docs/DEMARCHE-CREATIVE.md` | non fait | Voir DES-01 à DES-03. |
| `docs/IA.md` | non fait | `CLAUDE.md` et `AGENTS.md` sont déjà commités. |

## Choix documentés (ambiguïtés, section 2.2)

- **Hébergement (TECH-05)** : Railway plutôt qu'un VPS (ADR 0001). HTTPS et déploiement à chaque push sont automatiques. Écart à faire valider.
- **Temps réel (TECH-06)** : Socket.IO sur le même serveur Node que Next.js, sans service externe (ADR 0002).
- **Transfert d'hôte (SALLE-08)** : au participant présent depuis le plus longtemps, après un délai de grâce de 30 s en cas de déconnexion (ADR 0006).
