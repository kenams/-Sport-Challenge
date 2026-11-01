import {
  canRespond,
  canWithdraw,
  cleanTitle,
  duelView,
  hasMorePages,
  isNetworkMessage,
  mergeFeed,
  parseDeclaredScore,
  revengeOpponent,
  scoreDisplay,
  territoryLabel,
  TITLE_MAX,
} from "../screens/helpers/attempts";
import type { Attempt } from "../domain/types";

function attempt(over: Partial<Attempt> = {}): Attempt {
  return {
    id: "a1",
    user_id: "u1",
    kind: "challenge",
    challenge_id: null,
    recipient_user_id: null,
    title: null,
    format_key: "pushups_60s",
    discipline: "pushups",
    rules_version: 1,
    declared_score: 40,
    video_path: "u1/v.mp4",
    video_duration_seconds: 60,
    video_removed: false,
    status: "pending",
    decided_score: null,
    decision_reason: null,
    decided_by: null,
    decided_at: null,
    city_declared: null,
    region_declared: null,
    country_declared: null,
    report_count: 0,
    created_at: "2026-10-01T10:00:00Z",
    ...over,
  };
}

describe("parseDeclaredScore", () => {
  it("accepte un entier dans les bornes", () => {
    expect(parseDeclaredScore(" 45 ", 200)).toEqual({ ok: true, value: 45 });
    expect(parseDeclaredScore("200", 200)).toEqual({ ok: true, value: 200 });
  });
  it("refuse vide, zéro, décimal, trop grand", () => {
    expect(parseDeclaredScore("", 200).ok).toBe(false);
    expect(parseDeclaredScore("0", 200).ok).toBe(false);
    expect(parseDeclaredScore("4,5", 200).ok).toBe(false);
    expect(parseDeclaredScore("-3", 200).ok).toBe(false);
    const tooBig = parseDeclaredScore("101", 100);
    expect(tooBig.ok).toBe(false);
    if (!tooBig.ok) expect(tooBig.message).toContain("100");
  });
});

describe("cleanTitle", () => {
  it("retourne null si vide et tronque à 80", () => {
    expect(cleanTitle("   ")).toBeNull();
    expect(cleanTitle("a".repeat(120))?.length).toBe(TITLE_MAX);
    expect(cleanTitle("  Mon   record ")).toBe("Mon record");
  });
});

describe("territoryLabel", () => {
  it("assemble sans doublon ni vide", () => {
    expect(territoryLabel({ city_declared: "Toulouse", region_declared: "Occitanie", country_declared: "France" })).toBe("Toulouse, Occitanie, France");
    expect(territoryLabel({ city_declared: "Paris", region_declared: "Paris", country_declared: null })).toBe("Paris");
    expect(territoryLabel({ city_declared: null, region_declared: "", country_declared: null })).toBeNull();
  });
});

describe("scoreDisplay", () => {
  it("distingue déclaré et retenu", () => {
    expect(scoreDisplay(attempt())).toEqual({ caption: "Score déclaré", value: 40, declaredNote: null });
    expect(scoreDisplay(attempt({ status: "validated", decided_score: 38 }))).toEqual({ caption: "Score retenu", value: 38, declaredNote: "Déclaré : 40" });
    expect(scoreDisplay(attempt({ status: "validated", decided_score: 40 })).declaredNote).toBeNull();
    expect(scoreDisplay(attempt({ status: "rejected", decided_score: null })).caption).toBe("Score déclaré");
  });
});

describe("duelView", () => {
  const validated = (id: string, score: number) => attempt({ id, status: "validated", decided_score: score, declared_score: score });
  it("n'affiche rien tant que les deux ne sont pas validées", () => {
    expect(duelView(attempt(), validated("r", 30)).state).toBe("awaiting");
    expect(duelView(validated("c", 30), attempt({ status: "pending" })).state).toBe("awaiting");
  });
  it("signale l'absence de résultat si une performance est rejetée", () => {
    expect(duelView(validated("c", 30), attempt({ status: "rejected" })).state).toBe("no_result");
  });
  it("détecte égalité et plus haut score retenu", () => {
    expect(duelView(validated("c", 30), validated("r", 30))).toMatchObject({ state: "decided", relation: "tie" });
    expect(duelView(validated("c", 31), validated("r", 30))).toMatchObject({ relation: "challenge_higher" });
    expect(duelView(validated("c", 20), validated("r", 30))).toMatchObject({ relation: "response_higher" });
  });
});

describe("droits d'action", () => {
  const challenge = attempt({ user_id: "author" });
  it("canRespond : pas l'auteur, pas deux fois, pas défi nominatif d'un autre", () => {
    expect(canRespond(challenge, [], "author")).toBe(false);
    expect(canRespond(challenge, [], "other")).toBe(true);
    expect(canRespond(challenge, [attempt({ user_id: "other", kind: "response" })], "other")).toBe(false);
    expect(canRespond(challenge, [], null)).toBe(false);
    expect(canRespond(attempt({ user_id: "author", recipient_user_id: "z" }), [], "other")).toBe(false);
    expect(canRespond(attempt({ user_id: "author", recipient_user_id: "z" }), [], "z")).toBe(true);
    expect(canRespond(attempt({ user_id: "author", status: "rejected" }), [], "other")).toBe(false);
  });
  it("canWithdraw : auteur et en attente seulement", () => {
    expect(canWithdraw(challenge, "author")).toBe(true);
    expect(canWithdraw(challenge, "other")).toBe(false);
    expect(canWithdraw(attempt({ user_id: "author", status: "validated" }), "author")).toBe(false);
  });
  it("revengeOpponent : l'autre joueur du duel", () => {
    const response = attempt({ user_id: "resp", kind: "response", pseudo: "Resp" });
    expect(revengeOpponent(challenge, response, "author")).toEqual({ id: "resp", pseudo: "Resp" });
    expect(revengeOpponent(challenge, response, "resp")?.id).toBe("author");
    expect(revengeOpponent(challenge, response, "tiers")).toBeNull();
    expect(revengeOpponent(challenge, response, null)).toBeNull();
  });
});

describe("pagination et réseau", () => {
  it("mergeFeed dédoublonne", () => {
    const merged = mergeFeed([attempt({ id: "1" }), attempt({ id: "2" })], [attempt({ id: "2" }), attempt({ id: "3" })]);
    expect(merged.map((a) => a.id)).toEqual(["1", "2", "3"]);
  });
  it("hasMorePages", () => {
    expect(hasMorePages(20)).toBe(true);
    expect(hasMorePages(7)).toBe(false);
  });
  it("isNetworkMessage", () => {
    expect(isNetworkMessage("Connexion impossible. Vérifie ton réseau et réessaie.")).toBe(true);
    expect(isNetworkMessage("Score invalide pour ce format.")).toBe(false);
    expect(isNetworkMessage(null)).toBe(false);
  });
});
