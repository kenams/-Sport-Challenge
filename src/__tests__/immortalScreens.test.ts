import { describeAuthError, isSignUpEmailAlreadyUsed, validateEmail, validatePassword, validatePseudo, isTerritoryEmpty } from "../screens/helpers/validation";
import { bestValidatedScore, computeBadges, hasRegularity, nextObjective } from "../screens/helpers/profileStats";
import { resolveScope } from "../screens/helpers/leaderboardScope";
import { parseRetainedScore, validateDecision } from "../screens/helpers/moderationInput";

const att = (over: any) => ({ status: "validated", format_key: "pushups_60s", decided_score: 30, decided_at: "2026-10-01T10:00:00Z", created_at: "2026-10-01T09:00:00Z", ...over });

describe("validation", () => {
  it("e-mail", () => {
    expect(validateEmail("")).not.toBeNull();
    expect(validateEmail("abc")).not.toBeNull();
    expect(validateEmail("a@b.fr")).toBeNull();
  });
  it("mot de passe 8+", () => {
    expect(validatePassword("1234567")).not.toBeNull();
    expect(validatePassword("12345678")).toBeNull();
  });
  it("pseudo 2-24", () => {
    expect(validatePseudo("a")).not.toBeNull();
    expect(validatePseudo("ab")).toBeNull();
    expect(validatePseudo("a".repeat(25))).not.toBeNull();
  });
  it("erreurs auth en français", () => {
    expect(describeAuthError({ message: "User already registered" }, "signup")).toMatch(/existe déjà/);
    expect(describeAuthError({ message: "Invalid login credentials" })).toMatch(/incorrect/);
    expect(describeAuthError({ message: "Failed to fetch" })).toMatch(/réseau/);
    expect(describeAuthError({ code: "weak_password", message: "x" }, "signup")).toMatch(/faible/);
  });
  it("e-mail déjà utilisé sans erreur", () => {
    expect(isSignUpEmailAlreadyUsed({ identities: [] })).toBe(true);
    expect(isSignUpEmailAlreadyUsed({ identities: [{}] })).toBe(false);
    expect(isSignUpEmailAlreadyUsed(null)).toBe(false);
  });
  it("territoire vide", () => {
    expect(isTerritoryEmpty({ country: " ", region: "", city: null as any })).toBe(true);
    expect(isTerritoryEmpty({ city: "Lyon" })).toBe(false);
  });
});

describe("profil", () => {
  it("record = meilleur score validé du format", () => {
    const list = [att({ decided_score: 20 }), att({ decided_score: 41 }), att({ status: "pending", decided_score: null }), att({ format_key: "pullups_max", decided_score: 9 })] as any;
    expect(bestValidatedScore(list, "pushups_60s")).toBe(41);
    expect(bestValidatedScore(list, "pullups_max")).toBe(9);
    expect(bestValidatedScore([], "pullups_max")).toBeNull();
  });
  it("objectif", () => {
    expect(nextObjective(null)).toMatch(/1re performance validée/);
    expect(nextObjective(41)).toMatch(/42/);
  });
  it("badges et régularité", () => {
    expect(computeBadges([]).every((b) => !b.earned)).toBe(true);
    const three = [att({ decided_at: "2026-10-01T10:00:00Z" }), att({ decided_at: "2026-10-04T10:00:00Z" }), att({ decided_at: "2026-10-07T09:00:00Z" })] as any;
    expect(hasRegularity(three)).toBe(true);
    const spread = [att({ decided_at: "2026-10-01T10:00:00Z" }), att({ decided_at: "2026-10-10T10:00:00Z" }), att({ decided_at: "2026-10-20T09:00:00Z" })] as any;
    expect(hasRegularity(spread)).toBe(false);
    expect(computeBadges(spread)[0].earned).toBe(true);
  });
});

describe("classement", () => {
  it("périmètre issu du territoire déclaré", () => {
    expect(resolveScope("world", null)).toMatchObject({ value: null, missing: false });
    expect(resolveScope("city", { city: " Lyon " })).toMatchObject({ value: "Lyon", missing: false });
    expect(resolveScope("region", { city: "Lyon" })).toMatchObject({ missing: true });
  });
});

describe("modération", () => {
  it("score retenu entier 0..max", () => {
    expect(parseRetainedScore("12", 200)).toEqual({ ok: true, value: 12 });
    expect(parseRetainedScore("0", 200).ok).toBe(true);
    expect(parseRetainedScore("-1", 200).ok).toBe(false);
    expect(parseRetainedScore("1.5", 200).ok).toBe(false);
    expect(parseRetainedScore("201", 200).ok).toBe(false);
  });
  it("motif obligatoire pour rejet et retrait", () => {
    expect(validateDecision("reject", "", "", 100)).not.toBeNull();
    expect(validateDecision("reject", "", "vidéo coupée", 100)).toBeNull();
    expect(validateDecision("remove_video", "", " ", 100)).not.toBeNull();
    expect(validateDecision("validate", "10", "", 100)).toBeNull();
    expect(validateDecision("dismiss_reports", "", "", 100)).toBeNull();
  });
});
