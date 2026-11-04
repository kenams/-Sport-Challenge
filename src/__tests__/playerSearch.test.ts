import { playerSearchPattern } from "../domain/playerSearch";

describe("playerSearchPattern", () => {
  it("keeps pseudo underscores literal instead of turning them into wildcards", () => {
    expect(playerSearchPattern(" IMMORTAL_QA_2 ")).toBe("%IMMORTAL\\_QA\\_2%");
  });

  it("treats SQL LIKE wildcards and escape characters as literal text", () => {
    expect(playerSearchPattern("50%_\\\\ test")).toBe("%50\\%\\_\\\\\\\\ test%");
  });

  it("trims the query and ignores searches shorter than two characters", () => {
    expect(playerSearchPattern(" QA ")).toBe("%QA%");
    expect(playerSearchPattern(" ")).toBeNull();
    expect(playerSearchPattern("a")).toBeNull();
  });
});
