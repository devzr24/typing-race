export type RoomStatus = "EN_ATTENTE" | "EN_COURSE" | "TERMINEE";

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
  joinedAt: Date;
};

export type Room = {
  code: string;
  status: RoomStatus;
  hostKey: string;
  createdAt: Date;
  participants: Participant[];
};

/** Ce qu'on envoie aux navigateurs : pas d'identifiant de session. */
export type PublicParticipant = {
  id: string;
  displayName: string;
  image: string | null;
  isGuest: boolean;
  isHost: boolean;
};

export type PublicRoom = {
  code: string;
  status: RoomStatus;
  participants: PublicParticipant[];
};
