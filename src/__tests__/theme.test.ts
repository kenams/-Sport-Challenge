// Tests pour getSportPalette et SPORT_PALETTES
import { getSportPalette, SPORT_PALETTES, COLORS } from "../theme";

describe("getSportPalette", () => {
  it("retourne la palette par défaut si sport undefined", () => {
    const p = getSportPalette(undefined);
    expect(p).toEqual(SPORT_PALETTES.default);
  });

  it("retourne la palette par défaut si sport inconnu", () => {
    const p = getSportPalette("kitesurf");
    expect(p).toEqual(SPORT_PALETTES.default);
  });

  it("retourne la bonne palette pour 'running'", () => {
    const p = getSportPalette("running");
    expect(p.accent).toBe("#0EA5E9");
  });

  it("normalise la casse", () => {
    const p1 = getSportPalette("BOXE");
    const p2 = getSportPalette("boxe");
    expect(p1).toEqual(p2);
  });

  it("supprime les espaces", () => {
    const p = getSportPalette("  yoga  ");
    expect(p).toEqual(SPORT_PALETTES.yoga);
  });

  it("chaque palette a les champs requis", () => {
    const required = ["background", "card", "border", "accent", "text"];
    Object.entries(SPORT_PALETTES).forEach(([name, palette]) => {
      required.forEach((key) => {
        expect(palette).toHaveProperty(key);
      });
    });
  });
});

describe("COLORS", () => {
  it("a les couleurs de base définies", () => {
    expect(COLORS.primary).toBeDefined();
    expect(COLORS.background).toBeDefined();
    expect(COLORS.text).toBeDefined();
  });
});
