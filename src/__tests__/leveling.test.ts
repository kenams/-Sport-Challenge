// Tests pour les utils leveling
jest.mock("../supabase", () => ({ supabase: { from: jest.fn() } }));

import { getLevel, getTitle, LEVEL_THRESHOLDS } from "../utils/leveling";

describe("getLevel", () => {
  it("niveau 1 avec 0 points", () => {
    expect(getLevel(0)).toBe(1);
  });

  it("niveau 2 à partir de 200 points", () => {
    expect(getLevel(200)).toBe(2);
    expect(getLevel(199)).toBe(1);
  });

  it("monte de niveau avec des points", () => {
    expect(getLevel(1000)).toBeGreaterThan(1);
  });

  it("level est toujours >= 1", () => {
    expect(getLevel(-100)).toBeGreaterThanOrEqual(1);
  });

  it("niveau max correspond au dernier seuil", () => {
    const maxThreshold = LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
    expect(getLevel(maxThreshold)).toBe(LEVEL_THRESHOLDS.length);
    expect(getLevel(maxThreshold + 99999)).toBe(LEVEL_THRESHOLDS.length);
  });
});

describe("getTitle", () => {
  it("retourne une chaîne non vide", () => {
    expect(typeof getTitle(1)).toBe("string");
    expect(getTitle(1).length).toBeGreaterThan(0);
  });

  it("niveau 1 = Rookie", () => {
    expect(getTitle(1)).toContain("Rookie");
  });

  it("niveau 10 = Immortal", () => {
    expect(getTitle(10)).toContain("Immortal");
  });

  it("niveau élevé a un titre différent du niveau 1", () => {
    expect(getTitle(1)).not.toBe(getTitle(10));
  });
});
