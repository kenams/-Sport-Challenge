// Tests pour ensurePlayerStats
jest.mock("../supabase", () => ({
  supabase: {
    from: jest.fn(),
  },
}));

import { supabase } from "../supabase";
import { ensurePlayerStats } from "../utils/playerStats";

const mockFrom = supabase.from as jest.Mock;

describe("ensurePlayerStats", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("ne fait rien si userId est vide", async () => {
    await ensurePlayerStats("");
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("ne crée pas si la ligne existe déjà", async () => {
    const insertMock = jest.fn();
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: { user_id: "uid-1" }, error: null }),
      insert: insertMock,
    });

    await ensurePlayerStats("uid-1");
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("crée la ligne si elle n'existe pas", async () => {
    const insertMock = jest.fn().mockResolvedValue({ error: null });
    mockFrom
      .mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      })
      .mockReturnValueOnce({
        insert: insertMock,
      });

    await ensurePlayerStats("uid-new");
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "uid-new",
        points: 0,
        fair_play_score: 100,
      })
    );
  });

  it("ne crée pas si supabase retourne une erreur sur le select", async () => {
    const insertMock = jest.fn();
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: null,
        error: { message: "DB error" },
      }),
      insert: insertMock,
    });

    await ensurePlayerStats("uid-err");
    expect(insertMock).not.toHaveBeenCalled();
  });
});
