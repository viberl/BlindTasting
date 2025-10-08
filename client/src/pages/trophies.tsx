import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { canonicalizeCountry, canonicalizeRegion } from "@/lib/geo-normalize";

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const normalizeVarietals = (value: unknown): string[] => {
  if (!value) return [];

  const mapValues = (items: unknown[]): string[] =>
    items
      .map((item) => (typeof item === "string" ? item : String(item ?? "")))
      .map(normalizeText)
      .filter(Boolean);

  if (Array.isArray(value)) {
    return mapValues(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return mapValues(parsed);
      }
    } catch {}

    return mapValues(trimmed.split(","));
  }

  return [];
};

type TrophyDefinition = {
  id: "firstSip" | "terroirTalent" | "varietalRanger";
  title: string;
  description: string;
  icon: string;
};

type TrophyWithState = TrophyDefinition & { earned: boolean };

type TastingOverviewResponse = {
  participating?: unknown[];
};

const BASE_TROPHIES: TrophyDefinition[] = [
  {
    id: "firstSip",
    title: "Erster Schluck",
    description: "Erste Verkostung abgeschlossen",
    icon: "/badges/ersterschluck.png",
  },
  {
    id: "terroirTalent",
    title: "Terroir-Talent",
    description: "5 Regionen richtig erkannt",
    icon: "/badges/terroirtalent.png",
  },
  {
    id: "varietalRanger",
    title: "Rebsorten-Ranger",
    description: "5 Rebsorten erkannt",
    icon: "/badges/rebsortenranger.png",
  },
];

