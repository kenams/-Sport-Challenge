// src/context/SportThemeContext.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getSportPalette, SportPalette } from "../theme";
import { scheduleFavoriteSportPing } from "../notifications";

type SportSession = {
  sport: string;
  kind: "live_start" | "routine";
  timestamp: string;
};

type SportThemeContextValue = {
  activeSport: string | null;
  setActiveSport: (sport: string | null) => void;
  palette: SportPalette;
  favoriteSports: string[];
  updateFavorites: (next: string[]) => void;
  toggleFavorite: (sport: string) => void;
  hydrated: boolean;
  recentSessions: SportSession[];
  logSportSession: (entry: SportSession) => void;
};

const SportThemeContext = createContext<SportThemeContextValue | undefined>(
  undefined
);

const STORAGE_KEY = "immortalk:selectedSport";
const FAVORITES_KEY = "immortalk:favorites";
const SESSIONS_KEY = "immortalk:recentSessions";

async function safeSetItem(key: string, value: string | null) {
  try {
    if (value === null) {
      await AsyncStorage.removeItem(key);
    } else {
      await AsyncStorage.setItem(key, value);
    }
  } catch (e) {
    console.log("SPORT THEME STORAGE ERROR", key, e);
  }
}

export function SportThemeProvider({ children }: { children: React.ReactNode }) {
  const [activeSport, setActiveSportState] = useState<string | null>(null);
  const [favoriteSports, setFavoriteSports] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const hydrationRef = useRef(false);
  const [recentSessions, setRecentSessions] = useState<SportSession[]>([]);

  useEffect(() => {
    let mounted = true;
    const hydrate = async () => {
      try {
        const entries = await AsyncStorage.multiGet([
          STORAGE_KEY,
          FAVORITES_KEY,
          SESSIONS_KEY,
        ]);
        const storedSport = entries[0]?.[1];
        const storedFavorites = entries[1]?.[1];
        const storedSessions = entries[2]?.[1];
        if (!mounted) return;
        setActiveSportState(storedSport || null);
        if (storedFavorites) {
          try {
            const parsed = JSON.parse(storedFavorites);
            if (Array.isArray(parsed)) {
              setFavoriteSports(parsed.filter((s) => typeof s === "string"));
            }
          } catch (err) {
            console.log("SPORT THEME FAVORITES PARSE ERROR", err);
          }
        }
        if (storedSessions) {
          try {
            const parsedSessions = JSON.parse(storedSessions);
            if (Array.isArray(parsedSessions)) {
              setRecentSessions(
                parsedSessions
                  .filter(
                    (entry) =>
                      entry &&
                      typeof entry.sport === "string" &&
                      typeof entry.timestamp === "string"
                  )
                  .slice(0, 10)
              );
            }
          } catch (err) {
            console.log("SPORT THEME SESSIONS PARSE ERROR", err);
          }
        }
      } finally {
        if (mounted) {
          setHydrated(true);
          hydrationRef.current = true;
        }
      }
    };
    hydrate();
    return () => {
      mounted = false;
    };
  }, []);

  const persistFavorites = useCallback(async (favorites: string[]) => {
    try {
      await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    } catch (e) {
      console.log("SPORT THEME FAVORITES PERSIST ERROR", e);
    }
  }, []);

  const persistSessions = useCallback(async (sessions: SportSession[]) => {
    try {
      await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    } catch (e) {
      console.log("SPORT THEME SESSION PERSIST ERROR", e);
    }
  }, []);

  const updateFavorites = useCallback(
    (next: string[]) => {
      setFavoriteSports(next);
      persistFavorites(next);
    },
    [persistFavorites]
  );

  const toggleFavorite = useCallback(
    (sport: string) => {
      setFavoriteSports((prev) => {
        const exists = prev.includes(sport);
        const updated = exists ? prev.filter((s) => s !== sport) : [...prev, sport];
        persistFavorites(updated);
        if (!exists) {
          scheduleFavoriteSportPing(sport).catch(() => {});
        }
        return updated;
      });
    },
    [persistFavorites]
  );

  const setActiveSport = useCallback((sport: string | null) => {
    setActiveSportState(sport);
    safeSetItem(STORAGE_KEY, sport).catch(() => {});
  }, []);

  const logSportSession = useCallback(
    (entry: SportSession) => {
      if (!entry?.sport) return;
      setRecentSessions((prev) => {
        const filtered = prev.filter(
          (item) => !item || item.timestamp !== entry.timestamp
        );
        const next = [entry, ...filtered].slice(0, 10);
        persistSessions(next);
        return next;
      });
    },
    [persistSessions]
  );

  const palette = useMemo(
    () => getSportPalette(activeSport || undefined),
    [activeSport]
  );

  const value = useMemo(
    () => ({
      activeSport,
      setActiveSport,
      palette,
      favoriteSports,
      updateFavorites,
      toggleFavorite,
      hydrated,
      recentSessions,
      logSportSession,
    }),
    [
      activeSport,
      setActiveSport,
      palette,
      favoriteSports,
      updateFavorites,
      toggleFavorite,
      hydrated,
      recentSessions,
      logSportSession,
    ]
  );

  return (
    <SportThemeContext.Provider value={value}>
      {children}
    </SportThemeContext.Provider>
  );
}

export function useSportTheme(sportOverride?: string | null) {
  const ctx = useContext(SportThemeContext);
  if (!ctx) {
    throw new Error("useSportTheme must be used within SportThemeProvider");
  }
  const resolvedSport =
    typeof sportOverride === "string" && sportOverride.length > 0
      ? sportOverride
      : ctx.activeSport;
  const palette = useMemo(
    () => getSportPalette(resolvedSport || undefined),
    [resolvedSport]
  );

  return {
    ...ctx,
    resolvedSport,
    palette,
  };
}
