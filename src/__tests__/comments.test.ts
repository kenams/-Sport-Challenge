import { COMMENT_MAX, checkComment, cheerLabel, cleanCommentInput, commentAge, commentCountLabel, remainingChars } from "../screens/helpers/comments";
import { DELETE_CONFIRM_WORD, isDeletionConfirmed } from "../screens/helpers/accountDeletion";

describe("commentaires", () => {
  it("nettoie les caractères invisibles, les retours à la ligne et les espaces multiples", () => {
    expect(cleanCommentInput("  Bravo​ !\n\n  Continue\t ")).toBe("Bravo ! Continue");
    expect(cleanCommentInput("a‮b")).toBe("a b");
  });

  it("refuse un commentaire vide ou fait seulement de blancs invisibles", () => {
    expect(checkComment("").ok).toBe(false);
    expect(checkComment("   \n​ ").ok).toBe(false);
  });

  it("accepte 280 caractères et refuse 281", () => {
    expect(checkComment("a".repeat(COMMENT_MAX)).ok).toBe(true);
    const tooLong = checkComment("a".repeat(COMMENT_MAX + 1));
    expect(tooLong.ok).toBe(false);
  });

  it("compte les caractères restants", () => {
    expect(remainingChars("abc")).toBe(COMMENT_MAX - 3);
    expect(remainingChars("a".repeat(COMMENT_MAX + 5))).toBe(-5);
  });

  it("accorde les libellés au pluriel", () => {
    expect(cheerLabel(0)).toBe("Aucun encouragement");
    expect(cheerLabel(1)).toBe("1 encouragement");
    expect(cheerLabel(3)).toBe("3 encouragements");
    expect(commentCountLabel(1)).toBe("1 commentaire");
    expect(commentCountLabel(2)).toBe("2 commentaires");
  });

  it("donne un âge lisible", () => {
    const now = Date.parse("2026-11-02T12:00:00Z");
    expect(commentAge("2026-11-02T11:59:50Z", now)).toBe("à l'instant");
    expect(commentAge("2026-11-02T11:55:00Z", now)).toBe("il y a 5 min");
    expect(commentAge("2026-11-02T09:00:00Z", now)).toBe("il y a 3 h");
    expect(commentAge("2026-10-31T12:00:00Z", now)).toBe("il y a 2 j");
    expect(commentAge("pas une date", now)).toBe("");
  });
});

describe("confirmation de suppression de compte", () => {
  it("n'accepte que le mot de confirmation, sans tenir compte de la casse ni des espaces", () => {
    expect(isDeletionConfirmed(DELETE_CONFIRM_WORD)).toBe(true);
    expect(isDeletionConfirmed("  supprimer ")).toBe(true);
    expect(isDeletionConfirmed("")).toBe(false);
    expect(isDeletionConfirmed("supprim")).toBe(false);
    expect(isDeletionConfirmed("OUI")).toBe(false);
  });
});
