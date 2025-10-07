import { useEffect, useMemo } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Leaderboard from '@/components/tasting/leaderboard';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import RankedAvatar from '@/components/tasting/ranked-avatar';
import { Heart } from 'lucide-react';
import { useFavoriteWines, makeFavoriteKey } from '@/hooks/use-favorite-wines';
import { getWineLink, LinkableWine } from '@/lib/wine-link-utils';

type Participant = {
  id: number;
  tastingId: number;
  userId: number;
  score: number;
  user: { id: number; name: string };
};

type ScoringRule = {
  tastingId: number;
  country: number;
  region: number;
  producer: number;
  wineName: number;
  vintage: number;
  varietals: number;
  displayCount?: number | null;
  anyVarietalPoint?: boolean;
};

type FlightTopScorerResponse = {
  tastingId: number;
  flights: Array<{
    flightId: number;
    orderIndex?: number | null;
    name?: string | null;
    topScorer: null | {
      participantId: number;
      userId: number;
      name: string;
      company?: string | null;
      profileImage?: string | null;
      totalScore: number;
    };
  }>;
};

const formatFlightDisplayName = (orderIndex?: number | null, name?: string | null) => {
  const numericOrder = Number(orderIndex);
  const hasValidOrder = Number.isFinite(numericOrder);
  const defaultName = hasValidOrder ? `Flight ${numericOrder + 1}` : 'Flight';
  if (!name || !name.trim()) return defaultName;
  const trimmed = name.trim();
  if (trimmed.toLowerCase() === defaultName.toLowerCase()) return defaultName;
  return `${defaultName} – ${trimmed}`;
};

