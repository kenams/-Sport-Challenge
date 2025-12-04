import { Challenge } from "../types";

export type SportDomain = {
  key: string;
  label: string;
  tagline: string;
  paletteKey: string;
};

type DomainConfig = SportDomain & { matchers: string[] };

const DOMAIN_CONFIGS: DomainConfig[] = [
  {
    key: "basket",
    label: "Basket",
    tagline: "Impact orange",
    paletteKey: "basket",
    matchers: ["basket", "nba"],
  },
  {
    key: "aqua",
    label: "Aquatique",
    tagline: "Precision bleue",
    paletteKey: "piscine",
    matchers: ["swim", "piscine", "aqua", "nage"],
  },
  {
    key: "muscu",
    label: "Musculation",
    tagline: "Acier et sueur",
    paletteKey: "muscu",
    matchers: ["push", "muscu", "workout", "fitness", "cross", "bench"],
  },
  {
    key: "course",
    label: "Course",
    tagline: "Flow rapide",
    paletteKey: "running",
    matchers: ["run", "course", "sprint"],
  },
  {
    key: "endurance",
    label: "Endurance",
    tagline: "Stamina supreme",
    paletteKey: "velo",
    matchers: ["velo", "bike", "cycling"],
  },
];

const DEFAULT_DOMAIN: SportDomain = {
  key: "default",
  label: "Libre",
  tagline: "Style freestyle",
  paletteKey: "default",
};

export const getSportDomain = (sport?: string): SportDomain => {
  if (!sport) return DEFAULT_DOMAIN;
  const s = sport.toLowerCase();
  const domain =
    DOMAIN_CONFIGS.find((config) =>
      config.matchers.some((matcher) => s.includes(matcher))
    ) || DEFAULT_DOMAIN;
  return domain;
};

export type ChallengeSection = {
  key: string;
  domain: SportDomain;
  data: Challenge[];
};

export const groupChallengesByDomain = (
  list: Challenge[]
): ChallengeSection[] => {
  const map = new Map<string, ChallengeSection>();

  list.forEach((challenge) => {
    const domain = getSportDomain(challenge.sport);
    if (!map.has(domain.key)) {
      map.set(domain.key, { key: domain.key, domain, data: [] });
    }
    map.get(domain.key)!.data.push(challenge);
  });

  return Array.from(map.values()).sort((a, b) =>
    a.domain.label.localeCompare(b.domain.label)
  );
};
