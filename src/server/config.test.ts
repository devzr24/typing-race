import { describe, expect, it } from "vitest";
import { getPort } from "./config";

describe("getPort", () => {
  it("utilise PORT quand il est valide", () => {
    expect(getPort({ PORT: "8080" })).toBe(8080);
  });

  it("retombe sur 3000 si PORT est absent", () => {
    expect(getPort({})).toBe(3000);
  });

  it("retombe sur 3000 si PORT est invalide", () => {
    expect(getPort({ PORT: "abc" })).toBe(3000);
    expect(getPort({ PORT: "70000" })).toBe(3000);
  });
});