export default function FinalResults() {
  const { id } = useParams<{ id: string }>();
  const tastingId = parseInt(id);
  const [_, navigate] = useLocation();
  const { user } = useAuth();
  const { toggleFavorite, isFavorite } = useFavoriteWines();

  const { data: participants } = useQuery<Participant[]>({
    queryKey: [`/api/tastings/${tastingId}/participants`],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/tastings/${tastingId}/participants`);
      if (!res.ok) throw new Error('Teilnehmer konnten nicht geladen werden');
      return res.json();
    },
    enabled: !isNaN(tastingId),
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
  const { data: scoring } = useQuery<ScoringRule>({
    queryKey: [`/api/tastings/${tastingId}/scoring`],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/tastings/${tastingId}/scoring`);
      if (!res.ok) throw new Error('Scoring konnte nicht geladen werden');
      return res.json();
    },
    enabled: !isNaN(tastingId),
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
  const { data: flights } = useQuery<any[]>({
    queryKey: [`/api/tastings/${tastingId}/flights`],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/tastings/${tastingId}/flights`);
      if (!res.ok) throw new Error('Flights konnten nicht geladen werden');
      return res.json();
    },
    enabled: !isNaN(tastingId),
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const totalWines = useMemo(() => (flights ? flights.reduce((sum, f) => sum + (f.wines?.length || 0), 0) : 0), [flights]);
  const maxPointsPerWine = (scoring?.country ?? 0) + (scoring?.region ?? 0) + (scoring?.producer ?? 0) + (scoring?.wineName ?? 0) + (scoring?.vintage ?? 0) + (scoring?.varietals ?? 0);
  const maxPoints = totalWines * maxPointsPerWine;

  const me = participants?.find(p => (p as any).userId === user?.id || p.user?.id === user?.id);
  const sorted = participants ? [...participants].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)) : [];
  const rank = me ? sorted.findIndex(p => ((p as any).userId === (me as any).userId) || (p.user?.id === (me as any).user?.id)) + 1 : null;

  // Für Weine + eigene Tipps
  const { data: myParticipant } = useQuery<Participant | undefined>({
    queryKey: [`/api/tastings/${tastingId}/participant/self`],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/tastings/${tastingId}/participants`);
      const list: Participant[] = await res.json();
      return list.find(p => (p as any).userId === user?.id || p.user?.id === user?.id);
    },
    enabled: !!user?.id && !isNaN(tastingId),
  });

  type Guess = { id: number; wineId: number; score: number; wine?: any; [k: string]: any };
  const { data: myGuesses } = useQuery<Guess[]>({
    queryKey: myParticipant ? [`/api/participants/${myParticipant.id}/guesses`] : ['none'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/participants/${myParticipant!.id}/guesses`);
      if (!res.ok) throw new Error('Tipps konnten nicht geladen werden');
      return res.json();
    },
    enabled: !!myParticipant,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 0,
    refetchInterval: 2000,
  });

  const { data: flightTopScorers } = useQuery<FlightTopScorerResponse>({
    queryKey: [`/api/tastings/${tastingId}/flight-top-scorers`],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/tastings/${tastingId}/flight-top-scorers`);
      if (!res.ok) throw new Error('Flight-Top-Scorer konnten nicht geladen werden');
      return res.json();
    },
    enabled: !isNaN(tastingId),
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  // Sofort aktualisieren, wenn Server Scores pusht
  useEffect(() => {
    if (!tastingId) return;
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${protocol}://${window.location.host}/ws/join?t=${tastingId}`);
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg?.type === 'scores_updated' || msg?.type === 'flight_completed') {
          queryClient.invalidateQueries({ queryKey: [`/api/tastings/${tastingId}/participants`] });
          queryClient.invalidateQueries({ queryKey: [`/api/tastings/${tastingId}/flights`] });
          queryClient.invalidateQueries({ queryKey: [`/api/tastings/${tastingId}/scoring`] });
          queryClient.invalidateQueries({ queryKey: [`/api/tastings/${tastingId}/participant/self`] });
          // Invalidate all participant guesses queries to be safe (works across tabs/windows)
          queryClient.invalidateQueries({ predicate: (q) => {
            const k = q.queryKey as any;
            const s = Array.isArray(k) ? k.join('|') : String(k);
            return s.includes('/api/participants/') && s.includes('/guesses');
          }});
          // Proaktiv alle aktiven Guess-Queries refetchen
          queryClient.refetchQueries({ predicate: (q) => {
            const k = q.queryKey as any;
            const s = Array.isArray(k) ? k.join('|') : String(k);
            return s.includes('/api/participants/') && s.includes('/guesses');
          }});
        }
      } catch {}
    };
    return () => { try { ws.close(); } catch {} };
  }, [tastingId]);

  return (
    <div className="container mx-auto py-10 px-4 max-w-5xl space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Endergebnis</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="p-4 rounded border bg-gray-50 text-center">
            <div className="text-sm text-gray-600">Ihre Platzierung</div>
            <div className="text-4xl font-bold text-[#274E37] mt-1">{rank ?? '-'}</div>
          </div>
          <div className="p-4 rounded border bg-gray-50 text-center">
            <div className="text-sm text-gray-600">Ihre Punkte</div>
            <div className="text-4xl font-bold mt-1">{me?.score ?? 0}</div>
          </div>
          <div className="p-4 rounded border bg-gray-50 text-center">
            <div className="text-sm text-gray-600">Max. Punkte</div>
            <div className="text-4xl font-bold mt-1">{maxPoints}</div>
          </div>
        </CardContent>
      </Card>

      <Leaderboard tastingId={tastingId} displayCount={scoring?.displayCount ?? null} currentUserId={user?.id ?? undefined} />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Beste*r Verkoster*in je Flight</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(flightTopScorers?.flights?.length ?? 0) === 0 ? (
            <p className="text-sm text-gray-500">Noch keine Auswertung verfügbar.</p>
          ) : (
            flightTopScorers!.flights.map((entry) => {
              const label = formatFlightDisplayName(entry.orderIndex, entry.name);
              const top = entry.topScorer;
              const isCurrentUser = top?.userId === user?.id;
              return (
                <div key={entry.flightId} className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-gray-700">{label}</p>
                    <Badge className={top ? 'bg-[#274E37] text-white' : 'bg-gray-200 text-gray-700'}>
                      {top ? `${top.totalScore} Pkt` : '—'}
                    </Badge>
                  </div>
                  {top ? (
                    <div
                      className={`p-3 rounded-md border flex items-center space-x-3 ${
                        isCurrentUser ? 'ring-2 ring-[#274E37] ring-opacity-50 bg-[#FFF9DB]' : 'bg-gray-50'
                      }`}
                    >
                      <RankedAvatar
                        imageUrl={top.profileImage}
                        name={top.name}
                        rank={1}
                        sizeClass="h-12 w-12"
                      />
                      <div className="flex-1">
                        <p className="font-medium">
                          {top.name}
                          {isCurrentUser && <span className="ml-2 text-xs">(Sie)</span>}
                        </p>
                        <p className="text-xs opacity-70">
                          {top.company?.trim() || 'Unternehmen unbekannt'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">Keine Auswertung für diesen Flight.</p>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Ihre Tipps je Wein</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {flights?.map((f) => (
            <div key={f.id}>
              <h3 className="text-base font-semibold text-gray-800 mb-2">{f.name}</h3>
              <div className="space-y-3">
                {(f.wines || []).map((wine: any) => {
                  const g = myGuesses?.find(x => x.wineId === wine.id);
                  const r = scoring || { country: 0, region: 0, producer: 0, wineName: 0, vintage: 0, varietals: 0, anyVarietalPoint: true } as ScoringRule;
                  const norm = (s?: string | null) => (s ?? '').toString().trim().toLowerCase();
                  const eqTxt = (a?: string | null, b?: string | null) => norm(a) === norm(b);
                  const eqVintage = (a?: string | null, b?: string | null) => {
                    const aa = (a ?? '').toString().trim();
                    const bb = (b ?? '').toString().trim();
                    return aa === bb || Number(aa) === Number(bb);
                  };
                  let varietalMatches: boolean[] = [];
                  let baseFields = { country: false, region: false, producer: false, name: false, vintage: false, varietals: false } as any;
                  if (g) {
                    baseFields = {
                      country: !!(g.country && r.country > 0 && eqTxt(wine.country, g.country)),
                      region: !!(g.region && r.region > 0 && eqTxt(wine.region, g.region)),
                      producer: !!(g.producer && r.producer > 0 && eqTxt(wine.producer, g.producer)),
                      name: !!(g.name && r.wineName > 0 && eqTxt(wine.name, g.name)),
                      vintage: !!(g.vintage && r.vintage > 0 && eqVintage(wine.vintage, g.vintage)),
                      varietals: false,
                    };
                    const wineVars = (wine.varietals || []).map((v: string) => v.toLowerCase());
                    const guessVars = (g.varietals || []).map((v: string) => v.toLowerCase());
                    varietalMatches = guessVars.map((v: string) => wineVars.includes(v));
                    if (r.varietals > 0) {
                      if (r.anyVarietalPoint) {
                        baseFields.varietals = varietalMatches.some(Boolean);
                      } else {
                        const gw = guessVars.slice().sort();
                        const ww = wineVars.slice().sort();
                        baseFields.varietals = gw.length === ww.length && gw.every((v: string, i: number) => v === ww[i]);
                      }
                    }
                  }
                  // apply override flags if present
                  const flags = (g as any)?.overrideFlags || {};
                  const add: string[] = flags.add || [];
                  const remove: string[] = flags.remove || [];
                  const varietalAdd: string[] = flags.varietalAdd || [];
                  const varietalRemove: string[] = flags.varietalRemove || [];
                  const isActive = (key: 'country'|'region'|'producer'|'name'|'vintage'|'varietals') => {
                    const base = !!(baseFields as any)[key];
                    if (remove.includes(key)) return false;
                    if (add.includes(key)) return true;
                    return base;
                  };
                  const varietalActive = (index: number, label: string) => {
                    const base = !!(varietalMatches[index]);
                    if (varietalRemove.includes(label)) return false;
                    if (varietalAdd.includes(label)) return true;
                    return base;
                  };
                  const label = `${wine.producer ?? ''} ${wine.name ?? ''}`.trim() || wine.name || 'Wein';
                  const vinaturelUrl = getWineLink(wine as LinkableWine, label);
                  const favoriteKey = makeFavoriteKey(tastingId, wine.id);
                  const favorite = isFavorite(favoriteKey);
                  return (
                    <div key={wine.id} className="p-3 rounded border bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <span className="h-7 w-7 mr-2 flex items-center justify-center rounded-full bg-[#274E37] text-white">
                            {wine.letterCode}
                          </span>
                          <div>
                            {vinaturelUrl ? (
                              <a
                                href={vinaturelUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium block text-[#274E37] hover:text-[#e65b2d] hover:underline"
                              >
                                {label}
                              </a>
                            ) : (
                              <div className="font-medium">{wine.producer} {wine.name}</div>
                            )}
                            <div className="text-sm text-gray-600">{wine.region}, {wine.country}, {wine.vintage}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggleFavorite(favoriteKey)}
                            className={`h-8 w-8 flex items-center justify-center transition-colors ${
                              favorite ? 'text-[#e65b2d]' : 'text-gray-300 hover:text-[#e65b2d]'
                            }`}
                            aria-pressed={favorite}
                            aria-label={favorite ? 'Favorit entfernen' : 'Als Favorit markieren'}
                          >
                            <Heart className={`h-5 w-5 ${favorite ? 'fill-[#e65b2d]' : 'fill-transparent'}`} />
                          </button>
                          <Badge className="bg-[#274E37]" >{g?.score ?? 0} Pkt</Badge>
                        </div>
                      </div>
                      {g ? (
                        <div className="mt-2 text-sm">
                          <div className="font-medium mb-1">Ihr Tipp</div>
                          <div className="flex flex-wrap">
                            {['country','region','producer','name','vintage'].map((k) => {
                              const key = k as 'country'|'region'|'producer'|'name'|'vintage';
                              const label = (g as any)[key] || '-';
                              const ok = isActive(key);
                              return (
                                <span key={k} className={`text-xs mr-2 mb-2 inline-flex items-center px-2 py-1 rounded border ${ok ? 'bg-green-100 border-green-300 text-green-800' : 'bg-orange-100 border-orange-300 text-orange-800'}`}>
                                  {label}
                                </span>
                              );
                            })}
                            {r?.anyVarietalPoint
                              ? ((g.varietals || []).map((v: string, i: number) => {
                                  const ok = varietalActive(i, v);
                                  return (
                                    <span key={v+String(i)} className={`text-xs mr-2 mb-2 inline-flex items-center px-2 py-1 rounded border ${ok ? 'bg-green-100 border-green-300 text-green-800' : 'bg-orange-100 border-orange-300 text-orange-800'}`}>
                                      {v}
                                    </span>
                                  );
                                }))
                              : (
                                <span className={`text-xs mr-2 mb-2 inline-flex items-center px-2 py-1 rounded border ${isActive('varietals') ? 'bg-green-100 border-green-300 text-green-800' : 'bg-orange-100 border-orange-300 text-orange-800'}`}>
                                  {g.varietals && g.varietals.length ? g.varietals.join(', ') : '-'}
                                </span>
                              )
                            }
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2 text-sm text-gray-500">Kein Tipp abgegeben</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="text-center">
        <Button onClick={() => navigate('/')} className="bg-[#274E37] hover:bg-[#e65b2d]">Zur Startseite</Button>
      </div>
    </div>
  );
}
