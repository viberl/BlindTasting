import { ScoringRule } from "@shared/schema";

const DEFAULT_ERROR_MESSAGE = "Fehler beim Laden der Bewertungsregeln";

export async function fetchScoringRules(
  tastingId: number,
): Promise<ScoringRule | null> {
  if (!Number.isFinite(tastingId) || tastingId <= 0) {
    throw new Error("Ungültige Tasting-ID für Bewertungsregeln");
  }

  const res = await fetch(`/api/tastings/${tastingId}/scoring`, {
    credentials: "include",
  });

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || DEFAULT_ERROR_MESSAGE);
  }

  return res.json();
}
