import { describe, expect, it } from "vitest";
import { historyPagination } from "./pagination";

describe("pagination de l’historique", () => {
  it.each([undefined, "", "-1", "0", "1.5", "abc", ["2", "3"]])("borne une page invalide %j", (value) => {
    expect(historyPagination(value, 25)).toEqual({ page: 1, pages: 3, skip: 0, take: 10 });
  });
  it("gère un historique vide et les limites de pages", () => {
    expect(historyPagination("10", 0)).toEqual({ page: 1, pages: 1, skip: 0, take: 10 });
    expect(historyPagination("2", 20)).toEqual({ page: 2, pages: 2, skip: 10, take: 10 });
    expect(historyPagination("999999999999999999999999999999999999", 21)).toEqual({ page: 3, pages: 3, skip: 20, take: 10 });
  });
});
