export type Badge = {
  id: string;
  label: string;
  description: string;
  tone: "gold" | "silver" | "bronze" | "neutral";
};

type BadgeInput = {
  challenges: number;
  responses: number;
  wins: number;
  votesReceived: number;
};

export const getBadges = ({
  challenges,
  responses,
  wins,
  votesReceived,
}: BadgeInput): Badge[] => {
  const badges: Badge[] = [];

  if (challenges >= 1) {
    badges.push({
      id: "starter",
      label: "Starter",
      description: "Premier défi publié",
      tone: "bronze",
    });
  }
  if (challenges >= 5) {
    badges.push({
      id: "creator",
      label: "Créateur",
      description: "5 défis ou plus",
      tone: "silver",
    });
  }
  if (responses >= 5) {
    badges.push({
      id: "challenger",
      label: "Challenger",
      description: "5 réponses postées",
      tone: "silver",
    });
  }
  if (wins >= 1) {
    badges.push({
      id: "winner",
      label: "Winner",
      description: "A déjà gagné un vote",
      tone: "gold",
    });
  }
  if (votesReceived >= 30) {
    badges.push({
      id: "popular",
      label: "Populaire",
      description: "30 votes reçus",
      tone: "gold",
    });
  }

  if (badges.length === 0) {
    badges.push({
      id: "rookie",
      label: "Rookie",
      description: "Nouveau sur l'arène",
      tone: "neutral",
    });
  }

  return badges.slice(0, 6);
};