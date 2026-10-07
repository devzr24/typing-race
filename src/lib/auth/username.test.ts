import { describe, expect, it } from "vitest";
import { generateGuestName } from "./guest";
import {
  findAvailableUsername,
  normalizeUsername,
  usernameFromProvider,
  validateUsername,
} from "./username";

describe("normalizeUsername", () => {
  it("retire les espaces et met en minuscules", () => {
    expect(normalizeUsername("  Alex_42 ")).toBe("alex_42");
  });
});

describe("validateUsername", () => {
  it("accepte un nom valide", () => {
    expect(validateUsername("alex")).toBeNull();
    expect(validateUsername("joueur_1-a")).toBeNull();
    expect(validateUsername("a".repeat(24))).toBeNull();
  });

  it("refuse un nom vide", () => {
    expect(validateUsername("")).toMatch(/obligatoire/);
  });

  it("refuse un nom trop court ou trop long", () => {
    expect(validateUsername("ab")).toMatch(/entre 3 et 24/);
    expect(validateUsername("a".repeat(25))).toMatch(/entre 3 et 24/);
  });

  it("refuse les caractères non autorisés", () => {
    expect(validateUsername("élise")).toMatch(/ne peut contenir/);
    expect(validateUsername("alex dupont")).toMatch(/ne peut contenir/);
    expect(validateUsername("alex.d")).toMatch(/ne peut contenir/);
  });

  it("refuse un nom qui commence par _ ou -", () => {
    expect(validateUsername("_alex")).toMatch(/commencer/);
    expect(validateUsername("-alex")).toMatch(/commencer/);
  });
});

describe("usernameFromProvider", () => {
  it("garde un nom GitHub valide, en minuscules", () => {
    expect(usernameFromProvider("DevZR24")).toBe("devzr24");
  });

  it("remplace les caractères interdits (ex. le point de Discord)", () => {
    expect(usernameFromProvider("alex.dupont")).toBe("alex-dupont");
  });

  it("produit toujours un nom valide", () => {
    for (const raw of ["ab", "..", "", "___x___", "a".repeat(39), "Zoé..Martin"]) {
      expect(validateUsername(usernameFromProvider(raw))).toBeNull();
    }
  });
});

describe("findAvailableUsername", () => {
  const takenIn = (names: string[]) => async (candidate: string) => names.includes(candidate);

  it("garde le nom s'il est libre", async () => {
    expect(await findAvailableUsername("alex", takenIn([]))).toBe("alex");
  });

  it("ajoute -2 si le nom est pris", async () => {
    expect(await findAvailableUsername("alex", takenIn(["alex"]))).toBe("alex-2");
  });

  it("passe au suffixe suivant si -2 est aussi pris", async () => {
    expect(await findAvailableUsername("alex", takenIn(["alex", "alex-2", "alex-3"]))).toBe(
      "alex-4",
    );
  });

  it("raccourcit la base pour rester dans la longueur maximale", async () => {
    const base = "a".repeat(24);
    const result = await findAvailableUsername(base, takenIn([base]));
    expect(result).toBe(`${"a".repeat(22)}-2`);
    expect(validateUsername(result)).toBeNull();
  });
});

describe("generateGuestName", () => {
  it("produit un pseudo d'invité valide", () => {
    for (let i = 0; i < 20; i++) {
      const name = generateGuestName();
      expect(name).toMatch(/^invite-\d{4}$/);
      expect(validateUsername(name)).toBeNull();
    }
  });
});
