export function getFairPlayTier(score: number) {
  if (score >= 90) return { label: "Legend", color: "#22c55e" };
  if (score >= 75) return { label: "Clean Fighter", color: "#84cc16" };
  if (score >= 60) return { label: "Surveillance", color: "#facc15" };
  return { label: "Danger", color: "#ef4444" };
}
