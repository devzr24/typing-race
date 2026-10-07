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
        datetime joinedAt "ordre d'arrivée (transfert d'hôte)"
    }
```

| Table | Rôle |
|---|---|
| `User` | Utilisateur inscrit, par GitHub/Discord ou par nom d'utilisateur + mot de passe ; aucun courriel stocké ([ADR 0004](../adr/0004-authentification-authjs.md)). |
| `Account` | Lien entre un utilisateur et son compte GitHub ou Discord (format de l'adaptateur Prisma d'Auth.js) ; aucun jeton d'accès conservé. |
| `Room` | Salle rejointe par code, avec son état et son hôte ; supprimée quand le dernier participant part ([ADR 0006](../adr/0006-salles-transfert-hote.md)). |
| `RoomParticipant` | Présence d'un utilisateur ou d'un invité dans une salle ; `joinedAt` décide du prochain hôte. |

Remarques :

- Les **invités** n'ont pas de ligne `User` : ils n'existent que dans leur jeton de session et,
  le temps de leur présence, dans `RoomParticipant` (`isGuest = true`, `userId = null`).
- `Room.hostKey` désigne la `key` d'un participant de la salle (lien logique, pas de clé étrangère,
  car l'hôte peut être un invité).
- Pas de table `Session` : sessions JWT dans un cookie chiffré ([ADR 0004](../adr/0004-authentification-authjs.md)).
- `_prisma_migrations` (technique) suit les migrations appliquées ; visible via `/api/health`.

## Prévu (non créé en base)

Tables envisagées pour les exigences restantes ([matrice](../matrice-des-exigences.md)).
Les noms et champs sont indicatifs : chacune sera conçue, migrée et documentée au checkpoint qui la demande.

```mermaid
erDiagram
    Room ||--o| RoomSettings : "configure (LOBBY-01)"
    Room ||--o{ RoomInvite : "lien privé (LOBBY-02)"
    Room ||--o{ Race : "organise (RACE-01)"
    Text ||--o{ Race : "texte tapé (TEXT-01..04)"
    Race ||--|{ RaceResult : "produit (STAT-01)"
    User |o--o{ RaceResult : "obtient (STAT-03)"
    RaceResult ||--o{ KeyStat : "détaille (STAT-02)"
    User ||--o{ UserTrophy : "gagne (STAT-04)"
    Trophy ||--o{ UserTrophy : "attribué"

    RoomSettings {
        string roomId FK
        boolean isPublic "salle publique / matchmaking"
        int maxPlayers "au moins 30"
        boolean hostPlays "hôte participant ou spectateur"
        string textOptions "langue, longueur, mode d'erreurs"
        int botCount "BOT-01..03"
    }
    RoomInvite {
        string token UK "lien privé unique"
        string roomId FK
    }
    Race {
        string id PK
        string roomId FK
        string textId FK
        datetime startedAt
        datetime endedAt
    }
    Text {
        string id PK
        string language
        string content
    }
    RaceResult {
        string id PK
        string raceId FK
        string participantKey "utilisateur, invité ou bot"
        string userId FK "null pour invité et bot"
        string kind "USER | GUEST | BOT"
        int rank
        float wpm
        float accuracy
        boolean finished "abandon / déconnexion (RACE-06)"
    }
    KeyStat {
        string resultId FK
        string key "touche"
        int hits
        int errors
    }
    Trophy {
        string id PK
        string code UK
    }
    UserTrophy {
        string userId FK
        string trophyId FK
        datetime earnedAt
    }
```

- **Statistiques d'invité** (AUTH-03, AUTH-04) : les résultats d'un invité seraient liés à sa
  `participantKey` (sans `userId`), pour les afficher en fin de course et pendant sa séance.
- **Bots** (BOT-01..03) : participants de course de type `BOT`, sans compte.
- **Bonus** (BONUS-01..03) : modèle à définir avec le cahier des charges détaillé.
