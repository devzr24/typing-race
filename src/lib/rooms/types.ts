export type RoomStatus = "EN_ATTENTE" | "DECOMPTE" | "EN_COURSE" | "RESULTATS" | "FERMEE";
export type RoomVisibility = "PUBLIQUE" | "SUR_CODE" | "PRIVEE";

export type RoomInvite = {
  id: string;
  tokenHash: string;
  usedByKey: string | null;
  usedByName: string | null;
  usedIp: string | null;
  usedAt: Date | null;
  revokedAt: Date | null;
};
export type PublicInvite = Pick<RoomInvite, "id" | "usedByName"> & { used: boolean; revoked: boolean };
export type CreatedInvite = PublicInvite & { token: string };

/** Qui agit : un utilisateur inscrit ou un invité, tel que décrit par sa session Auth.js. */
export type Identity = {
  /** Identifiant de session : id de l'utilisateur, ou « guest-<uuid> » pour un invité. */
  key: string;
  displayName: string;
  image: string | null;
  isGuest: boolean;
};

export type Participant = Identity & {
  id: string;
  isSpectator: boolean;
  joinedAt: Date;
};

export type RaceConfig = {
  timeLimitSec: number | null;
  textLanguage: "FR" | "EN";
  textType: "COHERENT" | "ALEATOIRE";
  wordCount: number;
  complexity: "FACILE" | "MOYEN" | "DIFFICILE";
  punctuation: boolean;
  numbers: boolean;
  capitals: boolean;
  accents: boolean;
  includeChars: string;
  excludeChars: string;
  errorMode: "CORRECTION" | "LIBRE";
  bonusesEnabled: boolean;
};

export const defaultRaceConfig: RaceConfig = {
  timeLimitSec: null, textLanguage: "FR", textType: "COHERENT", wordCount: 30,
  complexity: "MOYEN", punctuation: true, numbers: false, capitals: true,
  accents: true, includeChars: "", excludeChars: "", errorMode: "CORRECTION", bonusesEnabled: true,
};

export type RoomBot = {
  id: string;
  name: string;
  level: "NOOB" | "BEGINNER" | "INTERMEDIATE" | "EXPERT" | "IMPOSSIBLE";
};

export type Race = { text: string; startsAt: number };

export type Room = {
  code: string;
  status: RoomStatus;
  hostKey: string;
  createdAt: Date;
  participants: Participant[];
  capacity: number;
  visibility: RoomVisibility;
  invites: RoomInvite[];
  bannedKeys: string[];
  config: RaceConfig;
  bots: RoomBot[];
};

/** Ce qu'on envoie aux navigateurs : pas d'identifiant de session. */
export type PublicParticipant = {
  id: string;
  displayName: string;
  image: string | null;
  isGuest: boolean;
  isHost: boolean;
  isSpectator: boolean;
};

export type PublicRoom = {
  code: string;
  status: RoomStatus;
  capacity: number;
  visibility: RoomVisibility;
  participants: PublicParticipant[];
  config: RaceConfig;
  bots: RoomBot[];
  race: Race | null;
  serverNow: number;
};

export type LobbyRoom = Pick<PublicRoom, "code" | "status" | "capacity"> & {
  count: number;
  textLanguage: RaceConfig["textLanguage"];
  complexity: RaceConfig["complexity"];
  hostName: string;
};
