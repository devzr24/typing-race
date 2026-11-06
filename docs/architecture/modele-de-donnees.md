# Modèle de données

Source de vérité : [`prisma/schema.prisma`](../../prisma/schema.prisma). Base PostgreSQL, accès via
Prisma 7 ([ADR 0003](../adr/0003-prisma-postgresql.md)).

## Tables actuelles

```mermaid
erDiagram
    User ||--o{ Account : "se connecte via"
    User |o--o{ RoomParticipant : "participe (inscrit)"
    Room ||--|{ RoomParticipant : "contient"

    User {
        string id PK "cuid"
        string username UK "unique, minuscules"
        string passwordHash "scrypt ; null si GitHub/Discord"
        string name "nom d'affichage GitHub/Discord"
        string image "photo GitHub/Discord"
        datetime createdAt
        datetime updatedAt
    }
    Account {
        string id PK
        string userId FK
        string provider "github | discord"
        string providerAccountId "unique avec provider"
        string type
    }
    Room {
        string id PK
        string code UK "6 caractères sans 0/O/1/I/L"
        enum status "EN_ATTENTE | EN_COURSE | TERMINEE"
        string hostKey "clé du participant hôte"
        datetime createdAt
    }
    RoomParticipant {
        string id PK
        string roomId FK
        string key "id utilisateur ou guest-uuid ; unique avec roomId"
        string userId FK "null pour un invité"
        string displayName
        string image
        boolean isGuest
        boolean isSpectator "hôte spectateur seulement (SALLE-01)"
        datetime joinedAt "ordre d'arrivée (transfert d'hôte)"
    }
```

| Table | Rôle |
|---|---|
| `User` | Utilisateur inscrit, par GitHub/Discord ou par nom d'utilisateur + mot de passe ; aucun courriel stocké ([ADR 0004](../adr/0004-authentification-authjs.md)). |
| `Account` | Lien entre un utilisateur et son compte GitHub ou Discord (format de l'adaptateur Prisma d'Auth.js) ; aucun jeton d'accès conservé. |
| `Room` | Salle rejointe par code, avec son état et son hôte ; supprimée quand le dernier participant part ([ADR 0006](../adr/0006-salles-transfert-hote.md)). |
| `RoomParticipant` | Présence d'un utilisateur ou d'un invité dans une salle ; `joinedAt` décide du prochain hôte ; `isSpectator` marque l'hôte qui a choisi de seulement regarder (SALLE-01). |

Remarques :

- Les **invités** n'ont pas de ligne `User` : ils n'existent que dans leur jeton de session et,
  le temps de leur présence, dans `RoomParticipant` (`isGuest = true`, `userId = null`).
- `Room.hostKey` désigne la `key` d'un participant de la salle (lien logique, pas de clé étrangère,
  car l'hôte peut être un invité).
- Pas de table `Session` : sessions JWT dans un cookie chiffré ([ADR 0004](../adr/0004-authentification-authjs.md)).
- `_prisma_migrations` (technique) suit les migrations appliquées ; visible via `/api/health`.

## Prévu (non créé en base)

Tables envisagées pour les exigences restantes ([matrice](../EXIGENCES.md)).
Les noms et champs sont indicatifs : chaque table sera conçue, migrée et documentée avec
l'exigence qui la demande.

```mermaid
erDiagram
    Room ||--o| RoomSettings : "configure (CONF-01..12)"
    Room ||--o{ RoomInvite : "lien d'invitation (SALLE-04)"
    Room ||--o{ RoomBan : "expulsion (SALLE-07)"
    Room ||--o{ Race : "organise (COURSE-01)"
    Passage ||--o{ Race : "texte cohérent (CONF-03)"
    Race ||--|{ RaceResult : "produit (RES-05)"
    User |o--o{ RaceResult : "historique (HIST-01)"

    RoomSettings {
        string roomId FK
        enum visibility "SALLE-03"
        int capacity "2 à 30, spectateurs exclus (SALLE-05)"
        int maxSeconds "null ou 30 à 600 (CONF-01)"
        string textLanguage "fr | en (CONF-02)"
        enum textType "COHERENT | ALEATOIRE (CONF-03)"
        int wordCount "CONF-04"
        enum complexity "CONF-05"
        string options "ponctuation, nombres, majuscules, accents, caractères (CONF-06, CONF-07)"
        enum errorMode "OBLIGATOIRE | LIBRE (CONF-08)"
        boolean bonuses "CONF-09"
        string bots "niveaux des bots (CONF-10)"
    }
    RoomInvite {
        string token UK "un lien par invité"
        string roomId FK
    }
    RoomBan {
        string roomId FK
        string key "personne expulsée"
    }
    Passage {
        string id PK
        string language
        string content "corpus du domaine public (seed, TECH-04)"
    }
    Race {
        string id PK
        string roomId FK
        string text "texte réellement tapé"
        string settings "copie de la configuration"
        datetime startedAt
        datetime endedAt
    }
    RaceResult {
        string id PK
        string raceId FK
        string userId FK "null pour un invité ou un bot"
        string displayName
        enum kind "UTILISATEUR | INVITE | BOT"
        int rank
        float wpm
        float rawWpm
        float accuracy
        int errors
        int timeMs
        enum outcome "TERMINE | TEMPS_ECOULE | ABANDON (COURSE-10)"
        json wpmSeries "série temporelle du MPM (RES-03)"
    }
```

- **Invités et bots** : une ligne `RaceResult` sans `userId`, pour que la page de résultats
  réaffichée depuis l'historique soit complète (HIST-02). Seuls les utilisateurs connectés ont un
  historique (RES-05, AUTH-03).
- **Historique** (HIST-01, HIST-02) : liste paginée des `RaceResult` de l'utilisateur ; la page de
  résultats est reconstruite à partir de `Race` et de ses `RaceResult`.
