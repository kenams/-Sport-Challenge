import { COLORS, TYPO } from "../theme";

describe("theme", () => {
  it("définit les couleurs de base", () => {
    expect(COLORS.primary).toBeDefined();
    expect(COLORS.background).toBeDefined();
    expect(COLORS.text).toBeDefined();
  });

  it("définit la typographie", () => {
    expect(TYPO.display).toBeDefined();
    expect(TYPO.button).toBeDefined();
  });
});