export default function TrophiesPage() {
  const { user } = useAuth();
  const [regionCorrectCount, setRegionCorrectCount] = useState(0);
  const [varietalCorrectCount, setVarietalCorrectCount] = useState(0);
  const [isProgressLoading, setIsProgressLoading] = useState(false);
  const [progressError, setProgressError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery<TastingOverviewResponse>({
    queryKey: ["/api/tastings", "trophies"],
    enabled: !!user,
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/tastings");
      if (!response.ok) {
        throw new Error("Tastings konnten nicht geladen werden");
      }
      return response.json();
    },
  });

  const participatedCount = Array.isArray(data?.participating) ? data!.participating!.length : 0;
  const participating = Array.isArray(data?.participating) ? data.participating : [];
  const participatingIds = useMemo(
    () =>
      participating
        .map((t: any) => t?.id)
        .filter((id): id is number | string => id !== null && id !== undefined),
    [participating],
  );
  const participatingKey = participatingIds.join("|");

  const userId = user?.id ?? null;

  useEffect(() => {
    let isActive = true;

    const fetchRegionStats = async () => {
      if (!userId || participatingIds.length === 0) {
        if (isActive) {
          setRegionCorrectCount(0);
          setVarietalCorrectCount(0);
          setProgressError(null);
        }
        return;
      }

      setIsProgressLoading(true);
      setProgressError(null);

      try {
        let totalRegionCorrect = 0;
        const varietalMatches = new Set<string>();

        for (const tastingId of participatingIds) {
          try {
            const participantsRes = await apiRequest("GET", `/api/tastings/${tastingId}/participants`);
            if (!participantsRes.ok) continue;
            const participantsList: any[] = await participantsRes.json();
            const me = participantsList.find(
              (p) => (p?.userId ?? p?.user?.id) === userId,
            );
            if (!me) continue;

            const guessesRes = await apiRequest("GET", `/api/participants/${me.id}/guesses`);
            if (!guessesRes.ok) continue;
            const guesses: any[] = await guessesRes.json();

            totalRegionCorrect += guesses.reduce((count, guess) => {
              const wine = guess?.wine ?? {};
              const guessRegion = guess?.region;
              if (!guessRegion) return count;

              const norm = (value?: string | null) => (value ?? "").toString().trim().toLowerCase();
              const eqText = (a?: string | null, b?: string | null) => norm(a) === norm(b);

              const baseCountry =
                canonicalizeCountry(wine?.country) ?? canonicalizeCountry(guess?.country);
              const actualRegion = canonicalizeRegion(wine?.region, baseCountry ?? undefined);
              const guessedRegion = canonicalizeRegion(guessRegion, baseCountry ?? undefined);

              const isMatch = actualRegion && guessedRegion
                ? actualRegion === guessedRegion
                : eqText(wine?.region, guessRegion);

              return isMatch ? count + 1 : count;
            }, 0);

            guesses.forEach((guess) => {
              const wineVarietalsRaw = normalizeVarietals(guess?.wine?.varietals);
              const guessVarietalsRaw = normalizeVarietals(guess?.varietals);
              if (wineVarietalsRaw.length === 0 || guessVarietalsRaw.length === 0) {
                return;
              }

              const wineSet = new Set(wineVarietalsRaw);
              for (const varietal of new Set(guessVarietalsRaw)) {
                if (wineSet.has(varietal)) {
                  varietalMatches.add(varietal);
                }
              }
            });
          } catch (innerError) {
            console.warn("Fehler beim Ermitteln der Trophäen-Fortschritte:", innerError);
          }
        }

        if (isActive) {
          setRegionCorrectCount(totalRegionCorrect);
          setVarietalCorrectCount(varietalMatches.size);
        }
      } catch (error) {
        console.error("Fehler beim Laden der Trophäen-Fortschritte:", error);
        if (isActive) {
          setProgressError("Fehler beim Laden der Fortschrittsdaten");
        }
      } finally {
        if (isActive) {
          setIsProgressLoading(false);
        }
      }
    };

    fetchRegionStats();

    return () => {
      isActive = false;
    };
  }, [userId, participatingKey]);

  const trophies: TrophyWithState[] = BASE_TROPHIES.map((trophy) => ({
    ...trophy,
    earned:
      trophy.id === "firstSip"
        ? participatedCount > 0
        : trophy.id === "terroirTalent"
          ? regionCorrectCount >= 5
          : trophy.id === "varietalRanger"
            ? varietalCorrectCount >= 5
            : false,
  }));

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="space-y-2 text-center">
          <h1 className="text-3xl font-bold text-[#274E37]">Trophäenregal</h1>
          <p className="text-gray-600">
            {user?.name
              ? `${user.name}, hier findest du alle Badges, die du sammeln kannst.`
              : "Sammle Badges für besondere Blindverkostungs-Momente."}
          </p>
        </header>

        <section className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {(isLoading || isProgressLoading) && (
            <article className="border border-dashed border-gray-200 rounded-lg p-3 shadow-sm bg-white flex flex-col items-center justify-center gap-1.5 aspect-square text-xs text-gray-500">
              Lädt …
            </article>
          )}

          {isError && !isLoading && (
            <article className="border border-red-200 rounded-lg p-3 shadow-sm bg-white flex flex-col items-center justify-center gap-1.5 aspect-square text-xs text-red-500">
              Fehler beim Laden
            </article>
          )}

          {progressError && !isProgressLoading && (
            <article className="border border-red-200 rounded-lg p-3 shadow-sm bg-white flex flex-col items-center justify-center gap-1.5 aspect-square text-xs text-red-500">
              {progressError}
            </article>
          )}

          {trophies.map(({ id, title, description, icon, earned }) => (
            <article
              key={id}
              className={
                `rounded-lg p-3 shadow-sm flex flex-col items-center justify-center gap-1.5 aspect-square transition-colors ` +
                (earned ? "border border-gray-200 bg-white" : "border border-gray-100 bg-gray-100 text-gray-400")
              }
            >
              <img
                src={icon}
                alt={title}
                className={`mx-auto h-20 w-20 ${earned ? '' : 'grayscale opacity-40'}`.trim()}
              />
              <div className="text-center space-y-0.5">
                <h2 className={`text-sm font-semibold ${earned ? "text-[#274E37]" : "text-gray-400"}`}>{title}</h2>
                <p className={`text-xs ${earned ? "text-gray-600" : "text-gray-300"}`}>{description}</p>
              </div>
            </article>
          ))}
        </section>

        {!user && (
          <p className="text-center text-xs text-gray-500">
            Melde dich an, um deinen Fortschritt zu sehen.
          </p>
        )}
      </div>
    </div>
  );
}
