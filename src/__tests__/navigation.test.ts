import { getPathFromState, getStateFromPath } from "@react-navigation/native";
import { linking } from "../navigation/linking";

describe("liens profonds", () => {
  it.each(["/MainTabs/Defis", "/MainTabs/Profil", "/MainTabs/Classement", "/MainTabs/Evenements", "/duels/duel-123", "/e/duel-public", "/d/attempt-123", "/Pro", "/Moderation", "/CreateChallenge", "/ProposeEvent"])("conserve le parcours après réouverture : %s", (path) => {
    const state = getStateFromPath(path, linking.config);
    expect(state).toBeDefined();
    expect(getPathFromState(state!, linking.config)).toBe(path);
  });
  it("retrouve l'identifiant du duel au lieu de renvoyer vers l'accueil", () => {
    const state = getStateFromPath("/duels/duel-123", linking.config);
    expect(state?.routes[0]).toMatchObject({ name: "EventDetail", params: { eventId: "duel-123" } });
  });
});
